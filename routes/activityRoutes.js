const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');

router.get('/', async (req, res) => {
  try {
    const activeUsers = await ActivityLog.distinct('userId', {
      timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayVisits = await ActivityLog.countDocuments({
      timestamp: { $gte: todayStart }
    });

    const recentActivity = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'name');

    res.json({
      activeUsers: activeUsers.length,
      todayVisits,
      recentActivity: recentActivity.map(a => ({
        action: a.action,
        time: a.timestamp
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity data' });
  }
});

module.exports = router;