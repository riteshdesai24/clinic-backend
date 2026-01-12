const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      index: true
    },

    specialization: {
      type: String,
      index: true
    },

    phone: {
      type: String,
      index: true
    },

    email: {
      type: String,
      index: true
    },

    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

// Performance indexes
doctorSchema.index({ clinicId: 1, _id: 1 });
doctorSchema.index({ clinicId: 1, specialization: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
