// backend/models/User.js - UPDATED VERSION WITH NEW QUESTIONNAIRE STRUCTURE

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
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIp: {
    type: String,
    default: null
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
  packageType: {
    type: String,
    enum: ['investor', 'custom', 'library'],
    default: 'investor'
  },
  // Tambahkan setelah field packageType
  teamAssignment: {
    designer: {
      type: String,
      enum: ['Joanna Staniszewski', 'Janelle Balci', 'Ash Agustin', ''],
      default: ''
    },
    projectManager: {
      type: String,
      enum: ['Madeline Clifford', 'Daiki Matsumaru', 'Savanna Gonzales', ''],
      default: ''
    },
    projectManagerAssistant: {
      type: String,
      enum: ['Haley Spitz', 'Florence Sosrita', ''],
      default: ''
    },
    designerAssistant: {
      type: String,
      enum: ['Benny Kristanto', ''],
      default: ''
    }
  },
  floorPlan: {
    type: String,
    required: false,
    enum: {
      values: [
        "Residence 00A", "Residence 01B", "Residence 03A",
        "Residence 05A", "Residence 08", "Residence 10A/12A",
        "Residence 03B", "Residence 05B", "Residence 07B",
        "Residence 09B", "Residence 10/12", "Residence 11B",
        "Residence 13A",
        "Custom Project" // ✅ TAMBAH INI
      ],
      message: '{VALUE} is not a valid floor plan'
    },
    default: null // ✅ TAMBAH INI
  },
  
  collection: {
    type: String,
    enum: ['Nalu Foundation Collection', 'Nalu Collection', 'Lani', 'Custom'],
    required: false
  },
  customNotes: {
    type: String,
    default: ''
  },
  bedroomCount: {
    type: String,
    enum: {
      values: ['0' ,'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      message: '{VALUE} is not a valid bedroom count'
    },
    required: false,
    default: null // ✅ TAMBAH INI
  },
  
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
  
  invoices: [{
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    stepNumber: {
      type: Number,
      required: true,
      enum: [16, 43, 58, 67]
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
      required: false
    },
    documentBuffer: {
      type: Buffer,
      required: false
    },
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

  agreements: [{
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
  }],
  
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
  
  // ✅ UPDATED: New questionnaire structure matching frontend payload
  questionnaire: {
    // Client Info
    clientName: String,
    unitNumber: String,
    
    // Step 1: Home & Lifestyle
    purpose_of_residence: [String],
    who_will_use: [String],
    family_members: String,
    children_ages: String,
    has_renters: Boolean,
    has_pets: Boolean,
    pet_details: String,
    living_envision: [String],
    home_feeling: [String],
    
    // Step 2: Daily Living
    work_from_home: [String],
    entertain_frequency: [String],
    gathering_types: [String],
    outdoor_lanai_use: [String],
    
    // Step 3: Design Aesthetic
    unit_options: [String],
    preferred_collection: [String],
    style_direction: [String],
    main_upholstery_color: [String],
    accent_fabric_color: [String],
    metal_tone: [String],
    tone_preference: [String],
    colors_to_avoid: String,
    
    // Step 4: Bedrooms
    bed_sizes: [String],
    mattress_firmness: [String],
    bedding_type: [String],
    bedding_material_color: [String],
    lighting_mood: [String],
    
    // Step 5: Art & Finishing
    art_style: [String],
    art_coverage: [String],
    accessories_styling: [String],
    decorative_pillows: [String],
    special_zones: [String],
    existing_furniture: [String],
    existing_furniture_details: String,
    additional_notes: String,
    
    // Step 6: Add-On Services - Closet Solutions
    closet_interested: Boolean,
    closet_use: [String],
    organization_style: [String],
    closet_additional_needs: [String],
    closet_finish: [String],
    closet_locations: [String],
    closet_locking_section: Boolean,
    
    // Step 6: Add-On Services - Window Coverings
    window_interested: Boolean,
    window_treatment: [String],
    window_operation: [String],
    light_quality: [String],
    shade_material: [String],
    shade_style: [String],
    window_locations: [String],
    
    // Step 6: Add-On Services - Audio/Visual
    av_interested: Boolean,
    av_usage: [String],
    av_areas: [String],
    
    // Step 6: Add-On Services - Greenery
    greenery_interested: Boolean,
    plant_type: [String],
    plant_areas: [String],
    
    // Step 6: Add-On Services - Kitchen Essentials
    kitchen_interested: Boolean,
    kitchen_essentials: [String],
    
    // Liked Designs (from image selection)
    likedDesigns: [Number],
    
    // Meta
    isFirstTimeComplete: Boolean,
    submittedAt: Date,
    updatedAt: Date
  },
  
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

// Generate next invoice number
userSchema.methods.generateInvoiceNumber = function() {
  const invoiceCount = this.invoices ? this.invoices.length : 0;
  const invoiceNumber = String(invoiceCount + 1).padStart(2, '0');
  return `${this.clientCode}-${invoiceNumber}`;
};

// Get invoice by number
userSchema.methods.getInvoiceByNumber = function(invoiceNumber) {
  if (!this.invoices) return null;
  return this.invoices.find(inv => inv.invoiceNumber === invoiceNumber);
};

// Get invoices by step
userSchema.methods.getInvoicesByStep = function(stepNumber) {
  if (!this.invoices) return [];
  return this.invoices.filter(inv => inv.stepNumber === stepNumber);
};

module.exports = mongoose.model('User', userSchema);