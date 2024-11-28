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

router.use(protect);

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