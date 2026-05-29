const Treatment = require('../models/Treatment');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─── Create Treatment ─────────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { appointmentId, diagnosis, medicines, notes, followUpDate } = req.body;

    // ✅ Validate required fields
    if (!appointmentId || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId and diagnosis are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid appointmentId' });
    }

    // ✅ Fetch appointment — must belong to this clinic
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      clinicId: req.user.clinicId
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // ✅ Prevent duplicate treatment for same appointment
    if (appointment.treatmentId) {
      return res.status(409).json({
        success: false,
        message: 'Treatment already exists for this appointment'
      });
    }

    // ✅ Validate medicines array if provided
    if (medicines && !Array.isArray(medicines)) {
      return res.status(400).json({
        success: false,
        message: 'medicines must be an array'
      });
    }

    // ✅ Validate followUpDate if provided
    if (followUpDate) {
      const followUp = new Date(followUpDate);
      if (isNaN(followUp.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid followUpDate format' });
      }
    }

    const treatment = await Treatment.create({
      clinicId: req.user.clinicId,          // ✅ from token
      appointmentId,
      patientId: appointment.patientId,      // ✅ pulled from appointment
      doctorId: appointment.doctorId,        // ✅ pulled from appointment
      diagnosis: diagnosis.trim(),
      medicines: medicines || [],
      notes: notes?.trim(),
      followUpDate: followUpDate ? new Date(followUpDate) : undefined
    });

    // ✅ Link treatment back to appointment
    await Appointment.findByIdAndUpdate(appointmentId, {
      treatmentId: treatment._id,
      status: 'COMPLETED' // ✅ auto-complete appointment when treatment is added
    });

    // ✅ Populate for response
    const populated = await Treatment.findById(treatment._id)
      .populate('patientId', 'name phone age gender')
      .populate('doctorId', 'staffname specialization')
      .populate('appointmentId', 'date status notes');

    logger.info(`Treatment created: ${treatment._id} for appointment: ${appointmentId}`);

    return res.status(201).json({
      success: true,
      message: 'Treatment created successfully',
      data: populated
    });

  } catch (err) {
    logger.error('Create Treatment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Treatments ──────────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      patientId,
      doctorId,
      appointmentId
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // ✅ Always scoped to clinic
    const query = { clinicId: req.user.clinicId };

    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: 'Invalid patientId' });
      }
      query.patientId = patientId;
    }

    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      }
      query.doctorId = doctorId;
    }

    if (appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid appointmentId' });
      }
      query.appointmentId = appointmentId;
    }

    if (search) {
      query.$or = [
        { diagnosis: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      Treatment.find(query)
        .populate('patientId', 'name phone age gender')
        .populate('doctorId', 'staffname specialization')
        .populate('appointmentId', 'date status notes')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageLimit)
        .limit(pageLimit),
      Treatment.countDocuments(query)
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
    logger.error('List Treatments Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Treatment By ID ──────────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    const treatment = await Treatment.findOne({
      _id: id,
      clinicId: req.user.clinicId // ✅ clinic-scoped
    })
      .populate('patientId', 'name phone age gender email address medicalHistory')
      .populate('doctorId', 'staffname specialization phone email')
      .populate('appointmentId', 'date status notes');

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    return res.json({ success: true, data: treatment });

  } catch (err) {
    logger.error('Get Treatment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Treatment ─────────────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    // ✅ Prevent these fields from being changed
    const {
      clinicId,
      appointmentId,
      patientId,
      doctorId,
      ...safeUpdates
    } = req.body;

    if (safeUpdates.medicines && !Array.isArray(safeUpdates.medicines)) {
      return res.status(400).json({ success: false, message: 'medicines must be an array' });
    }

    if (safeUpdates.followUpDate) {
      const followUp = new Date(safeUpdates.followUpDate);
      if (isNaN(followUp.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid followUpDate format' });
      }
      safeUpdates.followUpDate = followUp;
    }

    if (safeUpdates.diagnosis) safeUpdates.diagnosis = safeUpdates.diagnosis.trim();
    if (safeUpdates.notes) safeUpdates.notes = safeUpdates.notes.trim();

    const treatment = await Treatment.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId },
      safeUpdates,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'name phone age gender')
      .populate('doctorId', 'staffname specialization')
      .populate('appointmentId', 'date status notes');

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    logger.info(`Treatment updated: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Treatment updated successfully',
      data: treatment
    });

  } catch (err) {
    logger.error('Update Treatment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Treatment ─────────────────────────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    const treatment = await Treatment.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId // ✅ clinic-scoped
    });

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    // ✅ Unlink treatment from appointment and revert status
    await Appointment.findByIdAndUpdate(treatment.appointmentId, {
      treatmentId: null,
      status: 'CONFIRMED'
    });

    logger.info(`Treatment deleted: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Treatment deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Treatment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};