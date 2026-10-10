const r = require('express').Router();
const c = require('../controllers/treatment.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// Create
r.post('/', protect, c.create);

// List
r.get('/autocomplete', protect, c.autocomplete);
r.get('/', protect, c.getAll);

// Get treatments for a specific doctor (dentist)
r.get('/doctor/:doctorId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getByDoctor);

// Detail
r.get('/:id', protect, c.getById);

// Update
r.put('/:id', protect, c.update);

// Delete
r.delete('/:id', protect, c.remove);

module.exports = r;
