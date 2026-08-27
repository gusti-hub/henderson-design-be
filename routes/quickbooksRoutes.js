// routes/quickbooksRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');

const {
  connectQuickBooks, handleOAuthCallback, getConnectionStatus,
  disconnectQuickBooks, testConnection, syncInvoiceToQuickBooks,
  syncExpenseToQuickBooks, syncPOToQuickBooks, getLatestConfirmedPOs,
  syncProposalToQuickBooks, getAllPOVendors, getProjectFinanceSummary, getQBItems,
} = require('../controllers/quickbooksController');

const { syncBillInvoiceToQuickBooks } = require('../controllers/billInvoiceController');

router.get('/connect',    protect, connectQuickBooks);
router.get('/callback',   handleOAuthCallback);
router.get('/status',     protect, getConnectionStatus);
router.get('/test',       protect, testConnection);
router.post('/disconnect',protect, disconnectQuickBooks);
router.get('/items',      protect, getQBItems);

router.post('/sync-invoice/:clientId/:invoiceNumber', protect, syncInvoiceToQuickBooks);
router.post('/sync-expense/:expenseId',               protect, syncExpenseToQuickBooks);
router.post('/sync-po/:poVersionId',                  protect, syncPOToQuickBooks);
router.post('/sync-bill-invoice/:billInvoiceId',      protect, syncBillInvoiceToQuickBooks);
router.get('/latest-po/:orderId',                     protect, getLatestConfirmedPOs);
router.post('/sync-proposal/:orderId/:pvId',          protect, syncProposalToQuickBooks);
router.get('/po-vendors/:orderId',                    protect, getAllPOVendors);
router.get('/project-summary/:orderId',               protect, getProjectFinanceSummary);

module.exports = router;
