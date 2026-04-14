
require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(
  cors({
    origin: [
      'http://localhost:4200',          // Angular dev
      'https://your-frontend.netlify.app' // Prod frontend (later)
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Handle preflight
app.options('*', cors());
app.use(express.json({ verify:(req,res,buf)=>{ req.rawBody = buf }}));

mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log('MongoDB connected'))
  .catch(err=>console.error(err));

app.get('/api', (req, res) => {
  res.send('API is running 🚀');
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/doctors', require('./routes/doctor.routes'));
app.use('/api/patients', require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/treatments', require('./routes/treatment.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/webhooks', require('./routes/webhook.routes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', ()=>console.log(`Server running - ${PORT}`));
