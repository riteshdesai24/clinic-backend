const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ✅ ADMIN user = clinic
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    age: {
      type: Number,
      min: 0,
      max: 150
    },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      uppercase: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true
    },

    address: {
      type: String,
      trim: true
    },

    medicalHistory: {
      type: String,
      trim: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ✅ Compound index — phone unique per clinic
PatientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Patient', PatientSchema);