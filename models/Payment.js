
const mongoose = require('mongoose');
module.exports = mongoose.model('Payment', new mongoose.Schema({
  clinicId:{ type:mongoose.Schema.Types.ObjectId, required:true, index:true },
  plan:{ type:String, required:true },
  durationMonths:{ type:Number, required:true, default:1, min:1 },
  orderId:{ type:String, required:true, unique:true },
  paymentId:String,
  amount:{ type:Number, required:true, min:1 },
  status:{ type:String, enum:['CREATED','SUCCESS','FAILED'] },
  invoicePath:String,
  activatedAt:Date,
  expiresAt:Date
},{timestamps:true}));
