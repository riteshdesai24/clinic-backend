const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },    // e.g. "500mg"
    frequency: { type: String, trim: true }, // e.g. "Twice a day"
    duration: { type: String, trim: true }   // e.g. "5 days"
  },
  { _id: false }
);

const RecordedTreatmentSchema = new mongoose.Schema(
  {
    treatmentMasterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentType',
      required: true
    },
    treatmentName: { type: String, trim: true, required: true },
    treatmentPrice: { type: Number, min: 0 }
  },
  { _id: false }
);

const TreatmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ✅ ADMIN user = clinic
      required: true,
      index: true
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ✅ DOCTOR user
      required: true,
      index: true
    },

    treatmentMasterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentType'
    },

    treatmentName: {
      type: String,
      trim: true
    },

    treatmentPrice: {
      type: Number,
      min: 0
    },

    treatments: {
      type: [RecordedTreatmentSchema],
      default: []
    },

    diagnosis: {
      type: String,
      required: true,
      trim: true
    },

    medicines: {
      type: [MedicineSchema],
      default: []
    },

    notes: {
      type: String,
      trim: true
    },

    followUpDate: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Treatment', TreatmentSchema);