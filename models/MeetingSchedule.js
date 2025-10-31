const mongoose = require('mongoose');

const meetingScheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // orderId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Order',
  //   required: true
  // },
  // Client's preferred options
  preferredDate: {
    type: Date,
    required: true
  },
  preferredTime: {
    type: String,
    required: true
  },
  alternateDate: {
    type: Date,
    required: true
  },
  alternateTime: {
    type: String,
    required: true
  },
  // Meeting details
  meetingType: {
    type: String,
    enum: ['in-person', 'virtual'],
    default: 'in-person'
  },
  notes: {
    type: String,
    default: ''
  },
  // Confirmation details (filled by designer/admin)
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'pending'
  },
  confirmedDate: {
    type: Date
  },
  confirmedTime: {
    type: String
  },
  meetingLink: {
    type: String // For virtual meetings
  },
  designerNotes: {
    type: String
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Meeting outcome
  meetingNotes: {
    type: String
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
meetingScheduleSchema.index({ userId: 1, status: 1 });
meetingScheduleSchema.index({ confirmedDate: 1 });

module.exports = mongoose.model('MeetingSchedule', meetingScheduleSchema);
