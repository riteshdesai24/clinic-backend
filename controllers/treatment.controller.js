
const Treatment = require('../models/Treatment');
exports.create = async (req,res)=>{
  try {
  res.json(await Treatment.create({ ...req.body, clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
exports.list = async (req,res)=>{
  try {
  res.json(await Treatment.find({ clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
