require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const logger = require('./utils/logger');

// ✅ Validate critical env vars at startup
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI', 'FRONTEND_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

const app = express();

// ✅ Security middleware
app.use(helmet());
app.use(mongoSanitize()); // prevents NoSQL injection
app.use(xss());           // prevents XSS

// ✅ CORS — kept your existing origins + dynamic production origin
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://your-frontend.netlify.app',
    process.env.FRONTEND_URL
  ],
  credentials: true
}));
app.options('*', cors());

// ✅ Body parser — kept your rawBody for webhook signature verification
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => {
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
  });

// ✅ Health check
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'API is running 🚀' });
});

// ✅ Routes
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/staff',        require('./routes/staff.routes'));
app.use('/api/doctors',      require('./routes/doctor.routes'));
app.use('/api/patients',     require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/attendance',   require('./routes/attendance.routes'));
app.use('/api/treatments',   require('./routes/treatment.routes'));
app.use('/api/plans',        require('./routes/plan.routes'));
app.use('/api/payments',     require('./routes/payment.routes'));
app.use('/api/webhooks',     require('./routes/webhook.routes'));

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => logger.info(`Server running on port ${PORT}`));