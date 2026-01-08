
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Clinic = require('../models/Clinic');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const razorpay = new Razorpay({
  key_id:process.env.RAZORPAY_KEY_ID,
  key_secret:process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req,res)=>{
  try {
  const order = await razorpay.orders.create({
    amount:req.body.amount,
    currency:'INR',
    receipt:'gold_plan'
  });

  await Payment.create({
    clinicId:req.clinicId,
    plan:'GOLD',
    orderId:order.id,
    amount:req.body.amount,
    status:'CREATED'
  });

  res.json(order);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

exports.verifyPayment = async (req,res)=>{
  try {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if(expected !== razorpay_signature)
    return res.status(400).json({message:'Invalid signature'});

  const payment = await Payment.findOneAndUpdate(
    { orderId:razorpay_order_id },
    { status:'SUCCESS', paymentId:razorpay_payment_id },
    { new:true }
  );

  await Clinic.findByIdAndUpdate(payment.clinicId,{ plan:'GOLD' });

  fs.mkdirSync('invoices',{recursive:true});
  const doc = new PDFDocument();
  const path = `invoices/${payment._id}.pdf`;
  doc.pipe(fs.createWriteStream(path));
  doc.text('Clinic Subscription Invoice');
  doc.text(`Amount: ₹${payment.amount/100}`);
  doc.end();

  payment.invoicePath = path;
  await payment.save();

  res.json({message:'Payment verified & invoice generated'});
  } catch (error) {
    console.error(error);
    throw error;
  }
};

exports.history = async (req,res)=>{
  try {
  res.json(await Payment.find({ clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
