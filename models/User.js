const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
    },

    staffname: String,

    email: {
      type: String,
      unique: true,
      required: true,
    },

    phone: String,

    password: {
      type: String,
      select: false,
      required: true,
    },

    role: {
      type: String,
      enum: ['ADMIN', 'STAFF', 'DOCTOR'],
      default: 'ADMIN',
    },

    // Doctor fields
    specialization: String,

    available: {
      type: Boolean,
      default: true,
    },

    // 🔐 Forgot password fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
