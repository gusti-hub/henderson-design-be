const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  unitNumber: {
    type: String,
    required: true
  },
  floorPlan: {
    type: String,
    enum: ['investor', 'custom'],
    required: true
  },
  selections: {
    type: Map,
    of: {
      area: String,
      furniture: [{
        type: {
          type: String,
          required: true
        },
        material: String,
        color: String,
        style: String
      }]
    }
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'pending', 'paid', 'rejected'],
    default: 'unpaid'
  },
  paymentProof: String,
  totalItems: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);