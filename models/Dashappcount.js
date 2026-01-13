const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    startTime: {
      type: Date,
      required: true,
      index: true
    },

    endTime: {
      type: Date
    },

    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    }
  },
  { timestamps: true }
);

// Indexes for fast dashboard queries
appointmentSchema.index({ clinicId: 1, startTime: 1 });
appointmentSchema.index({ clinicId: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
