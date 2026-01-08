
const mongoose = require('mongoose');
module.exports = mongoose.model('Appointment', new mongoose.Schema({
  clinicId:mongoose.Schema.Types.ObjectId,
  doctorId:mongoose.Schema.Types.ObjectId,
  patientId:mongoose.Schema.Types.ObjectId,
  startTime:Date,
  endTime:Date
},{timestamps:true}));
