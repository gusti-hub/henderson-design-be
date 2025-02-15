const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  uploadPaymentProof,
  updatePaymentStatus,
  generateOrderPDF,
  generateProposal,
  generateOrderSummary
} = require('../controllers/orderController');
const orderController = require('../controllers/orderController');
const multer = require('multer');
const { handlePaymentProofUpload } = require('../config/s3');
const proposalVersionController = require('../controllers/proposalVersionController');

router.use(protect);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

router.post('/:id/payment-proof', protect, handlePaymentProofUpload, orderController.uploadPaymentProof);

router.get('/user-order', protect, orderController.getCurrentUserOrder);

router.get('/:id/proposal', protect, generateProposal);
router.get('/:id/summary', protect, generateOrderSummary);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .get(getOrderById)
  .put(updateOrder);

router.route('/:id/payment')
  .post(uploadPaymentProof)
  .put(updatePaymentStatus);

router.get('/:id/pdf', generateOrderPDF);
router.put('/:id/payment-status', protect, orderController.updatePaymentStatus);

// Keep/add these routes
router.post('/:id/proposal', protect, generateProposal);
router.get('/:id/generate-version-pdf/:version', protect, proposalVersionController.generateVersionPdf);
router.get('/:orderId/proposal-versions', protect, proposalVersionController.getProposalVersions);
//router.put('/:orderId/proposal-versions/:version/status', protect, proposalVersionController.updateProposalVersionStatus);


module.exports = router;