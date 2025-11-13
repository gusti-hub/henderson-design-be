// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Client Information
  clientName: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true
  },
  clientEmail: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  clientPhone: {
    type: String,
    trim: true
  },
  unitNumber: {
    type: String,
    required: [true, 'Unit number is required'],
    trim: true
  },

  // Appointment Details
  // Disimpan sebagai string YYYY-MM-DD supaya tidak kena offset timezone
  appointmentDate: {
    type: String,
    required: [true, 'Appointment date is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
  },
  appointmentTime: {
    type: String,
    required: [true, 'Appointment time is required'], // "11:00", "13:00", "15:00"
  },
  duration: {
    type: Number,
    default: 45, // minutes
    enum: [30, 45, 60]
  },
  timeZone: {
    type: String,
    default: 'Pacific/Honolulu'
  },

  // Reference to Next Steps submission
  nextStepsSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NextStepsOption',
    default: null
  },
  optionType: {
    type: String,
    enum: ['lock-price', 'design-fee', 'questions'],
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },

  // Notes
  clientNotes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
  },

  // Notifications
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },

  // Metadata
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Compound index to ensure one appointment per time slot
appointmentSchema.index(
  { appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['scheduled', 'confirmed'] }
    }
  }
);

// Index for querying
appointmentSchema.index({ clientEmail: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentDate: 1 });

// Static method to check if slot is available
appointmentSchema.statics.isSlotAvailable = async function (dateStr, time) {
  const existing = await this.findOne({
    appointmentDate: dateStr,
    appointmentTime: time,
    status: { $in: ['scheduled', 'confirmed'] }
  });

  return !existing;
};

// Static method to get available slots for a date
appointmentSchema.statics.getAvailableSlots = async function (dateStr) {
  const allSlots = ['11:00', '13:00', '15:00']; // Sesuaikan dengan AvailabilityConfig

  const booked = await this.find({
    appointmentDate: dateStr,
    status: { $in: ['scheduled', 'confirmed'] }
  }).select('appointmentTime');

  const bookedTimes = booked.map(a => a.appointmentTime);
  const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

  return availableSlots;
};

module.exports = mongoose.model('Appointment', appointmentSchema);
