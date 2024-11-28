const Order = require('../models/Order');
const fs = require('fs');

const uploadPaymentProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user.id) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Not authorized' });
    }

    order.paymentProof = req.file.path;
    order.paymentStatus = 'pending';
    await order.save();

    res.json({
      message: 'Payment proof uploaded successfully',
      path: req.file.path
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = 'paid';
    order.status = 'processing';
    await order.save();

    res.json({ message: 'Payment verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  uploadPaymentProof,
  verifyPayment
};