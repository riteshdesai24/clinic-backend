const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    // For STAFF and DOCTOR — points to the ADMIN user's _id
    // For ADMIN — null/undefined
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',  // ✅ self-reference to User (ADMIN), not Clinic
      index: true
    },

    staffname: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    password: {
      type: String,
      select: false,
      required: true
    },

    role: {
      type: String,
      enum: ['ADMIN', 'STAFF', 'DOCTOR'],
      default: 'ADMIN'
    },

    // Only meaningful on ADMIN users
    plan: {
      type: String,
      enum: ['BRONZE', 'GOLD', 'PLATINUM'],
      default: 'GOLD' // 🔄 Change to 'BRONZE' when plan system is ready
    },

    // Only meaningful on ADMIN users
    clinicName: {
      type: String,
      trim: true
    },

    // Doctor-only fields
    specialization: {
      type: String,
      trim: true
    },

    available: {
      type: Boolean,
      default: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // 🔐 Forgot password (stored as SHA-256 hash)
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);