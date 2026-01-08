const Clinic = require('../models/Clinic');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * ============================
 * REGISTER CLINIC
 * ============================
 */
exports.registerClinic = async (req, res) => {
  try {
    const { clinicName, phone, email, passwordx } = req.body;

    // -------- Validation --------
    if (!clinicName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'clinicName, email and password are required'
      });
    }

    // -------- Check duplicate email --------
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // -------- Create clinic --------
    const clinic = await Clinic.create({ name: clinicName });

    // -------- Create admin user --------
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      clinicId: clinic._id,
      email,
      password: hashedPassword,
      role: 'ADMIN'
    });

    // -------- Generate token --------
    const token = jwt.sign(
      {
        userId: user._id,
        clinicId: clinic._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // -------- Response --------
    return res.status(201).json({
      success: true,
      message: 'Clinic registered successfully',
      token,
      clinic,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register Clinic Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * ============================
 * LOGIN
 * ============================
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // -------- Validation --------
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required'
      });
    }

    // -------- Find user + clinic --------
    const user = await User.findOne({ email })
      .select('+password')
      .populate('clinicId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // -------- Compare password --------
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // -------- Generate token --------
    const token = jwt.sign(
      {
        userId: user._id,
        clinicId: user.clinicId._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // -------- Response --------
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      clinic: user.clinicId,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
