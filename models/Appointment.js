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
      ref: 'User',
      required: true
      // ❌ removed index:true
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
appointmentSchema.index({ clinicId: 1, startTime: 1 }); // calendar
appointmentSchema.index({ clinicId: 1, status: 1 });    // dashboard
appointmentSchema.index({ doctorId: 1 });               // doctor view
appointmentSchema.index({ clinicId: 1, _id: 1 });        // pagination

module.exports = mongoose.model('Appointment', appointmentSchema);
