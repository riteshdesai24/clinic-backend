const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const SuperAdmin = require('./models/SuperAdmin');
const User = require('../models/User');
const Plan = require('../models/Plan');
const TreatmentType = require('../models/TreatmentType');
const { Country, State, City } = require('./models/LocationMaster');
const LabMaster = require('./models/LabMaster');
const XLSX = require('xlsx');
const validatePassword = require('../utils/validatePassword');

const sendError = (res, error) => {
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'A record with these details already exists' });
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ success: false, message: error.message });
  console.error('Super Admin Error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};
const safeUser = (user) => {
  const result = user.toObject ? user.toObject() : user;
  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpire;
  return result;
};

exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'name, email and password are required' });
    if (!validatePassword(password)) return res.status(400).json({ success: false, message: 'Password must be 8+ characters with uppercase, lowercase, number and special character' });
    const existingAdmin = await SuperAdmin.exists({});
    if (existingAdmin) {
      if (!process.env.SUPER_ADMIN_REGISTRATION_KEY) return res.status(403).json({ success: false, message: 'Super admin registration is closed' });
      if (req.get('x-registration-key') !== process.env.SUPER_ADMIN_REGISTRATION_KEY) return res.status(403).json({ success: false, message: 'Invalid registration key' });
    }
    const admin = await SuperAdmin.create({ name, email, password: await bcrypt.hash(password, 12) });
    return res.status(201).json({ success: true, message: 'Super admin registered', data: { _id: admin._id, name: admin.name, email: admin.email } });
  } catch (error) { return sendError(res, error); }
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const admin = email && await SuperAdmin.findOne({ email }).select('+password');
    if (!admin || !(await bcrypt.compare(req.body.password || '', admin.password))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    if (!admin.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });
    const token = jwt.sign({ userId: admin._id, role: 'SUPER_ADMIN' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
    return res.json({ success: true, message: 'Login successful', token, user: { _id: admin._id, name: admin.name, email: admin.email, role: 'SUPER_ADMIN' } });
  } catch (error) { return sendError(res, error); }
};

// Clinics are represented by ADMIN users in the existing application.
exports.listClinics = async (req, res) => {
  try {
    const clinics = await User.find({ role: 'ADMIN' }).select('-password -resetPasswordToken -resetPasswordExpire').sort({ createdAt: -1 });
    return res.json({ success: true, data: clinics });
  } catch (error) { return sendError(res, error); }
};
exports.createClinic = async (req, res) => {
  try {
    const { clinicName, phone, plan = 'GOLD', password } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    if (!clinicName || !email || !password) return res.status(400).json({ success: false, message: 'clinicName, email and password are required' });
    if (!validatePassword(password)) return res.status(400).json({ success: false, message: 'Password must be 8+ characters with uppercase, lowercase, number and special character' });
    const clinic = await User.create({ clinicName, email, phone, plan, role: 'ADMIN', password: await bcrypt.hash(password, 12) });
    return res.status(201).json({ success: true, message: 'Clinic created successfully', data: safeUser(clinic) });
  } catch (error) { return sendError(res, error); }
};
exports.updateClinic = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid clinic id' });
    const allowed = ['clinicName', 'phone', 'email', 'plan', 'isActive'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (update.email) update.email = update.email.trim().toLowerCase();
    const clinic = await User.findOneAndUpdate({ _id: req.params.id, role: 'ADMIN' }, update, { new: true, runValidators: true }).select('-password -resetPasswordToken -resetPasswordExpire');
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });
    return res.json({ success: true, message: 'Clinic updated successfully', data: clinic });
  } catch (error) { return sendError(res, error); }
};
exports.deleteClinic = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid clinic id' });
    const clinic = await User.findOneAndUpdate({ _id: req.params.id, role: 'ADMIN' }, { isActive: false }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpire');
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });
    return res.json({ success: true, message: 'Clinic deactivated successfully', data: clinic });
  } catch (error) { return sendError(res, error); }
};

exports.listMemberships = async (req, res) => {
  try { return res.json({ success: true, data: await Plan.find().sort({ createdAt: -1 }) }); }
  catch (error) { return sendError(res, error); }
};
exports.createMembership = async (req, res) => {
  try { return res.status(201).json({ success: true, message: 'Membership created successfully', data: await Plan.create(req.body) }); }
  catch (error) { return sendError(res, error); }
};
exports.updateMembership = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid membership id' });
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Membership not found' });
    return res.json({ success: true, message: 'Membership updated successfully', data: plan });
  } catch (error) { return sendError(res, error); }
};
exports.deleteMembership = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid membership id' });
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Membership not found' });
    return res.json({ success: true, message: 'Membership deleted successfully' });
  } catch (error) { return sendError(res, error); }
};

const masters = { countries: Country, states: State, cities: City };
exports.listMaster = async (req, res) => {
  try {
    const Model = masters[req.params.type];
    if (!Model) return res.status(404).json({ success: false, message: 'Master not found' });
    return res.json({ success: true, data: await Model.find().sort({ name: 1 }) });
  } catch (error) { return sendError(res, error); }
};
exports.createMaster = async (req, res) => {
  try {
    const Model = masters[req.params.type];
    if (!Model) return res.status(404).json({ success: false, message: 'Master not found' });
    return res.status(201).json({ success: true, message: 'Record created successfully', data: await Model.create(req.body) });
  } catch (error) { return sendError(res, error); }
};
exports.updateMaster = async (req, res) => {
  try {
    const Model = masters[req.params.type];
    if (!Model) return res.status(404).json({ success: false, message: 'Master not found' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid record id' });
    const record = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    return res.json({ success: true, message: 'Record updated successfully', data: record });
  } catch (error) { return sendError(res, error); }
};
exports.deleteMaster = async (req, res) => {
  try {
    const Model = masters[req.params.type];
    if (!Model) return res.status(404).json({ success: false, message: 'Master not found' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid record id' });
    if (req.params.type === 'countries' && await State.exists({ country: req.params.id })) return res.status(409).json({ success: false, message: 'Delete this country’s states before deleting the country' });
    if (req.params.type === 'states' && await City.exists({ state: req.params.id })) return res.status(409).json({ success: false, message: 'Delete this state’s cities before deleting the state' });
    const record = await Model.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    return res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) { return sendError(res, error); }
};

const globalTreatmentQuery = (name) => ({ name, clinicId: null });
exports.listTreatments = async (req, res) => {
  try { return res.json({ success: true, data: await TreatmentType.find({ clinicId: null }).sort({ name: 1 }) }); }
  catch (error) { return sendError(res, error); }
};
exports.createTreatment = async (req, res) => {
  try {
    const { name, description, duration, price, status } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'name is required' });
    const data = await TreatmentType.create({ clinicId: null, name: name.trim(), description, duration, price, status });
    return res.status(201).json({ success: true, message: 'Treatment master created successfully', data });
  } catch (error) { return sendError(res, error); }
};
exports.updateTreatment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid treatment id' });
    const allowed = ['name', 'description', 'duration', 'price', 'status'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const data = await TreatmentType.findOneAndUpdate({ _id: req.params.id, clinicId: null }, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Treatment master not found' });
    return res.json({ success: true, message: 'Treatment master updated successfully', data });
  } catch (error) { return sendError(res, error); }
};
exports.deleteTreatment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid treatment id' });
    const data = await TreatmentType.findOneAndDelete({ _id: req.params.id, clinicId: null });
    if (!data) return res.status(404).json({ success: false, message: 'Treatment master not found' });
    return res.json({ success: true, message: 'Treatment master deleted successfully' });
  } catch (error) { return sendError(res, error); }
};

exports.listLabs = async (req, res) => {
  try { return res.json({ success: true, data: await LabMaster.find().sort({ name: 1 }) }); }
  catch (error) { return sendError(res, error); }
};
exports.createLab = async (req, res) => {
  try { return res.status(201).json({ success: true, message: 'Lab master created successfully', data: await LabMaster.create(req.body) }); }
  catch (error) { return sendError(res, error); }
};
exports.updateLab = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lab id' });
    const allowed = ['name', 'code', 'description', 'email', 'phone', 'address', 'isActive'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const data = await LabMaster.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Lab master not found' });
    return res.json({ success: true, message: 'Lab master updated successfully', data });
  } catch (error) { return sendError(res, error); }
};
exports.deleteLab = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lab id' });
    const data = await LabMaster.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Lab master not found' });
    return res.json({ success: true, message: 'Lab master deleted successfully' });
  } catch (error) { return sendError(res, error); }
};

const excelResources = {
  clinics: ['clinicName', 'email', 'password', 'phone', 'plan'],
  countries: ['name', 'code'],
  states: ['name', 'country'],
  cities: ['name', 'state', 'country'],
  memberships: ['name', 'price', 'durationMonths', 'staffAllowed', 'description', 'features'],
  treatments: ['name', 'description', 'duration', 'price', 'status'],
  labs: ['name', 'code', 'description', 'email', 'phone', 'address']
};
exports.downloadExcelTemplate = async (req, res) => {
  const fields = excelResources[req.params.resource];
  if (!fields) return res.status(404).json({ success: false, message: 'Unsupported Excel resource' });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([fields]);
  XLSX.utils.book_append_sheet(workbook, sheet, req.params.resource);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.resource}-template.xlsx"`);
  return res.send(buffer);
};

const normalizeExcelKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
const excelValue = (row, ...keys) => {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeExcelKey(key), value]));
  for (const key of keys) {
    const value = normalized.get(normalizeExcelKey(key));
    if (value !== undefined && String(value).trim() !== '') return typeof value === 'string' ? value.trim() : value;
  }
  return undefined;
};
const boolValue = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1', 'allowed'].includes(String(value).trim().toLowerCase());
};
const findNamed = async (Model, name, extra = {}) => Model.findOne({ ...extra, name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

exports.importExcel = async (req, res) => {
  try {
    const { resource } = req.params;
    if (!excelResources[resource]) return res.status(404).json({ success: false, message: 'Unsupported Excel resource' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Attach an .xlsx or .xls file in the file field' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ success: false, message: 'Workbook has no worksheet' });
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!rows.length) return res.status(400).json({ success: false, message: 'Worksheet contains no data rows' });
    if (rows.length > 5000) return res.status(400).json({ success: false, message: 'A maximum of 5000 rows can be imported at once' });

    const result = { resource, total: rows.length, created: 0, updated: 0, failed: 0, errors: [] };
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const name = excelValue(row, 'name');
        let Model;
        let filter;
        let data;
        if (resource === 'clinics') {
          const clinicName = excelValue(row, 'clinicName', 'name');
          const email = excelValue(row, 'email')?.toLowerCase();
          const password = excelValue(row, 'password');
          if (!clinicName || !email) throw new Error('clinicName and email are required');
          if (password && !validatePassword(String(password))) throw new Error('password must be 8+ characters with uppercase, lowercase, number and special character');
          Model = User; filter = { email, role: 'ADMIN' };
          if (!password && !(await User.exists(filter))) throw new Error('password is required for a new clinic');
          data = { clinicName, email, phone: excelValue(row, 'phone'), plan: excelValue(row, 'plan') || 'GOLD', role: 'ADMIN' };
          if (password) data.password = await bcrypt.hash(String(password), 12);
        } else if (resource === 'countries') {
          if (!name) throw new Error('name is required');
          Model = Country; filter = { name };
          data = { name, code: excelValue(row, 'code')?.toUpperCase() };
        } else if (resource === 'states') {
          if (!name) throw new Error('name is required');
          const countryName = excelValue(row, 'country', 'countryName');
          if (!countryName) throw new Error('country is required (country name)');
          const country = await findNamed(Country, countryName);
          if (!country) throw new Error(`Country not found: ${countryName}`);
          Model = State; filter = { name, country: country._id }; data = { name, country: country._id };
        } else if (resource === 'cities') {
          if (!name) throw new Error('name is required');
          const stateName = excelValue(row, 'state', 'stateName');
          const countryName = excelValue(row, 'country', 'countryName');
          if (!stateName || !countryName) throw new Error('state and country are required');
          const country = await findNamed(Country, countryName);
          if (!country) throw new Error(`Country not found: ${countryName}`);
          const state = await findNamed(State, stateName, { country: country._id });
          if (!state) throw new Error(`State not found: ${stateName} (${countryName})`);
          Model = City; filter = { name, state: state._id }; data = { name, state: state._id };
        } else if (resource === 'memberships') {
          if (!name) throw new Error('name is required');
          const price = Number(excelValue(row, 'price'));
          if (!Number.isFinite(price) || price < 0) throw new Error('price must be a non-negative number');
          const durationValue = excelValue(row, 'durationMonths');
          const durationMonths = durationValue === undefined ? 1 : Number(durationValue);
          if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 36) throw new Error('durationMonths must be a whole number between 1 and 36');
          Model = Plan; filter = { name: name.toUpperCase() };
          const featureCell = excelValue(row, 'features');
          const features = Array.isArray(featureCell)
            ? featureCell
            : (featureCell ? String(featureCell).split(/[|;\n]/).map((feature) => feature.trim()).filter(Boolean) : []);
          data = {
            name: name.toUpperCase(),
            price,
            durationMonths,
            staffAllowed: boolValue(excelValue(row, 'staffAllowed')),
            description: excelValue(row, 'description') || '',
            features
          };
        } else if (resource === 'treatments') {
          if (!name) throw new Error('name is required');
          const priceValue = excelValue(row, 'price');
          const durationValue = excelValue(row, 'duration');
          const price = priceValue === undefined ? undefined : Number(priceValue);
          const duration = durationValue === undefined ? undefined : Number(durationValue);
          if (price !== undefined && (!Number.isFinite(price) || price < 0)) throw new Error('price must be a non-negative number');
          if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) throw new Error('duration must be a non-negative number');
          Model = TreatmentType; filter = globalTreatmentQuery(name);
          data = { clinicId: null, name, description: excelValue(row, 'description'), duration, price, status: excelValue(row, 'status') || 'ACTIVE' };
        } else {
          if (!name) throw new Error('name is required');
          Model = LabMaster; filter = { name };
          data = { name, code: excelValue(row, 'code')?.toUpperCase(), description: excelValue(row, 'description'), email: excelValue(row, 'email'), phone: excelValue(row, 'phone'), address: excelValue(row, 'address') };
        }
        const prior = await Model.findOne(filter).select('_id');
        await Model.updateOne(filter, { $set: data }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
        if (prior) result.updated += 1; else result.created += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ row: index + 2, message: error.message });
      }
    }
    return res.status(result.failed ? 207 : 200).json({ success: result.failed === 0, message: 'Excel import finished', data: result });
  } catch (error) { return sendError(res, error); }
};
