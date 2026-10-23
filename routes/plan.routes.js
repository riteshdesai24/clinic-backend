const r = require('express').Router();
const c = require('../controllers/plan.controller');
const { protect } = require('../super-admin/super-admin.middleware');

// Create plan
r.post('/', protect, c.create);

// List plans
r.get('/', c.list);

// Plan detail
r.get('/:id', c.getById);

// Update plan
r.put('/:id', protect, c.update);

// Delete plan
r.delete('/:id', protect, c.remove);

module.exports = r;
