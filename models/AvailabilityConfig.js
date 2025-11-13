// models/AvailabilityConfig.js
const mongoose = require('mongoose');

const availabilityConfigSchema = new mongoose.Schema({

  availableDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5], // Monday–Friday
  },

  timeSlots: {
    type: [String],
    default: ['11:00', '13:00', '15:00'],
    required: true
  },

  durationOptions: {
    type: [Number],
    default: [30, 45, 60]
  },

  defaultDuration: {
    type: Number,
    default: 45,
    enum: [30, 45, 60]
  },

  maxDaysInAdvance: { type: Number, default: 60 },
  minDaysInAdvance: { type: Number, default: 1 },

  bufferTime: { type: Number, default: 15 },

  isActive: { type: Boolean, default: true }

}, { timestamps: true });

availabilityConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('AvailabilityConfig', availabilityConfigSchema);
