const Order = require('../models/Order');
const ClientPayment = require('../models/ClientPayment');
const fs = require('fs');

// ─── Payment settings are PER CLIENT, not per order ────────────────────────────
// A client can have many orders and each order may own a ClientPayment record, but the client only ever sees one
// Payment Info tab. So everything here works on ALL the records of the client behind an order:
//   read  → one merged view (tab on if ANY record is on, schedule = every item of every record)
//   write → settings (on/off, bank, instructions) go to every record; a new item goes to one main record;
//           editing / deleting an item finds the record that owns it.
// No data migration is needed: older per-order records are simply read together.

const loadRecords = (orderIds) => ClientPayment.find({ orderId: { $in: orderIds } })
  .populate('payments.createdBy', 'name')
  .populate('payments.updatedBy', 'name')
  .sort({ createdAt: 1 })
  .lean();

// The client behind an order + all of that client's orders and payment records
const clientScope = async (orderId) => {
  const order = await Order.findById(orderId).select('user').lean();
  if (!order) return null;
  const orders = await Order.find({ user: order.user }).select('_id').lean();
  const orderIds = orders.map(o => o._id);
  return { orderIds, records: await loadRecords(orderIds) };
};

// The record new items are added to: the one that is switched on, else one that already has items, else the oldest
const pickMain = (records) => records.find(r => r.enabled) || records.find(r => (r.payments || []).length) || records[0] || null;

const clientView = (records, fallbackOrderId) => {
  const main = pickMain(records);
  if (!main) return { orderId: fallbackOrderId, enabled: false, bankOption: 'boa', clientInstructions: '', payments: [] };
  const payments = records.flatMap(r => r.payments || [])
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return { ...main, enabled: records.some(r => r.enabled), payments };
};

const staffId = (req) => req.user.id || req.user._id;

// ─── Get payment settings for the currently logged-in client (by userId) ──────
const getMyPaymentSettings = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: 1 }).select('_id').lean();
    if (!orders.length) return res.json({ success: true, data: { enabled: false, payments: [] } });
    const records = await loadRecords(orders.map(o => o._id));
    res.json({ success: true, data: clientView(records, orders[0]._id) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Get payment settings for the client behind an order (admin) ──────────────
const getPaymentSettings = async (req, res) => {
  try {
    const { orderId } = req.params;
    const scope = await clientScope(orderId);
    if (!scope) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: { ...clientView(scope.records, orderId), orderId } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Update payment settings (enabled, bank, instructions) — for the whole client ──
const updatePaymentSettings = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { enabled, bankOption, clientInstructions } = req.body;
    const scope = await clientScope(orderId);
    if (!scope) return res.status(404).json({ success: false, message: 'Order not found' });

    const set = { ...(enabled !== undefined && { enabled }), ...(bankOption && { bankOption }), ...(clientInstructions !== undefined && { clientInstructions }) };
    if (!scope.records.length) await ClientPayment.create({ orderId, ...set });
    else if (Object.keys(set).length) await ClientPayment.updateMany({ _id: { $in: scope.records.map(r => r._id) } }, { $set: set });

    const fresh = await clientScope(orderId);
    res.json({ success: true, data: { ...clientView(fresh.records, orderId), orderId } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Add payment item (to the client's main record) ───────────────────────────
const addPaymentItem = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { description, amount, dueDate, notes } = req.body;
    const scope = await clientScope(orderId);
    if (!scope) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = { description, amount, dueDate: dueDate || '', notes: notes || '', status: 'pending', createdBy: staffId(req) };
    const main = pickMain(scope.records);
    if (main) await ClientPayment.updateOne({ _id: main._id }, { $push: { payments: item } });
    else await ClientPayment.create({ orderId, payments: [item] });

    const fresh = await clientScope(orderId);
    res.json({ success: true, data: { ...clientView(fresh.records, orderId), orderId } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// The record (of this client) that owns a payment item
const ownerOf = (records, itemId) => records.find(r => (r.payments || []).some(p => String(p._id) === String(itemId)));

// ─── Update payment item (status, notes, receivedDate, etc) ───────────────────
const updatePaymentItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status, notes, receivedDate, description, amount, dueDate } = req.body;
    const scope = await clientScope(orderId);
    const owner = scope && ownerOf(scope.records, itemId);
    if (!owner) return res.status(404).json({ success: false, message: 'Payment item not found' });

    const update = { 'payments.$.updatedBy': staffId(req) };
    if (status !== undefined)       update['payments.$.status'] = status;
    if (notes !== undefined)        update['payments.$.notes'] = notes;
    if (receivedDate !== undefined) update['payments.$.receivedDate'] = receivedDate;
    if (description !== undefined)  update['payments.$.description'] = description;
    if (amount !== undefined)       update['payments.$.amount'] = amount;
    if (dueDate !== undefined)      update['payments.$.dueDate'] = dueDate;
    await ClientPayment.updateOne({ _id: owner._id, 'payments._id': itemId }, { $set: update });

    const fresh = await clientScope(orderId);
    res.json({ success: true, data: { ...clientView(fresh.records, orderId), orderId } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── Delete payment item ───────────────────────────────────────────────────────
const deletePaymentItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const scope = await clientScope(orderId);
    if (!scope) return res.status(404).json({ success: false, message: 'Order not found' });
    const owner = ownerOf(scope.records, itemId);
    if (owner) await ClientPayment.updateOne({ _id: owner._id }, { $pull: { payments: { _id: itemId } } });

    const fresh = await clientScope(orderId);
    res.json({ success: true, data: { ...clientView(fresh.records, orderId), orderId } });
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