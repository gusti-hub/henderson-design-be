const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardStats, generatePurchaseOrder } = require('../controllers/dashboardController');

router.get('/', protect, getDashboardStats);
router.post('/purchase-order', protect, generatePurchaseOrder);

module.exports = router;