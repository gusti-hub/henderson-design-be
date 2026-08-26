// routes/agreementRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  generateAgreement,
  getClientAgreements,
  getAgreementData,
  deleteAgreement
} = require('../controllers/agreementController');

router.post('/generate/:clientId/:agreementType', protect, generateAgreement);
router.get('/client/:clientId', protect, getClientAgreements);
router.get('/data/:clientId/:agreementNumber', protect, getAgreementData);
router.delete('/client/:clientId/:agreementNumber', protect, deleteAgreement);

module.exports = router;
