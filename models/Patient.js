const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({

  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Basic Info
  firstName: {
    type: String,
    required: true,
    index: true
  },

  lastName: {
    type: String,
    required: true,
    index: true
  },

  phone: {
    type: String,
    required: true,
    index: true
  },

  email: {
    type: String
  },

  age: {
    type: Number
  },

  gender: {
    type: String,
    enum: ['MALE', 'FEMALE', 'OTHER'],
    required: true
  },

  // Address
  address1: String,
  address2: String,
  address3: String,

  pincode: String,

  // Medical
  medicalAllergies: {
    type: String
  }

}, {
  timestamps: true
});

// Prevent duplicate patient per clinic
patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Patient', patientSchema);
