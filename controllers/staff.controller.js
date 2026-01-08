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
    const { email, password } = req.body;

    // -------- Validation --------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required'
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
      email,
      password: await bcrypt.hash(password, 10),
      role: 'STAFF'
    });

    // -------- Response --------
    return res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      staff: {
        _id: staff._id,
        email: staff.email,
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
