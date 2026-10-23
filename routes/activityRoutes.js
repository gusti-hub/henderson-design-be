const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');
const { heartbeat, endSession, getAttendance, countOnline } = require('../controllers/sessionController');

// Team presence + recent activity (staff dashboard) — requires login: it contains names, emails and IPs
router.get('/', protect, async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeUserIds, todayVisits, recentActivity, onlineIds] = await Promise.all([
      ActivityLog.distinct('userId', {
        timestamp: { $gte: fifteenMinutesAgo },
        userId: { $ne: null }
      }),
      ActivityLog.countDocuments({
        timestamp: { $gte: todayStart }
      }),
      ActivityLog.find()
        .sort({ timestamp: -1 })
        .limit(20)
        .populate('userId', 'name email role'),
      countOnline(),
    ]);
    // online = heartbeat in the last 5 min, plus anyone who logged in within the last 15 min (covers the moment before the app sends its first heartbeat)
    const online = new Set([...onlineIds, ...activeUserIds.map(String)]);

    res.json({
      activeUsers: online.size,
      todayVisits,
      recentActivity: recentActivity.map(a => ({
        _id: a._id,
        userName: a.userName || a.userId?.name || 'Guest',
        userEmail: a.userEmail || a.userId?.email || '',
        userRole: a.userRole || a.userId?.role || 'unknown',
        action: a.action,
        actionType: a.actionType,
        description: a.description,
        resource: a.resource,
        resourceId: a.resourceId,
        path: a.path,
        ipAddress: a.ipAddress,
        status: a.status,
        time: a.timestamp
      }))
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ message: 'Error fetching activity data' });
  }
});

router.post('/heartbeat', protect, heartbeat);
router.post('/logout', protect, endSession);
router.get('/attendance', protect, getAttendance);

module.exports = router;