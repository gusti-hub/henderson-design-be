// models/UserSession.js
// One document = one work session of a staff user (login → last heartbeat / logout).
// Used by the Dashboard "Team attendance" report: check-in = first login of the day, check-out = logout or last activity.

const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName:    { type: String, default: '' },
  userEmail:   { type: String, default: '' },
  userRole:    { type: String, default: '' },

  loginAt:     { type: Date, required: true },
  lastSeenAt:  { type: Date, required: true },        // refreshed by the heartbeat while the app is open
  logoutAt:    { type: Date, default: null },         // set only when the user presses Logout

  startedBy:   { type: String, enum: ['login', 'heartbeat'], default: 'login' },   // heartbeat = app was already open (token from before tracking)
  ipAddress:   { type: String, default: '' },
  userAgent:   { type: String, default: '' },
}, { timestamps: false });

userSessionSchema.index({ userId: 1, lastSeenAt: -1 });
userSessionSchema.index({ loginAt: -1 });

module.exports = mongoose.models.UserSession || mongoose.model('UserSession', userSessionSchema, 'usersessions');
