const User = require('../models/User');
const Appointment = require('../models/Appointment');
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

const sendDoctorWelcomeEmails = async ({ doctor, admin, rawPassword }) => {
  const doctorHtml = `
    <h2>Welcome to ${admin.clinicName}!</h2>
    <p>Hi Dr. ${doctor.staffname},</p>
    <p>Your doctor account has been created. Here are your login credentials:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${doctor.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
      ${doctor.specialization ? `
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Specialization:</td>
        <td style="padding:8px 0;">${doctor.specialization}</td>
      </tr>` : ''}
    </table>
    <p style="color:#e53e3e;">
      <strong>Please change your password immediately after logging in.</strong>
    </p>
    <p>Login here: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
    <br/>
    <p>Regards,<br/>${admin.clinicName} Team</p>
  `;

  const adminHtml = `
    <h2>New Doctor Added — ${admin.clinicName}</h2>
    <p>A new doctor account has been created:</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Name:</td>
        <td style="padding:8px 0;">Dr. ${doctor.staffname}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Email:</td>
        <td style="padding:8px 0;">${doctor.email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Phone:</td>
        <td style="padding:8px 0;">${doctor.phone || 'N/A'}</td>
      </tr>
      ${doctor.specialization ? `
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Specialization:</td>
        <td style="padding:8px 0;">${doctor.specialization}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:8px 16px 8px 0; font-weight:bold;">Temporary Password:</td>
        <td style="padding:8px 0;">${rawPassword}</td>
      </tr>
    </table>
    <p>This is an automated notification.</p>
  `;

  await Promise.all([
    sendEmail({
      to: doctor.email,
      subject: `Welcome to ${admin.clinicName} — Your Login Credentials`,
      html: doctorHtml
    }),
    sendEmail({
      to: admin.email, // ✅ ADMIN user's email = clinic's email
      subject: `New Doctor Added — Dr. ${doctor.staffname}`,
      html: adminHtml
    })
  ]);
};

// ─── Create Doctor ────────────────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { staffname, email, phone, specialization, available } = req.body;

    if (!staffname || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

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
    }).select('clinicName email');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Clinic admin not found'
      });
    }

    const rawPassword = generateStrongPassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const doctor = await User.create({
      clinicId: req.user.clinicId, // ✅ ADMIN's _id
      staffname: staffname.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim(),
      password: hashedPassword,
      role: 'DOCTOR',
      specialization: specialization?.trim(),
      available: available ?? true
    });

    // ✅ Non-blocking — doctor is created even if email fails
    sendDoctorWelcomeEmails({ doctor, admin, rawPassword }).catch((emailErr) => {
      logger.error('Doctor welcome email failed', {
        doctorId: doctor._id,
        error: emailErr.message
      });
    });

    logger.info(`Doctor created: ${doctor._id} for clinic admin: ${req.user.clinicId}`);

    const { password: _pw, resetPasswordToken, resetPasswordExpire, ...safeDoctor } = doctor.toObject();

    return res.status(201).json({
      success: true,
      message: 'Doctor created successfully. Login credentials sent via email.',
      data: safeDoctor
    });

  } catch (err) {
    logger.error('Create Doctor Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Doctors ─────────────────────────────────────────────────────────────

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

    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const query = {
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    };

    if (specialization) {
      query.specialization = { $regex: specialization.trim(), $options: 'i' };
    }

    if (search) {
      query.staffname = { $regex: search.trim(), $options: 'i' };
    }

    if (active !== undefined) {
      query.available = active === 'true';
    }

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      query._id = sort === 'asc'
        ? { $gt: new mongoose.Types.ObjectId(cursor) }
        : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const doctors = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = doctors.length > pageLimit;
    if (hasNextPage) doctors.pop();

    const nextCursor = doctors.length > 0 ? doctors[doctors.length - 1]._id : null;

    return res.json({
      success: true,
      count: doctors.length,
      hasNextPage,
      nextCursor,
      data: doctors
    });

  } catch (err) {
    logger.error('List Doctors Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Doctor By ID ─────────────────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
    }

    const doctor = await User.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    }).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const [total, completed, pending, cancelled] = await Promise.all([
      Appointment.countDocuments({ clinicId: req.user.clinicId, doctorId: doctor._id }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, doctorId: doctor._id, status: 'COMPLETED' }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, doctorId: doctor._id, status: 'PENDING' }),
      Appointment.countDocuments({ clinicId: req.user.clinicId, doctorId: doctor._id, status: 'CANCELLED' })
    ]);

    return res.json({
      success: true,
      data: {
        doctor,
        appointmentStats: { total, completed, pending, cancelled }
      }
    });

  } catch (err) {
    logger.error('Get Doctor Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Doctor ────────────────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
    }

    // ✅ Strip sensitive fields — can never be updated via this endpoint
    const {
      password,
      role,
      clinicId,
      resetPasswordToken,
      resetPasswordExpire,
      plan,
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

    const doctor = await User.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId, role: 'DOCTOR' },
      safeUpdates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    logger.info(`Doctor updated: ${id} by admin: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor
    });

  } catch (err) {
    logger.error('Update Doctor Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Doctor ────────────────────────────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
    }

    const appointmentCount = await Appointment.countDocuments({
      clinicId: req.user.clinicId,
      doctorId: id
    });

    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete doctor with ${appointmentCount} existing appointment(s). Consider deactivating instead.`
      });
    }

    const doctor = await User.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId,
      role: 'DOCTOR'
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    logger.info(`Doctor deleted: ${id} by admin: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Doctor Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};