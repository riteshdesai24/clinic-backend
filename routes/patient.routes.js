const r = require('express').Router();
const c = require('../controllers/patient.controller');
const { protect, allowRoles } = require('../middlewares/auth');

r.post('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.create);
r.get('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getAll);
r.get('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getById);
r.put('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.update);
r.delete('/:id', protect, allowRoles('ADMIN'), c.remove);

module.exports = r;
