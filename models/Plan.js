
const mongoose = require('mongoose');
module.exports = mongoose.model('Plan', new mongoose.Schema({
  name:{ type:String, enum:['FREE','GOLD'], unique:true },
  price:Number,
  staffAllowed:Boolean
},{timestamps:true}));
