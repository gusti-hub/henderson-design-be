// routes/journeyChatRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStepChat,
  sendMessage,
  markAsRead,
  downloadAttachment,
  getClientChats,
  getChatsWithUnread,
  getUnreadCount,
  deleteMessage
} = require('../controllers/journeyChatController');

// ===== PROTECT ALL ROUTES =====
router.use(protect);

// ===== CLIENT & ADMIN ROUTES =====

// Get chat for specific step
router.get('/client/:clientId/step/:stepNumber', getStepChat);

// Send message in chat (with attachments)
router.post('/client/:clientId/step/:stepNumber/message', sendMessage);

// Mark messages as read
router.put('/client/:clientId/step/:stepNumber/read', markAsRead);

// Download attachment
router.get('/client/:clientId/step/:stepNumber/message/:messageId/attachment/:attachmentId', downloadAttachment);

// Get all chats for a client
router.get('/client/:clientId/chats', getClientChats);

// Get unread message count
router.get('/unread-count', getUnreadCount);

// ===== ADMIN-ONLY ROUTES =====

// Get all chats with unread messages
router.get('/unread', authorize('admin', 'designer'), getChatsWithUnread);

// Delete message (admin only)
router.delete('/client/:clientId/step/:stepNumber/message/:messageId', authorize('admin'), deleteMessage);

module.exports = router;