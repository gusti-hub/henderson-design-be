const express = require('express');
const router = express.Router();
const {
  verifyDownPayment, scheduleMeeting, updateMeeting,
  cancelMeeting, getMeeting, getProjectSummary
} = require('../controllers/clientPortalController');
const { protect } = require('../middleware/auth');

router.post('/verify-down-payment', verifyDownPayment);
router.post('/schedule-meeting', scheduleMeeting);
router.get('/meeting/:meetingId', getMeeting);
router.get('/project-summary', getProjectSummary);
router.put('/update-meeting/:meetingId', protect, updateMeeting);
router.delete('/cancel-meeting/:meetingId', protect, cancelMeeting);

module.exports = router;
