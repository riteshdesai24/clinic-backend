
const mongoose = require('mongoose');
module.exports = mongoose.model('Patient', new mongoose.Schema({
  clinicId:{ type:mongoose.Schema.Types.ObjectId, ref:'Clinic' },
  name:String,
  phone:String
},{timestamps:true}));
