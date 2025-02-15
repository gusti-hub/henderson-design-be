// models/ProposalVersion.js
const mongoose = require('mongoose');

const proposalVersionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
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
  clientInfo: {
    name: String,
    unitNumber: String,
    floorPlan: String
  },
  selectedProducts: [{
    _id: String,
    name: String,
    product_id: String,
    spotId: String,
    spotName: String,
    finalPrice: Number,
    quantity: Number,
    unitPrice: Number,   
    selectedOptions: {
      finish: String,
      fabric: String,
      image: String
    }
  }],
  occupiedSpots: {
    type: Map,
    of: String
  },
  notes: String,
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected'],
    default: 'draft'
  },
  pdfUrl: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create compound index for efficient querying
proposalVersionSchema.index({ orderId: 1, version: 1 }, { unique: true });

const ProposalVersion = mongoose.model('ProposalVersion', proposalVersionSchema);
module.exports = ProposalVersion;