const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardStats, generatePurchaseOrder } = require('../controllers/dashboardController');
const { getDashboardOverview } = require('../controllers/dashboardOverview');

router.get('/', protect, getDashboardStats);
router.get('/overview', protect, getDashboardOverview);
router.post('/purchase-order', protect, generatePurchaseOrder);

module.exports = router;