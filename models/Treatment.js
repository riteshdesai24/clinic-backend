
const mongoose = require('mongoose');
module.exports = mongoose.model('Treatment', new mongoose.Schema({
  clinicId:mongoose.Schema.Types.ObjectId,
  doctorId:mongoose.Schema.Types.ObjectId,
  patientId:mongoose.Schema.Types.ObjectId,
  description:String
},{timestamps:true}));
