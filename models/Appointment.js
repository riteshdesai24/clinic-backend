const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true
    },
    // ✅ NEW: time stored as "HH:MM" string (e.g. "14:30")
    time: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'Time must be in HH:MM format']
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    notes: {
      type: String,
      trim: true
    },
    treatmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Treatment',
      default: null
    },
    // ✅ NEW: soft-delete meta
    cancelledAt: {
      type: Date,
      default: null
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', AppointmentSchema);