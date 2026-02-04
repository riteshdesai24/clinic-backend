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
    },

    phone: String,

    password: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ['ADMIN', 'STAFF', 'DOCTOR'],
      default: 'ADMIN',
    },

    // Doctor specific fields
    specialization: String,

    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
