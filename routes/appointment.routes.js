const r = require('express').Router();
const c = require('../controllers/appointment.controller');
const { protect, allowRoles } = require('../middlewares/auth');

r.post('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.create);   // Create
r.get('/calendar', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getCalendar);
r.get('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getAll);   // List
r.get('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getById);  // Detail  ← must stay after r.get('/')
r.put('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.update);   // Update
r.delete('/:id', protect, allowRoles('ADMIN'), c.remove); // Soft-delete (cancel)

module.exports = r;