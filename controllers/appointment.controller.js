const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─── Create Appointment ───────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { doctorId, patientId, date, notes, status } = req.body;

    // ✅ Validate required fields
    if (!doctorId || !patientId || !date) {
      return res.status(400).json({
        success: false,
        message: 'doctorId, patientId and date are required'
      });
    }

    // ✅ Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId' });
    }

    // ✅ Validate date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // ✅ Verify doctor belongs to this clinic
    const doctor = await User.findOne({
      _id: doctorId,
      clinicId: req.user.clinicId,
      role: 'DOCTOR',
      isActive: true
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found in this clinic' });
    }

    // ✅ Verify patient belongs to this clinic
    const patient = await Patient.findOne({
      _id: patientId,
      clinicId: req.user.clinicId,
      isActive: true
    });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found in this clinic' });
    }

    // ✅ Check doctor doesn't have another appointment at the same time
    const conflict = await Appointment.findOne({
      clinicId: req.user.clinicId,
      doctorId,
      date: appointmentDate,
      status: { $nin: ['CANCELLED'] }
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Doctor already has an appointment at this time'
      });
    }

    const appointment = await Appointment.create({
      clinicId: req.user.clinicId, // ✅ from token
      doctorId,
      patientId,
      date: appointmentDate,
      notes: notes?.trim(),
      status: status || 'PENDING'
    });

    // ✅ Populate for response
    const populated = await Appointment.findById(appointment._id)
      .populate('doctorId', 'staffname specialization')
      .populate('patientId', 'name phone');

    logger.info(`Appointment created: ${appointment._id} for clinic: ${req.user.clinicId}`);

    return res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: populated
    });

  } catch (err) {
    logger.error('Create Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Appointments ────────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      date,
      doctorId,
      patientId,
      status
    } = req.query;

    // ✅ Sanitize pagination
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // ✅ Always scoped to clinic from token
    const query = { clinicId: req.user.clinicId };

    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      }
      query.doctorId = doctorId;
    }

    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: 'Invalid patientId' });
      }
      query.patientId = patientId;
    }

    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }
      query.status = status.toUpperCase();
    }

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      }
      query.date = {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lte: new Date(date + 'T23:59:59.999Z')
      };
    }

    if (search) {
      query.$or = [
        { status: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      Appointment.find(query)
        .populate('doctorId', 'staffname specialization')
        .populate('patientId', 'name phone age gender')
        .populate('treatmentId', 'diagnosis medicines')
        .sort({ date: -1 })
        .skip((pageNum - 1) * pageLimit)
        .limit(pageLimit),
      Appointment.countDocuments(query)
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
    logger.error('List Appointments Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Appointment By ID ────────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findOne({
      _id: id,
      clinicId: req.user.clinicId // ✅ clinic-scoped
    })
      .populate('doctorId', 'staffname specialization phone email')
      .populate('patientId', 'name phone age gender email address medicalHistory')
      .populate({
        path: 'treatmentId',
        populate: { path: 'doctorId', select: 'staffname specialization' }
      });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    return res.json({ success: true, data: appointment });

  } catch (err) {
    logger.error('Get Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Appointment ───────────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
    }

    // ✅ Prevent sensitive field changes via this endpoint
    const { clinicId, treatmentId, ...safeUpdates } = req.body;

    if (safeUpdates.status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(safeUpdates.status.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }
      safeUpdates.status = safeUpdates.status.toUpperCase();
    }

    if (safeUpdates.date) {
      const parsedDate = new Date(safeUpdates.date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      }
      safeUpdates.date = parsedDate;
    }

    if (safeUpdates.doctorId && !mongoose.Types.ObjectId.isValid(safeUpdates.doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId },
      safeUpdates,
      { new: true, runValidators: true }
    )
      .populate('doctorId', 'staffname specialization')
      .populate('patientId', 'name phone');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    logger.info(`Appointment updated: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });

  } catch (err) {
    logger.error('Update Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Appointment ───────────────────────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId // ✅ clinic-scoped
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    logger.info(`Appointment deleted: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};