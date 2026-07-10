const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ✅ ADMIN user = clinic
      required: true,
      index: true
    },

    // ── Personal Info ──────────────────────────────────────
    title: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    suffix: { type: String, trim: true },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'TRANSGENDER', 'UNKNOWN'],
      uppercase: true,
      trim: true
    },

    dob: { type: Date },
    age: { type: Number, min: 0, max: 150 },

    maritalStatus: {
      type: String,
      enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'],
      uppercase: true,
      trim: true
    },

    // ── Contact ─────────────────────────────────────────────
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    otherMobile: { type: String, trim: true },
    workEmail: { type: String, lowercase: true, trim: true },
    landlineNumber: { type: String, trim: true },
    areaCode: { type: String, trim: true },

    emergencyContactName: { type: String, trim: true },
    emergencyContactNumber: { type: String, trim: true },
    spouseName: { type: String, trim: true },
    spouseContactNumber: { type: String, trim: true },
    generalPractitioner: { type: String, trim: true },

    // ── Address ─────────────────────────────────────────────
    address1: { type: String, trim: true },
    address2: { type: String, trim: true },
    address3: { type: String, trim: true },
    locality: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'IN' },
    pincode: { type: String, trim: true },

    // ── Medical ─────────────────────────────────────────────
    medicalAllergies: { type: String, trim: true },
    medicalConditions: [{ type: String, trim: true }],
    dentalConditions: [{ type: String, trim: true }],
    currentMedications: { type: String, trim: true },
    allergicTo: { type: String, trim: true },
    habits: { type: String, trim: true },

    // ── Insurance ───────────────────────────────────────────
    insuranceCompany: { type: String, trim: true },
    insuranceSubCompany: { type: String, trim: true },
    insurancePolicy: { type: String, trim: true },
    insuranceIdNumber: { type: String, trim: true },

    // ── Demographics ────────────────────────────────────────
    language: { type: String, trim: true, default: 'ENGLISH' },
    religion: { type: String, trim: true, default: 'UNKNOWN' },
    occupation: { type: String, trim: true, default: 'UNKNOWN' },
    ethnicGroup: { type: String, trim: true },
    race: { type: String, trim: true },
    bloodGroup: { type: String, trim: true },
    discProfile: { type: String, trim: true },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ✅ Compound index — phone unique per clinic
PatientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });

// Convenience virtual so anything still reading `name` (old reports, exports)
// doesn't break outright. Not stored — derived on read.
PatientSchema.virtual('name').get(function () {
  return [this.title, this.firstName, this.middleName, this.lastName, this.suffix]
    .filter(Boolean)
    .join(' ');
});

PatientSchema.set('toJSON', { virtuals: true });
PatientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Patient', PatientSchema);