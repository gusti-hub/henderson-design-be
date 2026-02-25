const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');

router.get('/', async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeUserIds, todayVisits, recentActivity] = await Promise.all([
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
        .populate('userId', 'name email role')
    ]);

    res.json({
      activeUsers: activeUserIds.length,
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

module.exports = router;