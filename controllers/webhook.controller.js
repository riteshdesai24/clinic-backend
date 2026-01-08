
const crypto = require('crypto');
const Payment = require('../models/Payment');

exports.razorpayWebhook = async (req,res)=>{
  try {
  const sig = req.headers['x-razorpay-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if(sig !== expected) return res.status(400).send('Invalid');

  const event = req.body;
  if(event.event === 'payment.captured'){
    const orderId = event.payload.payment.entity.order_id;
    await Payment.findOneAndUpdate({ orderId }, { status:'SUCCESS' });
  }
  res.json({status:'ok'});
  } catch (error) {
    console.error(error);
    throw error;
  }
};
