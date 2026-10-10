const r = require('express').Router();
const c = require('../controllers/dashboardcount.controller');
const { protect } = require('../middlewares/auth');

// Appointment counts are clinic-wide for ADMIN/STAFF and doctor-only for DOCTOR.
r.get('/appointments', protect, c.appointmentCounts);
r.get('/appointments/today', protect, c.todayCounts);
r.get('/appointments/week', protect, c.weeklyCounts);
r.get('/appointments/month', protect, c.monthlyCounts);

module.exports = r;
