// models/QuickBooksToken.js
const mongoose = require('mongoose');

const quickbooksTokenSchema = new mongoose.Schema({
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  realmId: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  refreshTokenExpiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
quickbooksTokenSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Only keep one token document (singleton pattern)
quickbooksTokenSchema.index({}, { unique: true });

module.exports = mongoose.model('QuickBooksToken', quickbooksTokenSchema);