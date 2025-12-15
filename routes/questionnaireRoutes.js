// backend/routes/questionnaireRoutes.js - EXAMPLE

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// ✅ CORRECT: Import dengan destructuring
const {
  submitQuestionnaire,
  getQuestionnaireByClientId,
  getUserQuestionnaires,
  getAllQuestionnaires
} = require('../controllers/questionnaireController');

// Public routes (untuk user yang belum login)
router.post('/submit', submitQuestionnaire);
router.get('/my-questionnaires', getUserQuestionnaires);

// Protected routes (butuh login)
router.get('/client/:clientId', protect, getQuestionnaireByClientId);
router.get('/all', protect, authorize('admin'), getAllQuestionnaires);

module.exports = router;