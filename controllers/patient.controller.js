
const Patient = require('../models/Patient');
exports.create = async (req,res)=>{
  try {
  res.json(await Patient.create({ ...req.body, clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
exports.list = async (req,res)=>{
  try {
  res.json(await Patient.find({ clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
