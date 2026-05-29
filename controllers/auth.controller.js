const mongoose = require('mongoose');
const Clinic = require('../models/Clinic');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const validatePassword = require('../utils/validatePassword');
const logger = require('../utils/logger');

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateToken = (user, clinicId) => {
  return jwt.sign(
    {
      userId: user._id,
      clinicId: clinicId,
      role: user.role,
      plan: user.plan
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

const stripSensitiveFields = (userObj) => {
  const { password, resetPasswordToken, resetPasswordExpire, ...safeUser } = userObj;
  return safeUser;
};

// ─── Register Clinic ─────────────────────────────────────────────────────────

exports.registerClinic = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { clinicName, phone, email, password } = req.body;

    email = email?.trim().toLowerCase();

    // ✅ Validate required fields
    if (!clinicName || !email || !password) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'clinicName, email and password are required'
      });
    }

    // ✅ Validate password strength
    if (!validatePassword(password)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Password must be 8+ characters with uppercase, lowercase, number and special character'
      });
    }

    // ✅ Check duplicate email
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // ✅ Create clinic
    const [clinic] = await Clinic.create([{ name: clinicName, phone }], { session });

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ Create admin user
    const [user] = await User.create(
      [
        {
          clinicId: clinic._id,
          email,
          password: hashedPassword,
          role: 'ADMIN',
          plan: 'GOLD' // 🔄 Change to 'BRONZE' when plan system is ready
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const token = generateToken(user, clinic._id);

    logger.info(`New clinic registered: ${clinic._id} by user: ${user._id}`);

    return res.status(201).json({
      success: true,
      message: 'Clinic registered successfully',
      token,
      clinic: { _id: clinic._id, name: clinic.name },
      user: { _id: user._id, email: user.email, role: user.role, plan: user.plan }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Register Clinic Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // ✅ Fetch user with password + clinic name and id only
    const user = await User.findOne({ email })
      .select('+password')
      .populate('clinicId', 'name _id');

    // ✅ Single password check (prevents timing attacks with consistent error)
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ✅ Check account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    const token = generateToken(user, user.clinicId?._id);

    const safeUser = stripSensitiveFields(user.toObject());

    logger.info(`User logged in: ${user._id}`);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      clinic: user.clinicId, // { _id, name }
      user: safeUser
    });

  } catch (error) {
    logger.error('Login Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password and new password are required'
      });
    }

    // ✅ Validate new password strength
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be 8+ characters with uppercase, lowercase, number and special character'
      });
    }

    // ✅ Prevent reusing the same password
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from old password'
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    logger.info(`Password changed for user: ${userId}`);

    return res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    logger.error('Change Password Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;

    email = email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // ✅ Always return same response (prevents email enumeration)
    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent'
      });
    }

    // ✅ Generate raw token (sent to user) and store hashed version
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    // ✅ Send actual email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below:</p>
        <a href="${resetUrl}" target="_blank">Reset Password</a>
        <p>This link expires in <strong>15 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    logger.info(`Password reset email sent to: ${email}`);

    return res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent'
    });

  } catch (error) {
    logger.error('Forgot Password Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // ✅ Validate password strength
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8+ characters with uppercase, lowercase, number and special character'
      });
    }

    // ✅ Hash the incoming raw token and compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    logger.info(`Password reset successful for user: ${user._id}`);

    return res.json({ success: true, message: 'Password reset successful' });

  } catch (error) {
    logger.error('Reset Password Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};