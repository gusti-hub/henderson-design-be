const trackActivity = async (req, res, next) => {
    if (req.user && req.user.role === 'user') {
      try {
        await ActivityLog.create({
          userId: req.user._id,
          action: 'page_view',
          path: req.path,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error) {
        console.error('Activity tracking error:', error);
      }
    }
    next();
  };
  
  module.exports = trackActivity;