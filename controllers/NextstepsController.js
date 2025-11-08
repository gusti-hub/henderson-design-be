const NextStepsSubmission = require('../models/NextStepsSubmission');
const sendEmail = require('../utils/sendEmail');
const { 
  meetingRequestTemplate, 
  meetingConfirmationTemplate, 
  meetingCancellationTemplate,
  adminMeetingNotificationTemplate 
} = require('../utils/emailTemplates');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'anggaraputra9552@gmail.com';

// @desc    Submit next steps form (documents acknowledged + meeting request)
// @route   POST /api/next-steps/submit
// @access  Public
const submitNextSteps = async (req, res) => {
  try {
    const {
      name,
      email,
      unitNumber,
      preferredDate,
      preferredTime,
      alternateDate,
      alternateTime,
      meetingType,
      notes
    } = req.body;

    // Validation
    if (!name || !email || !unitNumber || !preferredDate || !preferredTime || !alternateDate || !alternateTime) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate public email domain
    const publicDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com'];
    const domain = email.toLowerCase().split('@')[1];
    
    if (!publicDomains.includes(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Please use a public email domain (Gmail, Yahoo, Outlook, etc.)'
      });
    }

    // Validate dates are in the future
    const preferredDateObj = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (preferredDateObj < today) {
      return res.status(400).json({
        success: false,
        message: 'Preferred date must be in the future'
      });
    }

    console.log('\n📋 ========================================');
    console.log('   NEW NEXT STEPS SUBMISSION');
    console.log('========================================');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Unit:', unitNumber);
    console.log('Preferred Date:', preferredDate);
    console.log('Meeting Type:', meetingType);

    // Check if submission already exists for this email + unit
    let submission = await NextStepsSubmission.findOne({
      email: email.toLowerCase(),
      unitNumber: unitNumber.trim()
    });

    if (submission) {
      console.log('📝 Updating existing submission:', submission._id);
      
      // Update existing submission
      submission.clientName = name.trim();
      submission.meetingRequest = {
        preferredDate: new Date(preferredDate),
        preferredTime,
        alternateDate: new Date(alternateDate),
        alternateTime,
        meetingType: meetingType || 'in-person',
        notes: notes || ''
      };
      submission.meetingStatus = 'pending';
      submission.allDocumentsAcknowledged = true;
      submission.documentsAcknowledgedAt = new Date();
      
      // Mark all documents as acknowledged
      submission.acknowledgedDocuments = {
        understandingOptions: {
          acknowledged: true,
          acknowledgedAt: new Date()
        },
        designFee: {
          acknowledged: true,
          acknowledgedAt: new Date()
        },
        depositPricing: {
          acknowledged: true,
          acknowledgedAt: new Date()
        }
      };
      
      await submission.save();
    } else {
      console.log('✨ Creating new submission...');
      
      // Create new submission
      submission = await NextStepsSubmission.create({
        email: email.toLowerCase(),
        unitNumber: unitNumber.trim(),
        clientName: name.trim(),
        allDocumentsAcknowledged: true,
        documentsAcknowledgedAt: new Date(),
        acknowledgedDocuments: {
          understandingOptions: {
            acknowledged: true,
            acknowledgedAt: new Date()
          },
          designFee: {
            acknowledged: true,
            acknowledgedAt: new Date()
          },
          depositPricing: {
            acknowledged: true,
            acknowledgedAt: new Date()
          }
        },
        meetingRequest: {
          preferredDate: new Date(preferredDate),
          preferredTime,
          alternateDate: new Date(alternateDate),
          alternateTime,
          meetingType: meetingType || 'in-person',
          notes: notes || ''
        },
        meetingStatus: 'pending',
        submissionSource: 'next-steps-page',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      });
    }

    console.log('✅ Submission saved - ID:', submission._id);

    // Format dates for email
    const formattedPreferredDate = new Date(preferredDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedAlternateDate = new Date(alternateDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send client confirmation email
    try {
      console.log('\n📧 Sending client confirmation email...');
      
      const clientEmailHTML = meetingRequestTemplate({
        clientName: name,
        unitNumber: unitNumber,
        preferredDate: formattedPreferredDate,
        preferredTime: preferredTime,
        alternateDate: formattedAlternateDate,
        alternateTime: alternateTime,
        meetingType: meetingType || 'in-person',
        notes: notes || ''
      });

      await sendEmail({
        to: email,
        toName: name,
        subject: `Meeting Request Confirmation - Unit ${unitNumber}`,
        htmlContent: clientEmailHTML
      });

      submission.emailNotifications.clientConfirmationSent = true;
      submission.emailNotifications.clientConfirmationSentAt = new Date();
      await submission.save();

      console.log('✅ Client email sent');
    } catch (emailError) {
      console.error('❌ Client email failed:', emailError.message);
      // Don't fail the request if email fails
    }

    // Send admin notification email to primary admin
    try {
      console.log('\n📧 Sending admin notification to:', ADMIN_EMAIL);

      const adminEmailHTML = adminMeetingNotificationTemplate({
        clientName: name,
        clientEmail: email,
        unitNumber: unitNumber,
        preferredDate: formattedPreferredDate,
        preferredTime: preferredTime,
        alternateDate: formattedAlternateDate,
        alternateTime: alternateTime,
        meetingType: meetingType || 'in-person',
        meetingNotes: notes || '',
        questionnaire: null // No questionnaire in this flow
      });

      await sendEmail({
        to: ADMIN_EMAIL,
        toName: 'Henderson Admin',
        subject: `🔔 New Meeting Request - ${name} (${unitNumber})`,
        htmlContent: adminEmailHTML
      });

      submission.emailNotifications.adminNotificationSent = true;
      submission.emailNotifications.adminNotificationSentAt = new Date();
      await submission.save();

      console.log('✅ Admin email sent to primary admin');
    } catch (adminEmailError) {
      console.error('⚠️  Admin email failed:', adminEmailError.message);
      // Don't fail the request if admin email fails
    }

    // Send duplicate notification to anggaraputra9552@gmail.com
    const NOTIFICATION_EMAIL = 'anggaraputra9552@gmail.com';
    if (NOTIFICATION_EMAIL && NOTIFICATION_EMAIL !== ADMIN_EMAIL) {
      try {
        console.log('\n📧 Sending duplicate notification to:', NOTIFICATION_EMAIL);

        const notificationEmailHTML = adminMeetingNotificationTemplate({
          clientName: name,
          clientEmail: email,
          unitNumber: unitNumber,
          preferredDate: formattedPreferredDate,
          preferredTime: preferredTime,
          alternateDate: formattedAlternateDate,
          alternateTime: alternateTime,
          meetingType: meetingType || 'in-person',
          meetingNotes: notes || '',
          questionnaire: null
        });

        await sendEmail({
          to: NOTIFICATION_EMAIL,
          toName: 'Notification Admin',
          subject: `🔔 New Meeting Request - ${name} (${unitNumber})`,
          htmlContent: notificationEmailHTML
        });

        console.log('✅ Duplicate notification sent');
      } catch (notificationError) {
        console.error('⚠️  Duplicate notification failed:', notificationError.message);
        // Don't fail the request if notification email fails
      }
    }

    console.log('========================================\n');

    // Return success response
    res.status(201).json({
      success: true,
      message: submission.isNew 
        ? '✅ Meeting request submitted! Confirmation email sent.'
        : '✅ Meeting request updated! Confirmation email sent.',
      data: {
        submissionId: submission._id,
        name: submission.clientName,
        email: submission.email,
        unitNumber: submission.unitNumber,
        meetingStatus: submission.meetingStatus,
        preferredDate: submission.meetingRequest.preferredDate,
        preferredTime: submission.meetingRequest.preferredTime,
        documentsAcknowledged: submission.allDocumentsAcknowledged,
        createdAt: submission.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Submission error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit meeting request. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get submission by ID
// @route   GET /api/next-steps/submission/:id
// @access  Public
const getSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await NextStepsSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get submission'
    });
  }
};

// @desc    Get submissions by email and unit number
// @route   GET /api/next-steps/check
// @access  Public
const checkSubmission = async (req, res) => {
  try {
    const { email, unitNumber } = req.query;

    if (!email || !unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Email and unit number are required'
      });
    }

    const submission = await NextStepsSubmission.findOne({
      email: email.toLowerCase(),
      unitNumber: unitNumber.trim()
    }).sort({ createdAt: -1 });

    if (!submission) {
      return res.json({
        success: true,
        exists: false,
        message: 'No submission found'
      });
    }

    res.json({
      success: true,
      exists: true,
      data: {
        submissionId: submission._id,
        email: submission.email,
        unitNumber: submission.unitNumber,
        meetingStatus: submission.meetingStatus,
        documentsAcknowledged: submission.allDocumentsAcknowledged,
        createdAt: submission.createdAt,
        meetingRequest: submission.meetingRequest
      }
    });

  } catch (error) {
    console.error('Check submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check submission'
    });
  }
};

// @desc    Get all pending meeting requests
// @route   GET /api/next-steps/pending
// @access  Protected (Admin)
const getPendingMeetings = async (req, res) => {
  try {
    const pendingMeetings = await NextStepsSubmission.getPendingMeetings();

    res.json({
      success: true,
      count: pendingMeetings.length,
      data: pendingMeetings
    });

  } catch (error) {
    console.error('Get pending meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending meetings'
    });
  }
};

// @desc    Confirm meeting
// @route   PUT /api/next-steps/confirm/:id
// @access  Protected (Admin)
const confirmMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      confirmedDate,
      confirmedTime,
      meetingLink,
      designerNotes
    } = req.body;

    const submission = await NextStepsSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Update meeting confirmation
    await submission.confirmMeeting({
      confirmedDate: new Date(confirmedDate),
      confirmedTime,
      meetingLink: meetingLink || '',
      confirmedBy: req.user?.name || req.user?.email || 'Admin',
      designerNotes: designerNotes || ''
    });

    // Send confirmation email to client
    try {
      const formattedDate = new Date(confirmedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const confirmationEmailHTML = meetingConfirmationTemplate({
        clientName: submission.clientName || submission.email.split('@')[0],
        unitNumber: submission.unitNumber,
        confirmedDate: formattedDate,
        confirmedTime: confirmedTime,
        meetingType: submission.meetingRequest.meetingType,
        meetingLink: meetingLink || '',
        notes: designerNotes || ''
      });

      await sendEmail({
        to: submission.email,
        toName: submission.clientName || submission.email.split('@')[0],
        subject: `Meeting Confirmed - Unit ${submission.unitNumber}`,
        htmlContent: confirmationEmailHTML
      });

      submission.emailNotifications.meetingConfirmationSent = true;
      submission.emailNotifications.meetingConfirmationSentAt = new Date();
      await submission.save();

      console.log('✅ Meeting confirmation email sent to client');
    } catch (emailError) {
      console.error('❌ Confirmation email failed:', emailError.message);
    }

    // Send duplicate notification to anggaraputra9552@gmail.com
    const NOTIFICATION_EMAIL = 'anggaraputra9552@gmail.com';
    try {
      console.log('📧 Sending confirmation notification to:', NOTIFICATION_EMAIL);

      const formattedDate = new Date(confirmedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const notificationHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #28a745; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f8f9fa; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #004b5f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✅ Meeting Confirmed</h2>
    </div>
    <div class="content">
      <p>A meeting has been confirmed with the following details:</p>
      
      <div class="info-row">
        <span class="label">Client Name:</span> ${submission.clientName || 'N/A'}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${submission.email}
      </div>
      <div class="info-row">
        <span class="label">Unit Number:</span> ${submission.unitNumber}
      </div>
      <div class="info-row">
        <span class="label">Confirmed Date:</span> ${formattedDate}
      </div>
      <div class="info-row">
        <span class="label">Confirmed Time:</span> ${confirmedTime}
      </div>
      <div class="info-row">
        <span class="label">Meeting Type:</span> ${submission.meetingRequest.meetingType}
      </div>
      ${meetingLink ? `<div class="info-row"><span class="label">Meeting Link:</span> ${meetingLink}</div>` : ''}
      ${designerNotes ? `<div class="info-row"><span class="label">Designer Notes:</span> ${designerNotes}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

      await sendEmail({
        to: NOTIFICATION_EMAIL,
        toName: 'Admin Notification',
        subject: `✅ Meeting Confirmed - ${submission.clientName} (${submission.unitNumber})`,
        htmlContent: notificationHTML
      });

      console.log('✅ Confirmation notification sent');
    } catch (notificationError) {
      console.error('⚠️  Confirmation notification failed:', notificationError.message);
    }

    res.json({
      success: true,
      message: 'Meeting confirmed successfully',
      data: submission
    });

  } catch (error) {
    console.error('Confirm meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm meeting'
    });
  }
};

// @desc    Cancel meeting
// @route   PUT /api/next-steps/cancel/:id
// @access  Protected (Admin)
const cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const submission = await NextStepsSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    submission.meetingStatus = 'cancelled';
    submission.adminNotes = reason || 'Meeting cancelled by admin';
    await submission.save();

    // Send cancellation email to client
    try {
      const cancelledDate = submission.confirmedMeeting?.confirmedDate 
        ? new Date(submission.confirmedMeeting.confirmedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : null;

      const cancellationEmailHTML = meetingCancellationTemplate({
        clientName: submission.clientName || submission.email.split('@')[0],
        unitNumber: submission.unitNumber,
        cancelledDate: cancelledDate,
        cancelledTime: submission.confirmedMeeting?.confirmedTime || '',
        reason: reason || ''
      });

      await sendEmail({
        to: submission.email,
        toName: submission.clientName || submission.email.split('@')[0],
        subject: `Meeting Cancelled - Unit ${submission.unitNumber}`,
        htmlContent: cancellationEmailHTML
      });

      console.log('✅ Cancellation email sent to client');
    } catch (emailError) {
      console.error('❌ Cancellation email failed:', emailError.message);
    }

    // Send duplicate notification to anggaraputra9552@gmail.com
    const NOTIFICATION_EMAIL = 'anggaraputra9552@gmail.com';
    try {
      console.log('📧 Sending cancellation notification to:', NOTIFICATION_EMAIL);

      const cancelledDate = submission.confirmedMeeting?.confirmedDate 
        ? new Date(submission.confirmedMeeting.confirmedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : null;

      const notificationHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f8f9fa; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #004b5f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>❌ Meeting Cancelled</h2>
    </div>
    <div class="content">
      <p>A meeting has been cancelled:</p>
      
      <div class="info-row">
        <span class="label">Client Name:</span> ${submission.clientName || 'N/A'}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${submission.email}
      </div>
      <div class="info-row">
        <span class="label">Unit Number:</span> ${submission.unitNumber}
      </div>
      ${cancelledDate ? `<div class="info-row"><span class="label">Cancelled Date:</span> ${cancelledDate}</div>` : ''}
      ${submission.confirmedMeeting?.confirmedTime ? `<div class="info-row"><span class="label">Cancelled Time:</span> ${submission.confirmedMeeting.confirmedTime}</div>` : ''}
      ${reason ? `<div class="info-row"><span class="label">Reason:</span> ${reason}</div>` : ''}
    </div>
  </div>
</body>
</html>`;

      await sendEmail({
        to: NOTIFICATION_EMAIL,
        toName: 'Admin Notification',
        subject: `❌ Meeting Cancelled - ${submission.clientName} (${submission.unitNumber})`,
        htmlContent: notificationHTML
      });

      console.log('✅ Cancellation notification sent');
    } catch (notificationError) {
      console.error('⚠️  Cancellation notification failed:', notificationError.message);
    }

    res.json({
      success: true,
      message: 'Meeting cancelled',
      data: submission
    });

  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel meeting'
    });
  }
};

module.exports = {
  submitNextSteps,
  getSubmission,
  checkSubmission,
  getPendingMeetings,
  confirmMeeting,
  cancelMeeting
};