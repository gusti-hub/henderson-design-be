// models/LocationMapping.js
const mongoose = require('mongoose');

const locationMappingSchema = new mongoose.Schema({
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    required: true
  },
  floorPlanId: {
    type: String,
    required: true
  },
  allowedProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, {
  timestamps: true
});

// Create compound index for faster searching
locationMappingSchema.index({ locationName: 'text', floorPlanId: 'text' });

const LocationMapping = mongoose.model('LocationMapping', locationMappingSchema);
module.exports = LocationMapping;