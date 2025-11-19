// models/JourneyChat.js
const mongoose = require('mongoose');

const journeyChatSchema = new mongoose.Schema({
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stepNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 23
  },
  messages: [{
    sender: {
      type: String,
      enum: ['admin', 'client'],
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    attachments: [{
      filename: {
        type: String,
        required: true
      },
      mimetype: {
        type: String,
        required: true
      },
      size: {
        type: Number,
        required: true
      },
      data: {
        type: Buffer,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    sentAt: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date,
      default: null
    }
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  unreadCountClient: {
    type: Number,
    default: 0
  },
  unreadCountAdmin: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
journeyChatSchema.index({ journeyId: 1, stepNumber: 1 });
journeyChatSchema.index({ clientId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('JourneyChat', journeyChatSchema);