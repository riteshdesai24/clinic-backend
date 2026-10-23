const crypto = require('crypto');
const Payment = require('../models/Payment');
const activateMembership = require('../utils/activateMembership');

exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signature || !secret || !req.rawBody) {
      return res.status(400).json({ success: false, message: 'Webhook signature data is missing' });
    }

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    if (req.body.event === 'payment.captured') {
      const capturedPayment = req.body.payload?.payment?.entity;
      if (!capturedPayment?.order_id) {
        return res.status(400).json({ success: false, message: 'Captured payment has no order ID' });
      }

      const payment = await Payment.findOne({ orderId: capturedPayment.order_id });
      if (!payment) return res.status(500).json({ success: false, message: 'Payment order is not recorded yet' });

      const capturedAt = req.body.created_at
        ? new Date(req.body.created_at * 1000)
        : new Date();
      await activateMembership(payment, capturedPayment.id, capturedAt);
    } else if (req.body.event === 'payment.failed') {
      const failedPayment = req.body.payload?.payment?.entity;
      if (failedPayment?.order_id) {
        await Payment.findOneAndUpdate(
          { orderId: failedPayment.order_id, status: { $ne: 'SUCCESS' } },
          { status: 'FAILED', paymentId: failedPayment.id }
        );
      }
    }

    return res.json({ success: true, status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return res.status(500).json({ success: false, message: 'Could not process Razorpay webhook' });
  }
};
