// routes/journeyRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getClientJourney, createClientJourney, updateJourneyStep,
  completeJourneyStep, getAllJourneys, deleteJourney,
  getStepDocument, getPendingClientActions, generateStepPdf
} = require('../controllers/journeyController');

router.use(protect);

router.get('/client/:clientId', getClientJourney);
router.get('/client/:clientId/pending-actions', getPendingClientActions);
router.get('/client/:clientId/step/:stepNumber/document/:documentIndex', getStepDocument);
router.post('/client/:clientId', createClientJourney);
router.put('/client/:clientId/step/:stepNumber', updateJourneyStep);
router.post('/client/:clientId/step/:stepNumber/complete', completeJourneyStep);
router.get('/', getAllJourneys);
router.delete('/client/:clientId', deleteJourney);
router.post('/client/:clientId/step/:stepNumber/generate-pdf', generateStepPdf);

module.exports = router;
