const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOrderVendors,
  getPurchaseOrder,
  updatePurchaseOrder,
  createPOVersion,
  getAllPOVersions,
  getAllPOsForOrder
} = require('../controllers/poController');

// Protect all routes
router.use(protect);

// Get vendors grouped with products for an order
router.get('/:orderId/po/vendors', getOrderVendors);

// Get all POs for an order (all vendors, latest versions)
router.get('/:orderId/po/all', getAllPOsForOrder);

// Get all versions for a specific vendor PO
router.get('/:orderId/po/:vendorId/versions/all', getAllPOVersions);

// Create new PO version
router.post('/:orderId/po/:vendorId/new-version', createPOVersion);

// Get PO (latest or specific version) - auto-creates if none exists
router.get('/:orderId/po/:vendorId/:version?', getPurchaseOrder);

// Update existing PO version
router.put('/:orderId/po/:vendorId', updatePurchaseOrder);

module.exports = router;