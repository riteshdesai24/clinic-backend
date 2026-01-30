const User = require('../models/User');
const Clinic = require('../models/Clinic');
const bcrypt = require('bcrypt');

/**
 * ============================
 * CREATE STAFF
 * ============================
 */
exports.createStaff = async (req, res) => {
  try {
    const { staffname, email, phone, password } = req.body;

    // -------- Validation --------
    if (!staffname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'staffname, email, phone and password are required'
      });
    }

    // -------- Check clinic --------
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // -------- Plan check --------
    if (clinic.plan !== 'GOLD') {
      return res.status(403).json({
        success: false,
        message: 'Upgrade to GOLD plan to add staff'
      });
    }

    // -------- Duplicate staff --------
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // -------- Create staff --------
    const staff = await User.create({
      clinicId: req.clinicId,
      staffname,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      role: 'STAFF'
    });

    // -------- Response --------
    return res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      staff: {
        _id: staff._id,
        staffname: staff.staffname,
        email: staff.email,
        phone: staff.phone,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('Create Staff Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * ============================
 * LIST STAFF
 * Cursor Pagination
 * ============================
 */
exports.listStaff = async (req, res) => {
  try {
    const { cursor, limit = 10, search, sort = 'asc' } = req.query;

    const query = { clinicId: req.clinicId, role: 'STAFF' };

    // -------- Search filter --------
    if (search) {
      query.$or = [
        { staffname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // -------- Cursor pagination --------
    if (cursor) {
      const mongoose = require('mongoose');
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

    // -------- Response --------
    return res.json({
      success: true,
      count: staff.length,
      hasNextPage,
      nextCursor,
      data: staff
    });
  } catch (error) {
    console.error('List Staff Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
