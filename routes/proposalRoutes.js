// routes/proposals.js - NEW FILE
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions
} = require('../controllers/proposalController');

router.use(protect);

// Get proposal data (latest or specific version)
router.get('/:orderId/:version?', getProposalData);

// Save proposal (update current version)
router.put('/:orderId', saveProposal);

// Save as new version
router.post('/:orderId/new-version', saveAsNewVersion);

// Get all versions
router.get('/:orderId/versions/all', getAllVersions);

module.exports = router;