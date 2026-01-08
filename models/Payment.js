
const mongoose = require('mongoose');
module.exports = mongoose.model('Payment', new mongoose.Schema({
  clinicId:mongoose.Schema.Types.ObjectId,
  plan:String,
  orderId:String,
  paymentId:String,
  amount:Number,
  status:{ type:String, enum:['CREATED','SUCCESS','FAILED'] },
  invoicePath:String
},{timestamps:true}));
