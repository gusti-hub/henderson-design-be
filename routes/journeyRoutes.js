// ✅ CORRECT - journeyRoutes.js
const express = require('express');
const router = express.Router();  // ← Must create router
const { protect, authorize } = require('../middleware/auth');
const {
  getClientJourney,
  createClientJourney,
  updateJourneyStep,
  completeJourneyStep
} = require('../controllers/journeyController');

// Define routes
router.use(protect);
router.get('/client/:clientId', getClientJourney);
router.post('/client/:clientId', authorize('admin', 'designer'), createClientJourney);
router.put('/client/:clientId/step/:stepNumber', authorize('admin', 'designer'), updateJourneyStep);
router.post('/client/:clientId/step/:stepNumber/complete', authorize('admin', 'designer'), completeJourneyStep);

// ✅ MUST export router
module.exports = router;