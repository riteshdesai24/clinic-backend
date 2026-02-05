const Appointment = require('../models/Appointment');
const Treatment = require('../models/Treatment');
const mongoose = require('mongoose');

/**
 * =====================================================
 * CREATE APPOINTMENT
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const { startTime, endTime, doctorId } = req.body;

    if (!startTime || !endTime || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'startTime, endTime and doctorId are required'
      });
    }

    // ---- Slot conflict check (doctor-wise) ----
    const conflict = await Appointment.findOne({
      clinicId: req.clinicId,
      doctorId,
      startTime: { $lt: new Date(endTime) },
      endTime: { $gt: new Date(startTime) }
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Slot already booked for this doctor'
      });
    }

    const appointment = await Appointment.create({
      ...req.body,
      clinicId: req.clinicId
    });

    return res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Create Appointment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST APPOINTMENTS
 * Cursor pagination + filters + populate
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const {
      cursor,
      limit = 10,
      status,
      doctorId,
      today,
      startDate,
      endDate,
      sort = 'asc'
    } = req.query;

    const query = { clinicId: req.clinicId };

    if (status) query.status = status.toUpperCase();

    if (doctorId) {
      query.doctorId = new mongoose.Types.ObjectId(doctorId);
    }

    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      query.startTime = { $gte: start, $lte: end };
    }

    if (cursor) {
      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const appointments = await Appointment.find(query)
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1)
      .populate('patientId', 'name mobile age gender')
      .populate('doctorId', 'staffname email phone specialization')

    const hasNextPage = appointments.length > pageLimit;
    if (hasNextPage) appointments.pop();

    const nextCursor =
      appointments.length > 0
        ? appointments[appointments.length - 1]._id
        : null;

    return res.json({
      success: true,
      count: appointments.length,
      hasNextPage,
      nextCursor,
      data: appointments.map(a => ({
        appointment: {
          _id: a._id,
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status,
          createdAt: a.createdAt
        },
        patient: a.patientId,
        doctor: a.doctorId
      }))
    });
  } catch (error) {
    console.error('List Appointments Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * GET APPOINTMENT DETAIL
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({
      _id: id,
      clinicId: req.clinicId
    })
      .populate('patientId', 'name mobile age gender')
      .populate('doctorId', 'name');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const treatments = await Treatment.find({
      clinicId: req.clinicId,
      appointmentId: appointment._id
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        appointment,
        patient: appointment.patientId,
        doctor: appointment.doctorId,
        treatments
      }
    });
  } catch (error) {
    console.error('Get Appointment Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
