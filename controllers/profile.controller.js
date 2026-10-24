const User = require('../models/User');
const Clinic = require('../models/Clinic');
const mongoose = require('mongoose');
const { Country, State, City } = require('../super-admin/models/LocationMaster');
const clinicApiResponse = require('../utils/clinicApiResponse');
const logger = require('../utils/logger');

const editableFields = {
  ADMIN: ['clinicName', 'phone', 'email', 'address1', 'address2', 'address3', 'country', 'state', 'city', 'pincode'],
  STAFF: ['staffname', 'phone', 'email'],
  DOCTOR: ['staffname', 'phone', 'email', 'specialization']
};

const hasLocationId = (body) => ['countryId', 'stateId', 'cityId'].some((field) => Object.hasOwn(body, field));

const parseLocationId = (body, field) => {
  if (!Object.hasOwn(body, field) || body[field] === null || body[field] === '') return null;
  if (typeof body[field] !== 'string' || !mongoose.isValidObjectId(body[field])) {
    throw new Error(`${field} must be a valid location autocomplete ID`);
  }
  return body[field];
};

const resolveLocationIds = async (body) => {
  const countryId = parseLocationId(body, 'countryId');
  const stateId = parseLocationId(body, 'stateId');
  const cityId = parseLocationId(body, 'cityId');

  const [selectedCountry, selectedState, selectedCity] = await Promise.all([
    countryId ? Country.findOne({ _id: countryId, isActive: true }).select('name') : null,
    stateId ? State.findOne({ _id: stateId, isActive: true }).select('name country') : null,
    cityId ? City.findOne({ _id: cityId, isActive: true }).select('name state') : null
  ]);
  if (countryId && !selectedCountry) throw new Error('Selected country was not found');
  if (stateId && !selectedState) throw new Error('Selected state was not found');
  if (cityId && !selectedCity) throw new Error('Selected city was not found');

  let resolvedState = selectedState;
  if (selectedCity) {
    const cityState = await State.findOne({ _id: selectedCity.state, isActive: true }).select('name country');
    if (!cityState) throw new Error('Selected city has no active state');
    if (resolvedState && String(resolvedState._id) !== String(cityState._id)) {
      throw new Error('Selected city does not belong to selected state');
    }
    resolvedState = cityState;
  }

  const resolvedCountryId = selectedCountry?._id || resolvedState?.country || null;
  if (selectedCountry && resolvedState && String(selectedCountry._id) !== String(resolvedState.country)) {
    throw new Error('Selected state does not belong to selected country');
  }
  const resolvedCountry = selectedCountry || (resolvedCountryId
    ? await Country.findOne({ _id: resolvedCountryId, isActive: true }).select('name')
    : null);
  if (resolvedCountryId && !resolvedCountry) throw new Error('Selected state has no active country');

  return {
    countryId: resolvedCountry?._id || null,
    country: resolvedCountry?.name || '',
    stateId: resolvedState?._id || null,
    state: resolvedState?.name || '',
    cityId: selectedCity?._id || null,
    city: selectedCity?.name || ''
  };
};

// Copy clinic profile values written by the previous Clinic-collection implementation
// into the User record created by registration. Profile reads and future writes then
// use the same record as registration.
const migrateLegacyClinicProfile = async (user) => {
  if (user.role !== 'ADMIN') return;
  let legacyClinic = await Clinic.collection.findOne({ ownerUserId: user._id });
  if (!legacyClinic) {
    const byEmail = await Clinic.collection.findOne({ email: user.email });
    if (!byEmail?.ownerUserId || String(byEmail.ownerUserId) === String(user._id)) legacyClinic = byEmail;
  }
  if (!legacyClinic) return;

  let changed = false;
  if (!user.clinicName && legacyClinic.name) { user.clinicName = legacyClinic.name; changed = true; }
  if (!user.phone && legacyClinic.phone) { user.phone = legacyClinic.phone; changed = true; }
  if (!user.email && legacyClinic.email) { user.email = legacyClinic.email; changed = true; }

  const legacyAddress = legacyClinic.address || {};
  const addressValues = {
    address1: legacyAddress.address1 || legacyAddress.street,
    address2: legacyAddress.address2,
    address3: legacyAddress.address3,
    country: legacyAddress.country,
    state: legacyAddress.state,
    city: legacyAddress.city,
    pincode: legacyAddress.pincode || legacyAddress.zip
  };
  for (const [field, value] of Object.entries(addressValues)) {
    if (typeof value === 'string' && value.trim() && !user[field]) {
      user[field] = value.trim();
      changed = true;
    }
  }

  const storedUser = await User.collection.findOne({ _id: user._id }, { projection: { logoContentType: 1 } });
  if (!storedUser?.logoContentType && legacyClinic.logoContentType && legacyClinic.logoContent) {
    user.logoContentType = legacyClinic.logoContentType;
    user.logoContent = legacyClinic.logoContent;
    user.logoUpdatedAt = legacyClinic.logoUpdatedAt || new Date();
    changed = true;
  }
  if (changed) await user.save();
};

const decodeClinicLogo = (dataUri) => {
  if (typeof dataUri !== 'string') return { error: 'clinicLogo must be an image data URI' };
  const match = dataUri.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return { error: 'clinicLogo must be a base64 PNG, JPEG, or WebP image' };

  const content = Buffer.from(match[2], 'base64');
  if (!content.length || content.length > 5 * 1024 * 1024 || content.toString('base64') !== match[2]) {
    return { error: 'Logo must be a valid image no larger than 5 MB' };
  }
  return { contentType: match[1], content };
};

exports.getCurrent = async (req, res) => {
  try {
    const logoOwnerId = req.user.role === 'ADMIN' ? req.user._id : req.clinicId;
    let clinicOwner = req.user.role === 'ADMIN' ? req.user : await User.findById(logoOwnerId);
    if (req.user.role === 'ADMIN') await migrateLegacyClinicProfile(req.user);
    else if (clinicOwner) await migrateLegacyClinicProfile(clinicOwner);
    if (req.user.role === 'ADMIN') clinicOwner = req.user;
    const logoOwner = await User.findById(logoOwnerId).select('+logoContentType +logoContent');
    return res.json(clinicApiResponse({ user: req.user, clinicOwner, logoOwner, message: 'Profile loaded successfully' }));
  } catch (err) {
    logger.error('Get Profile Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateCurrent = async (req, res) => {
  try {
    const hasDataUriLogo = Object.prototype.hasOwnProperty.call(req.body, 'clinicLogo') && req.body.clinicLogo !== '';
    if ((req.file || hasDataUriLogo) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only clinic admins can update the clinic logo' });
    }

    const dataUriLogo = hasDataUriLogo ? decodeClinicLogo(req.body.clinicLogo) : null;
    if (dataUriLogo?.error) {
      return res.status(400).json({ success: false, message: dataUriLogo.error });
    }

    const allowedFields = editableFields[req.user.role] || [];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== 'string') {
        return res.status(400).json({ success: false, message: `${field} must be a string` });
      }
      updates[field] = req.body[field].trim();
    }

    if (req.user.role === 'ADMIN' && hasLocationId(req.body)) {
      try {
        Object.assign(updates, await resolveLocationIds(req.body));
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    if (Object.keys(updates).length === 0 && !req.file && !dataUriLogo) {
      return res.status(400).json({ success: false, message: 'No editable profile fields provided' });
    }

    for (const field of ['email', 'clinicName', 'staffname']) {
      if (updates[field] !== undefined && !updates[field]) {
        return res.status(400).json({ success: false, message: `${field} cannot be empty` });
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      const existingUser = await User.exists({
        email: updates.email,
        _id: { $ne: req.user._id }
      });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
    }

    if (req.user.role === 'ADMIN') await migrateLegacyClinicProfile(req.user);
    req.user.set(updates);
    if (req.file || dataUriLogo) {
      req.user.logoContentType = req.file ? req.file.mimetype : dataUriLogo.contentType;
      req.user.logoContent = req.file ? req.file.buffer : dataUriLogo.content;
      req.user.logoUpdatedAt = new Date();
    }
    await req.user.save();

    const logoOwnerId = req.user.role === 'ADMIN' ? req.user._id : req.clinicId;
    let clinicOwner = req.user.role === 'ADMIN' ? req.user : await User.findById(logoOwnerId);
    if (req.user.role === 'ADMIN') clinicOwner = req.user;
    const logoOwner = await User.findById(logoOwnerId).select('+logoContentType +logoContent');
    return res.json(clinicApiResponse({ user: req.user, clinicOwner, logoOwner, message: 'Profile updated successfully' }));
  } catch (err) {
    logger.error('Update Profile Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.deactivateCurrent = async (req, res) => {
  try {
    req.user.isActive = false;
    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile deactivated successfully'
    });
  } catch (err) {
    logger.error('Deactivate Profile Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Select an image using the logo field' });
    }

    await migrateLegacyClinicProfile(req.user);
    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        logoContentType: req.file.mimetype,
        logoContent: req.file.buffer,
        logoUpdatedAt: new Date()
      },
      { new: true }
    ).select('+logoContentType +logoContent');

    return res.json(clinicApiResponse({
      user,
      clinicOwner: user,
      logoOwner: user,
      message: 'Logo uploaded successfully'
    }));
  } catch (err) {
    logger.error('Upload Logo Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Unable to upload logo' });
  }
};

exports.getLogo = async (req, res) => {
  try {
    const logoOwnerId = req.user.role === 'ADMIN' ? req.user._id : req.clinicId;
    const adminUser = req.user.role === 'ADMIN' ? req.user : await User.findById(logoOwnerId);
    if (adminUser) await migrateLegacyClinicProfile(adminUser);
    const user = await User.findById(logoOwnerId).select('+logoContentType +logoContent');
    if (!user?.logoContent) {
      return res.status(404).json({ success: false, message: 'Logo not found' });
    }

    res.set('Content-Type', user.logoContentType);
    res.set('Content-Length', user.logoContent.length);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(user.logoContent);
  } catch (err) {
    logger.error('Get Logo Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Unable to load logo' });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    await migrateLegacyClinicProfile(req.user);
    await User.updateOne(
      { _id: req.user._id },
      { $unset: { logoContentType: 1, logoContent: 1, logoUpdatedAt: 1 } }
    );
    return res.json({ success: true, message: 'Logo deleted successfully' });
  } catch (err) {
    logger.error('Delete Logo Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Unable to delete logo' });
  }
};
