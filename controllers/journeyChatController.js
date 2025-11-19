// controllers/journeyChatController.js
const JourneyChat = require('../models/JourneyChat');
const Journey = require('../models/Journey');
const sendEmail = require('../utils/sendEmail');

// Get chat for specific step
const getStepChat = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }

    let chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber) 
    })
      .populate('messages.senderId', 'name email')
      .lean();

    if (!chat) {
      // Create new chat if doesn't exist
      chat = await JourneyChat.create({
        journeyId: journey._id,
        clientId,
        stepNumber: parseInt(stepNumber),
        messages: []
      });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Error fetching chat', error: error.message });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { message, attachments } = req.body;
    const isAdmin = req.user.role === 'admin';

    const journey = await Journey.findOne({ clientId }).populate('clientId', 'name email');
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }

    let chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber) 
    });

    if (!chat) {
      chat = await JourneyChat.create({
        journeyId: journey._id,
        clientId,
        stepNumber: parseInt(stepNumber),
        messages: []
      });
    }

    // Process attachments if any
    let processedAttachments = [];
    if (attachments && attachments.length > 0) {
      processedAttachments = attachments.map(att => ({
        filename: att.filename,
        mimetype: att.mimetype,
        size: att.size,
        data: Buffer.from(att.data, 'base64')
      }));
    }

    // Add message
    const newMessage = {
      sender: isAdmin ? 'admin' : 'client',
      senderName: req.user.name,
      senderId: req.user.id,
      message,
      attachments: processedAttachments,
      sentAt: new Date(),
      read: false
    };

    chat.messages.push(newMessage);
    chat.lastMessageAt = new Date();
    
    // Update unread count
    if (isAdmin) {
      chat.unreadCountClient += 1;
    } else {
      chat.unreadCountAdmin += 1;
    }

    await chat.save();

    // Send email notification
    try {
      if (isAdmin) {
        // Admin sent message -> notify client
        const stepInfo = journey.steps.find(s => s.step === parseInt(stepNumber));
        await sendEmail({
          to: journey.clientId.email,
          toName: journey.clientId.name,
          subject: `New message about Step ${stepNumber}: ${stepInfo?.title || 'Your Journey'}`,
          htmlContent: `
            <h2>New Message from Henderson Design Group</h2>
            <p>You have received a new message regarding Step ${stepNumber}:</p>
            <blockquote style="border-left: 4px solid #005670; padding-left: 20px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </blockquote>
            <p><a href="${process.env.FRONTEND_URL || 'https://alia.henderson.house'}/portal-login" style="color: #005670;">View in your portal</a></p>
          `
        });
      } else {
        // Client sent message -> notify admin
        await sendEmail({
          to: process.env.ADMIN_EMAIL || 'info@henderson.house',
          toName: 'Admin Team',
          subject: `New client message - ${journey.clientId.name} - Step ${stepNumber}`,
          htmlContent: `
            <h2>New Message from ${journey.clientId.name}</h2>
            <p><strong>Unit:</strong> ${journey.clientId.unitNumber}</p>
            <p><strong>Step ${stepNumber}:</strong> ${journey.steps.find(s => s.step === parseInt(stepNumber))?.title}</p>
            <blockquote style="border-left: 4px solid #005670; padding-left: 20px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </blockquote>
            <p><a href="${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/journeys" style="color: #005670;">View in admin panel</a></p>
          `
        });
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Don't fail the request if email fails
    }

    await chat.populate('messages.senderId', 'name email');
    res.json({ message: 'Message sent successfully', chat });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const isAdmin = req.user.role === 'admin';

    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }

    const chat = await JourneyChat.findOne({ 
      journeyId: journey._id, 
      stepNumber: parseInt(stepNumber) 
    });

    if (!chat) {
      return res.json({ message: 'No chat found' });
    }

    // Mark all unread messages as read
    chat.messages.forEach(msg => {
      if (!msg.read && msg.sender !== (isAdmin ? 'admin' : 'client')) {
        msg.read = true;
        msg.readAt = new Date();
      }
    });

    // Reset unread count
    if (isAdmin) {
      chat.unreadCountAdmin = 0;
    } else {
      chat.unreadCountClient = 0;
    }

    await chat.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ message: 'Error marking as read', error: error.message });
  }
};

// Download attachment
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

    const message = chat.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const attachment = message.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(attachment.data);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Error downloading attachment', error: error.message });
  }
};

module.exports = {
  getStepChat,
  sendMessage,
  markAsRead,
  downloadAttachment
};