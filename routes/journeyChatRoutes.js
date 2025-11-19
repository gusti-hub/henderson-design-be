// routes/journeyChatRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  getStepChat,
  sendMessage,
  markAsRead,
  downloadAttachment
} = require('../controllers/journeyChatController');

// Get chat for specific step
router.get('/client/:clientId/step/:stepNumber', protect, getStepChat);

// Send message in chat
router.post('/client/:clientId/step/:stepNumber/message', protect, sendMessage);

// Mark messages as read
router.put('/client/:clientId/step/:stepNumber/read', protect, markAsRead);

// Download attachment
router.get('/client/:clientId/step/:stepNumber/message/:messageId/attachment/:attachmentId', protect, downloadAttachment);

module.exports = router;