// models/Journey.js
const mongoose = require('mongoose');

// ===== JOURNEY STEP SCHEMA =====
const journeyStepSchema = new mongoose.Schema({
  step: {
    type: Number,
    required: true,
    min: 1,
    max: 67
  },
  csvStep: {
    type: mongoose.Schema.Types.Mixed,
    required: true
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
    enum: [
      'Pre-Portal Flow',
      'Portal Activation & Design Setup',
      'Design Meetings & Presentations',
      'Proposal Contract & 50% Funding',
      'Vendor Order & Production',
      '25% Progress Payment',
      'Final 25% Balance',
      'Delivery Installation & Reveal'
    ]
  },
  status: {
    type: String,
    enum: ['not-started', 'pending', 'in-progress', 'completed', 'blocked'],
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
  actionBy: {
    type: String,
    enum: ['Client', 'HDG', 'HDG + Client', 'Vendor', 'Bank/System', 'Vendor/Logistics'],
    required: true
  },
  emailTemplate: {
    type: String,
    default: null
  },
  autoTrigger: {
    type: Boolean,
    default: false
  },
  autoGenerate: {
    type: String,
    enum: ['contract', 'proposalContract', null],
    default: null
  },
  autoCheck: {
    type: Boolean,
    default: false
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
    maxlength: 2000
  },
  generatedDocuments: [{
    type: {
      type: String,
      enum: ['contract', 'proposal', 'invoice']
    },
    filename: String,
    data: Buffer,
    generatedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
        return steps.length === 61;
      },
      message: 'Journey must have exactly 61 steps'
    }
  },
  contractData: {
    designFeeContract: {
      amount: Number,
      downPayment: Number,
      generatedAt: Date,
      signedAt: Date
    },
    productionContract: {
      amount: Number,
      initialPayment: Number,
      progressPayment: Number,
      finalPayment: Number,
      generatedAt: Date,
      signedAt: Date
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
journeySchema.index({ 'steps.clientAction': 1, 'steps.status': 1 });
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

journeySchema.methods.getPendingClientActions = function() {
  return this.steps.filter(s => 
    s.clientAction && 
    (s.status === 'pending' || s.status === 'in-progress')
  );
};

journeySchema.methods.getStepsByPhase = function(phase) {
  return this.steps.filter(s => s.phase === phase);
};

journeySchema.methods.isComplete = function() {
  return this.steps.every(s => s.status === 'completed');
};

journeySchema.methods.getStepByNumber = function(stepNumber) {
  return this.steps.find(s => s.step === parseInt(stepNumber));
};

// ===== STATIC METHODS =====
journeySchema.statics.findByClientId = function(clientId) {
  return this.findOne({ clientId })
    .populate('clientId', 'name email clientCode unitNumber floorPlan')
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

// ===== VIRTUALS =====
journeySchema.virtual('progressPercentage').get(function() {
  return this.getProgress().percentage;
});

journeySchema.virtual('currentStep').get(function() {
  return this.getCurrentStep();
});

journeySchema.virtual('pendingClientActions').get(function() {
  return this.getPendingClientActions();
});

journeySchema.set('toJSON', { virtuals: true });
journeySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Journey', journeySchema);