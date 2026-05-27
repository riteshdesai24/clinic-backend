const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    date: {
      // Stored as YYYY-MM-DD string for easy day-level querying
      type: String,
      required: true,
    },

    clockIn: {
      type: Date,
      default: null,
    },

    clockOut: {
      type: Date,
      default: null,
    },

    // Total working minutes for the day (set on clock-out)
    durationMinutes: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'],
      default: 'PRESENT',
    },

    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// One record per staff per day per clinic
AttendanceSchema.index({ clinicId: 1, staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
