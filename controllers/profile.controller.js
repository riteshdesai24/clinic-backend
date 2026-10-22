const User = require('../models/User');
const logger = require('../utils/logger');

const editableFields = {
  ADMIN: ['clinicName', 'phone', 'email'],
  STAFF: ['staffname', 'phone', 'email'],
  DOCTOR: ['staffname', 'phone', 'email', 'specialization']
};

const profileData = (user, hasClinicLogo = Boolean(user.logoContentType || user.logoUpdatedAt)) => {
  const { password, resetPasswordToken, resetPasswordExpire, logoContent, logoContentType, ...profile } = user.toObject();
  profile.logoUrl = hasClinicLogo ? '/api/profile/logo' : null;
  return profile;
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
    const hasClinicLogo = Boolean(await User.exists({ _id: logoOwnerId, logoContentType: { $exists: true } }));
    return res.json({ success: true, data: profileData(req.user, hasClinicLogo) });
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

    req.user.set(updates);
    if (req.file || dataUriLogo) {
      req.user.logoContentType = req.file ? req.file.mimetype : dataUriLogo.contentType;
      req.user.logoContent = req.file ? req.file.buffer : dataUriLogo.content;
      req.user.logoUpdatedAt = new Date();
    }
    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData(req.user)
    });
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

    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        logoContentType: req.file.mimetype,
        logoContent: req.file.buffer,
        logoUpdatedAt: new Date()
      },
      { new: true }
    ).select('+logoContentType +logoContent');

    return res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logoUrl: '/api/profile/logo', logoContentType: user.logoContentType, logoUpdatedAt: user.logoUpdatedAt }
    });
  } catch (err) {
    logger.error('Upload Logo Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Unable to upload logo' });
  }
};

exports.getLogo = async (req, res) => {
  try {
    const logoOwnerId = req.user.role === 'ADMIN' ? req.user._id : req.clinicId;
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
