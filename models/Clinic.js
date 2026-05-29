const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    address: {
      street: { type: String, trim: true },
      city:   { type: String, trim: true },
      state:  { type: String, trim: true },
      zip:    { type: String, trim: true },
      country:{ type: String, trim: true, default: 'India' }
    },

    plan: {
      type: String,
      enum: ['BRONZE', 'GOLD', 'PLATINUM'],
      default: 'GOLD' // 🔄 Change to 'BRONZE' when plan system is ready
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // 🔄 For future plan/billing system
    planActivatedAt: {
      type: Date,
      default: Date.now
    },

    planExpiresAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Clinic', ClinicSchema);