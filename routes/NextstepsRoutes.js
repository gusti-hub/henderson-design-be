const express = require('express');
const router = express.Router();
const {
  submitNextSteps,
  getSubmission,
  checkSubmission,
  getPendingMeetings,
  confirmMeeting,
  cancelMeeting
} = require('../controllers/NextstepsController');

// Import authentication middleware (adjust path as needed)
// const { protect, authorize } = require('../middleware/auth');

// @desc    Submit next steps form (documents acknowledged + meeting request)
// @route   POST /api/next-steps/submit
// @access  Public
router.post('/submit', submitNextSteps);

// @desc    Check if submission exists for email + unit number
// @route   GET /api/next-steps/check?email=xxx&unitNumber=xxx
// @access  Public
router.get('/check', checkSubmission);

// @desc    Get submission by ID
// @route   GET /api/next-steps/submission/:id
// @access  Public
router.get('/submission/:id', getSubmission);

// ============================================
// PROTECTED ROUTES (Admin Only)
// ============================================
// Uncomment the protect middleware when ready to use

// @desc    Get all pending meeting requests
// @route   GET /api/next-steps/pending
// @access  Protected (Admin)
router.get('/pending', getPendingMeetings);
// With auth: router.get('/pending', protect, authorize('admin', 'designer'), getPendingMeetings);

// @desc    Confirm a meeting
// @route   PUT /api/next-steps/confirm/:id
// @access  Protected (Admin)
router.put('/confirm/:id', confirmMeeting);
// With auth: router.put('/confirm/:id', protect, authorize('admin', 'designer'), confirmMeeting);

// @desc    Cancel a meeting
// @route   PUT /api/next-steps/cancel/:id
// @access  Protected (Admin)
router.put('/cancel/:id', cancelMeeting);
// With auth: router.put('/cancel/:id', protect, authorize('admin', 'designer'), cancelMeeting);

module.exports = router;