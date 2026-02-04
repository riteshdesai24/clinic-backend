const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * =====================================================
 * CREATE DOCTOR (ADMIN)
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const {
      staffname,
      email,
      phone,
      password,
      specialization,
      available
    } = req.body;

    if (!staffname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password required'
      });
    }

    // check duplicate
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const doctor = await User.create({
      clinicId: req.user.clinicId,
      staffname,
      email,
      phone,
      password: hash,
      role: 'DOCTOR',
      specialization,
      available
    });

    res.status(201).json({
      success: true,
      message: 'Doctor created',
      data: doctor
    });

  } catch (err) {
    console.error('Create Doctor Error:', err);
    res.status(500).json({ success: false });
  }
};


/**
 * =====================================================
 * LIST DOCTORS
 * =====================================================
 */
exports.list = async (req, res) => {
  try {

    const {
      cursor,
      limit = 10,
      specialization,
      search,
      active,
      sort = 'asc'
    } = req.query;

    const query = {
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    };

    // filters
    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }

    if (search) {
      query.staffname = { $regex: search, $options: 'i' };
    }

    if (active !== undefined) {
      query.available = active === 'true';
    }

    // cursor
    if (cursor) {
      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const doctors = await User.find(query)
      .select('-password')
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = doctors.length > pageLimit;
    if (hasNextPage) doctors.pop();

    const nextCursor =
      doctors.length > 0
        ? doctors[doctors.length - 1]._id
        : null;

    res.json({
      success: true,
      count: doctors.length,
      hasNextPage,
      nextCursor,
      data: doctors
    });

  } catch (err) {
    console.error('List Doctors Error:', err);
    res.status(500).json({ success: false });
  }
};


/**
 * =====================================================
 * DOCTOR DETAIL
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {

    const { id } = req.params;

    const doctor = await User.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    }).select('-password');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const [total, completed, pending] = await Promise.all([
      Appointment.countDocuments({
        clinicId: req.user.clinicId,
        doctorId: doctor._id
      }),

      Appointment.countDocuments({
        clinicId: req.user.clinicId,
        doctorId: doctor._id,
        status: 'COMPLETED'
      }),

      Appointment.countDocuments({
        clinicId: req.user.clinicId,
        doctorId: doctor._id,
        status: 'PENDING'
      })
    ]);

    res.json({
      success: true,
      data: {
        doctor,
        appointmentCount: {
          total,
          completed,
          pending
        }
      }
    });

  } catch (err) {
    console.error('Get Doctor Error:', err);
    res.status(500).json({ success: false });
  }
};


/**
 * =====================================================
 * UPDATE DOCTOR (ADMIN)
 * =====================================================
 */
exports.update = async (req, res) => {
  try {

    const doctor = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        clinicId: req.user.clinicId,
        role: 'DOCTOR'
      },
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      message: 'Doctor updated',
      data: doctor
    });

  } catch (err) {
    console.error('Update Doctor Error:', err);
    res.status(500).json({ success: false });
  }
};


/**
 * =====================================================
 * DELETE DOCTOR (ADMIN)
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {

    const { id } = req.params;

    const appointmentCount = await Appointment.countDocuments({
      clinicId: req.user.clinicId,
      doctorId: id
    });

    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete doctor with appointments'
      });
    }

    const doctor = await User.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      message: 'Doctor deleted'
    });

  } catch (err) {
    console.error('Delete Doctor Error:', err);
    res.status(500).json({ success: false });
  }
};
