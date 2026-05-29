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
  getQBItems,
} = require('../controllers/quickbooksController');

const { syncBillInvoiceToQuickBooks } = require('../controllers/billInvoiceController');

// ─── OAuth ────────────────────────────────────────────────────────────────────
router.get('/connect',    protect, authorize('admin', 'designer'), connectQuickBooks);
router.get('/callback',   handleOAuthCallback);
router.get('/status',     protect, authorize('admin', 'designer'), getConnectionStatus);
router.get('/test',       protect, authorize('admin', 'designer'), testConnection);
router.post('/disconnect',protect, authorize('admin'),             disconnectQuickBooks);

// ─── QB Items list ────────────────────────────────────────────────────────────
router.get('/items', protect, authorize('admin'), getQBItems);

// ─── Legacy client invoice sync ───────────────────────────────────────────────
router.post('/sync-invoice/:clientId/:invoiceNumber', protect, authorize('admin', 'designer'), syncInvoiceToQuickBooks);

// ─── Expense → QB Invoice ─────────────────────────────────────────────────────
router.post('/sync-expense/:expenseId', protect, authorize('admin', 'designer'), syncExpenseToQuickBooks);

// ─── PO → QB Bill (legacy — kept for reference, use Bill Invoice instead) ─────
router.post('/sync-po/:poVersionId', protect, authorize('admin', 'designer'), syncPOToQuickBooks);

// ─── Bill Invoice → QB Bill ───────────────────────────────────────────────────
router.post('/sync-bill-invoice/:billInvoiceId', protect, authorize('admin', 'designer'), syncBillInvoiceToQuickBooks);

// ─── Get latest confirmed POs per vendor for an order ─────────────────────────
router.get('/latest-po/:orderId', protect, authorize('admin', 'designer'), getLatestConfirmedPOs);

// ─── Proposal → QB Invoice ───────────────────────────────────────────────────
router.post('/sync-proposal/:orderId/:pvId', protect, authorize('admin', 'designer'), syncProposalToQuickBooks);

// ─── All PO vendors for an order (any status) ───────────────────────────────
router.get('/po-vendors/:orderId', protect, authorize('admin', 'designer'), getAllPOVendors);
router.get('/project-summary/:orderId', protect, authorize('admin', 'designer'), getProjectFinanceSummary);

module.exports = router;