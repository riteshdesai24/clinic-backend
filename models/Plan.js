const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
      index: true
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Plan price must be a whole number of rupees' }
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    features: {
      type: [{ type: String, trim: true }],
      default: []
    },

    durationMonths: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 36,
      validate: { validator: Number.isInteger, message: 'Plan duration must be a whole number of months' }
    },

    staffAllowed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
