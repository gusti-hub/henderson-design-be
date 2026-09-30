const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');
const {
  uploadPaymentProof,
  verifyPayment,
  getMyPaymentSettings,
  getPaymentSettings,
  updatePaymentSettings,
  addPaymentItem,
  updatePaymentItem,
  deletePaymentItem,
} = require('../controllers/paymentController');

router.use(protect);

// ── Legacy proof upload ──────────────────────────────────────────────────────
router.post('/:orderId/proof', upload.single('paymentProof'), uploadPaymentProof);
router.post('/:orderId/verify', verifyPayment);

// ── Payment settings for logged-in client (no orderId needed) ───────────────
router.get('/my-settings',                getMyPaymentSettings);

// ── Payment settings (admin) ─────────────────────────────────────────────────
router.get('/:orderId/settings',          getPaymentSettings);
router.put('/:orderId/settings',          updatePaymentSettings);
router.post('/:orderId/items',            addPaymentItem);
router.put('/:orderId/items/:itemId',     updatePaymentItem);
router.delete('/:orderId/items/:itemId',  deletePaymentItem);

module.exports = router;
