const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─── Create Patient ───────────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, medicalHistory } = req.body;

    // ✅ Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone are required'
      });
    }

    // ✅ Phone format check (basic)
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // ✅ Duplicate check — phone unique per clinic
    const exists = await Patient.findOne({
      clinicId: req.user.clinicId,
      phone: phone.trim()
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Patient with this phone already exists in this clinic'
      });
    }

    const patient = await Patient.create({
      clinicId: req.user.clinicId, // ✅ from token
      name: name.trim(),
      age,
      gender: gender?.toUpperCase(),
      phone: phone.trim(),
      email: email?.trim().toLowerCase(),
      address: address?.trim(),
      medicalHistory: medicalHistory?.trim()
    });

    logger.info(`Patient created: ${patient._id} for clinic: ${req.user.clinicId}`);

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
      clinicId: req.user.clinicId, // ✅ scoped to clinic
      isActive: true
    };

    if (search) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      Patient.find(query)
        .sort({ createdAt: -1 })
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

// ─── Get Patient By ID ────────────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID' });
    }

    const patient = await Patient.findOne({
      _id: id,
      clinicId: req.user.clinicId // ✅ clinic-scoped
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // ✅ Fetch appointment stats for this patient
    const [total, completed, pending, cancelled] = await Promise.all([
      Appointment.countDocuments({ clinicId: req.user.clinicId, patientId: id }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, patientId: id, status: 'COMPLETED' }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, patientId: id, status: 'PENDING' }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, patientId: id, status: 'CANCELLED' })
    ]);

    return res.json({
      success: true,
      data: {
        patient,
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

    // ✅ Prevent clinicId from being changed
    const { clinicId, ...safeUpdates } = req.body;

    // ✅ Validate phone if being updated
    if (safeUpdates.phone) {
      safeUpdates.phone = safeUpdates.phone.trim();
      const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
      if (!phoneRegex.test(safeUpdates.phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
      }

      // ✅ Check phone not taken by another patient in same clinic
      const phoneExists = await Patient.findOne({
        clinicId: req.user.clinicId,
        phone: safeUpdates.phone,
        _id: { $ne: id }
      });
      if (phoneExists) {
        return res.status(409).json({ success: false, message: 'Phone already in use by another patient' });
      }
    }

    if (safeUpdates.gender) safeUpdates.gender = safeUpdates.gender.toUpperCase();
    if (safeUpdates.email) safeUpdates.email = safeUpdates.email.trim().toLowerCase();
    if (safeUpdates.name) safeUpdates.name = safeUpdates.name.trim();

    const patient = await Patient.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId },
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
      clinicId: req.user.clinicId,
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
      clinicId: req.user.clinicId
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