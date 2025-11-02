const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  clientCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please add a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  unitNumber: {
    type: String,
    required: [false, 'Please add a unit number']
  },
  phoneNumber: {
    type: String,
    required: false
  },
  floorPlan: {
    type: String,
    required: false,
    enum: [
      "Residence 00A", "Residence 01B", "Residence 03A",
      "Residence 05A", "Residence 08", "Residence 10A/12A",
      "Residence 03B", "Residence 05B", "Residence 07B",
      "Residence 09B", "Residence 10/12", "Residence 11B",
      "Residence 13A"
    ]
  },
  
  // ✅ NEW: Down Payment & Transaction Information
  paymentInfo: {
    // Total transaction value
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Down payment amount
    downPaymentAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Down payment percentage (e.g., 30%)
    downPaymentPercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    
    // Down payment status
    downPaymentStatus: {
      type: String,
      enum: ['not-paid', 'partial', 'paid', 'overdue'],
      default: 'not-paid'
    },
    
    // Down payment date
    downPaymentDate: {
      type: Date,
      default: null
    },
    
    // Payment due date
    downPaymentDueDate: {
      type: Date,
      default: null
    },
    
    // Remaining balance
    remainingBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Payment method
    paymentMethod: {
      type: String,
      enum: ['bank-transfer', 'credit-card', 'check', 'cash', 'other'],
      default: null
    },
    
    // Transaction/Reference number
    transactionReference: {
      type: String,
      default: ''
    },
    
    // Payment notes
    paymentNotes: {
      type: String,
      default: ''
    },
    
    // Who recorded the payment
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    
    // When payment was recorded
    recordedAt: {
      type: Date,
      default: null
    }
  },
  
  // Registration and approval status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  registrationType: {
    type: String,
    enum: ['admin-created', 'self-registered'],
    default: 'admin-created'
  },
  
  // Questionnaire responses
  questionnaire: {
    designStyle: [{
      type: String,
      enum: ['Modern/Contemporary', 'Minimalist', 'Beachy/Hawaiian']
    }],
    colorPalette: [{
      type: String,
      enum: [
        'Tone-on-tone -- Dark', 'Tone-on-tone -- Light/Medium',
        'Ocean Blue', 'Navy Blue', 'Green', 'Coral/Orange', 'Yellow', 'Tan'
      ]
    }],
    patterns: [{
      type: String,
      enum: [
        'No pattern -- just texture', 'Subtle patterns',
        'Bold/Geometric patterns', 'Floral/Tropical patterns',
        'Organic/Natural patterns'
      ]
    }],
    personalTouches: {
      type: String,
      enum: ['Yes', 'No']
    },
    personalArtworkDetails: String,
    primaryUse: [{
      type: String,
      enum: [
        'Personal use', 'Entertaining', 'Working from home',
        'Short-term/Vacation rental', 'Long-term rental'
      ]
    }],
    occupants: String,
    lifestyleNeeds: String,
    desiredCompletionDate: Date,
    budgetFlexibility: {
      type: String,
      enum: ['Very flexible', 'Somewhat flexible', 'Not flexible']
    },
    technologyIntegration: String,
    additionalThoughts: String
  },
  
  // Admin approval tracking
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Calculate remaining balance before save
userSchema.pre('save', function(next) {
  if (this.paymentInfo) {
    this.paymentInfo.remainingBalance = 
      this.paymentInfo.totalAmount - this.paymentInfo.downPaymentAmount;
  }
  next();
});

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ NEW: Method to record down payment
userSchema.methods.recordDownPayment = function(paymentData, adminId) {
  this.paymentInfo.downPaymentAmount = paymentData.amount;
  this.paymentInfo.downPaymentDate = paymentData.date || new Date();
  this.paymentInfo.paymentMethod = paymentData.method;
  this.paymentInfo.transactionReference = paymentData.reference || '';
  this.paymentInfo.paymentNotes = paymentData.notes || '';
  this.paymentInfo.recordedBy = adminId;
  this.paymentInfo.recordedAt = new Date();
  
  // Update status based on amount
  const totalDP = this.paymentInfo.totalAmount * (this.paymentInfo.downPaymentPercentage / 100);
  if (paymentData.amount >= totalDP) {
    this.paymentInfo.downPaymentStatus = 'paid';
  } else if (paymentData.amount > 0) {
    this.paymentInfo.downPaymentStatus = 'partial';
  }
  
  return this.save();
};

// ✅ NEW: Method to check if DP is paid
userSchema.methods.hasDownPayment = function() {
  return this.paymentInfo.downPaymentStatus === 'paid';
};

// ✅ NEW: Method to get payment summary
userSchema.methods.getPaymentSummary = function() {
  const requiredDP = this.paymentInfo.totalAmount * (this.paymentInfo.downPaymentPercentage / 100);
  const paidDP = this.paymentInfo.downPaymentAmount;
  const remainingDP = Math.max(0, requiredDP - paidDP);
  
  return {
    totalAmount: this.paymentInfo.totalAmount,
    requiredDownPayment: requiredDP,
    paidDownPayment: paidDP,
    remainingDownPayment: remainingDP,
    downPaymentPercentage: this.paymentInfo.downPaymentPercentage,
    status: this.paymentInfo.downPaymentStatus,
    remainingBalance: this.paymentInfo.remainingBalance,
    isPaid: this.paymentInfo.downPaymentStatus === 'paid'
  };
};

// Instance method to approve user
userSchema.methods.approve = function(adminId) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to reject user
userSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.rejectedBy = adminId;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);