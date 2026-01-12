const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true
    },

    name: {
      type: String,
      required: true,
      index: true
    },

    phone: {
      type: String,
      index: true
    },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      index: true
    },

    age: Number
  },
  { timestamps: true }
);

// Performance indexes
patientSchema.index({ clinicId: 1, _id: 1 });
patientSchema.index({ clinicId: 1, gender: 1 });

module.exports = mongoose.model('Patient', patientSchema);
