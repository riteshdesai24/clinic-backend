const r = require('express').Router();
const c = require('../controllers/auth.controller');

r.post('/register', c.registerClinic);
r.post('/login', c.login);

// Add password routes
r.post('/forgot-password', c.forgotPassword);
r.post('/reset-password', c.resetPassword);
r.post('/change-password', c.changePassword);

module.exports = r;
