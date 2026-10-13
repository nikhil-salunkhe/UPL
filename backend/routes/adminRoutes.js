const express = require('express');
const rateLimit = require('express-rate-limit');
const { loginAdmin, seedAdmin } = require('../controllers/adminController');
const router = express.Router();

// Tight brute-force limit on login: 20 attempts / 15 min / IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter, loginAdmin);
router.post('/seed', seedAdmin);

module.exports = router;
