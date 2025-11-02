// backend/routes/questionnaireRoutes.js
const express = require('express');
const router = express.Router();
const questionnaireController = require('../controllers/questionnaireController');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/questionnaires/draft
 * @desc    Save questionnaire draft (auto-save)
 * @access  Public (no auth needed for client portal)
 */
router.post('/draft', questionnaireController.saveQuestionnaireDraft);

/**
 * @route   POST /api/questionnaires/submit
 * @desc    Submit completed questionnaire
 * @access  Public (no auth needed for client portal)
 */
router.post('/submit', questionnaireController.submitQuestionnaire);

/**
 * @route   GET /api/questionnaires/my-questionnaires
 * @desc    Get all questionnaires for user
 * @access  Public (no auth needed for client portal)
 */
router.get('/my-questionnaires', questionnaireController.getUserQuestionnaires);

/**
 * @route   GET /api/questionnaires/:id
 * @desc    Get single questionnaire by ID
 * @access  Public/Private (supports both)
 */
router.get('/:id', questionnaireController.getQuestionnaire);

/**
 * @route   DELETE /api/questionnaires/:id
 * @desc    Delete draft questionnaire
 * @access  Public (no auth needed for client portal)
 */
router.delete('/:id', questionnaireController.deleteQuestionnaire);

// ========== ADMIN/DESIGNER ROUTES ==========

/**
 * @route   GET /api/questionnaires
 * @desc    Get all questionnaires with filters
 * @access  Private (Admin, Designer)
 */
router.get(
  '/',
  protect,
  authorize('admin', 'designer'),
  questionnaireController.getAllQuestionnaires
);

/**
 * @route   PUT /api/questionnaires/:id/status
 * @desc    Update questionnaire status
 * @access  Private (Admin, Designer)
 */
router.put(
  '/:id/status',
  protect,
  authorize('admin', 'designer'),
  questionnaireController.updateQuestionnaireStatus
);

module.exports = router;