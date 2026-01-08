
const mongoose = require('mongoose');
module.exports = mongoose.model('User', new mongoose.Schema({
  clinicId:{ type:mongoose.Schema.Types.ObjectId, ref:'Clinic' },
  email:String,
  password:{ type:String, select:false },
  role:{ type:String, enum:['ADMIN','STAFF'], default:'ADMIN' }
},{timestamps:true}));
