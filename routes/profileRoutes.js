const express = require('express');
const router = express.Router();
const { changePassword } = require('../controllers/profileController');

// Route for changing password
router.post('/change-password', changePassword);

module.exports = router;