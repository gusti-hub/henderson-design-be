const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  uploadPaymentProof,
  updatePaymentStatus,
  generateOrderPDF,
  generateProposal,
  generateOrderSummary,
  getOrdersByClient,
  saveFurniturePlacements,
  getCurrentUserOrder,
  uploadCustomProductImages,
  uploadOrderFloorPlan,
  generateInstallBinder,
  generateInstallBinderExcel,
  generateStatusReport,
  getUploadPresignedUrl,
  generateCogExcel,
  getLatestConfirmedPOs,
  generateAllProductsReport,
  createOrderForClient
} = require('../controllers/orderController');
const {
  handlePaymentProofUpload,
  handleProductImagesUpload,
  handleFloorPlanUpload
} = require('../config/s3');
const proposalVersionController = require('../controllers/proposalVersionController');
const { ensureProposalNumber } = require('../controllers/proposalController');

// ✅ Audit log controller
const {
  getAuditLog,
  getProductAuditLog,
  rollbackAuditEntry,
  getAuditStats,
} = require('../controllers/auditLogController');


router.post('/presigned-url', getUploadPresignedUrl);

// Protect all routes
router.use(protect);

// ===================================
// IMAGE & FILE UPLOADS (BEFORE /:id routes)
// ===================================

router.get('/all-products-report', generateAllProductsReport);

router.get('/:id/cog-report', generateCogExcel);

router.post(
  '/:orderId/custom-product-images',
  handleProductImagesUpload,
  uploadCustomProductImages
);

router.post(
  '/:orderId/floor-plan',
  handleFloorPlanUpload,
  uploadOrderFloorPlan
);

router.post(
  '/:id/payment-proof',
  handlePaymentProofUpload,
  uploadPaymentProof
);

// ===================================
// SPECIFIC ROUTES (BEFORE /:id)
// ===================================

router.get('/user-order', getCurrentUserOrder);
router.get('/client/:clientId', getOrdersByClient);
router.post('/client/:clientId/new-order', createOrderForClient);

// ===================================
// DOCUMENTS & EXPORTS
// ===================================

router.get('/:id/proposal', generateProposal);
router.post('/:id/proposal', generateProposal);
router.get('/:id/summary', generateOrderSummary);
router.get('/:id/pdf', generateOrderPDF);

// ===================================
// PROPOSAL VERSIONS
// ===================================

router.get(
  '/:orderId/proposal-versions',
  proposalVersionController.getProposalVersions
);

router.get(
  '/:id/generate-version-pdf/:version',
  proposalVersionController.generateVersionPdf
);

// ===================================
// ✅ AUDIT LOG — harus SEBELUM router.route('/:id')
// ===================================

router.get( '/:orderId/audit-log',                    getAuditLog);
router.get( '/:orderId/audit-log/stats',              getAuditStats);
router.get( '/:orderId/audit-log/product/:productId', getProductAuditLog);
router.post('/:orderId/audit-log/:logId/rollback',    rollbackAuditEntry);

// ===================================
// ORDER CRUD
// ===================================

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .get(getOrderById)
  .put(updateOrder);

// ===================================
// PAYMENT
// ===================================

router.put('/:id/payment-status', updatePaymentStatus);

// ===================================
// LIBRARY SPECIFIC
// ===================================

router.put('/:orderId/furniture-placements', saveFurniturePlacements);

router.get('/:id/install-binder',       generateInstallBinder);
router.get('/:id/install-binder-excel', generateInstallBinderExcel);
router.get('/:id/status-report',        generateStatusReport);

router.get('/:orderId/po/latest-confirmed', getLatestConfirmedPOs);

module.exports = router;