const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      index: true
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // or 'Doctor'
      required: true,
      index: true
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },

    startTime: {
      type: Date,
      required: true,
      index: true
    },

    endTime: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },

    notes: String
  },
  { timestamps: true }
);

// ✅ Performance indexes
appointmentSchema.index({ clinicId: 1, startTime: 1 });
appointmentSchema.index({ clinicId: 1, status: 1 });
appointmentSchema.index({ doctorId: 1 });
appointmentSchema.index({ clinicId: 1, _id: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
