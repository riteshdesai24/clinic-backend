const r = require('express').Router();
const c = require('../controllers/Dashboardcount.controller');
const { protect } = require('../middlewares/auth');

// Clinic-wide appointment counts
r.get('/appointments/today', protect, c.todayCounts);
r.get('/appointments/week', protect, c.weeklyCounts);
r.get('/appointments/month', protect, c.monthlyCounts);

module.exports = r;
