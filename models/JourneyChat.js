// models/JourneyChat.js
const mongoose = require('mongoose');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const attachmentSchema = new mongoose.Schema({
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
    required: true,
    max: MAX_FILE_SIZE,
    validate: {
      validator: function(v) {
        return v <= MAX_FILE_SIZE;
      },
      message: 'File size must not exceed 5MB'
    }
  },
  data: {
    type: Buffer,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const messageSchema = new mongoose.Schema({
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
  attachments: {
    type: [attachmentSchema],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 5; // Max 5 attachments per message
      },
      message: 'Maximum 5 attachments per message'
    }
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, { _id: true });

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
    max: 67
  },
  messages: {
    type: [messageSchema],
    default: []
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  unreadCountClient: {
    type: Number,
    default: 0,
    min: 0
  },
  unreadCountAdmin: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// ===== INDEXES =====
journeyChatSchema.index({ journeyId: 1, stepNumber: 1 });
journeyChatSchema.index({ clientId: 1, lastMessageAt: -1 });
journeyChatSchema.index({ stepNumber: 1 });

// ===== INSTANCE METHODS =====

journeyChatSchema.methods.addMessage = function(messageData) {
  this.messages.push(messageData);
  this.lastMessageAt = new Date();
  
  // Update unread count
  if (messageData.sender === 'admin') {
    this.unreadCountClient += 1;
  } else {
    this.unreadCountAdmin += 1;
  }
  
  return this.save();
};

journeyChatSchema.methods.markAsReadByClient = function() {
  const unreadAdminMessages = this.messages.filter(
    m => m.sender === 'admin' && !m.read
  );
  
  unreadAdminMessages.forEach(msg => {
    msg.read = true;
    msg.readAt = new Date();
  });
  
  this.unreadCountClient = 0;
  return this.save();
};

journeyChatSchema.methods.markAsReadByAdmin = function() {
  const unreadClientMessages = this.messages.filter(
    m => m.sender === 'client' && !m.read
  );
  
  unreadClientMessages.forEach(msg => {
    msg.read = true;
    msg.readAt = new Date();
  });
  
  this.unreadCountAdmin = 0;
  return this.save();
};

journeyChatSchema.methods.getUnreadMessagesForClient = function() {
  return this.messages.filter(m => m.sender === 'admin' && !m.read);
};

journeyChatSchema.methods.getUnreadMessagesForAdmin = function() {
  return this.messages.filter(m => m.sender === 'client' && !m.read);
};

journeyChatSchema.methods.getAttachment = function(messageId, attachmentId) {
  const message = this.messages.id(messageId);
  if (!message) return null;
  
  const attachment = message.attachments.id(attachmentId);
  return attachment;
};

// ===== STATIC METHODS =====

journeyChatSchema.statics.findOrCreate = async function(journeyId, clientId, stepNumber) {
  let chat = await this.findOne({ journeyId, stepNumber });
  
  if (!chat) {
    chat = await this.create({
      journeyId,
      clientId,
      stepNumber,
      messages: []
    });
  }
  
  return chat;
};

journeyChatSchema.statics.getClientChats = function(clientId) {
  return this.find({ clientId })
    .sort({ lastMessageAt: -1 })
    .select('-messages.attachments.data'); // Exclude attachment data for list view
};

journeyChatSchema.statics.getChatsWithUnreadAdmin = function() {
  return this.find({ unreadCountAdmin: { $gt: 0 } })
    .populate('clientId', 'name email unitNumber')
    .sort({ lastMessageAt: -1 })
    .select('-messages.attachments.data');
};

journeyChatSchema.statics.getTotalUnreadCountForClient = async function(clientId) {
  const chats = await this.find({ clientId });
  return chats.reduce((total, chat) => total + chat.unreadCountClient, 0);
};

journeyChatSchema.statics.getTotalUnreadCountForAdmin = async function() {
  const chats = await this.find({});
  return chats.reduce((total, chat) => total + chat.unreadCountAdmin, 0);
};

// ===== VIRTUALS =====
journeyChatSchema.virtual('hasUnreadClient').get(function() {
  return this.unreadCountClient > 0;
});

journeyChatSchema.virtual('hasUnreadAdmin').get(function() {
  return this.unreadCountAdmin > 0;
});

journeyChatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

journeyChatSchema.set('toJSON', { virtuals: true });
journeyChatSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('JourneyChat', journeyChatSchema);