const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const activateMembership = require('../utils/activateMembership');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

exports.createOrder = async (req, res) => {
  try {
    const planName = String(req.body.plan || '').trim().toUpperCase();
    if (!planName) return res.status(400).json({ success: false, message: 'Plan is required' });
    const plan = await Plan.findOne({ name: planName });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    if (!Number.isSafeInteger(plan.price) || plan.price <= 0) return res.status(400).json({ success: false, message: 'Selected plan cannot be purchased' });
    if (!req.clinicId) return res.status(400).json({ success: false, message: 'Clinic is missing from the authenticated account' });
    const amount = plan.price * 100;
    if (!Number.isSafeInteger(amount)) return res.status(400).json({ success: false, message: 'Plan price is invalid' });
    // Razorpay limits receipt IDs to 40 characters.
    const receipt = `sub_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt });
    await Payment.create({
      clinicId: req.clinicId,
      plan: plan.name,
      durationMonths: plan.durationMonths,
      orderId: order.id,
      amount,
      status: 'CREATED'
    });
    return res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
      plan: { name: plan.name, price: plan.price, durationMonths: plan.durationMonths }
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    const providerError = error.error || {};
    const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 ? 502 : 500;
    return res.status(status).json({
      success: false,
      message: providerError.description || 'Could not create payment order',
      ...(providerError.code ? { code: providerError.code } : {}),
      ...(providerError.reason ? { reason: providerError.reason } : {})
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ success: false, message: 'Payment verification fields are required' });
    const payment = await Payment.findOne({ orderId: razorpay_order_id, clinicId: req.clinicId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment order not found' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(razorpay_signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ success: false, message: 'Invalid payment signature' });

    const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (gatewayPayment.order_id !== payment.orderId || gatewayPayment.amount !== payment.amount || gatewayPayment.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Payment does not match the saved order' });
    }
    if (gatewayPayment.status !== 'captured') {
      return res.status(202).json({
        success: false,
        status: gatewayPayment.status,
        message: 'Payment is not captured yet; membership will activate after capture'
      });
    }

    await activateMembership(payment, razorpay_payment_id);
    if (!payment.invoicePath) {
      const invoicePath = `invoices/${payment._id}.pdf`;
      try {
        fs.mkdirSync('invoices', { recursive: true });
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(invoicePath);
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
          doc.on('error', reject);
          doc.pipe(stream);
          doc.text('Clinic Subscription Invoice');
          doc.text(`Plan: ${payment.plan}`);
          doc.text(`Duration: ${payment.durationMonths} month(s)`);
          doc.text(`Amount: INR ${(payment.amount / 100).toFixed(2)}`);
          doc.end();
        });
        payment.invoicePath = invoicePath;
        await payment.save();
      } catch (invoiceError) {
        // An invoice write failure must not undo a captured payment or membership.
        console.error('Payment invoice generation error:', invoiceError);
      }
    }
    return res.json({
      success: true,
      message: 'Payment verified and membership activated',
      data: payment,
      membership: { plan: payment.plan, activatedAt: payment.activatedAt, expiresAt: payment.expiresAt }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: 'Could not verify payment' });
  }
};

exports.history = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = { clinicId: req.clinicId };
    const [data, count] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Payment.countDocuments(query)
    ]);
    return res.json({ success: true, page, limit, count, totalPages: Math.ceil(count / limit), data });
  } catch (error) {
    console.error('Payment history error:', error);
    return res.status(500).json({ success: false, message: 'Could not fetch payment history' });
  }
};
