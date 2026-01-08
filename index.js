
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json({ verify:(req,res,buf)=>{ req.rawBody = buf }}));

mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log('MongoDB connected'))
  .catch(err=>console.error(err));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/doctors', require('./routes/doctor.routes'));
app.use('/api/patients', require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/treatments', require('./routes/treatment.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/webhooks', require('./routes/webhook.routes'));

app.listen(process.env.PORT, ()=>console.log('Server running'));
