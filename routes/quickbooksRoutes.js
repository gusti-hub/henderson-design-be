// routes/quickbooksRoutes.js - COMPLETE with sync endpoint
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import all controller functions
const {
  connectQuickBooks,
  handleOAuthCallback,
  getConnectionStatus,
  disconnectQuickBooks,
  testConnection,
  syncInvoiceToQuickBooks
} = require('../controllers/quickbooksController');

/**
 * QuickBooks OAuth Routes
 */

// Initiate OAuth connection (admin/designer)
router.get('/connect', protect, authorize('admin', 'designer'), connectQuickBooks);

// OAuth callback (no auth - called by QuickBooks)
router.get('/callback', handleOAuthCallback);

// Get connection status (admin/designer)
router.get('/status', protect, authorize('admin', 'designer'), getConnectionStatus);

// Test connection (admin/designer)
router.get('/test', protect, authorize('admin', 'designer'), testConnection);

// Disconnect QuickBooks (admin only)
router.post('/disconnect', protect, authorize('admin'), disconnectQuickBooks);

/**
 * Invoice Sync Routes
 */

// Sync invoice to QuickBooks (admin/designer)
router.post(
  '/sync-invoice/:clientId/:invoiceNumber',
  protect,
  authorize('admin', 'designer'),
  syncInvoiceToQuickBooks
);

module.exports = router;