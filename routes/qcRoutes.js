const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const qc = require('../controllers/qcController');

router.use(protect);

router.get('/pos',              qc.listPOs);
router.get('/inspections',      qc.listInspections);
router.post('/inspections',     qc.createInspection);
router.get('/inspections/:id',  qc.getInspection);
router.put('/inspections/:id',  qc.updateInspection);
router.post('/inspections/:id/submit', qc.submitInspection);
router.get('/po/:poId/status',  qc.getPOQCStatus);

module.exports = router;
