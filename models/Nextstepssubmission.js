const mongoose = require('mongoose');

// Model untuk tracking acknowledgement dokumen dan meeting request
const nextStepsSubmissionSchema = new mongoose.Schema({
  // Client Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  unitNumber: {
    type: String,
    required: [true, 'Unit number is required'],
    trim: true
  },
  clientName: {
    type: String,
    trim: true
  },
  
  // Document Acknowledgement Tracking
  acknowledgedDocuments: {
    understandingOptions: {
      acknowledged: {
        type: Boolean,
        default: false
      },
      acknowledgedAt: {
        type: Date
      }
    },
    designFee: {
      acknowledged: {
        type: Boolean,
        default: false
      },
      acknowledgedAt: {
        type: Date
      }
    },
    depositPricing: {
      acknowledged: {
        type: Boolean,
        default: false
      },
      acknowledgedAt: {
        type: Date
      }
    }
  },
  
  allDocumentsAcknowledged: {
    type: Boolean,
    default: false
  },
  documentsAcknowledgedAt: {
    type: Date
  },
  
  // Meeting Request Information
  meetingRequest: {
    preferredDate: {
      type: Date,
      required: [true, 'Preferred date is required']
    },
    preferredTime: {
      type: String,
      required: [true, 'Preferred time is required'],
      trim: true
    },
    alternateDate: {
      type: Date,
      required: [true, 'Alternate date is required']
    },
    alternateTime: {
      type: String,
      required: [true, 'Alternate time is required'],
      trim: true
    },
    meetingType: {
      type: String,
      enum: ['in-person', 'virtual'],
      default: 'in-person'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  
  // Meeting Status
  meetingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'pending'
  },
  
  confirmedMeeting: {
    confirmedDate: {
      type: Date
    },
    confirmedTime: {
      type: String
    },
    meetingLink: {
      type: String // For virtual meetings
    },
    confirmedBy: {
      type: String // Admin/Designer name or ID
    },
    confirmedAt: {
      type: Date
    },
    designerNotes: {
      type: String,
      maxlength: [1000, 'Designer notes cannot exceed 1000 characters']
    }
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
    },
    meetingConfirmationSent: {
      type: Boolean,
      default: false
    },
    meetingConfirmationSentAt: {
      type: Date
    }
  },
  
  // Admin Notes
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
  },
  
  // Follow-up tracking
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  followUpNotes: {
    type: String
  }
  
}, {
  timestamps: true
});

// Indexes for better query performance
nextStepsSubmissionSchema.index({ email: 1, unitNumber: 1 });
nextStepsSubmissionSchema.index({ meetingStatus: 1 });
nextStepsSubmissionSchema.index({ createdAt: -1 });
nextStepsSubmissionSchema.index({ 'meetingRequest.preferredDate': 1 });

// Virtual for checking if all documents are acknowledged
nextStepsSubmissionSchema.virtual('isFullyAcknowledged').get(function() {
  return this.acknowledgedDocuments.understandingOptions.acknowledged &&
         this.acknowledgedDocuments.designFee.acknowledged &&
         this.acknowledgedDocuments.depositPricing.acknowledged;
});

// Method to mark document as acknowledged
nextStepsSubmissionSchema.methods.acknowledgeDocument = function(documentType) {
  if (this.acknowledgedDocuments[documentType]) {
    this.acknowledgedDocuments[documentType].acknowledged = true;
    this.acknowledgedDocuments[documentType].acknowledgedAt = new Date();
    
    // Check if all documents are now acknowledged
    if (this.isFullyAcknowledged) {
      this.allDocumentsAcknowledged = true;
      this.documentsAcknowledgedAt = new Date();
    }
  }
  return this.save();
};

// Method to confirm meeting
nextStepsSubmissionSchema.methods.confirmMeeting = function(confirmationData) {
  this.meetingStatus = 'confirmed';
  this.confirmedMeeting = {
    confirmedDate: confirmationData.confirmedDate,
    confirmedTime: confirmationData.confirmedTime,
    meetingLink: confirmationData.meetingLink || '',
    confirmedBy: confirmationData.confirmedBy,
    confirmedAt: new Date(),
    designerNotes: confirmationData.designerNotes || ''
  };
  return this.save();
};

// Static method to get pending meetings
nextStepsSubmissionSchema.statics.getPendingMeetings = function() {
  return this.find({ meetingStatus: 'pending' })
    .sort({ 'meetingRequest.preferredDate': 1 })
    .select('-__v');
};

// Static method to get meetings by date range
nextStepsSubmissionSchema.statics.getMeetingsByDateRange = function(startDate, endDate) {
  return this.find({
    $or: [
      { 'meetingRequest.preferredDate': { $gte: startDate, $lte: endDate } },
      { 'meetingRequest.alternateDate': { $gte: startDate, $lte: endDate } },
      { 'confirmedMeeting.confirmedDate': { $gte: startDate, $lte: endDate } }
    ]
  }).sort({ createdAt: -1 });
};

// Pre-save middleware to validate dates
nextStepsSubmissionSchema.pre('save', function(next) {
  // Ensure preferred date is in the future
  if (this.isNew || this.isModified('meetingRequest.preferredDate')) {
    const preferredDate = new Date(this.meetingRequest.preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (preferredDate < today) {
      return next(new Error('Preferred date must be in the future'));
    }
  }
  
  next();
});

module.exports = mongoose.model('NextStepsSubmission', nextStepsSubmissionSchema);