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
      image: String // Store selected variant image URL here
    }
  }],
  occupiedSpots: {
    type: Map,
    of: String
  },
  step: {
    type: Number,
    default: 1
  },
  Package: {
    type: String
  },
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'cancelled', 'confirmed'],
    default: 'ongoing'
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