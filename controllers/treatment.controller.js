const Treatment = require('../models/Treatment');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Attachment = require('../models/Attachment');
const Invoice = require('../models/Invoice');
const TreatmentType = require('../models/TreatmentType');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { parseAutocompleteQuery } = require('../utils/autocomplete');

// ─── Create Treatment ─────────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { appointmentId, treatmentMasterId, diagnosis, medicines, notes, followUpDate } = req.body;

    // ✅ Validate required fields
    if (!appointmentId || typeof diagnosis !== 'string' || !diagnosis.trim()) {
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
      clinicId: req.clinicId
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(409).json({ success: false, message: 'Cannot record treatment for a cancelled appointment' });
    }

    if (req.user.role === 'DOCTOR' && appointment.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only record treatment for your own appointments' });
    }

    // ✅ Prevent duplicate treatment for same appointment
    if (appointment.treatmentId) {
      return res.status(409).json({
        success: false,
        message: 'Treatment already exists for this appointment'
      });
    }

    let treatmentMaster;
    if (treatmentMasterId) {
      if (!mongoose.Types.ObjectId.isValid(treatmentMasterId)) {
        return res.status(400).json({ success: false, message: 'Invalid treatmentMasterId' });
      }
      treatmentMaster = await TreatmentType.findOne({
        _id: treatmentMasterId,
        clinicId: req.clinicId,
        status: 'ACTIVE'
      });
      if (!treatmentMaster) {
        return res.status(404).json({ success: false, message: 'Active treatment master not found' });
      }
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
      clinicId: req.clinicId,          // ✅ from token
      appointmentId,
      patientId: appointment.patientId,      // ✅ pulled from appointment
      doctorId: appointment.doctorId,        // ✅ pulled from appointment
      treatmentMasterId: treatmentMaster?._id,
      treatmentName: treatmentMaster?.name,
      treatmentPrice: treatmentMaster?.price,
      diagnosis: diagnosis.trim(),
      medicines: medicines || [],
      notes: notes?.trim(),
      followUpDate: followUpDate ? new Date(followUpDate) : undefined
    });

    // Claim the appointment once so concurrent requests cannot leave multiple treatments linked.
    let linkedAppointment;
    try {
      linkedAppointment = await Appointment.findOneAndUpdate(
        {
          _id: appointmentId,
          clinicId: req.clinicId,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          treatmentId: null,
          status: { $ne: 'CANCELLED' }
        },
        { treatmentId: treatment._id, status: 'COMPLETED' },
        { new: true }
      );
    } catch (linkError) {
      await Treatment.deleteOne({ _id: treatment._id, clinicId: req.clinicId });
      throw linkError;
    }

    if (!linkedAppointment) {
      await Treatment.deleteOne({ _id: treatment._id, clinicId: req.clinicId });
      return res.status(409).json({ success: false, message: 'Appointment already has a treatment or is cancelled' });
    }

    // ✅ Populate for response
    const populated = await Treatment.findById(treatment._id)
      .populate('treatmentMasterId', 'name description duration price')
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
    const query = { clinicId: req.clinicId };

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

exports.autocomplete = async (req, res) => {
  try {
    const { term, regex, limit } = parseAutocompleteQuery(req.query);
    if (!term) return res.json({ success: true, count: 0, data: [] });

    const treatments = await Treatment.find({
      clinicId: req.clinicId,
      $or: [
        { diagnosis: regex },
        { notes: regex }
      ]
    })
      .select('diagnosis notes patientId doctorId appointmentId')
      .populate('patientId', 'firstName middleName lastName phone')
      .populate('doctorId', 'staffname specialization')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const data = treatments.map((treatment) => {
      const patientName = treatment.patientId
        ? [treatment.patientId.firstName, treatment.patientId.middleName, treatment.patientId.lastName]
          .filter(Boolean)
          .join(' ')
        : '';

      return {
        id: treatment._id,
        value: treatment._id,
        label: treatment.diagnosis,
        subtitle: patientName || treatment.notes || '',
        patientId: treatment.patientId?._id,
        doctorId: treatment.doctorId?._id,
        appointmentId: treatment.appointmentId
      };
    });

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('Treatment autocomplete error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Treatments By Doctor (Dentist) ───────────────────────────────────────

exports.getByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const {
      page = 1,
      limit = 10,
      search,
      patientId,
      appointmentId
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }

    // If a doctor is requesting, ensure they only access their own records
    if (req.user.role === 'DOCTOR' && req.user._id.toString() !== doctorId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const query = {
      clinicId: req.clinicId,
      doctorId
    };

    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ success: false, message: 'Invalid patientId' });
      }
      query.patientId = patientId;
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
    logger.error('Get Treatments By Doctor Error', { error: err.message, stack: err.stack });
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
      clinicId: req.clinicId // ✅ clinic-scoped
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
      treatmentMasterId,
      treatmentName,
      treatmentPrice,
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
      { _id: id, clinicId: req.clinicId },
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

    const treatment = await Treatment.findOne({ _id: id, clinicId: req.clinicId });

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    const invoiceExists = await Invoice.exists({
      clinicId: req.clinicId,
      $or: [
        { treatmentId: treatment._id },
        { appointmentId: treatment.appointmentId }
      ]
    });
    if (invoiceExists) {
      return res.status(409).json({ success: false, message: 'Cannot delete a treatment with an invoice' });
    }

    await Treatment.deleteOne({ _id: treatment._id, clinicId: req.clinicId });

    await Attachment.deleteMany({
      clinicId: req.clinicId,
      recordType: 'treatment',
      recordId: treatment._id
    });

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