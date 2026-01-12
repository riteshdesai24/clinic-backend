const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['FREE', 'SILVER', 'GOLD'],
      unique: true,
      required: true,
      index: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    staffAllowed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
