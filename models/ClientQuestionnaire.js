// backend/models/ClientQuestionnaire.js
// ULTRA FLEXIBLE VERSION - No strict enum validation
// Accepts any string values from frontend

const mongoose = require('mongoose');

const clientQuestionnaireSchema = new mongoose.Schema({
  // Client Information
  clientName: {
    type: String,
    required: true
  },
  unitNumber: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },

  // 1. Home Use & Lifestyle
  homeUse: {
    purpose: {
      type: String,
      required: true
    },
    primaryUsers: {
      type: String,
      required: true
    },
    familyMembers: String,
    childrenAges: String,
    hasRenters: Boolean,
    hasPets: Boolean,
    petDetails: String,
    livingStyle: {
      type: String,
      required: true
    },
    desiredFeel: [String]  // Flexible array of strings
  },

  // 2. Entertaining & Daily Use
  workFromHome: {
    homeOfficeNeeded: Boolean,
    deskNeeded: Boolean
  },
  entertaining: {
    frequency: String,  // No enum restriction
    gatheringTypes: [String]  // Flexible array
  },
  outdoorUse: [String],  // Flexible array

  // 3. Design Aesthetic & Color Preferences
  designOptions: {
    designType: {
      type: String,
      required: true
    },
    preferredCollection: String,
    styleDirection: String,
    mainUpholsteryColor: String,
    accentColors: [String],  // Flexible array
    metalTone: String,
    contrast: String,  // ✅ NO ENUM - accepts any value
    colorsToAvoid: String
  },

  // 4. Bedrooms & Comfort
  bedrooms: {
    bedSizes: [String],  // Flexible array
    mattressFirmness: String,
    beddingType: [String],  // ✅ NO ENUM - accepts any value
    beddingMaterial: [String],  // Flexible array
    beddingColor: [String],  // Flexible array
    lightingMood: String  // ✅ NO ENUM - accepts any value
  },

  // 5. Art, Accessories & Finishing Touches
  art: {
    stylePreferences: [String],  // ✅ NO ENUM - accepts any value
    coverage: String
  },
  accessories: {
    preference: String
  },
  decorativePillows: String,  // ✅ NO ENUM - accepts any value

  // 6. Additional Requirements
  specialZones: [String],  // Flexible array
  existingFurniture: {
    keeping: Boolean,
    items: String
  },
  additionalNotes: String,

  // OPTIONAL ADD-ON SERVICES

  // 1. Customized Closet Solutions
  closetSolutions: {
    interested: {
      type: Boolean,
      default: false
    },
    closetUse: [String],  // Flexible array
    organizationStyle: String,
    additionalNeeds: [String],  // Flexible array
    finishOption: String,
    locations: [String],  // Flexible array
    lockingSection: Boolean
  },

  // 2. Window Coverings
  windowCoverings: {
    interested: {
      type: Boolean,
      default: false
    },
    treatmentPreference: [String],  // Flexible array
    operation: [String],  // Flexible array
    motorizedDetails: String,
    desiredLightQuality: [String],  // Flexible array
    materialPreference: [String],  // Flexible array
    preferredStyle: [String],  // Flexible array
    locations: [String]  // Flexible array
  },

  // 3. Audio/Visual
  audioVisual: {
    interested: {
      type: Boolean,
      default: false
    },
    usageLevel: String,
    locations: [String]  // Flexible array
  },

  // 4. Greenery/Plants
  greenery: {
    interested: {
      type: Boolean,
      default: false
    },
    plantType: String,
    locations: [String]  // Flexible array
  },

  // 5. Kitchen & Household Essentials
  kitchenEssentials: {
    interested: {
      type: Boolean,
      default: false
    },
    selectedItems: [String]  // Flexible array
  },

  // Status and Timestamps
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under-review', 'approved', 'needs-revision'],
    default: 'draft'
  },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  designerNotes: String,

  // Progress tracking
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currentStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 6
  }
}, {
  timestamps: true
});

// Calculate completion percentage before saving
clientQuestionnaireSchema.pre('save', function(next) {
  let completed = 0;
  let total = 0;

  // Section 1: Home Use (required)
  total += 4;
  if (this.clientName) completed++;
  if (this.homeUse.purpose) completed++;
  if (this.homeUse.primaryUsers) completed++;
  if (this.homeUse.livingStyle) completed++;

  // Section 3: Design Aesthetic (required)
  total += 1;
  if (this.designOptions.designType) completed++;

  // Calculate percentage
  this.completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  next();
});

// Index for quick lookups
clientQuestionnaireSchema.index({ userId: 1, unitNumber: 1 });
clientQuestionnaireSchema.index({ status: 1 });
clientQuestionnaireSchema.index({ submittedAt: -1 });

const ClientQuestionnaire = mongoose.model('ClientQuestionnaire', clientQuestionnaireSchema);

module.exports = ClientQuestionnaire;