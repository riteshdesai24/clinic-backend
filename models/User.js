const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
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

    plan: {
      type: String,
      enum: ['BRONZE', 'GOLD', 'PLATINUM'],
      default: 'GOLD' // 🔄 Change to 'BRONZE' when plan system is ready
    },

    // Doctor fields
    specialization: {
      type: String,
      trim: true
    },

    available: {
      type: Boolean,
      default: true
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true
    },

    // 🔐 Forgot password fields (token stored as SHA-256 hash)
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);