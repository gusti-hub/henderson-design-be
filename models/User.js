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
  propertyType: {
    type: String,
    enum: ['Lock 2025 Pricing', 'Design Hold Fee'],
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
  
  // ===== NEW FIELDS FOR PRICING =====
  collection: {
    type: String,
    enum: ['Nalu Foundation Collection', 'Nalu Collection', 'Lani'],
    required: false
  },
  bedroomCount: {
    type: String,
    enum: ['1', '2', '3'],
    required: false
  },
  
  // Down Payment & Transaction Information
  paymentInfo: {
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    downPaymentPercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    downPaymentStatus: {
      type: String,
      enum: ['not-paid', 'partial', 'paid', 'overdue'],
      default: 'not-paid'
    },
    // Array untuk track semua payment (30%, 20%, 25%, 25%)
    payments: [{
      amount: {
        type: Number,
        required: true
      },
      paymentDate: {
        type: Date,
        required: true
      },
      paymentMethod: {
        type: String,
        enum: ['bank-transfer', 'credit-card', 'check', 'cash', 'wire-transfer', 'other'],
        required: true
      },
      transactionReference: {
        type: String,
        default: ''
      },
      notes: {
        type: String,
        default: ''
      },
      recordedBy: {
        type: String,
        default: ''
      },
      recordedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // ===== NEW: INVOICES ARRAY =====
  invoices: [{
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    stepNumber: {
      type: Number,
      required: true,
      enum: [15, 43, 58, 67]
    },
    invoiceType: {
      type: String,
      required: true,
      enum: ['design-fee', 'progress-50', 'progress-75', 'final-payment']
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    description: {
      type: String,
      required: true
    },
    dueDate: {
      type: Date,
      required: false
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    documentPath: {
      type: String,
      required: true
    },
    documentBuffer: {
      type: Buffer,
      required: false
    },
    // QuickBooks Integration
    quickbooksId: {
      type: String,
      default: null
    },
    quickbooksSyncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed', 'not-synced', 'error'],
      default: 'not-synced'
    },
    quickbooksSyncedAt: {
      type: Date,
      default: null
    },
    quickbooksError: {
      type: String,
      default: null
    },
    // Payment tracking
    paid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date,
      default: null
    },
    paidAmount: {
      type: Number,
      default: 0
    }
  }],

  agreements: [
  {
    agreementNumber: String,
    agreementType: {
      type: String,
      enum: ['design-fee', 'deposit-hold']
    },
    effectiveDate: Date,
    clientName: String,
    unitNumber: String,
    invoiceNumber: String,
    packageDescription: String,
    amount: Number,
    collection: String,
    bedroomCount: String,
    generatedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['generated', 'signed', 'cancelled'],
      default: 'generated'
    }
  }
],
  
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

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
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

// ===== NEW METHOD: Generate next invoice number =====
userSchema.methods.generateInvoiceNumber = function() {
  const invoiceCount = this.invoices ? this.invoices.length : 0;
  const invoiceNumber = String(invoiceCount + 1).padStart(2, '0');
  return `${this.clientCode}-${invoiceNumber}`;
};

// ===== NEW METHOD: Get invoice by number =====
userSchema.methods.getInvoiceByNumber = function(invoiceNumber) {
  if (!this.invoices) return null;
  return this.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
};

// ===== NEW METHOD: Get invoices by step =====
userSchema.methods.getInvoicesByStep = function(stepNumber) {
  if (!this.invoices) return [];
  return this.invoices.filter(inv => inv.stepNumber === stepNumber);
};

module.exports = mongoose.model('User', userSchema);