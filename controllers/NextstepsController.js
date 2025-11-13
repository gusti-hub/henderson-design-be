const NextStepsOption = require('../models/NextStepsOption');
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

    const validOptions = ['lock-price', 'design-fee', 'questions'];
    if (!validOptions.includes(selectedOption)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option selected'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check existing submission
    let submission = await NextStepsOption.findOne({
      email: email.toLowerCase(),
      unitNumber: unitNumber.trim()
    });

    if (submission) {
      submission.name = name.trim();
      submission.phone = phone?.trim() || '';
      submission.selectedOption = selectedOption;
      submission.notes = notes?.trim() || '';
      submission.status = 'pending';
      submission.emailNotifications = {}; // clear email flags
      await submission.save();
    } else {
      submission = await NextStepsOption.create({
        name: name.trim(),
        email: email.toLowerCase(),
        phone: phone?.trim() || '',
        unitNumber: unitNumber.trim(),
        selectedOption,
        notes: notes?.trim() || '',
        status: 'pending',
        submissionSource: 'next-steps-page',
        emailNotifications: {},
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      });
    }

    // ❗ NO EMAILS SENT HERE

    return res.status(201).json({
      success: true,
      message: 'Next Step option saved. Please continue to scheduling.',
      data: {
        submissionId: submission._id
      }
    });

  } catch (err) {
    console.error('❌ submitOption error:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to save next steps option.'
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