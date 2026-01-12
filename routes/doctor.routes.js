const r = require('express').Router();
const c = require('../controllers/doctor.controller');
const { protect } = require('../middlewares/auth');

r.post('/', protect, c.create);
r.get('/', protect, c.list);
r.get('/:id', protect, c.getById);
r.put('/:id', protect, c.update);
r.delete('/:id', protect, c.remove);

module.exports = r;
