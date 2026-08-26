// routes/journeyChatRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getStepChat, sendMessage, markAsRead, downloadAttachment,
  getClientChats, getChatsWithUnread, getUnreadCount, deleteMessage
} = require('../controllers/journeyChatController');

router.use(protect);

router.get('/client/:clientId/step/:stepNumber', getStepChat);
router.post('/client/:clientId/step/:stepNumber/message', sendMessage);
router.put('/client/:clientId/step/:stepNumber/read', markAsRead);
router.get('/client/:clientId/step/:stepNumber/message/:messageId/attachment/:attachmentId', downloadAttachment);
router.get('/client/:clientId/chats', getClientChats);
router.get('/unread-count', getUnreadCount);
router.get('/unread', getChatsWithUnread);
router.delete('/client/:clientId/step/:stepNumber/message/:messageId', deleteMessage);

module.exports = router;
