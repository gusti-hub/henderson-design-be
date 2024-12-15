const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  designSelections: mongoose.Schema.Types.Mixed,
  selectedProducts: [{
    id: String,
    name: String,
    spotId: String,
    spotName: String,
    finalPrice: Number,
    selectedOptions: {
      finish: String,
      fabric: String
    },
    coordinates: Object,
    variants: Array
  }],
  occupiedSpots: {
    type: Map,
    of: String
  },
  step: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled', 'confirmed'],
    default: 'in_progress'
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['bank_transfer', 'wire_transfer', 'cheque', '']
    },
    installments: [{
      percent: Number,
      dueDate: Date,
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'uploaded', 'verified', 'rejected'],
        default: 'pending'
      },
      proofOfPayment: {
        filename: String,
        url: String,
        key: String,
        uploadDate: Date
      }
    }]
  }
}, {
  timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;