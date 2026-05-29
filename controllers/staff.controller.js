const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateStrongPassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const all = upper + lower + numbers + special;

  const password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
    ...Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)])
  ];

  return password.sort(() => Math.random() - 0.5).join('');
};

const sendStaffWelcomeEmails = async ({ staff, admin, rawPassword }) => {
  const staffHtml = `
    <h2>Welcome to ${admin.clinicName}!</h2>
    <p>Hi ${staff.staffname},</p>
    <p>Your staff account has been created. Here are your login credentials:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${staff.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Role:</td>
        <td style="padding:8px 0;">${staff.role}</td>
      </tr>
    </table>
    <p style="color:#e53e3e;">
      <strong>Please change your password immediately after logging in.</strong>
    </p>
    <p>Login here: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
    <br/>
    <p>Regards,<br/>${admin.clinicName} Team</p>
  `;

  const adminHtml = `
    <h2>New Staff Added — ${admin.clinicName}</h2>
    <p>A new staff account has been created:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Name:</td>
        <td style="padding:8px 0;">${staff.staffname}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${staff.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Phone:</td>
        <td style="padding:8px 0;">${staff.phone || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Role:</td>
        <td style="padding:8px 0;">${staff.role}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Temporary Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
    </table>
    <p>This is an automated notification.</p>
  `;

  await Promise.all([
    sendEmail({
      to: staff.email,
      subject: `Welcome to ${admin.clinicName} — Your Login Credentials`,
      html: staffHtml
    }),
    sendEmail({
      to: admin.email, // ✅ ADMIN user's email = clinic email
      subject: `New Staff Added — ${staff.staffname}`,
      html: adminHtml
    })
  ]);
};

// ─── Create Staff ─────────────────────────────────────────────────────────────

exports.createStaff = async (req, res) => {
  try {
    const { staffname, email, phone, role } = req.body;

    // ✅ Validate required fields
    if (!staffname || !email || !phone || !role) {
      return res.status(400).json({
        success: false,
        message: 'staffname, email, phone and role are required'
      });
    }

    // ✅ Only STAFF allowed via this controller — DOCTOR has its own controller
    if (role !== 'STAFF') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Use the doctors endpoint to create doctors.'
      });
    }

    // ✅ Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // ✅ Check duplicate globally (email is unique across all users)
    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // ✅ Fetch ADMIN user as clinic — clinicId in token = ADMIN's _id
    const admin = await User.findOne({
      _id: req.user.clinicId,
      role: 'ADMIN'
    }).select('clinicName email plan');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Clinic admin not found'
      });
    }

    // ✅ Plan check — only GOLD and above can add staff
    if (admin.plan === 'BRONZE') {
      return res.status(403).json({
        success: false,
        message: 'Upgrade your plan to add staff members'
      });
    }

    const rawPassword = generateStrongPassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const staff = await User.create({
      clinicId: req.user.clinicId, // ✅ ADMIN's _id
      staffname: staffname.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: hashedPassword,
      role: 'STAFF'
    });

    // ✅ Non-blocking — staff is created even if email fails
    sendStaffWelcomeEmails({ staff, admin, rawPassword }).catch((emailErr) => {
      logger.error('Staff welcome email failed', {
        staffId: staff._id,
        error: emailErr.message
      });
    });

    logger.info(`Staff created: ${staff._id} for clinic admin: ${req.user.clinicId}`);

    const { password: _pw, resetPasswordToken, resetPasswordExpire, ...safeStaff } = staff.toObject();

    return res.status(201).json({
      success: true,
      message: 'Staff created successfully. Login credentials sent via email.',
      data: safeStaff
    });

  } catch (err) {
    logger.error('Create Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Staff ───────────────────────────────────────────────────────────────

exports.listStaff = async (req, res) => {
  try {
    const { cursor, limit = 10, search, sort = 'asc' } = req.query;

    // ✅ Sanitize limit
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const query = {
      clinicId: req.user.clinicId,
      role: 'STAFF'
    };

    if (search) {
      query.$or = [
        { staffname: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // ✅ Validate cursor
    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      query._id = sort === 'asc'
        ? { $gt: new mongoose.Types.ObjectId(cursor) }
        : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const staff = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = staff.length > pageLimit;
    if (hasNextPage) staff.pop();

    const nextCursor = staff.length > 0 ? staff[staff.length - 1]._id : null;

    return res.json({
      success: true,
      count: staff.length,
      hasNextPage,
      nextCursor,
      data: staff
    });

  } catch (err) {
    logger.error('List Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Staff By ID ──────────────────────────────────────────────────────────

exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff ID' });
    }

    const staff = await User.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'STAFF'
    }).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    return res.json({
      success: true,
      data: staff
    });

  } catch (err) {
    logger.error('Get Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Staff ─────────────────────────────────────────────────────────────

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff ID' });
    }

    // ✅ Strip sensitive fields — cannot be updated via this endpoint
    const {
      password,
      role,
      clinicId,
      plan,
      resetPasswordToken,
      resetPasswordExpire,
      ...safeUpdates
    } = req.body;

    // ✅ Validate email if being updated
    if (safeUpdates.email) {
      safeUpdates.email = safeUpdates.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(safeUpdates.email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      // ✅ Check email not taken by another user
      const emailExists = await User.findOne({
        email: safeUpdates.email,
        _id: { $ne: id }
      });
      if (emailExists) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    const staff = await User.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId, role: 'STAFF' },
      safeUpdates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    logger.info(`Staff updated: ${id} by admin: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Staff updated successfully',
      data: staff
    });

  } catch (err) {
    logger.error('Update Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Staff ─────────────────────────────────────────────────────────────

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff ID' });
    }

    const staff = await User.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'STAFF'
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    logger.info(`Staff deleted: ${id} by admin: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Staff deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};