// routes/journeyRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getClientJourney,
  createClientJourney,
  updateJourneyStep,
  completeJourneyStep,
  getAllJourneys,
  deleteJourney,
  getStepDocument,
  getPendingClientActions
} = require('../controllers/journeyController');

// ===== PROTECT ALL ROUTES =====
router.use(protect);

// ===== CLIENT & ADMIN ROUTES =====
// Get specific client journey
router.get('/client/:clientId', getClientJourney);

// Get pending client actions
router.get('/client/:clientId/pending-actions', getPendingClientActions);

// Download step document (contract, proposal, etc)
router.get('/client/:clientId/step/:stepNumber/document/:documentIndex', getStepDocument);

// ===== ADMIN-ONLY ROUTES =====
// Create journey for client
router.post('/client/:clientId', authorize('admin', 'designer'), createClientJourney);

// Update specific step
router.put('/client/:clientId/step/:stepNumber', authorize('admin', 'designer'), updateJourneyStep);

// Complete specific step
router.post('/client/:clientId/step/:stepNumber/complete', authorize('admin', 'designer'), completeJourneyStep);

// Get all journeys
router.get('/', authorize('admin', 'designer'), getAllJourneys);

// Delete journey
router.delete('/client/:clientId', authorize('admin'), deleteJourney);

module.exports = router;