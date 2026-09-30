const Order = require('../models/Order');
const ClientPayment = require('../models/ClientPayment');
const fs = require('fs');

// ─── Get payment settings for the currently logged-in client (by userId) ──────
const getMyPaymentSettings = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: 1 }).select('_id').lean();
    if (!orders.length) return res.json({ success: true, data: { enabled: false, payments: [] } });

    // Find the first order that has payment settings enabled
    const orderIds = orders.map(o => o._id);
    let record = await ClientPayment.findOne({ orderId: { $in: orderIds }, enabled: true })
      .populate('payments.createdBy', 'name')
      .populate('payments.updatedBy', 'name')
      .lean();

    // Fall back to first order's settings (even if not enabled, for consistency)
    if (!record) {
      record = await ClientPayment.findOne({ orderId: { $in: orderIds } })
        .populate('payments.createdBy', 'name')
        .populate('payments.updatedBy', 'name')
        .lean();
    }

    if (!record) {
      record = { orderId: orderIds[0], enabled: false, bankOption: 'boa', clientInstructions: '', payments: [] };
    }
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Get payment settings for an order ────────────────────────────────────────
const getPaymentSettings = async (req, res) => {
  try {
    const { orderId } = req.params;
    let record = await ClientPayment.findOne({ orderId })
      .populate('payments.createdBy', 'name')
      .populate('payments.updatedBy', 'name')
      .lean();
    if (!record) {
      record = { orderId, enabled: false, bankOption: 'boa', clientInstructions: '', payments: [] };
    }
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Update payment settings (enabled, bank, instructions) ────────────────────
const updatePaymentSettings = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { enabled, bankOption, clientInstructions } = req.body;
    const record = await ClientPayment.findOneAndUpdate(
      { orderId },
      { $set: { ...(enabled !== undefined && { enabled }), ...(bankOption && { bankOption }), ...(clientInstructions !== undefined && { clientInstructions }) } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Add payment item ──────────────────────────────────────────────────────────
const addPaymentItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { description, amount, dueDate, notes } = req.body;
    const record = await ClientPayment.findOneAndUpdate(
      { orderId },
      { $push: { payments: { description, amount, dueDate: dueDate || '', notes: notes || '', status: 'pending', createdBy: req.user.id } } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Update payment item (status, notes, receivedDate, etc) ───────────────────
const updatePaymentItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status, notes, receivedDate, description, amount, dueDate } = req.body;
    const update = { 'payments.$.updatedBy': req.user.id };
    if (status !== undefined)       update['payments.$.status'] = status;
    if (notes !== undefined)        update['payments.$.notes'] = notes;
    if (receivedDate !== undefined) update['payments.$.receivedDate'] = receivedDate;
    if (description !== undefined)  update['payments.$.description'] = description;
    if (amount !== undefined)       update['payments.$.amount'] = amount;
    if (dueDate !== undefined)      update['payments.$.dueDate'] = dueDate;
    const record = await ClientPayment.findOneAndUpdate(
      { orderId, 'payments._id': itemId },
      { $set: update },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Payment item not found' });
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Delete payment item ───────────────────────────────────────────────────────
const deletePaymentItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const record = await ClientPayment.findOneAndUpdate(
      { orderId },
      { $pull: { payments: { _id: itemId } } },
      { new: true }
    );
    res.json({ success: true, data: record });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

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
  verifyPayment,
  getMyPaymentSettings,
  getPaymentSettings,
  updatePaymentSettings,
  addPaymentItem,
  updatePaymentItem,
  deletePaymentItem,
};