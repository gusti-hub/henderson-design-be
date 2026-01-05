// backend/models/Order.js
// UPDATE YOUR ORDER SCHEMA TO INCLUDE THESE FIELDS

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ✅ ADD THIS NEW FIELD
  packageType: {
    type: String,
    enum: ['investor', 'custom', 'library'],
    default: 'investor'
  },
  
  clientInfo: {
    name: String,
    unitNumber: String,
    floorPlan: String
  },
  
  selectedPlan: {
    id: String,
    title: String,
    description: String,
    image: String,
    details: [String],
    clientInfo: {
      name: String,
      unitNumber: String,
      floorPlan: String
    }
  },
  
  Package: String,
  
  selectedProducts: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: String,
    category: String,
    basePrice: Number,
    selectedOptions: mongoose.Schema.Types.Mixed,
    finalPrice: Number,
    quantity: {
      type: Number,
      default: 1
    },
    // ✅ FOR LIBRARY: Store placement info
    placement: {
      spotKey: String,
      coordinates: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        rotation: { type: Number, default: 0 }
      }
    }
  }],
  
  // ✅ ENHANCED FOR LIBRARY: Store dynamic furniture placements
  occupiedSpots: {
    type: Map,
    of: {
      furnitureId: String,
      label: String,
      area: String,
      coordinates: mongoose.Schema.Types.Mixed, // ✅ Allow any shape (polygon, curve, arc, rectangle)
      originalCoordinates: mongoose.Schema.Types.Mixed, // ✅ Store original shape
      rotation: { type: Number, default: 0 },
      isPlaced: Boolean,
      sourceConfig: String,
      sourceSpot: String,
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
    },
    default: {}
  },
  
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'confirmed', 'cancelled', 'review'],
    default: 'ongoing'
  },
  
  step: {
    type: Number,
    default: 1
  },
  
  proposalVersions: [{
    version: Number,
    notes: String,
    createdAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);