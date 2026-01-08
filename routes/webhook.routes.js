
const r = require('express').Router();
const c = require('../controllers/webhook.controller');
r.post('/razorpay',c.razorpayWebhook);
module.exports = r;
