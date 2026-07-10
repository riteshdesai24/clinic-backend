const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema(
  {
    insuranceCompany: {
      type: String,
      trim: true
    },
    insuranceSubCompany: {
      type: String,
      trim: true
    },
    insurancePolicy: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    insuranceIdNumber: {
      type: String,
      trim: true
    },
    companyName: {
      type: String,
      trim: true
    },
    policyNumber: {
      type: String,
      trim: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    coverageType: {
      type: String,
      trim: true
    },
    planType: {
      type: String,
      trim: true
    },
    premiumAmount: {
      type: Number,
      min: 0
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    holderName: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      trim: true
    },
    contactPhone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING'],
      default: 'ACTIVE'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Insurance', insuranceSchema);
