const Clinic = require('../models/Clinic');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * ============================
 * REGISTER CLINIC
 * ============================
 */
exports.registerClinic = async (req, res) => {
  try {
    const { clinicName, phone, email, password } = req.body;

    if (!clinicName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'clinicName, email and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const clinic = await Clinic.create({ name: clinicName, phone });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      clinicId: clinic._id,
      email,
      password: hashedPassword,
      role: 'ADMIN'
    });

    const token = jwt.sign(
      { userId: user._id, clinicId: clinic._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      message: 'Clinic registered successfully',
      token,
      clinic,
      user: { _id: user._id, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Register Clinic Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required'
      });
    }

    const user = await User.findOne({ email })
      .select('+password')
      .populate('clinicId');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { userId: user._id, clinicId: user.clinicId._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      clinic: user.clinicId,
      user: { _id: user._id, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * ============================
 * CHANGE PASSWORD (After Login)
 * ============================
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ fixed
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password and new password are required'
      });
    }

    // Get user with password
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Compare old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect'
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


/**
 * ============================
 * FORGOT PASSWORD
 * ============================
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: 'If email exists, reset link sent'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    res.json({
      success: true,
      message: 'Reset link generated',
      resetUrl // remove in production
    });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * ============================
 * RESET PASSWORD
 * ============================
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ success: true, message: 'Password reset successful' });

  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
