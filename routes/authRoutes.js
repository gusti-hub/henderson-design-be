// authRoutes.js
const express = require('express');
const router = express.Router();
const { register, registerClient, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/login', login);
router.post('/register-client', registerClient); // New public registration route

// Protected routes
router.post('/register', protect, register); // Admin only registration
router.get('/me', protect, getMe);

module.exports = router;