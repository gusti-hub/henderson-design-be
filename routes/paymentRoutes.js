const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');
const {
  uploadPaymentProof,
  verifyPayment
} = require('../controllers/paymentController');

router.use(protect);

router.post('/:orderId/proof', upload.single('paymentProof'), uploadPaymentProof);
router.post('/:orderId/verify', verifyPayment);

module.exports = router;