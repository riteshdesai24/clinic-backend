
const Appointment = require('../models/Appointment');

exports.create = async (req,res)=>{
  try {
  const { startTime, endTime } = req.body;

  const conflict = await Appointment.findOne({
    clinicId:req.clinicId,
    startTime:{ $lt:endTime },
    endTime:{ $gt:startTime }
  });

  if(conflict) return res.status(400).json({message:'Slot already booked'});

  res.json(await Appointment.create({ ...req.body, clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};

exports.list = async (req,res)=>{
  try {
  res.json(await Appointment.find({ clinicId:req.clinicId }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
