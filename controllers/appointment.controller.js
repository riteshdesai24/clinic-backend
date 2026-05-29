const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const twilio = require('twilio');

// ─── Twilio WhatsApp setup ─────────────────────────────────────────────────
// Add to your .env:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=your_auth_token
//   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio sandbox number)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp(to, body) {
  if (!to) return;
  try {
    // 'to' must be in E.164 format, e.g. "+919876543210"
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body
    });
    logger.info(`WhatsApp sent to ${to}`);
  } catch (err) {
    // Don't fail the request if WhatsApp fails
    logger.error(`WhatsApp send failed to ${to}`, { error: err.message });
  }
}

// ─── Create Appointment ────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { doctorId, patientId, date, time, notes, status } = req.body;

    // ✅ Validate required fields
    if (!doctorId || !patientId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'doctorId, patientId, date and time are required'
      });
    }

    // ✅ Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    if (!mongoose.Types.ObjectId.isValid(patientId))
      return res.status(400).json({ success: false, message: 'Invalid patientId' });

    // ✅ Validate date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime()))
      return res.status(400).json({ success: false, message: 'Invalid date format' });

    // ✅ Validate time format HH:MM
    if (!/^\d{2}:\d{2}$/.test(time))
      return res.status(400).json({ success: false, message: 'Time must be in HH:MM format' });

    // ✅ Verify doctor belongs to this clinic
    const doctor = await User.findOne({
      _id: doctorId,
      clinicId: req.user.clinicId,
      role: 'DOCTOR',
      isActive: true
    });
    if (!doctor)
      return res.status(404).json({ success: false, message: 'Doctor not found in this clinic' });

    // ✅ Verify patient belongs to this clinic
    const patient = await Patient.findOne({
      _id: patientId,
      clinicId: req.user.clinicId,
      isActive: true
    });
    if (!patient)
      return res.status(404).json({ success: false, message: 'Patient not found in this clinic' });

    // ✅ Conflict check: same doctor, same date+time, not cancelled
    const conflict = await Appointment.findOne({
      clinicId: req.user.clinicId,
      doctorId,
      date: appointmentDate,
      time,
      status: { $nin: ['CANCELLED'] }
    });
    if (conflict)
      return res.status(409).json({
        success: false,
        message: 'Doctor already has an appointment at this date and time'
      });

    const appointment = await Appointment.create({
      clinicId: req.user.clinicId,
      doctorId,
      patientId,
      date: appointmentDate,
      time,
      notes: notes?.trim(),
      status: status || 'PENDING'
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('doctorId', 'staffname specialization phone')
      .populate('patientId', 'name phone');

    logger.info(`Appointment created: ${appointment._id} for clinic: ${req.user.clinicId}`);

    // ✅ Send WhatsApp to patient and doctor
    const dateStr = appointmentDate.toDateString();
    const patientMsg =
      `Hello ${populated.patientId.name}, your appointment with Dr. ${populated.doctorId.staffname}` +
      ` is confirmed on ${dateStr} at ${time}. Please arrive 10 minutes early.`;

    const doctorMsg =
      `Hello Dr. ${populated.doctorId.staffname}, you have a new appointment with patient` +
      ` ${populated.patientId.name} on ${dateStr} at ${time}.`;

    await Promise.all([
      sendWhatsApp(populated.patientId.phone, patientMsg),
      sendWhatsApp(populated.doctorId.phone, doctorMsg)
    ]);

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

// ─── List Appointments ─────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, date, doctorId, patientId, status } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const query = { clinicId: req.user.clinicId };

    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId))
        return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      query.doctorId = doctorId;
    }

    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId))
        return res.status(400).json({ success: false, message: 'Invalid patientId' });
      query.patientId = patientId;
    }

    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase()))
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      query.status = status.toUpperCase();
    }

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime()))
        return res.status(400).json({ success: false, message: 'Invalid date format' });
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
        .sort({ date: -1, time: 1 })
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

// ─── Get Appointment By ID ─────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });

    const appointment = await Appointment.findOne({
      _id: id,
      clinicId: req.user.clinicId
    })
      .populate('doctorId', 'staffname specialization phone email')
      .populate('patientId', 'name phone age gender email address medicalHistory')
      .populate({
        path: 'treatmentId',
        populate: { path: 'doctorId', select: 'staffname specialization' }
      });

    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });

    return res.json({ success: true, data: appointment });

  } catch (err) {
    logger.error('Get Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Appointment ────────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });

    // ✅ Strip fields that must never be changed via this endpoint
    const { clinicId, treatmentId, cancelledAt, cancelledBy, ...safeUpdates } = req.body;

    // ✅ Prevent direct CANCELLED via update — use DELETE /id instead
    if (safeUpdates.status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED'];
      if (!validStatuses.includes(safeUpdates.status.toUpperCase()))
        return res.status(400).json({
          success: false,
          message: 'Use DELETE /:id to cancel. Valid update statuses: PENDING, CONFIRMED, COMPLETED'
        });
      safeUpdates.status = safeUpdates.status.toUpperCase();
    }

    if (safeUpdates.date) {
      const parsedDate = new Date(safeUpdates.date);
      if (isNaN(parsedDate.getTime()))
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      safeUpdates.date = parsedDate;
    }

    if (safeUpdates.time && !/^\d{2}:\d{2}$/.test(safeUpdates.time))
      return res.status(400).json({ success: false, message: 'Time must be in HH:MM format' });

    if (safeUpdates.doctorId && !mongoose.Types.ObjectId.isValid(safeUpdates.doctorId))
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });

    // ✅ If date or time is being changed, re-check for conflicts
    if (safeUpdates.date || safeUpdates.time) {
      const existing = await Appointment.findOne({ _id: id, clinicId: req.user.clinicId });
      if (!existing)
        return res.status(404).json({ success: false, message: 'Appointment not found' });

      const checkDate = safeUpdates.date || existing.date;
      const checkTime = safeUpdates.time || existing.time;
      const checkDoctor = safeUpdates.doctorId || existing.doctorId;

      const conflict = await Appointment.findOne({
        _id: { $ne: id },
        clinicId: req.user.clinicId,
        doctorId: checkDoctor,
        date: checkDate,
        time: checkTime,
        status: { $nin: ['CANCELLED'] }
      });
      if (conflict)
        return res.status(409).json({
          success: false,
          message: 'Doctor already has an appointment at this date and time'
        });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId },
      safeUpdates,
      { new: true, runValidators: true }
    )
      .populate('doctorId', 'staffname specialization')
      .populate('patientId', 'name phone');

    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });

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

// ─── Soft Delete (Cancel) Appointment ─────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });

    // ✅ Reason is required
    if (!reason || !reason.trim())
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });

    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: id,
        clinicId: req.user.clinicId,
        status: { $nin: ['CANCELLED'] }
      },
      {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: req.user._id,
        cancellationReason: reason.trim()   // ✅ save reason
      },
      { new: true }
    )
      .populate('doctorId', 'staffname phone')
      .populate('patientId', 'name phone');

    if (!appointment)
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or already cancelled'
      });

    logger.info(`Appointment cancelled: ${id} | Reason: ${reason.trim()} | By: ${req.user._id}`);

    const dateStr = new Date(appointment.date).toDateString();

    await Promise.all([
      sendWhatsApp(
        appointment.patientId.phone,
        `Hello ${appointment.patientId.name}, your appointment with Dr. ${appointment.doctorId.staffname}` +
        ` on ${dateStr} at ${appointment.time} has been cancelled.\nReason: ${reason.trim()}\nPlease contact the clinic to reschedule.`
      ),
      sendWhatsApp(
        appointment.doctorId.phone,
        `Hello Dr. ${appointment.doctorId.staffname}, the appointment with patient` +
        ` ${appointment.patientId.name} on ${dateStr} at ${appointment.time} has been cancelled.\nReason: ${reason.trim()}`
      )
    ]);

    return res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });

  } catch (err) {
    logger.error('Cancel Appointment Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Calendar View ─────────────────────────────────────────────────────────
// GET /api/appointments/calendar?year=2025&month=6
// - DOCTOR  → sees only their own appointments
// - ADMIN   → sees all clinic appointments, optionally filter by ?doctorId=

exports.getCalendar = async (req, res) => {
  try {
    const { year, month, doctorId } = req.query;

    // ✅ Validate year & month
    const y = parseInt(year);
    const m = parseInt(month); // 1-based (1 = Jan, 12 = Dec)

    if (!y || !m || m < 1 || m > 12 || y < 2000 || y > 2100)
      return res.status(400).json({ success: false, message: 'Valid year and month (1-12) are required' });

    // ✅ Build date range for the whole month (UTC)
    const from = new Date(Date.UTC(y, m - 1, 1));           // 1st of month 00:00 UTC
    const to   = new Date(Date.UTC(y, m, 1));               // 1st of next month 00:00 UTC

    // ✅ Base query — always clinic-scoped
    const query = {
      clinicId: req.user.clinicId,
      date: { $gte: from, $lt: to }
    };

    if (req.user.role === 'DOCTOR') {
      // Doctors only see their own appointments — ignore any doctorId param
      query.doctorId = req.user._id;
    } else if (req.user.role === 'ADMIN' && doctorId) {
      // Admin can optionally filter by a specific doctor
      if (!mongoose.Types.ObjectId.isValid(doctorId))
        return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      query.doctorId = doctorId;
    }
    // If ADMIN with no doctorId filter → fetch all clinic appointments

    const appointments = await Appointment.find(query)
      .populate('doctorId', 'staffname specialization')
      .populate('patientId', 'name phone age gender')
      .sort({ date: 1, time: 1 })
      .lean();

    // ✅ Group by "YYYY-MM-DD" for easy calendar consumption
    const grouped = {};
    for (const appt of appointments) {
      // Use UTC date to avoid timezone shifts on the key
      const d = new Date(appt.date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(appt);
    }

    return res.json({
      success: true,
      year: y,
      month: m,
      data: grouped         // { "2025-06-15": [ ...appointments ] }
    });

  } catch (err) {
    logger.error('Calendar Appointments Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};