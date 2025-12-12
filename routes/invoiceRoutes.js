// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();

const invoiceController = require('../controllers/invoiceController');

// Auth middleware
const { protect, authorize } = require('../middleware/auth');

// ===== PROTECT ALL ROUTES (sama seperti journeyRoutes) =====
router.use(protect);

// =================== ADMIN & DESIGNER ROUTES ===================

// Generate invoice
router.post(
  '/generate/:clientId/:stepNumber',
  authorize('admin', 'designer'),
  invoiceController.generateInvoice
);

// Get all invoices for a client
router.get(
  '/client/:clientId',
  authorize('admin', 'designer'),
  invoiceController.getClientInvoices
);

// Delete invoice
router.delete(
  '/client/:clientId/:invoiceNumber',
  authorize('admin', 'designer'),
  invoiceController.deleteInvoice
);

// =================== PUBLIC (AUTHENTICATED) ROUTES ===================
// Sama seperti journeyRoutes: endpoint non-sensitif tidak perlu role check,
// hanya butuh protect (sudah diterapkan router.use(protect))
router.get(
  '/data/:clientId/:invoiceNumber',
  invoiceController.getInvoiceData
);

module.exports = router;
