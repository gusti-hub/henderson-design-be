// models/Order.js - UPDATE customFloorPlan schema

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ✅ UPDATED: Support both Buffer (old) and S3 URL (new)
  customFloorPlan: {
    filename: String,
    contentType: String,
    data: Buffer,        // ✅ Keep for backward compatibility
    url: String,         // ✅ NEW: S3 URL
    key: String,         // ✅ NEW: S3 key
    size: Number,
    notes: String,
    uploadedAt: Date
  },
  
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
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    product_id: String,
    name: String,
    category: String,
    spotName: String,
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: Number,
    finalPrice: Number,
    sourceType: {
      type: String,
      enum: ['library', 'manual'],
      default: 'manual'
    },
    isEditable: {
      type: Boolean,
      default: true
    },
    selectedOptions: {
      finish: String,
      fabric: String,
      size: String,
      insetPanel: String,
      image: String,
      images: [String],
      links: [String],
      specifications: String,
      notes: String,
      // ✅ UPDATED: Support both Buffer and S3 URL for uploaded images
      uploadedImages: [{
        filename: String,
        contentType: String,
        data: Buffer,      // ✅ Keep for backward compatibility
        url: String,       // ✅ NEW: S3 URL
        key: String,       // ✅ NEW: S3 key
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }],
      customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
      }
    },
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
  
  occupiedSpots: {
    type: Map,
    of: {
      furnitureId: String,
      label: String,
      area: String,
      coordinates: mongoose.Schema.Types.Mixed,
      originalCoordinates: mongoose.Schema.Types.Mixed,
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