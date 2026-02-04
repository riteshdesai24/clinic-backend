const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      index: true // keep this (used everywhere)
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
      // ❌ removed index:true
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
      // ❌ removed index:true
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
      // ❌ removed index:true
    },

    description: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

// ✅ Performance indexes
treatmentSchema.index({ clinicId: 1, appointmentId: 1 });
treatmentSchema.index({ clinicId: 1, patientId: 1 });
treatmentSchema.index({ doctorId: 1 });

module.exports = mongoose.model('Treatment', treatmentSchema);
