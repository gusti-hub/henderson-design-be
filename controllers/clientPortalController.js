const User = require('../models/User');
const Order = require('../models/Order');
const MeetingSchedule = require('../models/MeetingSchedule');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// @desc    Verify client's down payment
// @route   POST /api/clients/verify-down-payment
// @access  Public
const verifyDownPayment = async (req, res) => {
  try {
    const { email, unitNumber } = req.body;

    // Validate input
    if (!email || !unitNumber) {
      return res.status(400).json({ 
        message: 'Email and unit number are required' 
      });
    }

    // Find user by email and unit number
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      unitNumber,
      // status: 'approved' 
    });

    // if (!user) {
    //   return res.status(404).json({ 
    //     message: 'No approved account found with this email and unit number' 
    //   });
    // }

    // // Check if user has an order with down payment completed
    // const order = await Order.findOne({ 
    //   userId: user._id,
    //   downPaymentStatus: 'completed'
    // });

    // if (!order) {
    //   return res.status(403).json({ 
    //     message: 'No down payment found for this account. Please complete your down payment before scheduling a meeting.' 
    //   });
    // }

    // Return client info (without sensitive data)
    res.json({
      success: true,
      client: {
        name: user.name,
        email: email,
        unitNumber: unitNumber
        //phoneNumber: user.phoneNumber
      }
    });

  } catch (error) {
    console.error('Down payment verification error:', error);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
};

// @desc    Schedule a meeting with designer
// @route   POST /api/clients/schedule-meeting
// @access  Public (but requires verification)
const scheduleMeeting = async (req, res) => {
  try {
    const { 
      email, 
      unitNumber, 
      preferredDate, 
      preferredTime, 
      alternateDate, 
      alternateTime,
      meetingType,
      notes 
    } = req.body;

    // Validate input
    if (!email || !unitNumber || !preferredDate || !preferredTime || !alternateDate || !alternateTime) {
      return res.status(400).json({ 
        message: 'All required fields must be provided' 
      });
    }

    // Re-verify user
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      unitNumber,
      // status: 'approved' 
    });

    // if (!user) {
    //   return res.status(404).json({ 
    //     message: 'User not found' 
    //   });
    // }

    // // Verify down payment again
    // const order = await Order.findOne({ 
    //   userId: user._id,
    //   downPaymentStatus: 'completed'
    // });

    // if (!order) {
    //   return res.status(403).json({ 
    //     message: 'Down payment verification failed' 
    //   });
    // }

    // Create meeting schedule
    const meetingSchedule = await MeetingSchedule.create({
      userId: user._id,
      // orderId: order._id,
      preferredDate: new Date(preferredDate),
      preferredTime,
      alternateDate: new Date(alternateDate),
      alternateTime,
      meetingType: meetingType || 'in-person',
      notes: notes || '',
      status: 'pending'
    });

    // Send confirmation email to client
    await sendClientConfirmationEmail(user, {
      preferredDate,
      preferredTime,
      alternateDate,
      alternateTime,
      meetingType,
      notes
    });

    // Send notification to designers/admins
    await sendDesignerNotificationEmail(user, {
      preferredDate,
      preferredTime,
      alternateDate,
      alternateTime,
      meetingType,
      notes,
      meetingScheduleId: meetingSchedule._id
    });

    res.json({
      success: true,
      message: 'Meeting request submitted successfully',
      meetingScheduleId: meetingSchedule._id
    });

  } catch (error) {
    console.error('Meeting scheduling error:', error);
    res.status(500).json({ message: 'Failed to schedule meeting. Please try again.' });
  }
};

// Email helper functions
const sendClientConfirmationEmail = async (user, meetingDetails) => {
  try {
    const { preferredDate, preferredTime, alternateDate, alternateTime, meetingType, notes } = meetingDetails;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Design Consultation Request Received - Henderson Design Group',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
            <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #005670; margin-bottom: 20px;">Design Consultation Request Received</h2>
            
            <p>Dear ${user.name},</p>
            
            <p>Thank you for scheduling your design consultation! We've received your meeting request and our team is reviewing your preferred time slots.</p>
            
            <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
              <h3 style="color: #005670; margin-top: 0;">Your Request Details</h3>
              <p><strong>Unit Number:</strong> ${user.unitNumber}</p>
              <p><strong>Meeting Type:</strong> ${meetingType === 'in-person' ? 'In-Person' : 'Virtual Meeting'}</p>
              <p><strong>Preferred Date & Time:</strong> ${new Date(preferredDate).toLocaleDateString()} at ${preferredTime}</p>
              <p><strong>Alternate Date & Time:</strong> ${new Date(alternateDate).toLocaleDateString()} at ${alternateTime}</p>
              ${notes ? `<p><strong>Your Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            <div style="background-color: #e8f4f8; border-left: 4px solid #005670; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>What happens next:</strong></p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Our design team will review your time preferences</li>
                <li>You'll receive a confirmation email within 24 hours</li>
                <li>We'll send calendar invitations with meeting details</li>
                <li>For virtual meetings, we'll include video conference links</li>
              </ul>
            </div>
            
            <p>We're excited to work with you and bring your design vision to life!</p>
            
            <p>If you need to make any changes or have questions, please don't hesitate to contact us at (808) 315-8782.</p>
            
            <p>Best regards,<br>The Henderson Design Group Team</p>
          </div>
          
          <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Henderson Design Group | 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p style="margin: 5px 0 0 0;">Phone: (808) 315-8782</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Client confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending client confirmation email:', error);
  }
};

const sendDesignerNotificationEmail = async (user, meetingDetails) => {
  try {
    const { preferredDate, preferredTime, alternateDate, alternateTime, meetingType, notes, meetingScheduleId } = meetingDetails;
    
    // Get all admin and designer users
    const designers = await User.find({ 
      role: { $in: ['admin', 'designer'] } 
    });
    
    for (const designer of designers) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: designer.email,
        subject: 'New Design Consultation Request - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
              <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #800000; margin-bottom: 20px;">New Design Consultation Request</h2>
              
              <p>A client has submitted a meeting request and is awaiting confirmation.</p>
              
              <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
                <h3 style="color: #005670; margin-top: 0;">Client Information</h3>
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone:</strong> ${user.phoneNumber}</p>
                <p><strong>Unit Number:</strong> ${user.unitNumber}</p>
              </div>
              
              <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
                <h3 style="color: #005670; margin-top: 0;">Meeting Request Details</h3>
                <p><strong>Meeting Type:</strong> ${meetingType === 'in-person' ? 'In-Person' : 'Virtual Meeting'}</p>
                <p><strong>Preferred Date & Time:</strong> ${new Date(preferredDate).toLocaleDateString()} at ${preferredTime}</p>
                <p><strong>Alternate Date & Time:</strong> ${new Date(alternateDate).toLocaleDateString()} at ${alternateTime}</p>
                ${notes ? `<p><strong>Client Notes:</strong> ${notes}</p>` : ''}
                <p><strong>Request ID:</strong> ${meetingScheduleId}</p>
              </div>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Action Required:</strong> Please review this meeting request and confirm the appointment time within 24 hours.</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://de-cora.com'}/designer-login" 
                   style="background-color: #005670; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Access Admin Panel
                </a>
              </div>
            </div>
            
            <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">Henderson Design Group Admin System</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    }
    
    console.log('Designer notification emails sent successfully');
  } catch (error) {
    console.error('Error sending designer notification email:', error);
  }
};

// @desc    Confirm meeting schedule (for designers/admins)
// @route   PUT /api/clients/confirm-meeting/:meetingId
// @access  Private (Admin/Designer)
const confirmMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { confirmedDate, confirmedTime, meetingLink, notes } = req.body;

    const meetingSchedule = await MeetingSchedule.findById(meetingId)
      .populate('userId');

    if (!meetingSchedule) {
      return res.status(404).json({ message: 'Meeting schedule not found' });
    }

    // Update meeting schedule
    meetingSchedule.status = 'confirmed';
    meetingSchedule.confirmedDate = new Date(confirmedDate);
    meetingSchedule.confirmedTime = confirmedTime;
    meetingSchedule.meetingLink = meetingLink || '';
    meetingSchedule.designerNotes = notes || '';
    meetingSchedule.confirmedBy = req.user.id;
    await meetingSchedule.save();

    // Send confirmation email to client
    await sendMeetingConfirmationEmail(meetingSchedule.userId, {
      confirmedDate,
      confirmedTime,
      meetingType: meetingSchedule.meetingType,
      meetingLink,
      notes
    });

    res.json({
      success: true,
      message: 'Meeting confirmed successfully'
    });

  } catch (error) {
    console.error('Meeting confirmation error:', error);
    res.status(500).json({ message: 'Failed to confirm meeting' });
  }
};

const sendMeetingConfirmationEmail = async (user, confirmationDetails) => {
  try {
    const { confirmedDate, confirmedTime, meetingType, meetingLink, notes } = confirmationDetails;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Design Consultation Confirmed - Henderson Design Group',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
            <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #28a745; margin-bottom: 20px;">Your Design Consultation is Confirmed! 🎉</h2>
            
            <p>Dear ${user.name},</p>
            
            <p>Great news! Your design consultation has been confirmed. We're looking forward to meeting with you!</p>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #155724; margin-top: 0;">Confirmed Meeting Details</h3>
              <p><strong>📅 Date:</strong> ${new Date(confirmedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>🕐 Time:</strong> ${confirmedTime} (HST - Hawaii Standard Time)</p>
              <p><strong>📍 Type:</strong> ${meetingType === 'in-person' ? 'In-Person at our Kailua Kona Office' : 'Virtual Meeting'}</p>
              ${meetingLink ? `<p><strong>🔗 Meeting Link:</strong> <a href="${meetingLink}" style="color: #005670;">${meetingLink}</a></p>` : ''}
              ${notes ? `<p><strong>📝 Additional Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            ${meetingType === 'in-person' ? `
              <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
                <h3 style="color: #005670; margin-top: 0;">Office Location</h3>
                <p>
                  Henderson Design Group<br>
                  74-5518 Kaiwi Street Suite B<br>
                  Kailua Kona, HI 96740-3145<br>
                  Phone: (808) 315-8782
                </p>
              </div>
            ` : ''}
            
            <div style="background-color: #e8f4f8; border-left: 4px solid #005670; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>To prepare for your consultation:</strong></p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Review your design questionnaire responses</li>
                <li>Prepare any questions or ideas you'd like to discuss</li>
                <li>Gather inspiration photos if you have them</li>
                <li>${meetingType === 'virtual' ? 'Test your video/audio setup 10 minutes before' : 'Plan to arrive 5-10 minutes early'}</li>
              </ul>
            </div>
            
            <p>If you need to reschedule or have any questions, please contact us at (808) 315-8782 or reply to this email.</p>
            
            <p>We're excited to work with you!</p>
            
            <p>Best regards,<br>The Henderson Design Group Team</p>
          </div>
          
          <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Henderson Design Group | 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p style="margin: 5px 0 0 0;">Phone: (808) 315-8782</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Meeting confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending meeting confirmation email:', error);
  }
};

module.exports = {
  verifyDownPayment,
  scheduleMeeting,
  confirmMeeting
};
