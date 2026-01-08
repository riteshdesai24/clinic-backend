
const Doctor = require('../models/Doctor');
exports.create = async (req,res)=>{
  try {
  res.json(await Doctor.create({ ...req.body, clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
exports.list = async (req,res)=>{
  try {
  res.json(await Doctor.find({ clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
