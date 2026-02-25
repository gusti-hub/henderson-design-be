const ActivityLog = require('../models/ActivityLog');

const logActivity = async (req, { action, actionType = 'other', description = '', resource = '', resourceId = '', status = 'success' }) => {
  try {
    const user = req.user;
    await ActivityLog.create({
      userId: user?._id || null,
      userName: user?.name || user?.username || 'Guest',
      userEmail: user?.email || '',
      userRole: user?.role || 'unknown',
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