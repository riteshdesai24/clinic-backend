const mongoose = require('mongoose');

const TreatmentTypeSchema = new mongoose.Schema(
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

    description: {
      type: String,
      trim: true
    },

    duration: {
      type: Number, // in minutes
      min: 0
    },

    price: {
      type: Number,
      min: 0
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TreatmentType', TreatmentTypeSchema);
