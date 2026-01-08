
const mongoose = require('mongoose');
module.exports = mongoose.model('Doctor', new mongoose.Schema({
  clinicId:{ type:mongoose.Schema.Types.ObjectId, ref:'Clinic' },
  name:String,
  specialization:String
},{timestamps:true}));
