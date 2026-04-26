// routes/proposalRoutes.js (or wherever proposal routes are defined)
// ✅ Add/update these routes — especially the new ensure-number endpoint

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions,
  ensureProposalNumberEndpoint,
} = require('../controllers/proposalController');

// ── Ensure proposal number (called by CustomProductManager on mount) ──────────
// Idempotent: generates and persists if not set, returns existing if already set.
// Formula: Hen-[ClientCode]-[last6charsOrderId] — unique per project, deterministic.
router.post('/:orderId/ensure-number', protect, ensureProposalNumberEndpoint);

// ── Get proposal data (latest or specific version) ────────────────────────────
router.get('/:orderId/latest',          protect, (req, res) => {
  req.params.version = 'latest';
  getProposalData(req, res);
});
router.get('/:orderId/:version',        protect, getProposalData);
router.get('/:orderId/versions/all',    protect, getAllVersions);

// ── Save / update ─────────────────────────────────────────────────────────────
router.put('/:orderId',                 protect, saveProposal);
router.post('/:orderId/new-version',    protect, saveAsNewVersion);

module.exports = router;