const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  clientCode: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but ensure uniqueness when present
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
    match: [
      /^\S+@\S+\.\S+$/,
      'Please add a valid email'
    ]
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
  // Questionnaire responses based on official Ālia questionnaire
  questionnaire: {
    designStyle: [{
      type: String,
      enum: [
        'Modern/Contemporary',
        'Minimalist',
        'Beachy/Hawaiian'
      ]
    }],
    colorPalette: [{
      type: String,
      enum: [
        'Tone-on-tone -- Dark',
        'Tone-on-tone -- Light/Medium',
        'Ocean Blue',
        'Navy Blue',
        'Green',
        'Coral/Orange',
        'Yellow',
        'Tan'
      ]
    }],
    patterns: [{
      type: String,
      enum: [
        'No pattern -- just texture',
        'Subtle patterns',
        'Bold/Geometric patterns',
        'Floral/Tropical patterns',
        'Organic/Natural patterns'
      ]
    }],
    personalTouches: {
      type: String,
      enum: ['Yes', 'No']
    },
    personalArtworkDetails: {
      type: String,
      default: ''
    },
    primaryUse: [{
      type: String,
      enum: [
        'Personal use',
        'Entertaining',
        'Working from home',
        'Short-term/Vacation rental',
        'Long-term rental'
      ]
    }],
    occupants: {
      type: String,
      default: ''
    },
    lifestyleNeeds: {
      type: String,
      default: ''
    },
    desiredCompletionDate: {
      type: Date
    },
    budgetFlexibility: {
      type: String,
      enum: [
        'Very flexible',
        'Somewhat flexible',
        'Not flexible'
      ]
    },
    technologyIntegration: {
      type: String,
      default: ''
    },
    additionalThoughts: {
      type: String,
      default: ''
    }
  },
  // Admin approval tracking
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Only hash password on new user creation or password change
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add method to check password
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

module.exports = mongoose.model('User', userSchema);