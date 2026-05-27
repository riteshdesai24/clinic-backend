require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// ✅ CORS
app.use(
  cors({
    origin: [
      'http://localhost:4200',
      'https://your-frontend.netlify.app'
    ],
    credentials: true
  })
);

// ✅ Middleware
app.options('*', cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ Mongo Error:', err);
    process.exit(1);
  });

app.get('/api', (req, res) => {
  res.send('API is running 🚀');
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/doctors', require('./routes/doctor.routes'));
app.use('/api/patients', require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/treatments', require('./routes/treatment.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/webhooks', require('./routes/webhook.routes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', ()=>console.log(`Server running - ${PORT}`));
