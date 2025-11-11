const express = require('express');
const router = express.Router();
const {
  submitOption,
  getSubmission,
  checkSubmission,
  getPendingSubmissions,
  updateSubmissionStatus,
  getSubmissionsByOption
} = require('../controllers/NextstepsController');

// Import authentication middleware (adjust path as needed)
// const { protect, authorize } = require('../middleware/auth');

// @desc Submit next steps option selection
// @route POST /api/next-steps/submit-option
// @access Public
router.post('/submit-option', submitOption);

// @desc Check if submission exists for email + unit number
// @route GET /api/next-steps/check?email=xxx&unitNumber=xxx
// @access Public
router.get('/check', checkSubmission);

// @desc Get submission by ID
// @route GET /api/next-steps/submission/:id
// @access Public
router.get('/submission/:id', getSubmission);

// ============================================
// PROTECTED ROUTES (Admin Only)
// ============================================

// @desc Get all pending submissions
// @route GET /api/next-steps/pending
// @access Protected (Admin)
router.get('/pending', getPendingSubmissions);
// With auth: router.get('/pending', protect, authorize('admin', 'staff'), getPendingSubmissions);

// @desc Get submissions by option type
// @route GET /api/next-steps/by-option/:optionType
// @access Protected (Admin)
router.get('/by-option/:optionType', getSubmissionsByOption);
// With auth: router.get('/by-option/:optionType', protect, authorize('admin', 'staff'), getSubmissionsByOption);

// @desc Update submission status
// @route PUT /api/next-steps/update-status/:id
// @access Protected (Admin)
router.put('/update-status/:id', updateSubmissionStatus);
// With auth: router.put('/update-status/:id', protect, authorize('admin', 'staff'), updateSubmissionStatus);

module.exports = router;