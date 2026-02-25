const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: 'Guest' },
  userEmail: { type: String, default: '' },
  userRole: { type: String, default: 'unknown' },
  action: { type: String, required: true },
  actionType: {
    type: String,
    enum: ['login', 'logout', 'view', 'create', 'update', 'delete', 'download', 'upload', 'other'],
    default: 'other'
  },
  description: { type: String, default: '' },
  resource: { type: String, default: '' },
  resourceId: { type: String, default: '' },
  path: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  status: { type: String, enum: ['success', 'failed', 'warning'], default: 'success' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);