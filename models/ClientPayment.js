const mongoose = require('mongoose');

const paymentItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'received', 'processing', 'confirmed'],
    default: 'pending',
  },
  receivedDate: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const clientPaymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
    index: true,
  },
  enabled: { type: Boolean, default: false },
  bankOption: {
    type: String,
    enum: ['schwab', 'boa'],
    default: 'boa',
  },
  clientInstructions: {
    type: String,
    default: 'After completing your wire transfer, please notify your Project Manager (CEE) with your sender name and invoice number as reference.',
  },
  payments: [paymentItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('ClientPayment', clientPaymentSchema);
