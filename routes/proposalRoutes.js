const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions,
  ensureProposalNumberEndpoint,
  updateProposalStatus,
  migrateProposalNumbers,
} = require('../controllers/proposalController');

// ── Specific routes FIRST ─────────────────────────────────────────────────────
router.post('/:orderId/ensure-number',  protect, ensureProposalNumberEndpoint);
router.post('/:orderId/new-version',    protect, saveAsNewVersion);
router.post('/migrate-numbers',         protect, migrateProposalNumbers);

router.get('/:orderId/versions/all',    protect, getAllVersions);
router.get('/:orderId/latest',          protect, (req, res) => {
  req.params.version = 'latest';
  getProposalData(req, res);
});

// ── Status update BEFORE generic PUT /:orderId ────────────────────────────────
router.put('/:orderId/status',          protect, updateProposalStatus);

// ── Generic routes LAST ───────────────────────────────────────────────────────
router.put('/:orderId',                 protect, saveProposal);
router.get('/:orderId/:version',        protect, getProposalData);

module.exports = router;