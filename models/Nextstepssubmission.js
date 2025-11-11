const mongoose = require('mongoose');

// Model untuk tracking pilihan Next Steps client
const nextStepsOptionSchema = new mongoose.Schema({
  // Client Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true
  },
  unitNumber: {
    type: String,
    required: [true, 'Unit number is required'],
    trim: true
  },

  // Selected Option
  selectedOption: {
    type: String,
    required: [true, 'Selected option is required'],
    enum: ['lock-price', 'design-fee', 'questions'],
  },

  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },

  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'contacted', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Follow-up Information
  followUpRequired: {
    type: Boolean,
    default: true
  },
  followUpDate: {
    type: Date
  },
  followUpNotes: {
    type: String,
    maxlength: [2000, 'Follow-up notes cannot exceed 2000 characters']
  },

  // Email Notifications
  emailNotifications: {
    clientConfirmationSent: {
      type: Boolean,
      default: false
    },
    clientConfirmationSentAt: {
      type: Date
    },
    adminNotificationSent: {
      type: Boolean,
      default: false
    },
    adminNotificationSentAt: {
      type: Date
    }
  },

  // Admin Processing
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
  },
  processedBy: {
    type: String // Admin/Staff name or ID
  },
  processedAt: {
    type: Date
  },

  // Tracking and Metadata
  submissionSource: {
    type: String,
    default: 'next-steps-page'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
nextStepsOptionSchema.index({ email: 1 });
nextStepsOptionSchema.index({ unitNumber: 1 });
nextStepsOptionSchema.index({ selectedOption: 1 });
nextStepsOptionSchema.index({ status: 1 });
nextStepsOptionSchema.index({ createdAt: -1 });

// Virtual for option display name
nextStepsOptionSchema.virtual('optionDisplayName').get(function() {
  const optionNames = {
    'lock-price': 'Lock 2025 Pricing',
    'design-fee': 'Design Hold Fee',
    'questions': 'Schedule Consultation'
  };
  return optionNames[this.selectedOption] || this.selectedOption;
});

// Method to mark as contacted
nextStepsOptionSchema.methods.markAsContacted = function(staffName, notes) {
  this.status = 'contacted';
  this.processedBy = staffName;
  this.processedAt = new Date();
  if (notes) {
    this.adminNotes = notes;
  }
  return this.save();
};

// Static method to get pending submissions
nextStepsOptionSchema.statics.getPendingSubmissions = function() {
  return this.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .select('-__v');
};

// Static method to get submissions by option type
nextStepsOptionSchema.statics.getSubmissionsByOption = function(optionType) {
  return this.find({ selectedOption: optionType })
    .sort({ createdAt: -1 })
    .select('-__v');
};

// Static method to get submissions by date range
nextStepsOptionSchema.statics.getSubmissionsByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('NextStepsOption', nextStepsOptionSchema);