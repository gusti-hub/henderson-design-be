// routes/agreementRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  generateAgreement,
  getClientAgreements,
  getAgreementData,
  deleteAgreement
} = require('../controllers/agreementController');

// Generate agreement (admin/designer)
router.post(
  '/generate/:clientId/:agreementType',
  protect,
  authorize('admin', 'designer'),
  generateAgreement
);

// Get client agreements (admin/designer)
router.get(
  '/client/:clientId',
  protect,
  authorize('admin', 'designer'),
  getClientAgreements
);

// Get agreement data (admin/designer/client)
router.get(
  '/data/:clientId/:agreementNumber',
  protect,
  getAgreementData
);

// Delete agreement (admin/designer)
router.delete(
  '/client/:clientId/:agreementNumber',
  protect,
  authorize('admin', 'designer'),
  deleteAgreement
);

module.exports = router;