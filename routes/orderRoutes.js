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
  generateOrderPDF
} = require('../controllers/orderController');
const orderController = require('../controllers/orderController');
const multer = require('multer');

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

router.post('/:id/payment-proof', protect, upload.single('paymentProof'), orderController.uploadPaymentProof);

router.get('/user-order', protect, orderController.getCurrentUserOrder);

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

module.exports = router;