const r = require('express').Router();
const c = require('../controllers/plan.controller');

// Create plan
r.post('/', c.create);

// List plans
r.get('/', c.list);

// Plan detail
r.get('/:id', c.getById);

// Update plan
r.put('/:id', c.update);

// Delete plan
r.delete('/:id', c.remove);

module.exports = r;
