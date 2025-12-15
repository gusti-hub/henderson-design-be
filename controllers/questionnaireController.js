// backend/controllers/questionnaireController.js - FIXED VERSION
// ✅ Saves questionnaire directly to User.questionnaire field

const User = require('../models/User');

/**
 * Submit questionnaire - saves to User.questionnaire field
 * @route POST /api/questionnaires/submit
 */
const submitQuestionnaire = async (req, res) => {
  try {
    const { email, unitNumber, ...questionnaireData } = req.body;

    console.log('\n📝 Submitting questionnaire...');
    console.log('Email:', email);
    console.log('Unit Number:', unitNumber);
    console.log('Payload keys:', Object.keys(questionnaireData));

    // Find user by email and unitNumber
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      unitNumber
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email and unit number'
      });
    }

    console.log('✅ User found:', user.name);

    // ✅ Save ALL questionnaire data to user.questionnaire
    user.questionnaire = {
      clientName: questionnaireData.clientName || user.name,
      unitNumber: unitNumber,
      
      // Step 1: Home & Lifestyle
      purpose_of_residence: questionnaireData.purpose_of_residence || [],
      who_will_use: questionnaireData.who_will_use || [],
      family_members: questionnaireData.family_members || '',
      children_ages: questionnaireData.children_ages || '',
      has_renters: questionnaireData.has_renters || false,
      has_pets: questionnaireData.has_pets || false,
      pet_details: questionnaireData.pet_details || '',
      living_envision: questionnaireData.living_envision || [],
      home_feeling: questionnaireData.home_feeling || [],
      
      // Step 2: Daily Living
      work_from_home: questionnaireData.work_from_home || [],
      entertain_frequency: questionnaireData.entertain_frequency || [],
      gathering_types: questionnaireData.gathering_types || [],
      outdoor_lanai_use: questionnaireData.outdoor_lanai_use || [],
      
      // Step 3: Design Aesthetic
      unit_options: questionnaireData.unit_options || [],
      preferred_collection: questionnaireData.preferred_collection || [],
      style_direction: questionnaireData.style_direction || [],
      main_upholstery_color: questionnaireData.main_upholstery_color || [],
      accent_fabric_color: questionnaireData.accent_fabric_color || [],
      metal_tone: questionnaireData.metal_tone || [],
      tone_preference: questionnaireData.tone_preference || [],
      colors_to_avoid: questionnaireData.colors_to_avoid || '',
      
      // Step 4: Bedrooms
      bed_sizes: questionnaireData.bed_sizes || [],
      mattress_firmness: questionnaireData.mattress_firmness || [],
      bedding_type: questionnaireData.bedding_type || [],
      bedding_material_color: questionnaireData.bedding_material_color || [],
      lighting_mood: questionnaireData.lighting_mood || [],
      
      // Step 5: Art & Finishing
      art_style: questionnaireData.art_style || [],
      art_coverage: questionnaireData.art_coverage || [],
      accessories_styling: questionnaireData.accessories_styling || [],
      decorative_pillows: questionnaireData.decorative_pillows || [],
      special_zones: questionnaireData.special_zones || [],
      existing_furniture: questionnaireData.existing_furniture || [],
      existing_furniture_details: questionnaireData.existing_furniture_details || '',
      additional_notes: questionnaireData.additional_notes || '',
      
      // Step 6: Add-On Services - Closet
      closet_interested: questionnaireData.closet_interested || false,
      closet_use: questionnaireData.closet_use || [],
      organization_style: questionnaireData.organization_style || [],
      closet_additional_needs: questionnaireData.closet_additional_needs || [],
      closet_finish: questionnaireData.closet_finish || [],
      closet_locations: questionnaireData.closet_locations || [],
      closet_locking_section: questionnaireData.closet_locking_section || false,
      
      // Step 6: Add-On Services - Window Coverings
      window_interested: questionnaireData.window_interested || false,
      window_treatment: questionnaireData.window_treatment || [],
      window_operation: questionnaireData.window_operation || [],
      light_quality: questionnaireData.light_quality || [],
      shade_material: questionnaireData.shade_material || [],
      shade_style: questionnaireData.shade_style || [],
      window_locations: questionnaireData.window_locations || [],
      
      // Step 6: Add-On Services - Audio/Visual
      av_interested: questionnaireData.av_interested || false,
      av_usage: questionnaireData.av_usage || [],
      av_areas: questionnaireData.av_areas || [],
      
      // Step 6: Add-On Services - Greenery
      greenery_interested: questionnaireData.greenery_interested || false,
      plant_type: questionnaireData.plant_type || [],
      plant_areas: questionnaireData.plant_areas || [],
      
      // Step 6: Add-On Services - Kitchen
      kitchen_interested: questionnaireData.kitchen_interested || false,
      kitchen_essentials: questionnaireData.kitchen_essentials || [],
      
      // Liked Designs
      likedDesigns: questionnaireData.likedDesigns || [],
      
      // Meta
      isFirstTimeComplete: questionnaireData.isFirstTimeComplete || true,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    await user.save();

    console.log('✅ Questionnaire saved successfully');
    console.log('   User ID:', user._id);
    console.log('   Fields saved:', Object.keys(user.questionnaire).length);

    res.json({
      success: true,
      message: 'Questionnaire submitted successfully',
      questionnaire: user.questionnaire,
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
 * Get questionnaire by clientId (for admin)
 * @route GET /api/questionnaires/client/:clientId
 */
const getQuestionnaireByClientId = async (req, res) => {
  try {
    const clientId = req.params.clientId;

    console.log('📥 Fetching questionnaire for client:', clientId);

    const user = await User.findById(clientId).select('questionnaire name email unitNumber');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if questionnaire exists and has data
    if (!user.questionnaire || Object.keys(user.questionnaire).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questionnaire found for this client'
      });
    }

    console.log('✅ Questionnaire found');

    return res.json({
      success: true,
      questionnaire: user.questionnaire
    });

  } catch (error) {
    console.error('❌ Error getQuestionnaireByClientId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving questionnaire',
      error: error.message
    });
  }
};

/**
 * Get user's questionnaire (for user portal)
 * @route GET /api/questionnaires/my-questionnaires
 */
const getUserQuestionnaires = async (req, res) => {
  try {
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
    }).select('questionnaire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
const hasQuestionnaire =
  Array.isArray(user.questionnaire?.purpose_of_residence) &&
  user.questionnaire.purpose_of_residence.length > 0;

      console.log('Has questionnaire:', hasQuestionnaire);

    res.json({
      success: true,
      questionnaires: hasQuestionnaire ? [user.questionnaire] : [],
      hasCompletedQuestionnaire: hasQuestionnaire,
      needsQuestionnaire: !hasQuestionnaire
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
 * Get all questionnaires (Admin only)
 * @route GET /api/questionnaires/all
 */
const getAllQuestionnaires = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Find all users who have questionnaire data
    const users = await User.find({ 
      'questionnaire.submittedAt': { $exists: true } 
    })
      .select('name email unitNumber questionnaire')
      .sort({ 'questionnaire.submittedAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments({ 
      'questionnaire.submittedAt': { $exists: true } 
    });

    const questionnaires = users.map(user => ({
      userId: user._id,
      clientName: user.name,
      email: user.email,
      unitNumber: user.unitNumber,
      ...user.questionnaire.toObject()
    }));

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

// ✅ FIXED: Proper exports
module.exports = {
  submitQuestionnaire,
  getQuestionnaireByClientId,
  getUserQuestionnaires,
  getAllQuestionnaires
};