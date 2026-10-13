// controllers/proposalController.js

const Order = require('../models/Order');
const ProposalVersion = require('../models/ProposalVersion');

// ─── Helper: toKey ────────────────────────────────────────────────────────────
const toKey = (p) => {
  if (!p) return '';
  if (p.product_id && p.product_id.trim() !== '') return p.product_id;
  return 'name::' + (p.name || '').trim().toLowerCase();
};

// ─── Helper: Instance-aware "already proposed" classifier ────────────────────
// For each product_id: find max count across one proposal version = quota.
// Walk order products consuming quota slots → remainder = products not yet proposed.
const buildPrevProposalClassifier = (allVersions) => {
  const sorted = [...allVersions].sort((a, b) => a.version - b.version);

  const slotsByKey = {};

  sorted.forEach(v => {
    const countInV = {};
    (v.selectedProducts || []).forEach(p => {
      const key = toKey(p);
      if (key) countInV[key] = (countInV[key] || 0) + 1;
    });
    Object.entries(countInV).forEach(([key, cnt]) => {
      if (!slotsByKey[key] || cnt > slotsByKey[key].count) {
        slotsByKey[key] = { count: cnt, proposalNumber: v.proposalNumber || ('v' + v.version) };
      }
    });
  });

  return function classifyProducts(orderProducts) {
    const remaining = {};
    Object.entries(slotsByKey).forEach(([key, val]) => {
      remaining[key] = val.count;
    });

    const included = [];
    const excluded = [];

    orderProducts.forEach(p => {
      const key = toKey(p);
      if (!key) return;

      if (remaining[key] && remaining[key] > 0) {
        remaining[key]--;
        excluded.push({ ...p, _prevProposalNumber: slotsByKey[key].proposalNumber });
      } else {
        included.push(p);
      }
    });

    return { included, excluded };
  };
};

// ─── Extract 3-char client code from name (format: "Last, First") ─────────────
// Take everything before the first comma as the Last Name; fall back to the
// full name if no comma is present (handles legacy "First Last" names too).
const clientCodeFromName = (name) => {
  const raw = (name || 'CLT').trim();
  const words = raw.includes(',') ? [raw.split(',')[0].trim()] : raw.split(/\s+/);
  // Use last word; if it has no letters (e.g. unit number "1015"), fall back to first word with letters
  let lastName = words[words.length - 1] || raw;
  if (!/[a-zA-Z]/.test(lastName)) {
    lastName = words.find(w => /[a-zA-Z]/.test(w)) || raw;
  }
  return lastName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
};

// ─── Single canonical proposal number generator ───────────────────────────────
const ensureProposalNumber = async (order) => {
  if (order.proposalNumber) return order.proposalNumber;

  const clientName = order.clientInfo?.name || 'CLT';
  const clientCode = clientCodeFromName(clientName);

  const Counter = require('../models/Counter');
  const counterDoc = await Counter.findOneAndUpdate(
    { _id: `proposalNumber_${clientCode}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const counter = String(counterDoc.seq).padStart(6, '0');
  const proposalNumber = `Hen-${clientCode}-${counter}`;

  await Order.findByIdAndUpdate(
    order._id,
    { $set: { proposalNumber } },
    { new: false }
  );

  console.log(`[proposal] Generated proposalNumber: ${proposalNumber} for order ${order._id}`);
  return proposalNumber;
};

// ─── GET proposal data ────────────────────────────────────────────────────────
const getProposalData = async (req, res) => {
  try {
    const { orderId, version } = req.params;

    // ── SPECIFIC VERSION ──────────────────────────────────────────────────────
    if (version && version !== 'latest') {
      const [proposalVersion, order] = await Promise.all([
        ProposalVersion.findOne({ orderId, version: parseInt(version) }),
        Order.findById(orderId)
          .populate('selectedProducts.vendor')
          .select('proposalNumber clientInfo selectedProducts')
          .lean(),
      ]);

      if (!proposalVersion) {
        return res.status(404).json({ message: 'Proposal version not found' });
      }

      const proposalNumber = proposalVersion.proposalNumber || order?.proposalNumber || null;


      // Match by _id primary, toKey fallback (same logic as latest-version path)
      const pvById  = new Map();
      const pvKeyCount = {};
      (proposalVersion.selectedProducts || []).forEach(p => {
        const id = p._id?.toString();
        if (id) pvById.set(id, p.product_id || '');
        else {
          const key = toKey(p);
          if (key) pvKeyCount[key] = (pvKeyCount[key] || 0) + 1;
        }
      });

      const pvUsedIds  = new Set();
      const pvKeyUsed  = {};
      const excludedProducts = [];
      (order?.selectedProducts || []).forEach(p => {
        const id  = p._id?.toString();
        const pid = p.product_id || '';
        if (id && pvById.has(id) && !pvUsedIds.has(id) && pvById.get(id) === pid) {
          pvUsedIds.add(id);
          return;
        }
        const key = toKey(p);
        if (!key) { excludedProducts.push(p); return; }
        pvKeyUsed[key] = (pvKeyUsed[key] || 0) + 1;
        if (pvKeyUsed[key] > (pvKeyCount[key] || 0)) excludedProducts.push(p);
      });

      const finalSelectedProducts = proposalVersion.selectedProducts || [];
      

      return res.json({
        success: true,
        data: {
          ...proposalVersion.toObject(),
          selectedProducts: finalSelectedProducts,
          proposalNumber,
          excludedProducts,
          depositPercent: proposalVersion.depositPercent ?? 100,
        }
      });
    }

    // ── LATEST VERSION ────────────────────────────────────────────────────────
    const order = await Order.findById(orderId)
      .populate('user', 'name email address unitNumber phoneNumber creditBalance')
      .populate('selectedProducts.vendor')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    ).lean();

    let proposalNumber = latestVersion?.proposalNumber || order.proposalNumber;
    if (!proposalNumber) {
      const fullOrder = await Order.findById(orderId);
      proposalNumber = await ensureProposalNumber(fullOrder);
    }

    // Proposal always mirrors Order — product list comes directly from the Order.
    // Any add/edit/delete on Order is immediately reflected in the proposal.
    // orderId is the join key, so multiple orders per client never cross-contaminate.
    let finalSelectedProducts = order.selectedProducts || [];
    const excludedProducts = [];


    res.json({
      success: true,
      data: {
        orderId:          order._id,
        orderNumber:      order.orderNumber,
        orderLabel:       order.orderLabel,
        version:          latestVersion ? latestVersion.version : 0,
        status:           latestVersion ? latestVersion.status : 'draft',
        invoicePayment:   latestVersion?.invoicePayment ?? null,
        invoiceCredit:    latestVersion?.invoiceCredit || 0,
        proposalNumber,
        clientInfo:       order.clientInfo,
        user:             order.user,
        selectedPlan:     order.selectedPlan,
        selectedProducts:  finalSelectedProducts,
        excludedProducts,
        hiddenProductIds:  latestVersion?.hiddenProductIds || [],
        createdAt:         order.createdAt,
        updatedAt:         order.updatedAt,
        depositPercent:    latestVersion?.depositPercent ?? 100,
      }
    });

  } catch (error) {
    console.error('Error getting proposal data:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SAVE proposal ────────────────────────────────────────────────────────────
// (tidak ada perubahan)
const saveProposal = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { version, products, clientInfo, notes } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const proposalNumber = await ensureProposalNumber(order);

    if (version === 0) {
      const newVersion = await ProposalVersion.create({
        orderId,
        version:          1,
        selectedProducts: products,
        clientInfo,
        notes:            notes || 'Initial proposal',
        status:           'draft',
        createdBy:        req.user.id
      });

      return res.json({
        success:        true,
        message:        'First version created',
        data:           newVersion,
        proposalNumber,
      });
    }

    const updated = await ProposalVersion.findOneAndUpdate(
      { orderId, version },
      { selectedProducts: products, clientInfo, notes, updatedAt: new Date(), updatedBy: req.user.id },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Version not found' });

    res.json({
      success:        true,
      message:        'Proposal updated',
      data:           updated,
      proposalNumber,
    });

  } catch (error) {
    console.error('Error saving proposal:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SAVE AS NEW VERSION ──────────────────────────────────────────────────────
// Smart filtering rules:
//   - Version 1: no previous versions → all Order products included
//   - Version 2+: only products NOT yet in any previous version → default included
//                 Previously proposed products → excludedProducts (Not Included)
const saveAsNewVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, notes, depositPercent } = req.body;

    if (!notes?.trim()) return res.status(400).json({ message: 'Version notes are required' });

    const order = await Order.findById(orderId)
      .populate('selectedProducts.vendor')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    ).lean();
    const nextVersion = (latestVersion?.version || 0) + 1;

    // ── Proposal number: always generate a fresh sequential number per version ──
    const clientName = order.clientInfo?.name || 'CLT';
    const clientCode = clientCodeFromName(clientName);
    const Counter = require('../models/Counter');
    const counterDoc = await Counter.findOneAndUpdate(
      { _id: `proposalNumber_${clientCode}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const versionProposalNumber = `Hen-${clientCode}-${String(counterDoc.seq).padStart(6, '0')}`;
    console.log(`[proposal] Generated proposalNumber for v${nextVersion}: ${versionProposalNumber}`);

    // Keep order.proposalNumber in sync with the latest version's number
    await Order.findByIdAndUpdate(orderId, { $set: { proposalNumber: versionProposalNumber } });

    // ── Smart product filtering ──
    let finalProducts = [];
    let excludedProducts = [];
    const autoCompute = products == null;

    if (autoCompute) {
      if (nextVersion === 1) {
        // Version 1: no previous history — include all Order products
        finalProducts = order.selectedProducts || [];
        excludedProducts = [];
        console.log(`[proposal] New v1: all ${finalProducts.length} products included`);
      } else {
        // Version 2+: classifier separates new vs previously proposed
        const allVersions = await ProposalVersion.find({ orderId }).lean();
        const classify = buildPrevProposalClassifier(allVersions);
        const { included, excluded } = classify(order.selectedProducts || []);
        finalProducts = included;
        excludedProducts = excluded;
        console.log(`[proposal] New v${nextVersion}: ${finalProducts.length} new, ${excludedProducts.length} previously proposed`);
      }
    } else {
      // Products explicitly provided from frontend
      finalProducts = products;
    }

    const newVersion = await ProposalVersion.create({
      orderId,
      version:          nextVersion,
      selectedProducts: finalProducts,
      clientInfo:       clientInfo || order.clientInfo,
      notes,
      status:           'draft',
      proposalNumber:   versionProposalNumber,
      depositPercent:   depositPercent ?? 100,
      createdBy:        req.user.id
    });

    const responseData = newVersion.toObject();
    responseData.excludedProducts = excludedProducts;

    res.json({
      success:        true,
      message:        `Version ${nextVersion} created`,
      data:           responseData,
      proposalNumber: versionProposalNumber,
    });

  } catch (error) {
    console.error('Error creating new version:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET ALL VERSIONS ─────────────────────────────────────────────────────────
// (tidak ada perubahan)
const getAllVersions = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [versions, order] = await Promise.all([
      ProposalVersion.find({ orderId })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ version: -1 })
        .lean(),
      Order.findById(orderId).select('proposalNumber clientInfo orderLabel orderNumber').lean(),
    ]);

    const versionsWithNumber = versions.map(v => ({
      ...v,
      proposalNumber: v.proposalNumber || order?.proposalNumber || null,
    }));

    res.json({
      success: true,
      data: versionsWithNumber,
      orderClientInfo: order?.clientInfo || null,
      orderLabel: order?.orderLabel || null,
      orderNumber: order?.orderNumber || null,
    });
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── ENSURE proposal number endpoint ─────────────────────────────────────────
// (tidak ada perubahan)
const ensureProposalNumberEndpoint = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const proposalNumber = await ensureProposalNumber(order);
    res.json({ success: true, proposalNumber });
  } catch (error) {
    console.error('ensureProposalNumber error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── MIGRATE old proposal numbers ────────────────────────────────────────────
// (tidak ada perubahan)
const migrateProposalNumbers = async (req, res) => {
  try {
    const oldFormatRegex = /^Hen-[A-Z]{3}-[0-9A-F]{6}$/;
    const orders = await Order.find({
      proposalNumber: { $exists: true, $ne: null, $ne: '' }
    }).select('proposalNumber').lean();

    const toReset = orders.filter(o => oldFormatRegex.test(o.proposalNumber));
    if (toReset.length === 0) {
      return res.json({ success: true, message: 'No old-format numbers found. Nothing to migrate.', reset: 0 });
    }

    const ids = toReset.map(o => o._id);
    await Order.updateMany({ _id: { $in: ids } }, { $unset: { proposalNumber: '' } });
    console.log(`[migration] Reset ${toReset.length} old proposal numbers`);

    res.json({
      success: true,
      message: `Reset ${toReset.length} old proposal numbers.`,
      reset: toReset.length,
      examples: toReset.slice(0, 5).map(o => o.proposalNumber),
    });
  } catch (error) {
    console.error('migrateProposalNumbers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
// (tidak ada perubahan)
const updateProposalStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent', 'approved', 'paid', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    let latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    );

    if (!latestVersion) {
      // Auto-create version on first status update
      const order = await Order.findById(orderId).lean();
      if (!order) return res.status(404).json({ message: 'Order not found' });
      latestVersion = await ProposalVersion.create({
        orderId,
        version: 1,
        status,
        proposalNumber: order.proposalNumber || null,
        selectedProducts: order.selectedProducts || [],
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });
      return res.json({ success: true, status });
    }

    latestVersion.status = status;
    latestVersion.updatedAt = new Date();
    latestVersion.updatedBy = req.user.id;
    await latestVersion.save();

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SET invoice payment (amount=null resets to automatic) ───────────────────
const updateInvoicePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, version, markPaid } = req.body;

    let value = null;
    if (amount !== null && amount !== undefined && amount !== '') {
      value = Number(amount);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ message: 'Payment must be a number ≥ 0' });
      }
      value = Math.round(value * 100) / 100;
    }

    const query = version ? { orderId, version: parseInt(version) } : { orderId };
    let pv = await ProposalVersion.findOne(query, {}, { sort: { version: -1 } });

    if (!pv) {
      const order = await Order.findById(orderId).lean();
      if (!order) return res.status(404).json({ message: 'Order not found' });
      await ProposalVersion.create({
        orderId,
        version: 1,
        status: markPaid === true && value !== null ? 'paid' : 'draft',
        invoicePayment: value,
        proposalNumber: order.proposalNumber || null,
        selectedProducts: order.selectedProducts || [],
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });
      return res.json({ success: true, invoicePayment: value, status: markPaid === true && value !== null ? 'paid' : 'draft' });
    }

    if (pv.status === 'paid') {
      return res.status(409).json({ message: 'Invoice is already paid — payment is locked. Change the proposal status first to edit it.' });
    }

    pv.invoicePayment = value;
    if (markPaid === true && value !== null) pv.status = 'paid';
    pv.updatedAt = new Date();
    pv.updatedBy = req.user.id;
    await pv.save();

    res.json({ success: true, invoicePayment: value, status: pv.status });
  } catch (error) {
    console.error('Error updating invoice payment:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── APPLY client credit to the invoice (latest version) ─────────────────────
// Deducts from / returns to User.creditBalance in real time, atomically, so the balance can never
// go negative and two people applying credit at the same time cannot spend it twice.
const updateInvoiceCredit = async (req, res) => {
  try {
    const User = require('../models/User');
    const { orderId } = req.params;
    const { amount, markPaid } = req.body;

    const target = Math.round((Number(amount) || 0) * 100) / 100;
    if (!Number.isFinite(target) || target < 0) {
      return res.status(400).json({ message: 'Credit must be a number ≥ 0' });
    }

    const order = await Order.findById(orderId).select('user proposalNumber').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.user) return res.status(400).json({ message: 'This order has no client to take credit from' });

    let pv = await ProposalVersion.findOne({ orderId }, {}, { sort: { version: -1 } });
    if (!pv) {
      pv = await ProposalVersion.create({
        orderId, version: 1, status: 'draft',
        proposalNumber: order.proposalNumber || null,
        selectedProducts: (await Order.findById(orderId).select('selectedProducts').lean()).selectedProducts || [],
        createdBy: req.user.id, updatedBy: req.user.id,
      });
    }
    if (pv.status === 'paid') {
      return res.status(409).json({ message: 'Invoice is already paid — credit is locked. Change the status first to edit it.' });
    }

    const prev = Math.round((pv.invoiceCredit || 0) * 100) / 100;
    const delta = Math.round((target - prev) * 100) / 100;   // >0 uses more credit, <0 gives credit back

    // 1) move the balance (atomic, never below zero)
    if (delta !== 0) {
      const moved = await User.findOneAndUpdate(
        delta > 0 ? { _id: order.user, creditBalance: { $gte: delta } } : { _id: order.user },
        { $inc: { creditBalance: -delta } },
        { new: true }
      ).select('creditBalance');
      if (!moved) {
        const u = await User.findById(order.user).select('creditBalance').lean();
        return res.status(409).json({
          message: `Not enough client credit. Available: $${(u?.creditBalance || 0).toFixed(2)}.`,
          creditBalance: u?.creditBalance || 0,
        });
      }
    }

    // 2) record it on the invoice — only if nobody changed it in the meantime; otherwise undo step 1
    const set = { invoiceCredit: target, updatedAt: new Date(), updatedBy: req.user.id };
    if (markPaid === true) set.status = 'paid';
    const saved = await ProposalVersion.findOneAndUpdate(
      { _id: pv._id, status: { $ne: 'paid' }, invoiceCredit: { $in: prev === 0 ? [0, null] : [prev] } },
      { $set: set },
      { new: true }
    );
    if (!saved) {
      if (delta !== 0) await User.updateOne({ _id: order.user }, { $inc: { creditBalance: delta } });
      return res.status(409).json({ message: 'The invoice changed while saving. Reload and try again.' });
    }

    const u = await User.findById(order.user).select('creditBalance').lean();
    res.json({ success: true, invoiceCredit: saved.invoiceCredit, creditBalance: u?.creditBalance || 0, status: saved.status });
  } catch (error) {
    console.error('Error updating invoice credit:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SAVE CURRENT VERSION ─────────────────────────────────────────────────────
// (tidak ada perubahan)
const saveCurrentVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, depositPercent, version, hiddenProductIds } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Find the specific version if provided, fallback to latest
    let targetVersion;
    if (version != null) {
      targetVersion = await ProposalVersion.findOne({ orderId, version });
    }
    if (!targetVersion) {
      targetVersion = await ProposalVersion.findOne(
        { orderId },
        {},
        { sort: { version: -1 } }
      );
    }

    if (targetVersion) {
      if (products !== undefined) targetVersion.selectedProducts = products;
      if (clientInfo) targetVersion.clientInfo = clientInfo;
      if (depositPercent !== undefined) targetVersion.depositPercent = depositPercent;
      if (hiddenProductIds !== undefined) targetVersion.hiddenProductIds = hiddenProductIds;
      targetVersion.updatedAt = new Date();
      targetVersion.updatedBy = req.user.id;
      await targetVersion.save();

      const proposalNumber = targetVersion.proposalNumber || order.proposalNumber;
      return res.json({
        success: true,
        message: `Version ${targetVersion.version} updated`,
        data: targetVersion,
        proposalNumber,
      });
    }

    const baseProposalNumber = await ensureProposalNumber(order);
    const newVersion = await ProposalVersion.create({
      orderId,
      version:          1,
      selectedProducts: products || [],
      clientInfo:       clientInfo || order.clientInfo,
      notes:            'Initial version',
      status:           'draft',
      proposalNumber:   baseProposalNumber,
      depositPercent:   depositPercent ?? 100,
      createdBy:        req.user.id,
    });

    return res.json({
      success: true,
      message: 'Version 1 created',
      data: newVersion,
      proposalNumber: baseProposalNumber,
    });

  } catch (error) {
    console.error('saveCurrentVersion error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET AVAILABLE PRODUCTS ───────────────────────────────────────────────────
// (tidak ada perubahan)
const getAvailableProducts = async (req, res) => {
  try {
    const { orderId, version } = req.params;

    const [order, proposalVersion] = await Promise.all([
      Order.findById(orderId).lean(),
      version && version !== 'latest'
        ? ProposalVersion.findOne({ orderId, version: parseInt(version) }).lean()
        : ProposalVersion.findOne({ orderId }, {}, { sort: { version: -1 } }).lean(),
    ]);

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Match by _id + product_id (primary), toKey count (fallback) — same as excludedProducts logic
    const pvById     = new Map();
    const pvKeyCount = {};
    (proposalVersion?.selectedProducts || []).forEach(p => {
      const id = p._id?.toString();
      if (id) pvById.set(id, p.product_id || '');
      else {
        const key = toKey(p);
        if (key) pvKeyCount[key] = (pvKeyCount[key] || 0) + 1;
      }
    });

    const usedIds  = new Set();
    const keyUsed  = {};
    const available = [];
    (order.selectedProducts || []).forEach(p => {
      const id  = p._id?.toString();
      const pid = p.product_id || '';
      if (id && pvById.has(id) && !usedIds.has(id) && pvById.get(id) === pid) {
        usedIds.add(id);
        return; // already in proposal
      }
      const key = toKey(p);
      if (!key) { available.push(p); return; }
      keyUsed[key] = (keyUsed[key] || 0) + 1;
      if (keyUsed[key] > (pvKeyCount[key] || 0)) available.push(p);
    });

    res.json({ success: true, data: available });
  } catch (error) {
    console.error('getAvailableProducts error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions,
  ensureProposalNumberEndpoint,
  migrateProposalNumbers,
  updateProposalStatus,
  updateInvoicePayment,
  updateInvoiceCredit,
  saveCurrentVersion,
  getAvailableProducts,
};