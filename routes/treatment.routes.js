const r = require('express').Router();
const c = require('../controllers/treatment.controller');
const { protect } = require('../middlewares/auth');

// Create
r.post('/', protect, c.create);

// List
r.get('/', protect, c.list);

// Detail
r.get('/:id', protect, c.getById);

// Update
r.put('/:id', protect, c.update);

// Delete
r.delete('/:id', protect, c.remove);

module.exports = r;
