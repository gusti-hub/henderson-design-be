const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { register, login } = require('../controllers/authController');
const { 
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser
} = require('../controllers/userController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect);

// Admin routes
router.get('/admins', protect, getAdminUsers);
router.post('/admins', protect, createAdminUser);
router.put('/admins/:id', protect, updateAdminUser);
router.delete('/admins/:id', protect, deleteAdminUser);

module.exports = router;