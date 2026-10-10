const User = require('../models/User');
const logger = require('../utils/logger');

const editableFields = {
  ADMIN: ['clinicName', 'phone', 'email'],
  STAFF: ['staffname', 'phone', 'email'],
  DOCTOR: ['staffname', 'phone', 'email', 'specialization']
};

const profileData = (user) => {
  const { password, resetPasswordToken, resetPasswordExpire, ...profile } = user.toObject();
  return profile;
};

exports.getCurrent = (req, res) => {
  return res.json({ success: true, data: profileData(req.user) });
};

exports.updateCurrent = async (req, res) => {
  try {
    const allowedFields = editableFields[req.user.role] || [];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== 'string') {
        return res.status(400).json({ success: false, message: `${field} must be a string` });
      }
      updates[field] = req.body[field].trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No editable profile fields provided' });
    }

    for (const field of ['email', 'clinicName', 'staffname']) {
      if (updates[field] !== undefined && !updates[field]) {
        return res.status(400).json({ success: false, message: `${field} cannot be empty` });
      }
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      const existingUser = await User.exists({
        email: updates.email,
        _id: { $ne: req.user._id }
      });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
    }

    req.user.set(updates);
    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData(req.user)
    });
  } catch (err) {
    logger.error('Update Profile Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.deactivateCurrent = async (req, res) => {
  try {
    req.user.isActive = false;
    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile deactivated successfully'
    });
  } catch (err) {
    logger.error('Deactivate Profile Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};