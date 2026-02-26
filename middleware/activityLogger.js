const ActivityLog = require('../models/ActivityLog');

const logActivity = async (req, { action, actionType = 'other', description = '', resource = '', resourceId = '', status = 'success', _overrideUser = null }) => {
  try {
    const user = _overrideUser || req.user;

    // Cegah duplicate dalam 2 detik
    if (user?._id) {
      const twoSecondsAgo = new Date(Date.now() - 2000);
      const duplicate = await ActivityLog.findOne({
        userId: user._id,
        actionType,
        timestamp: { $gte: twoSecondsAgo }
      });
      if (duplicate) return;
    }

    await ActivityLog.create({
      userId: user?._id || null,
      userName: user?.name || user?.username || '',
      userEmail: user?.email || '',
      userRole: user?.role || '',
      action,
      actionType,
      description,
      resource,
      resourceId: resourceId?.toString() || '',
      path: req.originalUrl || '',
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
      status
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

module.exports = { logActivity };