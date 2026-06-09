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
  const lastName = raw.includes(',') ? raw.split(',')[0].trim() : raw.split(/\s+/).pop() || raw;
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
      .populate('user', 'name email address unitNumber phoneNumber')
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

    const allVersions = await ProposalVersion.find({ orderId }).lean();
    // Order is source of truth — finalSelectedProducts is resolved below
    let finalSelectedProducts = order.selectedProducts || latestVersion?.selectedProducts || [];
    let excludedProducts = [];

    if (latestVersion) {
      // Auto-populate if version is still empty
      if ((latestVersion.selectedProducts || []).length === 0) {
        finalSelectedProducts = order.selectedProducts || [];
        excludedProducts = [];
        try {
          await ProposalVersion.findByIdAndUpdate(latestVersion._id, {
            selectedProducts: finalSelectedProducts,
            updatedAt: new Date(),
          });
        } catch (_) {}
      } else {
        // ── Match order products against proposal using _id as primary key ──────
        const proposalById  = new Map(); // _id → product_id (for corruption check)
        const proposalKeyCount = {};     // toKey → count (for _id-less fallback)
        (latestVersion.selectedProducts || []).forEach(p => {
          const id = p._id?.toString();
          if (id) {
            proposalById.set(id, p.product_id || '');
          } else {
            const key = toKey(p);
            if (key) proposalKeyCount[key] = (proposalKeyCount[key] || 0) + 1;
          }
        });

        const usedIds  = new Set();
        const keyCount = {};
        excludedProducts = [];
        (order.selectedProducts || []).forEach(p => {
          const id = p._id?.toString();
          const pid = p.product_id || '';
          if (id && proposalById.has(id) && !usedIds.has(id) &&
              proposalById.get(id) === pid) {
            usedIds.add(id);
            return;
          }
          const key = toKey(p);
          if (!key) {
            excludedProducts.push(p);
            return;
          }
          keyCount[key] = (keyCount[key] || 0) + 1;
          if (keyCount[key] > (proposalKeyCount[key] || 0)) {
            excludedProducts.push(p);
          }
        });

        // ── Use Order as source of truth for product data ─────────────────────
        // For each product in the proposal, use fresh data from Order.
        // Fallback to PV data only if product was removed from Order (historical record).
        const orderProductById = new Map();
        (order.selectedProducts || []).forEach(p => {
          if (p._id) orderProductById.set(p._id.toString(), p);
        });
        finalSelectedProducts = (latestVersion.selectedProducts || []).map(pvProduct => {
          const id = pvProduct._id?.toString();
          const orderProduct = id && orderProductById.get(id);
          return orderProduct || pvProduct;
        });
      }
    }


    res.json({
      success: true,
      data: {
        orderId:          order._id,
        version:          latestVersion ? latestVersion.version : 0,
        status:           latestVersion ? latestVersion.status : 'draft',
        proposalNumber,
        clientInfo:       order.clientInfo,
        user:             order.user,
        selectedPlan:     order.selectedPlan,
        selectedProducts: finalSelectedProducts,
        excludedProducts,
        createdAt:        order.createdAt,
        updatedAt:        order.updatedAt,
        depositPercent:   latestVersion?.depositPercent ?? 100,
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

    // ── Proposal number logic ──
    let versionProposalNumber;
    if (nextVersion === 1) {
      const fullOrder = await Order.findById(orderId);
      versionProposalNumber = await ensureProposalNumber(fullOrder);
    } else {
      const clientName = order.clientInfo?.name || 'CLT';
      const clientCode = clientCodeFromName(clientName);

      const Counter = require('../models/Counter');
      const counterDoc = await Counter.findOneAndUpdate(
        { _id: `proposalNumber_${clientCode}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const counter = String(counterDoc.seq).padStart(6, '0');
      versionProposalNumber = `Hen-${clientCode}-${counter}`;
      console.log(`[proposal] Generated new proposalNumber for v${nextVersion}: ${versionProposalNumber}`);
    }

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
      Order.findById(orderId).select('proposalNumber').lean(),
    ]);

    const versionsWithNumber = versions.map(v => ({
      ...v,
      proposalNumber: v.proposalNumber || order?.proposalNumber || null,
    }));

    res.json({ success: true, data: versionsWithNumber });
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

    const validStatuses = ['draft', 'sent', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    );
    if (!latestVersion) {
      return res.status(404).json({ message: 'No proposal version found' });
    }
    if (latestVersion.status === 'approved') {
      return res.status(400).json({ message: 'Approved proposals cannot be changed' });
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

// ─── SAVE CURRENT VERSION ─────────────────────────────────────────────────────
// (tidak ada perubahan)
const saveCurrentVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, depositPercent, version } = req.body;

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
  saveCurrentVersion,
  getAvailableProducts,
};