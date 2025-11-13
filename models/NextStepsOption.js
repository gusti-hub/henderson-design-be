// models/NextStepsOption.js
const mongoose = require('mongoose');

const nextStepsOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
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

  // Pilihan: 'lock-price' | 'design-fee' | 'questions'
  selectedOption: {
    type: String,
    enum: ['lock-price', 'design-fee', 'questions'],
    required: true
  },

  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },

  // Status ringkas
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },

  // Info follow up / jadwal terakhir
  followUpDate: {
    type: String, // YYYY-MM-DD kalau diisi
    default: null
  },
  followUpNotes: {
    type: String,
    default: null
  },

  // Metadata (opsional, tapi sudah dipakai di controller)
  submissionSource: {
    type: String,
    default: 'next-steps-page'
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Satu kombinasi email + unitNumber hanya boleh satu record
nextStepsOptionSchema.index(
  { email: 1, unitNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('NextStepsOption', nextStepsOptionSchema);
