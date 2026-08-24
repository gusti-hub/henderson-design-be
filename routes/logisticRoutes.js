// routes/logisticRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, hasPermission } = require('../middleware/auth');
const logistic = require('../controllers/logisticController');

router.use(protect);
router.use(hasPermission('view_logistic_tracker'));

router.get('/config',                               logistic.getConfig);
router.get('/clients',                              logistic.listClients);
router.get('/',                                     logistic.listEntries);
router.put('/po/:poVersionId/:poProductId',         logistic.updatePoEntry);  // orphaned PO product
router.get('/:orderId/:productId',                  logistic.getEntry);
router.put('/:orderId/:productId',                  logistic.updateEntry);

module.exports = router;
