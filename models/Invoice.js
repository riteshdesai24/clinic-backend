const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const InvoicePaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER'], trim: true, default: 'CASH' },
  reference: { type: String, trim: true },
  paidAt: { type: Date, default: Date.now }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  treatmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Treatment' },
  treatmentName: { type: String, trim: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [InvoiceItemSchema], required: true, validate: value => value.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  gstRate: { type: Number, default: 18, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'], default: 'ISSUED', index: true },
  issuedAt: { type: Date, default: Date.now },
  dueDate: Date,
  payments: { type: [InvoicePaymentSchema], default: [] },
  notes: { type: String, trim: true }
}, { timestamps: true, optimisticConcurrency: true });

InvoiceSchema.index({ clinicId: 1, issuedAt: -1 });
InvoiceSchema.index({ clinicId: 1, doctorId: 1, issuedAt: -1 });
InvoiceSchema.index(
  { clinicId: 1, appointmentId: 1 },
  { unique: true, partialFilterExpression: { treatmentId: { $exists: true } } }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
