
const mongoose = require('mongoose');
module.exports = mongoose.model('Clinic', new mongoose.Schema({
  name:String,
  phone:String,
  plan:{ type:String, enum:['FREE','GOLD'], default:'FREE' }
},{timestamps:true}));
