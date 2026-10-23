const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true },
  description: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ name: 1 }, { unique: true });
schema.index({ code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('LabMaster', schema);
