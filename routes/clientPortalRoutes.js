const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  verifyDownPayment,
  scheduleMeeting,
  confirmMeeting
} = require('../controllers/clientPortalController');

// Public routes (no authentication required)
router.post('/verify-down-payment', verifyDownPayment);
router.post('/schedule-meeting', scheduleMeeting);

// Protected routes (require authentication and specific roles)
router.put('/confirm-meeting/:meetingId', protect, authorize('admin', 'designer'), confirmMeeting);

module.exports = router;
