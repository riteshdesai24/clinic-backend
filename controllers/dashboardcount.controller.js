const Appointment = require('../models/Appointment');
const logger = require('../utils/logger');

const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const supportedPeriods = ['all', 'today', 'week', 'month'];

const getPeriodRange = (period, now = new Date()) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'today') {
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }
  if (period === 'week') {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }
  if (period === 'month') {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {
      start: monthStart,
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    };
  }
  return null;
};

const sendAppointmentCounts = async (req, res, requestedPeriod) => {
  try {
    const period = requestedPeriod || String(req.query.period || 'all').toLowerCase();
    if (!supportedPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'period must be one of: all, today, week, month'
      });
    }

    const query = { clinicId: req.clinicId };
    if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
    else if (req.query.doctorId) {
      if (!require('mongoose').Types.ObjectId.isValid(req.query.doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      }
      const User = require('../models/User');
      const doctor = await User.findOne({ _id: req.query.doctorId, clinicId: req.clinicId, role: 'DOCTOR' }).select('_id');
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found in this clinic' });
      query.doctorId = doctor._id;
    }

    const range = getPeriodRange(period);
    if (range) query.date = { $gte: range.start, $lt: range.end };

    const [total, ...counts] = await Promise.all([
      Appointment.countDocuments(query),
      ...statuses.map((status) => Appointment.countDocuments({ ...query, status }))
    ]);

    const byStatus = Object.fromEntries(statuses.map((status, index) => [status, counts[index]]));

    return res.json({
      success: true,
      scope: req.user.role === 'DOCTOR' ? 'DOCTOR' : 'CLINIC',
      period: period.toUpperCase(),
      total,
      byStatus,
      ...(range && { from: range.start, to: range.end })
    });
  } catch (error) {
    logger.error('Dashboard Appointment Counts Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.appointmentCounts = (req, res) => sendAppointmentCounts(req, res);
exports.todayCounts = (req, res) => sendAppointmentCounts(req, res, 'today');
exports.weeklyCounts = (req, res) => sendAppointmentCounts(req, res, 'week');
exports.monthlyCounts = (req, res) => sendAppointmentCounts(req, res, 'month');
