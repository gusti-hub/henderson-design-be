const NextStepsOption = require('../models/Nextstepssubmission');
const sendEmail = require('../utils/sendEmail');
const { 
  lockPriceClientTemplate, 
  lockPriceAdminTemplate,
  designFeeClientTemplate,
  designFeeAdminTemplate,
  questionsClientTemplate,
  questionsAdminTemplate
} = require('../utils/emailTemplates');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gustianggara@henderson.house;almer@henderson.house;madeline@henderson.house';
const NOTIFICATION_EMAIL = 'anggaraputra9552@gmail.com';

// @desc Submit next steps option selection
// @route POST /api/next-steps/submit-option
// @access Public
const submitOption = async (req, res) => {
  try {
    const { name, email, phone, unitNumber, selectedOption, notes } = req.body;

    // Validation
    if (!name || !email || !unitNumber || !selectedOption) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, unit number, and selected option are required'
      });
    }

    // Validate option type
    const validOptions = ['lock-price', 'design-fee', 'questions'];
    if (!validOptions.includes(selectedOption)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option selected'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    console.log('\n📋 ========================================');
    console.log(' NEW NEXT STEPS OPTION SUBMISSION');
    console.log('========================================');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Unit:', unitNumber);
    console.log('Option:', selectedOption);

    // Check if submission already exists for this email + unit
    let submission = await NextStepsOption.findOne({
      email: email.toLowerCase(),
      unitNumber: unitNumber.trim()
    });

    if (submission) {
      console.log('📝 Updating existing submission:', submission._id);
      
      // Update existing submission
      submission.name = name.trim();
      submission.phone = phone?.trim() || '';
      submission.selectedOption = selectedOption;
      submission.notes = notes?.trim() || '';
      submission.status = 'pending';
      
      await submission.save();
    } else {
      console.log('✨ Creating new submission...');
      
      // Create new submission
      submission = await NextStepsOption.create({
        name: name.trim(),
        email: email.toLowerCase(),
        phone: phone?.trim() || '',
        unitNumber: unitNumber.trim(),
        selectedOption: selectedOption,
        notes: notes?.trim() || '',
        status: 'pending',
        submissionSource: 'next-steps-page',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      });
    }

    console.log('✅ Submission saved - ID:', submission._id);

    // Determine which email templates to use
    let clientTemplate, adminTemplate, clientSubject, adminSubject;

    switch (selectedOption) {
      case 'lock-price':
        clientTemplate = lockPriceClientTemplate;
        adminTemplate = lockPriceAdminTemplate;
        clientSubject = 'Lock 2025 Pricing - Next Steps';
        adminSubject = `🔒 New Lock Pricing Request - ${name} (${unitNumber})`;
        break;
      
      case 'design-fee':
        clientTemplate = designFeeClientTemplate;
        adminTemplate = designFeeAdminTemplate;
        clientSubject = 'Design Hold Fee - Next Steps';
        adminSubject = `📋 New Design Fee Request - ${name} (${unitNumber})`;
        break;
      
      case 'questions':
        clientTemplate = questionsClientTemplate;
        adminTemplate = questionsAdminTemplate;
        clientSubject = 'Consultation Request - We\'ll Be In Touch';
        adminSubject = `❓ New Consultation Request - ${name} (${unitNumber})`;
        break;
      
      default:
        clientTemplate = questionsClientTemplate;
        adminTemplate = questionsAdminTemplate;
        clientSubject = 'Request Received - We\'ll Be In Touch';
        adminSubject = `📨 New Request - ${name} (${unitNumber})`;
    }

    // Send client confirmation email (ONLY ONCE)
    try {
      console.log('\n📧 Sending client confirmation email to:', email);
      
      const clientEmailHTML = clientTemplate({
        clientName: name,
        unitNumber: unitNumber,
        email: email,
        phone: phone || 'Not provided',
        notes: notes || 'None'
      });

      await sendEmail({
        to: email,
        toName: name,
        subject: clientSubject,
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

    // Send admin notification email #1 to primary admin
    try {
      const adminEmails = (process.env.ADMIN_EMAIL || 'gustianggara@henderson.house;almer@henderson.house;madeline@henderson.house')
        .split(/[;,]+/) // split by ; or ,
        .map(e => e.trim())
        .filter(e => e.length > 0);

      console.log('\n📧 Sending admin notification to:', adminEmails.join(', '));

      const adminEmailHTML = adminTemplate({
        clientName: name,
        clientEmail: email,
        clientPhone: phone || 'Not provided',
        unitNumber: unitNumber,
        notes: notes || 'None',
        submittedAt: new Date().toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      for (const adminEmail of adminEmails) {
        try {
          await sendEmail({
            to: adminEmail,
            toName: 'Henderson Admin',
            subject: adminSubject,
            htmlContent: adminEmailHTML
          });
          console.log(`✅ Admin email sent to: ${adminEmail}`);
        } catch (err) {
          console.error(`⚠️ Failed to send admin email to ${adminEmail}:`, err.message);
        }
      }

      submission.emailNotifications.adminNotificationSent = true;
      submission.emailNotifications.adminNotificationSentAt = new Date();
      await submission.save();

    } catch (adminEmailError) {
      console.error('⚠️ Admin email sending loop failed:', adminEmailError.message);
    }

    // Send admin notification email #2 to Gusti
    try {
      console.log('\n📧 Sending admin notification #2 to:', NOTIFICATION_EMAIL);
      
      const notificationEmailHTML = adminTemplate({
        clientName: name,
        clientEmail: email,
        clientPhone: phone || 'Not provided',
        unitNumber: unitNumber,
        notes: notes || 'None',
        submittedAt: new Date().toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      await sendEmail({
        to: NOTIFICATION_EMAIL,
        toName: 'Admin Notification',
        subject: adminSubject,
        htmlContent: notificationEmailHTML
      });
      
      console.log('✅ Admin email #2 sent to:', NOTIFICATION_EMAIL);
    } catch (notificationError) {
      console.error('⚠️ Admin email #2 failed:', notificationError.message);
      // Don't fail the request if notification email fails
    }

    console.log('========================================\n');
    console.log('📊 EMAIL SUMMARY:');
    console.log(`   1. Client email → ${email}`);
    console.log(`   2. Admin email #1 → ${ADMIN_EMAIL}`);
    console.log(`   3. Admin email #2 → ${NOTIFICATION_EMAIL}`);
    console.log('========================================\n');

    // Return success response
    res.status(201).json({
      success: true,
      message: '✅ Your request has been submitted! Confirmation email sent.',
      data: {
        submissionId: submission._id,
        name: submission.name,
        email: submission.email,
        unitNumber: submission.unitNumber,
        selectedOption: submission.selectedOption,
        optionDisplayName: submission.optionDisplayName,
        status: submission.status,
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
      message: 'Failed to submit request. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc Get submission by ID
// @route GET /api/next-steps/submission/:id
// @access Public
const getSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await NextStepsOption.findById(id);

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

// @desc Check if submission exists for email + unit number
// @route GET /api/next-steps/check
// @access Public
const checkSubmission = async (req, res) => {
  try {
    const { email, unitNumber } = req.query;

    if (!email || !unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Email and unit number are required'
      });
    }

    const submission = await NextStepsOption.findOne({
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
        name: submission.name,
        email: submission.email,
        unitNumber: submission.unitNumber,
        selectedOption: submission.selectedOption,
        optionDisplayName: submission.optionDisplayName,
        status: submission.status,
        createdAt: submission.createdAt
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

// @desc Get all pending submissions
// @route GET /api/next-steps/pending
// @access Protected (Admin)
const getPendingSubmissions = async (req, res) => {
  try {
    const pendingSubmissions = await NextStepsOption.getPendingSubmissions();

    res.json({
      success: true,
      count: pendingSubmissions.length,
      data: pendingSubmissions
    });

  } catch (error) {
    console.error('Get pending submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending submissions'
    });
  }
};

// @desc Get submissions by option type
// @route GET /api/next-steps/by-option/:optionType
// @access Protected (Admin)
const getSubmissionsByOption = async (req, res) => {
  try {
    const { optionType } = req.params;

    const validOptions = ['lock-price', 'design-fee', 'questions'];
    if (!validOptions.includes(optionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option type'
      });
    }

    const submissions = await NextStepsOption.getSubmissionsByOption(optionType);

    res.json({
      success: true,
      count: submissions.length,
      data: submissions
    });

  } catch (error) {
    console.error('Get submissions by option error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get submissions'
    });
  }
};

// @desc Update submission status
// @route PUT /api/next-steps/update-status/:id
// @access Protected (Admin)
const updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, processedBy } = req.body;

    const submission = await NextStepsOption.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Update status
    if (status) {
      submission.status = status;
    }

    if (adminNotes) {
      submission.adminNotes = adminNotes;
    }

    if (processedBy) {
      submission.processedBy = processedBy;
      submission.processedAt = new Date();
    }

    await submission.save();

    console.log(`✅ Submission ${id} updated - Status: ${submission.status}`);

    res.json({
      success: true,
      message: 'Submission updated successfully',
      data: submission
    });

  } catch (error) {
    console.error('Update submission status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update submission'
    });
  }
};

module.exports = {
  submitOption,
  getSubmission,
  checkSubmission,
  getPendingSubmissions,
  getSubmissionsByOption,
  updateSubmissionStatus
};