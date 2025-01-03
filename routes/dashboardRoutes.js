// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardStats, generatePurchaseOrder } = require('../controllers/dashboardController');

// Get dashboard statistics
router.get('/', protect, getDashboardStats);

// Generate PO for selected orders
router.post('/purchase-order', protect, generatePurchaseOrder);

module.exports = router;