// controllers/journeyChatController.js
const JourneyChat = require('../models/JourneyChat');
const Journey = require('../models/Journey');
const User = require('../models/User');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ===== GET CHAT FOR SPECIFIC STEP =====
const getStepChat = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    
    // Verify client exists
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    // Get journey
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    // Find or create chat
    let chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber)
    });
    
    if (!chat) {
      chat = await JourneyChat.create({
        journeyId: journey._id,
        clientId: clientId,
        stepNumber: parseInt(stepNumber),
        messages: []
      });
    }
    
    // Return messages without attachment data (for performance)
    const chatData = chat.toObject();
    chatData.messages = chatData.messages.map(msg => {
      const msgData = { ...msg };
      if (msgData.attachments) {
        msgData.attachments = msgData.attachments.map(att => ({
          _id: att._id,
          filename: att.filename,
          mimetype: att.mimetype,
          size: att.size,
          uploadedAt: att.uploadedAt
          // data excluded for performance
        }));
      }
      return msgData;
    });
    
    res.json(chatData);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Error fetching chat', error: error.message });
  }
};

// ===== SEND MESSAGE IN CHAT =====
const sendMessage = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { message, attachments = [] } = req.body;
    
    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }
    
    if (message.length > 2000) {
      return res.status(400).json({ message: 'Message too long (max 2000 characters)' });
    }
    
    // Validate attachments
    if (attachments.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 attachments per message' });
    }
    
    // Validate attachment sizes
    for (const att of attachments) {
      if (!att.data || !att.filename || !att.mimetype) {
        return res.status(400).json({ message: 'Invalid attachment data' });
      }
      
      // Convert base64 to buffer
      const buffer = Buffer.from(att.data, 'base64');
      
      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          message: `File "${att.filename}" exceeds 5MB limit` 
        });
      }
    }
    
    // Get journey
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    // Find or create chat
    let chat = await JourneyChat.findOrCreate(
      journey._id, 
      clientId, 
      parseInt(stepNumber)
    );
    
    // Determine sender
    const user = await User.findById(req.user.id);
    const sender = user.role === 'user' ? 'client' : 'admin';
    
    // Prepare attachments with buffer data
    const processedAttachments = attachments.map(att => ({
      filename: att.filename,
      mimetype: att.mimetype,
      size: Buffer.from(att.data, 'base64').length,
      data: Buffer.from(att.data, 'base64')
    }));
    
    // Add message
    const messageData = {
      sender,
      senderName: user.name,
      senderId: user._id,
      message: message.trim(),
      attachments: processedAttachments,
      sentAt: new Date(),
      read: false
    };
    
    await chat.addMessage(messageData);
    
    // Return response without attachment data
    const responseChat = chat.toObject();
    responseChat.messages = responseChat.messages.map(msg => {
      const msgData = { ...msg };
      if (msgData.attachments) {
        msgData.attachments = msgData.attachments.map(att => ({
          _id: att._id,
          filename: att.filename,
          mimetype: att.mimetype,
          size: att.size,
          uploadedAt: att.uploadedAt
        }));
      }
      return msgData;
    });
    
    res.json({
      message: 'Message sent successfully',
      chat: responseChat
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// ===== MARK MESSAGES AS READ =====
const markAsRead = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber)
    });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Determine if user is admin or client
    const user = await User.findById(req.user.id);
    
    if (user.role === 'user') {
      await chat.markAsReadByClient();
    } else {
      await chat.markAsReadByAdmin();
    }
    
    res.json({ 
      message: 'Messages marked as read',
      unreadCount: user.role === 'user' ? chat.unreadCountClient : chat.unreadCountAdmin
    });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ message: 'Error marking as read', error: error.message });
  }
};

// ===== DOWNLOAD ATTACHMENT =====
const downloadAttachment = async (req, res) => {
  try {
    const { clientId, stepNumber, messageId, attachmentId } = req.params;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber)
    });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Find message
    const message = chat.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Find attachment
    const attachment = message.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    // Verify access (user must be part of the chat)
    const user = await User.findById(req.user.id);
    const isClient = user._id.toString() === clientId.toString();
    const isAdmin = user.role === 'admin' || user.role === 'designer';
    
    if (!isClient && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Send file
    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', attachment.size);
    res.send(attachment.data);
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Error downloading attachment', error: error.message });
  }
};

// ===== GET ALL CHATS FOR CLIENT =====
const getClientChats = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const chats = await JourneyChat.getClientChats(clientId);
    
    res.json({
      count: chats.length,
      chats
    });
  } catch (error) {
    console.error('Error fetching client chats:', error);
    res.status(500).json({ message: 'Error fetching chats', error: error.message });
  }
};

// ===== GET CHATS WITH UNREAD MESSAGES (Admin) =====
const getChatsWithUnread = async (req, res) => {
  try {
    const chats = await JourneyChat.getChatsWithUnreadAdmin();
    
    res.json({
      count: chats.length,
      chats
    });
  } catch (error) {
    console.error('Error fetching unread chats:', error);
    res.status(500).json({ message: 'Error fetching unread chats', error: error.message });
  }
};

// ===== GET UNREAD COUNT =====
const getUnreadCount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    let unreadCount;
    if (user.role === 'user') {
      unreadCount = await JourneyChat.getTotalUnreadCountForClient(user._id);
    } else {
      unreadCount = await JourneyChat.getTotalUnreadCountForAdmin();
    }
    
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
};

// ===== DELETE MESSAGE (Admin only) =====
const deleteMessage = async (req, res) => {
  try {
    const { clientId, stepNumber, messageId } = req.params;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber)
    });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Remove message
    chat.messages.id(messageId).remove();
    await chat.save();
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
};

module.exports = {
  getStepChat,
  sendMessage,
  markAsRead,
  downloadAttachment,
  getClientChats,
  getChatsWithUnread,
  getUnreadCount,
  deleteMessage
};