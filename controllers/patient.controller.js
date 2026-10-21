const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Attachment = require('../models/Attachment');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { parseAutocompleteQuery } = require('../utils/autocomplete');

// Fields the client is allowed to set. Keeps req.body from silently writing
// clinicId, isActive, timestamps, etc. via a stray extra key.
const ALLOWED_FIELDS = [
  'title', 'firstName', 'middleName', 'lastName', 'suffix',
  'gender', 'dob', 'age', 'maritalStatus',

  'phone', 'email', 'whatsappNumber', 'otherMobile', 'workEmail',
  'landlineNumber', 'areaCode',
  'emergencyContactName', 'emergencyContactNumber',
  'spouseName', 'spouseContactNumber', 'generalPractitioner',

  'address1', 'address2', 'address3', 'locality', 'city', 'state',
  'country', 'pincode',

  'medicalAllergies', 'medicalConditions', 'dentalConditions',
  'currentMedications', 'allergicTo', 'habits',

  'insuranceCompany', 'insuranceSubCompany', 'insurancePolicy',
  'insuranceIdNumber',

  'language', 'religion', 'occupation', 'ethnicGroup', 'race',
  'bloodGroup', 'discProfile'
];

function pickAllowed(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function sanitize(data) {
  if (data.firstName) data.firstName = data.firstName.trim();
  if (data.lastName) data.lastName = data.lastName.trim();
  if (data.middleName) data.middleName = data.middleName.trim();
  if (data.phone) data.phone = data.phone.trim();
  if (data.email) data.email = data.email.trim().toLowerCase();
  if (data.workEmail) data.workEmail = data.workEmail.trim().toLowerCase();
  if (data.gender) data.gender = data.gender.toUpperCase();
  if (data.maritalStatus) data.maritalStatus = data.maritalStatus.toUpperCase();

  // p-multiSelect sends arrays already; guard against a stray string anyway
  if (data.medicalConditions && !Array.isArray(data.medicalConditions)) {
    data.medicalConditions = [data.medicalConditions];
  }
  if (data.dentalConditions && !Array.isArray(data.dentalConditions)) {
    data.dentalConditions = [data.dentalConditions];
  }

  return data;
}

const PHONE_REGEX = /^[0-9+\-\s()]{7,15}$/;

// ─── Create Patient ───────────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const data = sanitize(pickAllowed(req.body));

    // ✅ Validate required fields — matches patientForm required validators
    if (!data.firstName || !data.lastName || !data.phone) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name and phone are required'
      });
    }

    // ✅ Phone format check (basic)
    if (!PHONE_REGEX.test(data.phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // ✅ Duplicate check — phone unique per clinic
    const exists = await Patient.findOne({
      clinicId: req.clinicId,
      phone: data.phone
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Patient with this phone already exists in this clinic'
      });
    }

    const patient = await Patient.create({
      ...data,
      clinicId: req.clinicId // ✅ from token, never trust body
    });

    logger.info(`Patient created: ${patient._id} for clinic: ${req.clinicId}`);

    return res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: patient
    });

  } catch (err) {
    logger.error('Create Patient Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Patients ────────────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    // ✅ Sanitize pagination
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const query = {
      clinicId: req.clinicId, // ✅ scoped to clinic
      isActive: true
    };

    if (search) {
      const term = search.trim();
      query.$or = [
        { firstName: { $regex: term, $options: 'i' } },
        { lastName: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { workEmail: { $regex: term, $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      Patient.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pageNum - 1) * pageLimit)
        .limit(pageLimit),
      Patient.countDocuments(query)
    ]);

    return res.json({
      success: true,
      page: pageNum,
      limit: pageLimit,
      totalPages: Math.ceil(count / pageLimit),
      count,
      data
    });

  } catch (err) {
    logger.error('List Patients Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.autocomplete = async (req, res) => {
  try {
    const { term, regex, limit } = parseAutocompleteQuery(req.query);
    if (!term) return res.json({ success: true, count: 0, data: [] });

    const patients = await Patient.find({
      clinicId: req.clinicId,
      isActive: true,
      $or: [
        { firstName: regex },
        { middleName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex }
      ]
    })
      .select('title firstName middleName lastName suffix phone email')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();

    const data = patients.map((patient) => ({
      id: patient._id,
      value: patient._id,
      label: [patient.title, patient.firstName, patient.middleName, patient.lastName, patient.suffix]
        .filter(Boolean)
        .join(' '),
      subtitle: patient.phone,
      phone: patient.phone,
      email: patient.email
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('Patient autocomplete error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Patient By ID ────────────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }

    const patient = await Patient.findOne({
      _id: id,
      clinicId: req.clinicId // ✅ clinic-scoped
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // ✅ Fetch appointment stats for this patient
    const [total, completed, pending, cancelled, documents] = await Promise.all([
      Appointment.countDocuments({ clinicId: req.clinicId, patientId: id }),
      Appointment.countDocuments({ clinicId: req.clinicId, patientId: id, status: 'COMPLETED' }),
      Appointment.countDocuments({ clinicId: req.clinicId, patientId: id, status: 'PENDING' }),
      Appointment.countDocuments({ clinicId: req.clinicId, patientId: id, status: 'CANCELLED' }),
      Attachment.find({ clinicId: req.clinicId, recordType: 'patient', recordId: id })
        .select('originalName contentType size uploadedBy createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .lean()
    ]);

    return res.json({
      success: true,
      data: {
        patient,
        documents: documents.map((document) => ({
          id: document._id,
          originalName: document.originalName,
          contentType: document.contentType,
          size: document.size,
          uploadedBy: document.uploadedBy,
          createdAt: document.createdAt,
          downloadUrl: `/api/patients/${id}/attachments/${document._id}`
        })),
        appointmentStats: { total, completed, pending, cancelled }
      }
    });

  } catch (err) {
    logger.error('Get Patient Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Patient ───────────────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }

    // ✅ Only whitelisted, sanitized fields — clinicId can never be overwritten
    const safeUpdates = sanitize(pickAllowed(req.body));

    // ✅ Validate phone if being updated
    if (safeUpdates.phone) {
      if (!PHONE_REGEX.test(safeUpdates.phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
      }

      // ✅ Check phone not taken by another patient in same clinic
      const phoneExists = await Patient.findOne({
        clinicId: req.clinicId,
        phone: safeUpdates.phone,
        _id: { $ne: id }
      });
      if (phoneExists) {
        return res.status(409).json({ success: false, message: 'Phone already in use by another patient' });
      }
    }

    const patient = await Patient.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      safeUpdates,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    logger.info(`Patient updated: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Patient updated successfully',
      data: patient
    });

  } catch (err) {
    logger.error('Update Patient Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Patient ───────────────────────────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }

    // ✅ Block deletion if patient has appointments
    const appointmentCount = await Appointment.countDocuments({
      clinicId: req.clinicId,
      patientId: id
    });

    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete patient with ${appointmentCount} existing appointment(s). Consider deactivating instead.`
      });
    }

    const patient = await Patient.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    logger.info(`Patient deleted: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Patient deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Patient Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
