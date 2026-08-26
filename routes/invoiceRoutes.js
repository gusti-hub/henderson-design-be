// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/generate/:clientId/:stepNumber', invoiceController.generateInvoice);
router.get('/client/:clientId', invoiceController.getClientInvoices);
router.delete('/client/:clientId/:invoiceNumber', invoiceController.deleteInvoice);
router.get('/data/:clientId/:invoiceNumber', invoiceController.getInvoiceData);

module.exports = router;
