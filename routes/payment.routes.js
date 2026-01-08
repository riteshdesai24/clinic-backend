
const r = require('express').Router();
const c = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth');
r.post('/create-order',protect,c.createOrder);
r.post('/verify',protect,c.verifyPayment);
r.get('/history',protect,c.history);
module.exports = r;
