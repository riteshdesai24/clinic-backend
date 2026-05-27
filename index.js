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

// ✅ Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/doctors', require('./routes/doctor.routes'));
app.use('/api/patients', require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/attendence', require('./routes/attendance.routes'));
app.use('/api/treatments', require('./routes/treatment.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/webhooks', require('./routes/webhook.routes'));

// 🔥 FIX: convert PORT to number
const PORT = Number(process.env.PORT) || 5000;

// ✅ Start Server
function startServer(port) {

  port = Number(port); // 🔥 CRITICAL FIX

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => startServer(port + 1), 500);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });

  return server;
}

// 🚀 Start
startServer(PORT);