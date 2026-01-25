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
  uploadCustomProductImages,  // ✅ ADD
  uploadOrderFloorPlan,         // ✅ ADD
  generateInstallBinder
} = require('../controllers/orderController');
const { 
  handlePaymentProofUpload,
  handleProductImagesUpload,   // ✅ ADD
  handleFloorPlanUpload         // ✅ ADD
} = require('../config/s3');
const proposalVersionController = require('../controllers/proposalVersionController');

// Protect all routes
router.use(protect);

// ===================================
// ✅ IMAGE & FILE UPLOADS (BEFORE /:id routes)
// ===================================

// Upload custom product images
router.post(
  '/:orderId/custom-product-images', 
  handleProductImagesUpload, 
  uploadCustomProductImages
);

// ✅ Upload floor plan - THIS WAS MISSING!
router.post(
  '/:orderId/floor-plan', 
  handleFloorPlanUpload, 
  uploadOrderFloorPlan
);

// Upload payment proof
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

router.get('/:id/install-binder', generateInstallBinder);

module.exports = router;