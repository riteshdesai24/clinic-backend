const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSMS');
const logger = require('../utils/logger');
const { parseAutocompleteQuery } = require('../utils/autocomplete');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['STAFF', 'DOCTOR'];

const generateStrongPassword = () => {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const all     = upper + lower + numbers + special;

  const password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
    ...Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)])
  ];

  return password.sort(() => Math.random() - 0.5).join('');
};

// ─── Notifications ────────────────────────────────────────────────────────────

const sendWelcomeNotifications = async ({ member, admin, rawPassword }) => {
  const roleLabel = member.role === 'DOCTOR' ? 'Doctor' : 'Staff';

  const memberHtml = `
    <h2>Welcome to ${admin.clinicName}!</h2>
    <p>Hi ${member.staffname},</p>
    <p>Your ${roleLabel} account has been created at <strong>${admin.clinicName}</strong>. Here are your login credentials:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Clinic:</td>
        <td style="padding:8px 0;">${admin.clinicName}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${member.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Role:</td>
        <td style="padding:8px 0;">${member.role}</td>
      </tr>
      ${member.specialization ? `
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Specialization:</td>
        <td style="padding:8px 0;">${member.specialization}</td>
      </tr>` : ''}
    </table>
    <p style="color:#e53e3e;"><strong>Please change your password immediately after logging in.</strong></p>
    <p>Login here: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
    <br/>
    <p>Regards,<br/>${admin.clinicName} Team</p>
  `;

  const adminHtml = `
    <h2>New ${roleLabel} Added — ${admin.clinicName}</h2>
    <p>A new ${roleLabel} account has been created:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Name:</td>
        <td style="padding:8px 0;">${member.staffname}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${member.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Phone:</td>
        <td style="padding:8px 0;">${member.phone || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Role:</td>
        <td style="padding:8px 0;">${member.role}</td>
      </tr>
      ${member.specialization ? `
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Specialization:</td>
        <td style="padding:8px 0;">${member.specialization}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Temporary Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
    </table>
    <p>This is an automated notification.</p>
  `;

  const smsText =
    `Welcome to ${admin.clinicName}!\n` +
    `Your ${roleLabel} account is ready.\n` +
    `Email: ${member.email}\n` +
    `Password: ${rawPassword}\n` +
    `Please change your password after first login.\n` +
    `Login: ${process.env.FRONTEND_URL}/login`;

  await Promise.allSettled([
    sendEmail({
      to: member.email,
      subject: `Welcome to ${admin.clinicName} — Your Login Credentials`,
      html: memberHtml
    }),
    sendEmail({
      to: admin.email,
      subject: `New ${roleLabel} Added — ${member.staffname}`,
      html: adminHtml
    }),
    sendSMS({ to: member.phone, message: smsText })
  ]);
};

// ─── Create Staff / Doctor ────────────────────────────────────────────────────

exports.createStaff = async (req, res) => {
  try {
    const { staffname, email, phone, role, specialization } = req.body;

    if (!staffname || !email || !phone || !role) {
      return res.status(400).json({
        success: false,
        message: 'staffname, email, phone and role are required'
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`
      });
    }

    if (role === 'DOCTOR' && !specialization) {
      return res.status(400).json({
        success: false,
        message: 'specialization is required for DOCTOR role'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    // ✅ Admin is the logged-in user — use req.user._id
    const adminId = req.clinicId;
    const admin = await User.findOne({
      _id: adminId,
      role: 'ADMIN'
    }).select('clinicName email plan');

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Clinic admin not found' });
    }

    if (admin.plan === 'BRONZE') {
      return res.status(403).json({
        success: false,
        message: 'Upgrade your plan to add staff or doctors'
      });
    }

    const rawPassword    = generateStrongPassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    // ✅ clinicId = admin's _id, stamped on every staff/doctor they create
    const newMember = await User.create({
      clinicId:  req.clinicId,
      staffname: staffname.trim(),
      email:     email.trim().toLowerCase(),
      phone:     phone.trim(),
      password:  hashedPassword,
      role,
      ...(role === 'DOCTOR' && { specialization: specialization.trim() })
    });

    sendWelcomeNotifications({ member: newMember, admin, rawPassword }).catch((err) => {
      logger.error('Welcome notification failed', { memberId: newMember._id, error: err.message });
    });

    logger.info(`${role} created: ${newMember._id} for clinic: ${req.clinicId}`);

    const { password: _pw, resetPasswordToken, resetPasswordExpire, ...safeData } = newMember.toObject();

    return res.status(201).json({
      success: true,
      message: `${role} created successfully. Login credentials sent via email and SMS.`,
      data: safeData
    });

  } catch (err) {
    logger.error('Create Member Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Staff / Doctors ─────────────────────────────────────────────────────

exports.listStaff = async (req, res) => {
  try {
    const { cursor, limit = 10, search, sort = 'asc', role } = req.query;

    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // ✅ Filter by specific role if provided, otherwise return both
    const query = {
      clinicId: req.clinicId,
      role: role && ALLOWED_ROLES.includes(role)
        ? role
        : { $in: ALLOWED_ROLES }
    };

    if (search) {
      query.$or = [
        { staffname: { $regex: search.trim(), $options: 'i' } },
        { email:     { $regex: search.trim(), $options: 'i' } }
      ];
    }

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      query._id = sort === 'asc'
        ? { $gt: new mongoose.Types.ObjectId(cursor) }
        : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const members = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = members.length > pageLimit;
    if (hasNextPage) members.pop();

    const nextCursor = members.length > 0 ? members[members.length - 1]._id : null;

    return res.json({
      success: true,
      count: members.length,
      hasNextPage,
      nextCursor,
      data: members
    });

  } catch (err) {
    logger.error('List Staff Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.autocomplete = async (req, res) => {
  try {
    const { term, regex, limit } = parseAutocompleteQuery(req.query);
    if (!term) return res.json({ success: true, count: 0, data: [] });

    const query = {
      clinicId: req.clinicId,
      isActive: true,
      role: { $in: ALLOWED_ROLES },
      $or: [
        { staffname: regex },
        { email: regex },
        { phone: regex }
      ]
    };

    if (ALLOWED_ROLES.includes(req.query.role)) query.role = req.query.role;

    const members = await User.find(query)
      .select('staffname email phone role specialization')
      .sort({ staffname: 1 })
      .limit(limit)
      .lean();

    const data = members.map((member) => ({
      id: member._id,
      value: member._id,
      label: member.staffname,
      subtitle: [member.role, member.specialization || member.email].filter(Boolean).join(' · '),
      role: member.role,
      email: member.email,
      phone: member.phone
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('Staff autocomplete error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Staff / Doctor By ID ─────────────────────────────────────────────────

exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const member = await User.findOne({
      _id: id,
      clinicId: req.clinicId,
      role: { $in: ALLOWED_ROLES }
    }).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    return res.json({ success: true, data: member });

  } catch (err) {
    logger.error('Get Member Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Staff / Doctor ────────────────────────────────────────────────────

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const {
      password, role, clinicId, plan,
      resetPasswordToken, resetPasswordExpire,
      ...safeUpdates
    } = req.body;

    if (safeUpdates.email) {
      safeUpdates.email = safeUpdates.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(safeUpdates.email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      const emailExists = await User.findOne({
        email: safeUpdates.email,
        _id: { $ne: id }
      });
      if (emailExists) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    const member = await User.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId, role: { $in: ALLOWED_ROLES } },
      safeUpdates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    logger.info(`Member updated: ${id} by admin: ${req.user._id}`);

    return res.json({ success: true, message: 'Updated successfully', data: member });

  } catch (err) {
    logger.error('Update Member Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Staff / Doctor ────────────────────────────────────────────────────

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const member = await User.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId,
      role: { $in: ALLOWED_ROLES }
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    logger.info(`Member deleted: ${id} by admin: ${req.user._id}`);

    return res.json({ success: true, message: 'Deleted successfully' });

  } catch (err) {
    logger.error('Delete Member Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};