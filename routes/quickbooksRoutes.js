// routes/quickbooksRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  connectQuickBooks,
  handleOAuthCallback,
  getConnectionStatus,
  disconnectQuickBooks,
  testConnection,
  syncInvoiceToQuickBooks,
  syncExpenseToQuickBooks,
  syncPOToQuickBooks,
  getLatestConfirmedPOs,
  syncProposalToQuickBooks,
  getAllPOVendors,
  getProjectFinanceSummary,
} = require('../controllers/quickbooksController');

// ─── OAuth ────────────────────────────────────────────────────────────────────
router.get('/connect',    protect, authorize('admin', 'designer'), connectQuickBooks);
router.get('/callback',   handleOAuthCallback);  // no auth — called by QuickBooks
router.get('/status',     protect, authorize('admin', 'designer'), getConnectionStatus);
router.get('/test',       protect, authorize('admin', 'designer'), testConnection);
router.post('/disconnect',protect, authorize('admin'),             disconnectQuickBooks);

// ─── Legacy client invoice sync ───────────────────────────────────────────────
router.post('/sync-invoice/:clientId/:invoiceNumber', protect, authorize('admin', 'designer'), syncInvoiceToQuickBooks);

// ─── Expense → QB Invoice ─────────────────────────────────────────────────────
// Only confirmed/paid expenses can be synced
router.post('/sync-expense/:expenseId', protect, authorize('admin', 'designer'), syncExpenseToQuickBooks);

// ─── PO → QB Bill ─────────────────────────────────────────────────────────────
// Only confirmed POVersions can be synced
router.post('/sync-po/:poVersionId', protect, authorize('admin', 'designer'), syncPOToQuickBooks);

// ─── Get latest confirmed POs per vendor for an order ─────────────────────────
router.get('/latest-po/:orderId', protect, authorize('admin', 'designer'), getLatestConfirmedPOs);

// ─── Proposal → QB Invoice ───────────────────────────────────────────────────
router.post('/sync-proposal/:orderId', protect, authorize('admin', 'designer'), syncProposalToQuickBooks);

// ─── All PO vendors for an order (any status) ───────────────────────────────
router.get('/po-vendors/:orderId', protect, authorize('admin', 'designer'), getAllPOVendors);
router.get('/project-summary/:orderId', protect, authorize('admin', 'designer'), getProjectFinanceSummary);

module.exports = router;