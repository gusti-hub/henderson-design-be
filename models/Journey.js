// models/Journey.js
const mongoose = require('mongoose');

// ===== SUB-STEP SCHEMA =====
const subStepSchema = new mongoose.Schema({
  sub: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: Boolean,
    default: false
  },
  clientAction: {
    type: Boolean,
    default: false
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

// ===== JOURNEY STEP SCHEMA =====
const journeyStepSchema = new mongoose.Schema({
  step: {
    type: Number,
    required: true,
    min: 1,
    max: 23  // ✅ CHANGED FROM 10 TO 23
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  phase: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['not-started', 'pending', 'in-progress', 'completed'],
    default: 'not-started'
  },
  email: {
    type: Boolean,
    default: false
  },
  clientAction: {
    type: Boolean,
    default: false
  },
  subSteps: {
    type: [subStepSchema],
    default: []
  },
  estimatedDate: {
    type: Date,
    default: null
  },
  actualDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: '',
    maxlength: 1000
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// ===== MAIN JOURNEY SCHEMA =====
const journeySchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  steps: {
    type: [journeyStepSchema],
    default: [],
    validate: {
      validator: function(steps) {
        return steps.length === 23;  // ✅ CHANGED FROM 10 TO 23
      },
      message: 'Journey must have exactly 23 steps'  // ✅ UPDATED MESSAGE
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ===== INDEXES =====
journeySchema.index({ clientId: 1 });
journeySchema.index({ 'steps.status': 1 });
journeySchema.index({ updatedAt: -1 });

// ===== PRE-SAVE MIDDLEWARE =====
journeySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ===== INSTANCE METHODS =====
journeySchema.methods.getProgress = function() {
  const completedSteps = this.steps.filter(s => s.status === 'completed').length;
  const totalSteps = this.steps.length;
  return {
    completed: completedSteps,
    total: totalSteps,
    percentage: Math.round((completedSteps / totalSteps) * 100)
  };
};

journeySchema.methods.getCurrentStep = function() {
  const currentStep = this.steps.find(s => s.status === 'in-progress');
  if (currentStep) return currentStep;
  return this.steps.find(s => s.status === 'pending') || null;
};

journeySchema.methods.getNextStep = function() {
  return this.steps.find(s => s.status === 'not-started' || s.status === 'pending') || null;
};

journeySchema.methods.getCompletedSteps = function() {
  return this.steps.filter(s => s.status === 'completed');
};

journeySchema.methods.getStepsByStatus = function(status) {
  return this.steps.filter(s => s.status === status);
};

journeySchema.methods.isComplete = function() {
  return this.steps.every(s => s.status === 'completed');
};

journeySchema.methods.getEstimatedCompletion = function() {
  const datesWithEstimates = this.steps
    .filter(s => s.estimatedDate && s.status !== 'completed')
    .map(s => s.estimatedDate)
    .sort((a, b) => new Date(b) - new Date(a));
  
  return datesWithEstimates.length > 0 ? datesWithEstimates[0] : null;
};

// ===== STATIC METHODS =====
journeySchema.statics.findByClientId = function(clientId) {
  return this.findOne({ clientId })
    .populate('clientId', 'name email clientCode unitNumber')
    .populate('steps.updatedBy', 'name email');
};

journeySchema.statics.getAllWithPagination = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find()
    .populate('clientId', 'name email clientCode unitNumber')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
};

journeySchema.statics.getStatistics = async function() {
  const journeys = await this.find();
  const stats = {
    total: journeys.length,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    averageProgress: 0
  };
  
  let totalProgress = 0;
  journeys.forEach(journey => {
    const progress = journey.getProgress();
    totalProgress += progress.percentage;
    
    if (progress.percentage === 100) stats.completed++;
    else if (progress.percentage > 0) stats.inProgress++;
    else stats.notStarted++;
  });
  
  stats.averageProgress = journeys.length > 0 ? Math.round(totalProgress / journeys.length) : 0;
  return stats;
};

// ===== VIRTUALS =====
journeySchema.virtual('progressPercentage').get(function() {
  return this.getProgress().percentage;
});

journeySchema.virtual('currentStep').get(function() {
  return this.getCurrentStep();
});

journeySchema.set('toJSON', { virtuals: true });
journeySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Journey', journeySchema);