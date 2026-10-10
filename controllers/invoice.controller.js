const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Appointment = require('../models/Appointment');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const logger = require('../utils/logger');

const validPeriods = ['week', 'month'];
const paymentMethods = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER'];
const toCents = value => Math.round((Number(value) + Number.EPSILON) * 100);
const fromCents = value => value / 100;
const periodStart = (period, now = new Date()) => {
  if (period === 'week') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    return start;
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

exports.create = async (req, res) => {
  try {
    const { appointmentId, items = [], treatmentPrice, taxAmount = 0, dueDate, notes } = req.body;
    if (!mongoose.Types.ObjectId.isValid(appointmentId) || !Array.isArray(items) || items.length > 50) {
      return res.status(400).json({ success: false, message: 'A valid appointmentId and at most 50 additional items are required' });
    }
    const appointment = await Appointment.findOne({ _id: appointmentId, clinicId: req.clinicId })
      .populate('patientId', 'name phone email')
      .populate('doctorId', 'staffname');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found in this clinic' });
    if (appointment.status === 'CANCELLED') return res.status(409).json({ success: false, message: 'Cannot invoice a cancelled appointment' });
    const appointmentDoctorId = appointment.doctorId?._id || appointment.doctorId;
    const appointmentPatientId = appointment.patientId?._id || appointment.patientId;
    if (!mongoose.Types.ObjectId.isValid(appointmentDoctorId) || !mongoose.Types.ObjectId.isValid(appointmentPatientId)) {
      return res.status(409).json({ success: false, message: 'Appointment has an invalid patient or doctor reference' });
    }
    if (req.user.role === 'DOCTOR' && String(appointmentDoctorId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only invoice your own appointments' });
    }

    if (!appointment.treatmentId) {
      return res.status(409).json({ success: false, message: 'Record the treatment for this appointment before invoicing' });
    }
    const treatment = await Treatment.findOne({
      _id: appointment.treatmentId,
      appointmentId: appointment._id,
      clinicId: req.clinicId
    }).populate('treatmentMasterId', 'name price');
    if (!treatment) return res.status(409).json({ success: false, message: 'The appointment treatment record is missing or invalid' });

    const existingInvoice = await Invoice.findOne({ clinicId: req.clinicId, appointmentId: appointment._id });
    if (existingInvoice) return res.status(409).json({ success: false, message: 'An invoice already exists for this appointment', data: existingInvoice });

    const patient = await Patient.findOne({ _id: appointmentPatientId, clinicId: req.clinicId });
    const doctor = await User.findOne({ _id: appointmentDoctorId, clinicId: req.clinicId, role: 'DOCTOR' });
    if (!patient || !doctor) return res.status(400).json({ success: false, message: 'Appointment patient or doctor is invalid' });

    const catalogPrice = treatment.treatmentPrice ?? treatment.treatmentMasterId?.price;
    const billedTreatmentPrice = treatmentPrice === undefined ? catalogPrice : Number(treatmentPrice);
    if (billedTreatmentPrice === undefined || !Number.isFinite(billedTreatmentPrice) || billedTreatmentPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'The treatment has no catalog price; provide a non-negative treatmentPrice to invoice it'
      });
    }

    const normalizedItems = [{
      description: treatment.treatmentName || treatment.treatmentMasterId?.name || treatment.diagnosis,
      quantity: 1,
      unitPrice: fromCents(toCents(billedTreatmentPrice)),
      amount: fromCents(toCents(billedTreatmentPrice))
    }];

    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ success: false, message: 'Each additional invoice item must be an object' });
      }
      const description = typeof item.description === 'string' ? item.description.trim() : '';
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!description || description.length > 200 || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10000000) {
        return res.status(400).json({ success: false, message: 'Each additional item needs a description, integer quantity, and non-negative unitPrice' });
      }
      const unitPriceCents = toCents(unitPrice);
      normalizedItems.push({
        description,
        quantity,
        unitPrice: fromCents(unitPriceCents),
        amount: fromCents(unitPriceCents * quantity)
      });
    }

    const subtotalCents = normalizedItems.reduce((sum, item) => sum + toCents(item.amount), 0);
    const tax = Number(taxAmount);
    if (!Number.isFinite(tax) || tax < 0 || tax > 10000000) return res.status(400).json({ success: false, message: 'taxAmount must be a non-negative INR amount' });
    const taxCents = toCents(tax);
    let parsedDueDate;
    if (dueDate !== undefined) {
      parsedDueDate = new Date(dueDate);
      if (Number.isNaN(parsedDueDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid dueDate' });
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) {
      return res.status(400).json({ success: false, message: 'notes must be a string of 2000 characters or fewer' });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const invoice = await Invoice.create({
      clinicId: req.clinicId,
      invoiceNumber,
      appointmentId: appointment._id,
      treatmentId: treatment._id,
      treatmentName: treatment.treatmentName || treatment.treatmentMasterId?.name || treatment.diagnosis,
      patientId: patient._id,
      doctorId: doctor._id,
      items: normalizedItems,
      subtotal: fromCents(subtotalCents),
      taxAmount: fromCents(taxCents),
      totalAmount: fromCents(subtotalCents + taxCents),
      dueDate: parsedDueDate,
      notes
    });
    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'An invoice already exists for this appointment' });
    logger.error('Create Invoice Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not create invoice' });
  }
};

exports.list = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = { clinicId: req.clinicId };
    if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
    else if (req.query.doctorId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.doctorId)) return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      query.doctorId = req.query.doctorId;
    }
    if (req.query.appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.appointmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid appointmentId' });
      }
      query.appointmentId = req.query.appointmentId;
    }
    if (req.query.status) query.status = String(req.query.status).toUpperCase();
    const [data, count] = await Promise.all([
      Invoice.find(query).populate('patientId', 'name phone').populate('doctorId', 'staffname').populate('treatmentId', 'diagnosis treatmentName treatmentMasterId').sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Invoice.countDocuments(query)
    ]);
    return res.json({ success: true, page, limit, count, totalPages: Math.ceil(count / limit), data });
  } catch (error) {
    logger.error('List Invoices Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not load invoices' });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Number(req.body.amount);
    const amountCents = toCents(amount);
    if (!mongoose.Types.ObjectId.isValid(id) || !Number.isFinite(amount) || amountCents <= 0 || !paymentMethods.includes(String(req.body.method || 'CASH').toUpperCase())) {
      return res.status(400).json({ success: false, message: 'A valid invoice ID and positive payment amount are required' });
    }
    const query = { _id: id, clinicId: req.clinicId, status: { $ne: 'VOID' } };
    if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
    const invoice = await Invoice.findOne(query);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const paidCents = toCents(invoice.amountPaid);
    const totalCents = toCents(invoice.totalAmount);
    if (paidCents + amountCents > totalCents) return res.status(400).json({ success: false, message: 'Payment exceeds the outstanding balance' });
    invoice.payments.push({ amount: fromCents(amountCents), method: String(req.body.method || 'CASH').toUpperCase(), reference: req.body.reference, paidAt: new Date() });
    invoice.amountPaid = fromCents(paidCents + amountCents);
    invoice.status = paidCents + amountCents === totalCents ? 'PAID' : 'PARTIALLY_PAID';
    await invoice.save();
    return res.json({ success: true, data: invoice });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({ success: false, message: 'Invoice changed during payment; reload and retry' });
    }
    logger.error('Record Invoice Payment Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not record invoice payment' });
  }
};

exports.dashboardSummary = async (req, res) => {
  try {
    if (!['ADMIN', 'DOCTOR'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and doctors can view invoice totals' });
    }
    const period = String(req.query.period || 'month').toLowerCase();
    if (!validPeriods.includes(period)) return res.status(400).json({ success: false, message: 'period must be week or month' });
    const from = periodStart(period);
    const now = new Date();
    const clinicObjectId = new mongoose.Types.ObjectId(req.clinicId);
    const base = { clinicId: clinicObjectId, issuedAt: { $gte: from, $lte: now }, status: { $ne: 'VOID' } };
    const doctorId = req.user.role === 'DOCTOR' ? req.user._id : req.query.doctorId;
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) return res.status(400).json({ success: false, message: 'Invalid doctorId' });
      const doctor = await User.findOne({ _id: doctorId, clinicId: req.clinicId, role: 'DOCTOR' }).select('_id');
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found in this clinic' });
    }
    const doctorObjectId = doctorId ? new mongoose.Types.ObjectId(doctorId.toString()) : undefined;
    const scopedInvoiceQuery = { ...base };
    const scopedPaymentQuery = { clinicId: clinicObjectId, status: { $ne: 'VOID' } };
    if (doctorObjectId) {
      scopedInvoiceQuery.doctorId = doctorObjectId;
      scopedPaymentQuery.doctorId = doctorObjectId;
    }

    const doctorQuery = {
      clinicId: clinicObjectId,
      role: 'DOCTOR'
    };
    if (doctorObjectId) doctorQuery._id = doctorObjectId;

    const [invoiceTotals, paymentTotals, clinicDoctors] = await Promise.all([
      Invoice.aggregate([
        { $match: scopedInvoiceQuery },
        {
          $group: {
            _id: '$doctorId',
            invoiceCount: { $sum: 1 },
            invoicedAmount: { $sum: '$totalAmount' },
            outstandingAmount: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } }
          }
        }
      ]),
      Invoice.aggregate([
        { $match: scopedPaymentQuery },
        { $unwind: '$payments' },
        { $match: { 'payments.paidAt': { $gte: from, $lte: now } } },
        {
          $group: {
            _id: '$doctorId',
            paidAmount: { $sum: '$payments.amount' },
            paymentCount: { $sum: 1 }
          }
        }
      ]),
      User.find(doctorQuery).select('_id staffname').lean()
    ]);

    const invoicesByDoctor = new Map(invoiceTotals.map((row) => [row._id.toString(), row]));
    const paymentsByDoctor = new Map(paymentTotals.map((row) => [row._id.toString(), row]));
    const doctors = clinicDoctors.map((doctor) => {
      const invoices = invoicesByDoctor.get(doctor._id.toString());
      const payments = paymentsByDoctor.get(doctor._id.toString());
      return {
        doctorId: doctor._id,
        doctorName: doctor.staffname,
        invoiceCount: invoices?.invoiceCount || 0,
        invoicedAmount: fromCents(toCents(invoices?.invoicedAmount || 0)),
        paidAmount: fromCents(toCents(payments?.paidAmount || 0)),
        paymentCount: payments?.paymentCount || 0,
        outstandingAmount: fromCents(toCents(invoices?.outstandingAmount || 0))
      };
    }).sort((first, second) => second.invoicedAmount - first.invoicedAmount);

    const totals = doctors.reduce((summary, doctor) => ({
      invoiceCount: summary.invoiceCount + doctor.invoiceCount,
      invoicedAmount: summary.invoicedAmount + toCents(doctor.invoicedAmount),
      paidAmount: summary.paidAmount + toCents(doctor.paidAmount),
      paymentCount: summary.paymentCount + doctor.paymentCount,
      outstandingAmount: summary.outstandingAmount + toCents(doctor.outstandingAmount)
    }), { invoiceCount: 0, invoicedAmount: 0, paidAmount: 0, paymentCount: 0, outstandingAmount: 0 });

    const clinic = req.user.role === 'ADMIN' ? {
      invoiceCount: totals.invoiceCount,
      invoicedAmount: fromCents(totals.invoicedAmount),
      paidAmount: fromCents(totals.paidAmount),
      paymentCount: totals.paymentCount,
      outstandingAmount: fromCents(totals.outstandingAmount)
    } : undefined;

    return res.json({ success: true, period: period.toUpperCase(), from, to: now, doctors, ...(clinic && { clinic }) });
  } catch (error) {
    logger.error('Invoice Dashboard Summary Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not load invoice summary' });
  }
};
