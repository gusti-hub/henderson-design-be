const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { register, login } = require('../controllers/authController');
const { 
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getProfile,       // ← import ini
  updateProfile     // ← import ini
} = require('../controllers/userController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect);

// Profile routes ← TAMBAHKAN INI
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Admin routes
router.get('/admins', getAdminUsers);
router.post('/admins', createAdminUser);
router.put('/admins/:id', updateAdminUser);
router.delete('/admins/:id', deleteAdminUser);

module.exports = router;