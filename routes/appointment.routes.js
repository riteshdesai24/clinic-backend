const r = require('express').Router();
const c = require('../controllers/appointment.controller');
const { protect } = require('../middlewares/auth');

// Create appointment
r.post('/', protect, c.create);

// List appointments (filters + pagination)
r.get('/', protect, c.list);

// ✅ Appointment detail (VERY IMPORTANT)
// ⚠️ MUST be AFTER r.get('/')
r.get('/:id', protect, c.getById);

module.exports = r;
