const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Appointment = require('../models/Appointment');
const Treatment = require('../models/Treatment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const sendWhatsApp = require('../utils/sendWhatsApp');

const validPeriods = ['week', 'month'];
const paymentMethods = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER'];
const GST_RATE = 18;
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

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const formatAmount = value => `INR ${Number(value || 0).toFixed(2)}`;
const formatInvoiceDate = value => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'N/A';

const generateInvoicePdf = invoice => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = 60;
  const right = pageWidth - left;
  const contentWidth = right - left;
  const patient = invoice.patientId;
  const doctor = invoice.doctorId;
  const clinic = invoice.clinicId;
  const patientName = patient?.name || [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient';
  const patientAddress = [
    patient?.address1,
    patient?.address2,
    [patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(', '),
    patient?.phone
  ].filter(Boolean);
  const clinicAddress = clinic?.address || {};
  const clinicAddressLines = [
    clinicAddress.street,
    [clinicAddress.city, clinicAddress.state, clinicAddress.zip].filter(Boolean).join(', ')
  ].filter(Boolean);
  const clinicName = clinic?.clinicName || clinic?.staffname || 'Clinic';
  const paymentMethodsUsed = [...new Set((invoice.payments || []).map(payment => payment.method).filter(Boolean))];
  const paymentMethod = paymentMethodsUsed.length ? paymentMethodsUsed.join(', ') : 'Not paid';
  const ink = '#202124';
  const muted = '#686b70';
  const pale = '#e9eaec';
  const rule = '#d5d7da';

  const drawTableHeader = y => {
    doc.save().roundedRect(left, y, contentWidth, 34, 3).fill(pale).restore();
    doc.fillColor(ink).font('Helvetica').fontSize(10);
    doc.text('Item', left + 12, y + 11, { width: 225 });
    doc.text('Quantity', left + 238, y + 11, { width: 66, align: 'right' });
    doc.text('Price', left + 318, y + 11, { width: 65, align: 'right' });
    doc.text('Amount', right - 75, y + 11, { width: 63, align: 'right' });
    return y + 34;
  };

  const drawFooter = () => {
    const crest = pageHeight - 220;
    doc.save();
    doc.path(`M 0 ${crest} C 130 ${crest - 18}, 240 ${crest + 12}, 330 ${crest + 72} C 425 ${crest + 130}, 505 ${crest + 75}, ${pageWidth} ${crest - 22} L ${pageWidth} ${pageHeight} L 0 ${pageHeight} Z`)
      .fill('#d3d4d5');
    doc.path(`M 0 ${pageHeight - 68} C 130 ${pageHeight - 190}, 250 ${pageHeight - 165}, 360 ${pageHeight - 150} C 465 ${pageHeight - 135}, 520 ${pageHeight - 175}, ${pageWidth} ${pageHeight - 245} L ${pageWidth} ${pageHeight} L 0 ${pageHeight} Z`)
      .fill('#393b3d');
    doc.restore();
  };

  doc.fillColor(ink);
  if (clinic?.logoContent && ['image/png', 'image/jpeg'].includes(clinic.logoContentType)) {
    try {
      doc.image(clinic.logoContent, left, 52, { fit: [245, 58], align: 'left', valign: 'center' });
    } catch (error) {
      doc.font('Helvetica-Bold').fontSize(18).text(clinicName.toUpperCase(), left, 66, { width: 245, height: 32 });
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(18).text(clinicName.toUpperCase(), left, 66, { width: 245, height: 32 });
  }
  doc.font('Helvetica').fontSize(10).fillColor(muted)
    .text(`NO. ${invoice.invoiceNumber}`, left, 56, { width: contentWidth, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('Date:', left, 184, { continued: true });
  doc.font('Helvetica').text(`  ${formatInvoiceDate(invoice.issuedAt)}`);
  if (invoice.dueDate) {
    doc.font('Helvetica-Bold').text('Due:', left, 202, { continued: true });
    doc.font('Helvetica').text(`  ${formatInvoiceDate(invoice.dueDate)}`);
  }

  const detailsTop = invoice.dueDate ? 244 : 226;
  const columnGap = 28;
  const columnWidth = (contentWidth - columnGap) / 2;
  const fromX = left + columnWidth + columnGap;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink)
    .text('Billed to:', left, detailsTop)
    .text('From:', fromX, detailsTop);
  doc.font('Helvetica').fontSize(10).fillColor(ink);
  let billedY = detailsTop + 18;
  doc.text(patientName, left, billedY, { width: columnWidth });
  billedY += 15;
  for (const line of patientAddress) {
    doc.text(line, left, billedY, { width: columnWidth });
    billedY += 15;
  }
  if (patient?.email) {
    doc.text(patient.email, left, billedY, { width: columnWidth });
    billedY += 15;
  }

  let fromY = detailsTop + 18;
  doc.text(clinicName, fromX, fromY, { width: columnWidth });
  fromY += 15;
  for (const line of clinicAddressLines) {
    doc.text(line, fromX, fromY, { width: columnWidth });
    fromY += 15;
  }
  if (clinic?.email) {
    doc.text(clinic.email, fromX, fromY, { width: columnWidth });
    fromY += 15;
  }
  if (clinic?.phone) {
    doc.text(clinic.phone, fromX, fromY, { width: columnWidth });
    fromY += 15;
  }
  if (doctor?.staffname) {
    doc.fillColor(muted).text(`Doctor: ${doctor.staffname}`, fromX, fromY, { width: columnWidth });
  }

  let y = drawTableHeader(Math.max(billedY, fromY) + 24);
  const itemColumnWidth = 220;
  for (const item of invoice.items) {
    const descriptionHeight = doc.font('Helvetica').fontSize(10)
      .heightOfString(item.description, { width: itemColumnWidth });
    const rowHeight = Math.max(27, descriptionHeight + 12);
    if (y + rowHeight > 590) {
      doc.addPage();
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(14).text('INVOICE', left, 52);
      doc.font('Helvetica').fontSize(10).fillColor(muted)
        .text(invoice.invoiceNumber, left, 72);
      y = drawTableHeader(105);
    }

    doc.fillColor(ink).font('Helvetica').fontSize(10)
      .text(item.description, left + 12, y + 8, { width: itemColumnWidth, height: rowHeight - 8 });
    doc.text(String(item.quantity), left + 238, y + 8, { width: 66, align: 'right' });
    doc.text(formatAmount(item.unitPrice), left + 310, y + 8, { width: 73, align: 'right' });
    doc.text(formatAmount(item.amount), right - 82, y + 8, { width: 70, align: 'right' });
    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(rule).stroke();
  }

  if (y + 190 > pageHeight - 230) {
    doc.addPage();
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(14).text('INVOICE SUMMARY', left, 54);
    doc.font('Helvetica').fontSize(10).fillColor(muted).text(invoice.invoiceNumber, left, 74);
    y = 112;
  } else {
    y += 12;
  }

  const labelX = right - 240;
  const valueX = right - 125;
  const summaryLine = (label, value, options = {}) => {
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(options.total ? 12 : 10)
      .fillColor(ink)
      .text(label, labelX, y, { width: 115 });
    doc.text(value, valueX, y, { width: 125, align: 'right' });
    y += options.total ? 28 : 21;
  };

  summaryLine('Subtotal', formatAmount(invoice.subtotal));
  summaryLine(`GST (${invoice.gstRate ?? GST_RATE}%)`, formatAmount(invoice.taxAmount));
  doc.moveTo(labelX, y - 3).lineTo(right, y - 3).lineWidth(0.8).strokeColor(rule).stroke();
  const totalBeforeDiscount = toCents(invoice.subtotal) + toCents(invoice.taxAmount);
  summaryLine('Total before discount', formatAmount(fromCents(totalBeforeDiscount)), { bold: true, total: true });
  if (invoice.discountAmount) summaryLine('Discount', `-${formatAmount(invoice.discountAmount)}`);
  summaryLine('Amount due', formatAmount(invoice.totalAmount), { bold: true, total: true });
  summaryLine('Paid', formatAmount(invoice.amountPaid));
  summaryLine('Balance due', formatAmount(Math.max(invoice.totalAmount - invoice.amountPaid, 0)), { bold: true });

  y += 20;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('Payment method:', left, y, { continued: true });
  doc.font('Helvetica').text(`  ${paymentMethod}`);
  y += 20;
  doc.font('Helvetica-Bold').text('Note:', left, y, { continued: true });
  doc.font('Helvetica').text(`  ${invoice.notes || 'Thank you for choosing us!'}`, {
    width: contentWidth - 32
  });

  drawFooter();
  doc.end();
});

const getInvoiceForUser = (id, req) => {
  const query = { _id: id, clinicId: req.clinicId };
  if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
  return Invoice.findOne(query)
    .populate('patientId', 'title firstName middleName lastName suffix email phone whatsappNumber address1 address2 city state pincode')
    .populate('doctorId', 'staffname email')
    .populate({ path: 'clinicId', select: 'clinicName staffname email phone address +logoContent +logoContentType' });
};

const sendInvoicePdf = async (res, invoice, disposition = 'inline') => {
  const pdf = await generateInvoicePdf(invoice);
  const safeInvoiceNumber = String(invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdf.length,
    'Content-Disposition': `${disposition}; filename="${safeInvoiceNumber}.pdf"`,
    'Cache-Control': 'private, no-store'
  });
  return res.send(pdf);
};

exports.viewPdf = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    const invoice = await getInvoiceForUser(id, req);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return await sendInvoicePdf(res, invoice);
  } catch (error) {
    logger.error('View Invoice PDF Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not generate invoice PDF' });
  }
};

exports.publicPdf = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid invoice ID' });

  let payload;
  try {
    payload = jwt.verify(req.query.token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invoice PDF link is invalid or expired' });
  }
  if (payload.purpose !== 'invoice-whatsapp' || payload.invoiceId !== id) {
    return res.status(401).json({ success: false, message: 'Invoice PDF link is invalid or expired' });
  }

  try {
    const invoice = await Invoice.findById(id)
      .populate('patientId', 'title firstName middleName lastName suffix email phone whatsappNumber address1 address2 city state pincode')
      .populate('doctorId', 'staffname email')
      .populate({ path: 'clinicId', select: 'clinicName staffname email phone address +logoContent +logoContentType' });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return await sendInvoicePdf(res, invoice, 'attachment');
  } catch (error) {
    logger.error('Public Invoice PDF Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not generate invoice PDF' });
  }
};

exports.send = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    const invoice = await getInvoiceForUser(id, req);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'VOID') return res.status(409).json({ success: false, message: 'Cannot send a void invoice' });
    if (!invoice.patientId || !invoice.doctorId) {
      return res.status(409).json({ success: false, message: 'Invoice patient or doctor details are unavailable' });
    }

    const pdf = await generateInvoicePdf(invoice);
    const results = {};
    const attachment = {
      filename: `${invoice.invoiceNumber}.pdf`,
      content: pdf,
      contentType: 'application/pdf'
    };
    const patientName = invoice.patientId.name || 'Patient';
    const clinicName = invoice.clinicId?.clinicName || 'Clinic';
    const emailHtml = `
      <p>Hello ${escapeHtml(patientName)},</p>
      <p>Please find attached invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> from ${escapeHtml(clinicName)}.</p>
      <p>Total: ${escapeHtml(formatAmount(invoice.totalAmount))}<br>
      Balance due: ${escapeHtml(formatAmount(Math.max(invoice.totalAmount - invoice.amountPaid, 0)))}</p>
    `;
    const emailTasks = [
      ['patientEmail', invoice.patientId.email, `Invoice ${invoice.invoiceNumber}`, emailHtml],
      ['doctorEmail', invoice.doctorId.email, `Invoice ${invoice.invoiceNumber} — ${patientName}`, `
        <p>Hello Dr. ${escapeHtml(invoice.doctorId.staffname || '')},</p>
        <p>Attached is invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for ${escapeHtml(patientName)}.</p>
        <p>Total: ${escapeHtml(formatAmount(invoice.totalAmount))}</p>
      `]
    ];
    await Promise.all(emailTasks.map(async ([channel, recipient, subject, html]) => {
      if (!recipient) {
        results[channel] = { success: false, error: 'Recipient email address is not available' };
        return;
      }
      try {
        await sendEmail({ to: recipient, subject, html, attachments: [attachment] });
        results[channel] = { success: true, recipient };
      } catch (error) {
        logger.error(`Invoice email delivery failed (${channel})`, { invoiceId: id, error: error.message });
        results[channel] = { success: false, error: 'Email delivery failed' };
      }
    }));

    const whatsappNumber = invoice.patientId.whatsappNumber || invoice.patientId.phone;
    try {
      if (!process.env.API_BASE_URL) throw new Error('API_BASE_URL is required to deliver invoice PDFs through WhatsApp');
      const baseUrl = new URL(process.env.API_BASE_URL);
      if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
        throw new Error('API_BASE_URL must be a valid HTTP(S) URL without credentials');
      }
      const token = jwt.sign(
        { purpose: 'invoice-whatsapp', invoiceId: invoice.id },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      const pdfUrl = new URL(`/api/invoices/public/${invoice.id}/pdf`, baseUrl);
      pdfUrl.searchParams.set('token', token);
      await sendWhatsApp({
        to: whatsappNumber,
        body: `Invoice ${invoice.invoiceNumber} from ${clinicName}. Total: ${formatAmount(invoice.totalAmount)}. The PDF is attached.`,
        mediaUrl: pdfUrl.toString()
      });
      results.patientWhatsApp = { success: true, recipient: whatsappNumber };
    } catch (error) {
      logger.error('Invoice WhatsApp delivery failed', { invoiceId: id, error: error.message });
      results.patientWhatsApp = { success: false, error: error.message };
    }

    const failedCount = Object.values(results).filter(result => !result.success).length;
    const status = failedCount === 0 ? 200 : failedCount === Object.keys(results).length ? 502 : 207;
    return res.status(status).json({
      success: failedCount === 0,
      message: failedCount === 0 ? 'Invoice sent successfully' : 'Invoice delivery was incomplete',
      data: { invoiceId: invoice.id, channels: results }
    });
  } catch (error) {
    logger.error('Send Invoice Error', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Could not send invoice' });
  }
};

exports.create = async (req, res) => {
  try {
    const { appointmentId, items = [], treatmentPrice, dueDate, notes } = req.body;
    const discountValue = req.body.discountAmount ?? req.body.discount ?? 0;
    if (req.body.discountAmount !== undefined && req.body.discount !== undefined
      && Number(req.body.discountAmount) !== Number(req.body.discount)) {
      return res.status(400).json({ success: false, message: 'Provide either discountAmount or discount, not conflicting values' });
    }
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
    })
      .populate('treatmentMasterId', 'name price')
      .populate('treatments.treatmentMasterId', 'name price');
    if (!treatment) return res.status(409).json({ success: false, message: 'The appointment treatment record is missing or invalid' });

    const existingInvoice = await Invoice.findOne({ clinicId: req.clinicId, appointmentId: appointment._id });
    if (existingInvoice) return res.status(409).json({ success: false, message: 'An invoice already exists for this appointment', data: existingInvoice });

    const patient = await Patient.findOne({ _id: appointmentPatientId, clinicId: req.clinicId });
    const doctor = await User.findOne({ _id: appointmentDoctorId, clinicId: req.clinicId, role: 'DOCTOR' });
    if (!patient || !doctor) return res.status(400).json({ success: false, message: 'Appointment patient or doctor is invalid' });

    const selectedTreatments = Array.isArray(treatment.treatments) && treatment.treatments.length
      ? treatment.treatments
      : treatment.treatmentMasterId
        ? [{
          treatmentName: treatment.treatmentName || treatment.treatmentMasterId.name,
          treatmentPrice: treatment.treatmentPrice ?? treatment.treatmentMasterId.price
        }]
        : [];
    if (treatmentPrice !== undefined && selectedTreatments.length > 1) {
      return res.status(400).json({ success: false, message: 'treatmentPrice can only override the price when one treatment is selected' });
    }

    const normalizedItems = [];
    for (const [index, selectedTreatment] of selectedTreatments.entries()) {
      const selectedPrice = index === 0 && treatmentPrice !== undefined
        ? Number(treatmentPrice)
        : Number(selectedTreatment.treatmentPrice ?? selectedTreatment.treatmentMasterId?.price);
      if (!Number.isFinite(selectedPrice) || selectedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Treatment "${selectedTreatment.treatmentName || selectedTreatment.treatmentMasterId?.name || index + 1}" has no valid price`
        });
      }
      const priceCents = toCents(selectedPrice);
      normalizedItems.push({
        description: selectedTreatment.treatmentName || selectedTreatment.treatmentMasterId?.name || `Treatment ${index + 1}`,
        quantity: 1,
        unitPrice: fromCents(priceCents),
        amount: fromCents(priceCents)
      });
    }

    if (!selectedTreatments.length) {
      const billedTreatmentPrice = treatmentPrice === undefined
        ? treatment.treatmentPrice
        : Number(treatmentPrice);
      if (billedTreatmentPrice === undefined || !Number.isFinite(billedTreatmentPrice) || billedTreatmentPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'The treatment has no catalog price; provide a non-negative treatmentPrice to invoice it'
        });
      }
      const priceCents = toCents(billedTreatmentPrice);
      normalizedItems.push({
        description: treatment.treatmentName || treatment.diagnosis,
        quantity: 1,
        unitPrice: fromCents(priceCents),
        amount: fromCents(priceCents)
      });
    }

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
    const discount = Number(discountValue);
    if (!Number.isFinite(discount) || discount < 0 || discount > fromCents(subtotalCents)) {
      return res.status(400).json({ success: false, message: 'discountAmount must be between zero and the invoice subtotal' });
    }
    const discountCents = toCents(discount);
    const taxableAmountCents = subtotalCents - discountCents;
    const taxCents = Math.round(taxableAmountCents * GST_RATE / 100);
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
      treatmentName: normalizedItems.map(item => item.description).join(', '),
      patientId: patient._id,
      doctorId: doctor._id,
      items: normalizedItems,
      subtotal: fromCents(subtotalCents),
      discountAmount: fromCents(discountCents),
      gstRate: GST_RATE,
      taxAmount: fromCents(taxCents),
      totalAmount: fromCents(taxableAmountCents + taxCents),
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
    const period = req.query.period === undefined ? undefined : String(req.query.period).toLowerCase();
    if (period && !validPeriods.includes(period)) {
      return res.status(400).json({ success: false, message: 'period must be week or month' });
    }
    const to = period ? new Date() : undefined;
    const from = period ? periodStart(period, to) : undefined;
    if (period) query.issuedAt = { $gte: from, $lte: to };
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
      Invoice.find(query).populate('patientId', 'name phone').populate('doctorId', 'staffname').populate('treatmentId', 'diagnosis treatmentName treatmentMasterId').sort({ issuedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Invoice.countDocuments(query)
    ]);
    return res.json({
      success: true,
      page,
      limit,
      count,
      totalPages: Math.ceil(count / limit),
      ...(period && { period: period.toUpperCase(), from, to }),
      data
    });
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
