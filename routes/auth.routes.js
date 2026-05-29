const express = require('express');
const router = express.Router();
const {
  registerClinic,
  login,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');
const { authLimiter, forgotPasswordLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, registerClinic);
router.post('/login', authLimiter, login);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;