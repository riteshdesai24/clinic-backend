const mongoose = require('mongoose');

const ConditionSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['MEDICAL', 'DENTAL'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }
}, { timestamps: true });

ConditionSchema.index({ clinicId: 1, type: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Condition', ConditionSchema);
