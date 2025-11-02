// backend/controllers/questionnaireController.js
const ClientQuestionnaire = require('../models/ClientQuestionnaire');
const User = require('../models/User');
const Order = require('../models/Order');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Create or update questionnaire (draft mode)
 * Supports both authenticated users and client portal (email/unitNumber)
 * ✅ FIXED: Always update existing record, never create duplicates
 */
exports.saveQuestionnaireDraft = async (req, res) => {
  try {
    const questionnaireData = req.body;
    let userId;

    // Check if request is authenticated (has req.user from protect middleware)
    if (req.user) {
      userId = req.user.id;
    } else {
      // Client portal - verify by email and unitNumber
      const { email, unitNumber } = req.body;
      
      if (!email || !unitNumber) {
        return res.status(400).json({
          success: false,
          message: 'Email and unit number are required'
        });
      }

      const user = await User.findOne({ 
        email: email.toLowerCase(), 
        unitNumber
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      userId = user._id;
    }

    console.log('\n💾 Saving questionnaire draft...');
    console.log('User ID:', userId);
    console.log('Unit Number:', questionnaireData.unitNumber);

    // ✅ FIX: Use findOneAndUpdate with upsert to prevent duplicates
    // Find by userId + unitNumber + status OR just userId + unitNumber
    const questionnaire = await ClientQuestionnaire.findOneAndUpdate(
      {
        userId: userId,
        unitNumber: questionnaireData.unitNumber,
        status: { $in: ['draft', 'submitted'] } // Update any draft or submitted
      },
      {
        ...questionnaireData,
        userId: userId,
        status: 'draft',
        updatedAt: new Date()
      },
      {
        new: true,        // Return updated document
        upsert: true,     // Create if doesn't exist
        runValidators: true
      }
    );

    console.log('✅ Draft saved/updated successfully');
    console.log('   Questionnaire ID:', questionnaire._id);
    console.log('   Status:', questionnaire.status);

    res.json({
      success: true,
      message: 'Draft saved successfully',
      questionnaire: questionnaire,
      completionPercentage: questionnaire.completionPercentage
    });
  } catch (error) {
    console.error('❌ Save draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving draft',
      error: error.message
    });
  }
};

/**
 * Submit completed questionnaire
 * Supports both authenticated users and client portal (email/unitNumber)
 * ✅ FIXED: Always update existing record, never create duplicates
 */
exports.submitQuestionnaire = async (req, res) => {
  try {
    const questionnaireData = req.body;
    let userId, user;

    // Check if request is authenticated
    if (req.user) {
      userId = req.user.id;
      user = await User.findById(userId);
    } else {
      // Client portal - verify by email and unitNumber
      const { email, unitNumber } = req.body;
      
      if (!email || !unitNumber) {
        return res.status(400).json({
          success: false,
          message: 'Email and unit number are required'
        });
      }

      user = await User.findOne({ 
        email: email.toLowerCase(), 
        unitNumber
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      userId = user._id;
    }

    // Validate required fields
    const validationErrors = validateQuestionnaire(questionnaireData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required fields',
        errors: validationErrors
      });
    }

    console.log('\n📝 Submitting questionnaire...');
    console.log('User:', user.name);
    console.log('Email:', user.email);
    console.log('Unit Number:', questionnaireData.unitNumber);

    // ✅ FIX: Use findOneAndUpdate with upsert to prevent duplicates
    const questionnaire = await ClientQuestionnaire.findOneAndUpdate(
      {
        userId: userId,
        unitNumber: questionnaireData.unitNumber
      },
      {
        ...questionnaireData,
        userId: userId,
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    console.log('✅ Questionnaire submitted successfully');
    console.log('   Questionnaire ID:', questionnaire._id);
    console.log('   Status:', questionnaire.status);

    // NO EMAIL NOTIFICATIONS - removed as requested

    res.json({
      success: true,
      message: 'Questionnaire submitted successfully',
      questionnaire: questionnaire
    });
  } catch (error) {
    console.error('❌ Submit questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting questionnaire',
      error: error.message
    });
  }
};

/**
 * Get questionnaire by ID
 * Supports both authenticated users and client portal
 */
exports.getQuestionnaire = async (req, res) => {
  try {
    const questionnaireId = req.params.id;
    const questionnaire = await ClientQuestionnaire.findById(questionnaireId)
      .populate('userId', 'name email phoneNumber')
      .populate('reviewedBy', 'name email');

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: 'Questionnaire not found'
      });
    }

    // Check permissions
    if (req.user) {
      // Authenticated user
      const userId = req.user.id;
      const userRole = req.user.role;

      if (questionnaire.userId._id.toString() !== userId && 
          !['admin', 'designer'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }
    // If not authenticated, allow access (client portal)

    res.json({
      success: true,
      questionnaire: questionnaire
    });
  } catch (error) {
    console.error('Get questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving questionnaire',
      error: error.message
    });
  }
};

/**
 * Get user's questionnaires
 * Supports both authenticated users and client portal (email/unitNumber)
 * ✅ FIXED: Return only the latest questionnaire per unit
 */
exports.getUserQuestionnaires = async (req, res) => {
  try {
    let userId;

    // Check if request is authenticated
    if (req.user) {
      userId = req.user.id;
    } else {
      // Client portal - verify by email and unitNumber from query params
      const { email, unitNumber } = req.query;
      
      if (!email || !unitNumber) {
        return res.status(400).json({
          success: false,
          message: 'Email and unit number are required'
        });
      }

      const user = await User.findOne({ 
        email: email.toLowerCase(), 
        unitNumber
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      userId = user._id;
    }

    // Get questionnaires - should only be 1 per unit now
    const questionnaires = await ClientQuestionnaire.find({ userId: userId })
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      questionnaires: questionnaires
    });
  } catch (error) {
    console.error('Get user questionnaires error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving questionnaires',
      error: error.message
    });
  }
};

/**
 * Get all questionnaires (Admin/Designer only)
 */
exports.getAllQuestionnaires = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const questionnaires = await ClientQuestionnaire.find(query)
      .populate('userId', 'name email phoneNumber')
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1, updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await ClientQuestionnaire.countDocuments(query);

    res.json({
      success: true,
      questionnaires: questionnaires,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    console.error('Get all questionnaires error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving questionnaires',
      error: error.message
    });
  }
};

/**
 * Update questionnaire status (Admin/Designer only)
 */
exports.updateQuestionnaireStatus = async (req, res) => {
  try {
    const questionnaireId = req.params.id;
    const { status, designerNotes } = req.body;

    const questionnaire = await ClientQuestionnaire.findById(questionnaireId);

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: 'Questionnaire not found'
      });
    }

    questionnaire.status = status;
    if (designerNotes) questionnaire.designerNotes = designerNotes;
    questionnaire.reviewedAt = new Date();
    questionnaire.reviewedBy = req.user.id;

    await questionnaire.save();

    // NO EMAIL NOTIFICATIONS - removed as requested

    res.json({
      success: true,
      message: 'Questionnaire status updated',
      questionnaire: questionnaire
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating questionnaire',
      error: error.message
    });
  }
};

/**
 * Delete questionnaire (soft delete - only drafts)
 */
exports.deleteQuestionnaire = async (req, res) => {
  try {
    const questionnaireId = req.params.id;
    let userId;

    // Check if request is authenticated
    if (req.user) {
      userId = req.user.id;
    } else {
      // Client portal - get userId from query
      const { email, unitNumber } = req.query;
      
      if (!email || !unitNumber) {
        return res.status(400).json({
          success: false,
          message: 'Email and unit number are required'
        });
      }

      const user = await User.findOne({ 
        email: email.toLowerCase(), 
        unitNumber
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      userId = user._id;
    }

    const questionnaire = await ClientQuestionnaire.findById(questionnaireId);

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: 'Questionnaire not found'
      });
    }

    // Only allow deletion of drafts by owner
    if (questionnaire.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (questionnaire.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft questionnaires can be deleted'
      });
    }

    await questionnaire.deleteOne();

    res.json({
      success: true,
      message: 'Draft questionnaire deleted'
    });
  } catch (error) {
    console.error('Delete questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting questionnaire',
      error: error.message
    });
  }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Validate required questionnaire fields
 */
function validateQuestionnaire(data) {
  const errors = [];

  // Section 1: Home Use & Lifestyle (Required)
  if (!data.clientName) errors.push('Client name is required');
  if (!data.unitNumber) errors.push('Unit number is required');
  if (!data.homeUse?.purpose) errors.push('Home purpose is required');
  if (!data.homeUse?.primaryUsers) errors.push('Primary users is required');
  if (!data.homeUse?.livingStyle) errors.push('Living style is required');

  // Section 3: Design Aesthetic (Required)
  if (!data.designOptions?.designType) errors.push('Design type is required');

  return errors;
}

module.exports = exports;