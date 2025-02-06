const express = require('express');
const router = express.Router();
const { changePassword } = require('../controllers/ProfileController');

// Route for changing password
router.post('/change-password', changePassword);

module.exports = router;