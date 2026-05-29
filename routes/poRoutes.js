const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOrderVendors,
  getPurchaseOrder,
  updatePurchaseOrder,
  createPOVersion,
  getAllPOVersions,
  getAllPOsForOrder,
  updatePOStatus,
  getAvailableProducts
} = require('../controllers/poController');

const {
  getOrCreateBillInvoice,
  updateBillInvoice,
  getBillInvoicesForOrder,
} = require('../controllers/billInvoiceController');

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

// ─── All Bill Invoices for an order ──────────────────────────────────────────
router.get('/:orderId/bill-invoices', getBillInvoicesForOrder);

// ─── Bill Invoice (1-to-1 with PO Version) — must be before /:version? ───────
// ?poVersionId=xxx required on both routes
router.get('/:orderId/po/:vendorId/bill-invoice', getOrCreateBillInvoice);
router.put('/:orderId/po/:vendorId/bill-invoice', updateBillInvoice);

router.put('/:orderId/po/:vendorId/status', updatePOStatus);

// Update existing PO version
router.put('/:orderId/po/:vendorId', updatePurchaseOrder);

router.get(
  '/:orderId/po/:vendorId/:version/available-products',
  getAvailableProducts
);

// Get PO (latest or specific version) - auto-creates if none exists
router.get('/:orderId/po/:vendorId/:version?', getPurchaseOrder);

module.exports = router;