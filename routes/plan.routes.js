const r = require('express').Router();
const c = require('../controllers/plan.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// Create plan
r.post('/', protect, allowRoles('ADMIN'), c.create);

// List plans
r.get('/', c.list);

// Plan detail
r.get('/:id', c.getById);

// Update plan
r.put('/:id', protect, allowRoles('ADMIN'), c.update);

// Delete plan
r.delete('/:id', protect, allowRoles('ADMIN'), c.remove);

module.exports = r;
