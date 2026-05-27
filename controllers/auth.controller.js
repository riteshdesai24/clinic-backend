const Clinic = require('../models/Clinic');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

/**
 * ============================
 * REGISTER CLINIC
 * ============================
 */
exports.registerClinic = async (req, res) => {
  try {
    let { clinicName, phone, email, password } = req.body;

    // ✅ CLEAN INPUT
    email = email?.trim().toLowerCase();

    if (!clinicName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'clinicName, email and password are required'
      });
    }

    // ✅ CHECK DUPLICATE
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // ✅ CREATE CLINIC
    const clinic = await Clinic.create({ name: clinicName, phone });

    // ✅ HASH PASSWORD
    const hashedPassword = bcrypt.hashSync(password, 10);

    // ✅ CREATE USER
    const user = await User.create({
      clinicId: clinic._id,
      email,
      password: hashedPassword,
      role: 'ADMIN'
    });

    // ✅ TOKEN
    const token = jwt.sign(
      {
        userId: user._id,
        clinicId: clinic._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

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
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required'
      });
    }

    const user = await User.findOne({ email })
      .select('+password')
      .populate('clinicId');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        clinicId: user.clinicId._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

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

/**
 * ============================
 * FORGOT PASSWORD (SECURE)
 * ============================
 */

exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;

    // ✅ Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // ✅ Clean email
    email = email.trim().toLowerCase();

    // ✅ Find user
    const user = await User.findOne({ email });
    console.log('DB NAME:', User.db.name);
    // ❌ If user NOT found
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${email} does not exist`
      });
    }

    // ✅ Generate token
    const token = crypto.randomBytes(32).toString('hex');

    // ✅ Save token in DB
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // 🔗 Reset link
    const resetLink = `http://localhost:4200/#/auth/reset-password?token=${token}`;

    // 📧 Email HTML
    const html = `
      <div style="font-family: Arial; padding: 20px;">
        <h2 style="color:#333;">Reset Your Password</h2>

        <p>Hello,</p>
        <p>You requested to reset your password.</p>

        <a href="${resetLink}" 
          style="
            display:inline-block;
            background:#4f46e5;
            color:#fff;
            padding:12px 20px;
            text-decoration:none;
            border-radius:6px;
            margin-top:10px;
          ">
          Reset Password
        </a>

        <p style="margin-top:20px;">
          This link will expire in 1 hour.
        </p>

        <p>If you did not request this, ignore this email.</p>
      </div>
    `;

    // 📧 Send email
    await sendEmail(email, 'Reset Your Password', html);

    // ✅ Success response
    return res.status(200).json({
      success: true,
      message: `Reset link sent to ${email}`
    });

  } catch (error) {
    console.error('Forgot Password Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later'
    });
  }
};

/**
 * ============================
 * RESET PASSWORD
 * ============================
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'token and newPassword are required'
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * ============================
 * CHANGE PASSWORD
 * ============================
 */
exports.changePassword = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(payload.userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = bcrypt.compareSync(oldPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Old password incorrect'
      });
    }

    user.password = bcrypt.hashSync(newPassword, 10);

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