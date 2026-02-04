const User = require('../models/User');
const Clinic = require('../models/Clinic');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

/**
 * ============================
 * CREATE STAFF / DOCTOR
 * ============================
 */
exports.createStaff = async (req, res) => {
  try {

    const {
      staffname,
      email,
      phone,
      password,
      role,
      specialization
    } = req.body;

    // Validation
    if (!staffname || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'staffname, email, phone, password and role are required'
      });
    }

    const allowedRoles = ['STAFF', 'DOCTOR'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Doctor specialization
    if (role === 'DOCTOR' && !specialization) {
      return res.status(400).json({
        success: false,
        message: 'Specialization is required for Doctor'
      });
    }

    // Check clinic
    const clinic = await Clinic.findById(req.clinicId);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Plan check
    if (clinic.plan !== 'GOLD') {
      return res.status(403).json({
        success: false,
        message: 'Upgrade to GOLD plan'
      });
    }

    // Duplicate per clinic
    const exists = await User.findOne({
      email,
      clinicId: req.clinicId
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'User already exists in this clinic'
      });
    }

    // Create
    const user = await User.create({
      clinicId: req.clinicId,
      staffname,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      role,
      specialization: role === 'DOCTOR' ? specialization : ''
    });

    return res.status(201).json({
      success: true,
      message: `${role} created successfully`,
      data: user
    });

  } catch (err) {

    console.error('Create Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * LIST STAFF
 * ============================
 */
exports.listStaff = async (req, res) => {
  try {

    const { cursor, limit = 10, search, sort = 'asc' } = req.query;

    const query = {
      clinicId: req.clinicId,
      role: 'STAFF'
    };

    if (search) {
      query.$or = [
        { staffname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (cursor) {

      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const staff = await User.find(query)
      .select('-password')
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = staff.length > pageLimit;

    if (hasNextPage) staff.pop();

    const nextCursor =
      staff.length > 0
        ? staff[staff.length - 1]._id
        : null;

    return res.json({
      success: true,
      count: staff.length,
      hasNextPage,
      nextCursor,
      data: staff
    });

  } catch (err) {

    console.error('List Staff Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * LIST DOCTORS
 * ============================
 */
exports.listDoctors = async (req, res) => {
  try {

    const { cursor, limit = 10, search, sort = 'asc' } = req.query;

    const query = {
      clinicId: req.clinicId,
      role: 'DOCTOR'
    };

    if (search) {
      query.$or = [
        { staffname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

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

    return res.json({
      success: true,
      count: doctors.length,
      hasNextPage,
      nextCursor,
      data: doctors
    });

  } catch (err) {

    console.error('List Doctors Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * GET STAFF / DOCTOR BY ID
 * ============================
 */
exports.getStaffById = async (req, res) => {
  try {

    const user = await User.findOne({
      _id: req.params.id,
      clinicId: req.clinicId
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        staff: user,
        doctor: user
      }
    });

  } catch (err) {

    console.error('Get User Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * UPDATE STAFF / DOCTOR
 * ============================
 */
exports.updateStaff = async (req, res) => {
  try {

    const data = { ...req.body };

    // Password hash
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    // Specialization logic
    if (data.role !== 'DOCTOR') {
      data.specialization = '';
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        clinicId: req.clinicId
      },
      data,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });

  } catch (err) {

    console.error('Update Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * DELETE STAFF / DOCTOR
 * ============================
 */
exports.deleteStaff = async (req, res) => {
  try {

    const user = await User.findOneAndDelete({
      _id: req.params.id,
      clinicId: req.clinicId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (err) {

    console.error('Delete Error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
