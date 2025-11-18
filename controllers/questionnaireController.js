// backend/controllers/questionnaireController.js - COMPLETE VERSION WITH ALL HANDLERS
const ClientQuestionnaire = require('../models/ClientQuestionnaire');
const User = require('../models/User');

/**
 * Save questionnaire draft (auto-save)
 * NOT USED IN CURRENT IMPLEMENTATION but kept for compatibility
 */
exports.saveQuestionnaireDraft = async (req, res) => {
  try {
    const questionnaireData = req.body;
    let userId;

    if (req.user) {
      userId = req.user.id;
    } else {
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

    const questionnaire = await ClientQuestionnaire.findOneAndUpdate(
      { userId: userId },
      {
        ...questionnaireData,
        userId: userId,
        status: 'draft',
        updatedAt: new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    console.log('✅ Draft saved/updated successfully');

    res.json({
      success: true,
      message: 'Draft saved successfully',
      questionnaire: questionnaire
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
 * ✅ FIXED: Ensures likedDesigns is saved
 * ✅ FIXED: 1 user = 1 questionnaire (always update, never duplicate)
 */
exports.submitQuestionnaire = async (req, res) => {
  try {
    const questionnaireData = req.body;
    let userId, user;

    if (req.user) {
      userId = req.user.id;
      user = await User.findById(userId);
    } else {
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

    console.log('\n📝 Submitting questionnaire...');
    console.log('User:', user.name);
    console.log('Email:', user.email);
    console.log('Unit Number:', questionnaireData.unitNumber);
    console.log('Liked Designs:', questionnaireData.likedDesigns);

    const dataToSave = {
      clientName: questionnaireData.clientName || user.name,
      unitNumber: questionnaireData.unitNumber || user.unitNumber,
      email: user.email,
      userId: userId,
      
      // ✅ CRITICAL: Explicitly save likedDesigns
      likedDesigns: questionnaireData.likedDesigns || [],
      
      // Form data
      primary_use: questionnaireData.primary_use,
      occupancy: questionnaireData.occupancy,
      lifestyle: questionnaireData.lifestyle,
      entertaining: questionnaireData.entertaining,
      entertaining_style: questionnaireData.entertaining_style,
      design_style: questionnaireData.design_style,
      color_preference: questionnaireData.color_preference,
      atmosphere: questionnaireData.atmosphere,
      bedroom_use: questionnaireData.bedroom_use,
      work_from_home: questionnaireData.work_from_home,
      dining: questionnaireData.dining,
      bed_size: questionnaireData.bed_size,
      guest_bed: questionnaireData.guest_bed,
      tv_preference: questionnaireData.tv_preference,
      artwork: questionnaireData.artwork,
      window_treatment: questionnaireData.window_treatment,
      pets: questionnaireData.pets,
      pet_details: questionnaireData.pet_details,
      activities: questionnaireData.activities,
      collection_interest: questionnaireData.collection_interest,
      move_in: questionnaireData.move_in,
      must_haves: questionnaireData.must_haves,
      special_requests: questionnaireData.special_requests,
      
      // Status
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date(),
      isFirstTimeComplete: true,
      completionPercentage: 100
    };

    console.log('📦 Data to save:', dataToSave);

    // ✅ CRITICAL: Use findOneAndUpdate with upsert
    const questionnaire = await ClientQuestionnaire.findOneAndUpdate(
      { userId: userId },
      dataToSave,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('✅ Questionnaire submitted successfully');
    console.log('   Questionnaire ID:', questionnaire._id);
    console.log('   Status:', questionnaire.status);
    console.log('   Liked Designs Count:', questionnaire.likedDesigns?.length || 0);

    res.json({
      success: true,
      message: 'Questionnaire submitted successfully',
      questionnaire: questionnaire,
      isFirstTimeComplete: true
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

    if (req.user) {
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
 * ✅ FIXED: Returns only ONE questionnaire per user
 */
exports.getUserQuestionnaires = async (req, res) => {
  try {
    let userId;

    if (req.user) {
      userId = req.user.id;
    } else {
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

    const questionnaires = await ClientQuestionnaire.find({ userId: userId })
      .sort({ updatedAt: -1 })
      .limit(1);

    const hasCompletedQuestionnaire = questionnaires.some(
      q => q.status === 'submitted' || q.status === 'under-review' || q.status === 'approved'
    );

    res.json({
      success: true,
      questionnaires: questionnaires,
      hasCompletedQuestionnaire: hasCompletedQuestionnaire,
      needsQuestionnaire: !hasCompletedQuestionnaire
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
      .populate('userId', 'name email phoneNumber unitNumber')
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
 * Delete questionnaire (Admin only)
 */
exports.deleteQuestionnaire = async (req, res) => {
  try {
    const questionnaireId = req.params.id;

    // Allow both admin and user to delete (user only their own drafts)
    if (req.user) {
      const questionnaire = await ClientQuestionnaire.findById(questionnaireId);

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          message: 'Questionnaire not found'
        });
      }

      // Admin can delete any, user can only delete their own drafts
      if (req.user.role !== 'admin') {
        if (questionnaire.userId.toString() !== req.user.id || questionnaire.status !== 'draft') {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      await questionnaire.deleteOne();

      res.json({
        success: true,
        message: 'Questionnaire deleted'
      });
    } else {
      // Non-authenticated request
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

      const questionnaire = await ClientQuestionnaire.findById(questionnaireId);

      if (!questionnaire) {
        return res.status(404).json({
          success: false,
          message: 'Questionnaire not found'
        });
      }

      if (questionnaire.userId.toString() !== user._id.toString() || questionnaire.status !== 'draft') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await questionnaire.deleteOne();

      res.json({
        success: true,
        message: 'Questionnaire deleted'
      });
    }
  } catch (error) {
    console.error('Delete questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting questionnaire',
      error: error.message
    });
  }
};

module.exports = exports;