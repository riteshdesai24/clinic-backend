const r = require('express').Router();
const c = require('../controllers/appointment.controller');
const { protect } = require('../middlewares/auth');

r.post('/',    protect, c.create);   // Create
r.get('/',     protect, c.getAll);   // List
r.get('/:id',  protect, c.getById);  // Detail  ← must stay after r.get('/')
r.put('/:id',  protect, c.update);   // Update
r.delete('/:id', protect, c.remove); // Soft-delete (cancel)

module.exports = r;