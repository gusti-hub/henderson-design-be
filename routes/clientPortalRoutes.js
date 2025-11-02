const express = require('express');
const router = express.Router();
const { 
  verifyDownPayment, 
  scheduleMeeting,
  updateMeeting,      // ✅ NEW
  cancelMeeting,      // ✅ NEW  
  getMeeting          // ✅ NEW
} = require('../controllers/clientPortalController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/verify-down-payment', verifyDownPayment);
router.post('/schedule-meeting', scheduleMeeting);
router.get('/meeting/:meetingId', getMeeting);

// Protected routes (Admin/Designer only)
router.put('/update-meeting/:meetingId', protect, authorize('admin', 'designer'), updateMeeting);
router.delete('/cancel-meeting/:meetingId', protect, authorize('admin', 'designer'), cancelMeeting);

module.exports = router;