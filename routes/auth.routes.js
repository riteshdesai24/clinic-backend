const r = require('express').Router();
const c = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth'); // JWT middleware

// Public
r.post('/register', c.registerClinic);
r.post('/login', c.login);
r.post('/forgot-password', c.forgotPassword);
r.post('/reset-password/:token', c.resetPassword);

// Protected
r.post('/change-password', protect, c.changePassword);

module.exports = r;
