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

// Clients (role 'user') may only read their own settings; everything that edits payment settings is staff-only
const requireStaff = (req, res, next) => (req.user && req.user.role !== 'user'
  ? next()
  : res.status(403).json({ success: false, message: 'Not allowed' }));

// ── Legacy proof upload ──────────────────────────────────────────────────────
router.post('/:orderId/proof', upload.single('paymentProof'), uploadPaymentProof);
router.post('/:orderId/verify', verifyPayment);

// ── Payment settings for logged-in client (no orderId needed) ───────────────
router.get('/my-settings',                getMyPaymentSettings);

// ── Payment settings (admin) ─────────────────────────────────────────────────
router.get('/:orderId/settings',          requireStaff, getPaymentSettings);
router.put('/:orderId/settings',          requireStaff, updatePaymentSettings);
router.post('/:orderId/items',            requireStaff, addPaymentItem);
router.put('/:orderId/items/:itemId',     requireStaff, updatePaymentItem);
router.delete('/:orderId/items/:itemId',  requireStaff, deletePaymentItem);

module.exports = router;
