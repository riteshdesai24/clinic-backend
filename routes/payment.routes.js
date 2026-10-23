
const r = require('express').Router();
const c = require('../controllers/payment.controller');
const { protect, allowRoles } = require('../middlewares/auth');
r.post('/create-order', protect, allowRoles('ADMIN'), c.createOrder);
r.post('/verify', protect, allowRoles('ADMIN'), c.verifyPayment);
r.get('/history', protect, allowRoles('ADMIN'), c.history);
module.exports = r;
