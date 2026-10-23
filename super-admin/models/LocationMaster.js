const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
countrySchema.index({ name: 1 }, { unique: true });

const stateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
stateSchema.index({ name: 1, country: 1 }, { unique: true });

const citySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
citySchema.index({ name: 1, state: 1 }, { unique: true });

module.exports = {
  Country: mongoose.models.Country || mongoose.model('Country', countrySchema),
  State: mongoose.models.State || mongoose.model('State', stateSchema),
  City: mongoose.models.City || mongoose.model('City', citySchema)
};
