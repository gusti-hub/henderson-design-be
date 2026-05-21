// controllers/proposalController.js
// ✅ SMART FILTERING:
//    - getProposalData: attach `excludedProducts` = products NOT in prev version
//      so frontend knows which items to hide by default
//    - saveAsNewVersion: new version starts with items NOT yet in any PO,
//      excluding items from the previous proposal version by default

const Order = require('../models/Order');
const ProposalVersion = require('../models/ProposalVersion');

// ─── Helper: Instance-aware "already proposed" classifier ────────────────────
// Mirrors buildPrevPoClassifier in poController.
// For each product_id: find max count in any single proposal version = quota.
// Walk order products consuming quota slots → remainder are "new" (not yet proposed).
const buildPrevProposalClassifier = (allVersions) => {
  const sorted = [...allVersions].sort((a, b) => a.version - b.version);
  const slotsByKey = {}; // { key: { count, proposalNumber } }
  sorted.forEach(v => {
    const countInV = {};
    (v.selectedProducts || []).forEach(p => {
      const key = (p.product_id && p.product_id !== '')
        ? p.product_id
        : ('oid::' + (p._id?.toString() || ''));
      countInV[key] = (countInV[key] || 0) + 1;
    });
    Object.entries(countInV).forEach(([key, cnt]) => {
      if (!slotsByKey[key] || cnt > slotsByKey[key].count) {
        slotsByKey[key] = { count: cnt, proposalNumber: v.proposalNumber || ('v' + v.version) };
      }
    });
  });

  return function classifyProducts(orderProducts) {
    const remaining = {};
    Object.entries(slotsByKey).forEach(([key, val]) => { remaining[key] = val.count; });
    const included = []; // new — never proposed
    const excluded = []; // previously proposed
    orderProducts.forEach(p => {
      const key = (p.product_id && p.product_id !== '')
        ? p.product_id
        : ('oid::' + (p._id?.toString() || ''));
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

// ─── Single canonical proposal number generator ───────────────────────────────
const ensureProposalNumber = async (order) => {
  if (order.proposalNumber) return order.proposalNumber;

  const clientName = order.clientInfo?.name || 'CLT';
  const nameParts  = clientName.trim().split(/[\s\-\/,]+/);
  const lastWord   = [...nameParts].reverse().find(p => /[a-zA-Z]/.test(p)) || 'CLT';
  const clientCode = lastWord.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

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

      // ── Compute excluded products using instance-aware classifier ──
      const allVersions = await ProposalVersion.find({ orderId }).lean();
      const classify = buildPrevProposalClassifier(allVersions);
      const orderProducts = order?.selectedProducts || [];
      const { included: newOnes, excluded: prevOnes } = classify(orderProducts);

      // Products in this specific version
      const pvProductIds = new Set(
        (proposalVersion.selectedProducts || [])
          .map(p => (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString())
          .filter(Boolean)
      );
      // excludedProducts = everything not currently in this version
      const excludedProducts = [
        ...prevOnes.filter(p => !pvProductIds.has(
          (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString()
        )),
        ...newOnes.filter(p => !pvProductIds.has(
          (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString()
        )),
      ];

      // Auto-populate: if this version has no products but there are new items, fill them in
      let finalSelectedProducts = proposalVersion.selectedProducts || [];
      if (finalSelectedProducts.length === 0 && newOnes.length > 0) {
        finalSelectedProducts = newOnes;
        try {
          await ProposalVersion.findByIdAndUpdate(proposalVersion._id, {
            selectedProducts: newOnes,
            updatedAt: new Date(),
          });
        } catch (_) {}
      }

      return res.json({
        success: true,
        data: {
          ...proposalVersion.toObject(),
          selectedProducts: finalSelectedProducts,
          proposalNumber,
          excludedProducts,
          depositPercent: proposalVersion.depositPercent ?? 90,
        }
      });
    }

    // Latest version
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

    // ── Compute excluded using instance-aware classifier ──
    const allVersions = await ProposalVersion.find({ orderId }).lean();
    let finalSelectedProducts = latestVersion?.selectedProducts || order.selectedProducts || [];
    let excludedProducts = [];

    if (latestVersion) {
      const classify = buildPrevProposalClassifier(allVersions);
      const { included: newOnes, excluded: prevOnes } = classify(order.selectedProducts || []);

      const lvProductIds = new Set(
        (latestVersion.selectedProducts || [])
          .map(p => (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString())
          .filter(Boolean)
      );

      // Auto-populate: if latest version is empty but there are new products, fill them in
      if ((latestVersion.selectedProducts || []).length === 0 && newOnes.length > 0) {
        finalSelectedProducts = newOnes;
        try {
          await ProposalVersion.findByIdAndUpdate(latestVersion._id, {
            selectedProducts: newOnes,
            updatedAt: new Date(),
          });
        } catch (_) {}
        excludedProducts = prevOnes;
      } else {
        // excludedProducts = everything not in the current version
        excludedProducts = [
          ...prevOnes.filter(p => !lvProductIds.has(
            (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString()
          )),
          ...newOnes.filter(p => !lvProductIds.has(
            (p.product_id && p.product_id !== '') ? p.product_id : p._id?.toString()
          )),
        ];
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
        depositPercent:   latestVersion?.depositPercent ?? 90,
      }
    });

  } catch (error) {
    console.error('Error getting proposal data:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SAVE proposal ────────────────────────────────────────────────────────────
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
// NEW BEHAVIOUR:
//   - New version starts ONLY with products NOT present in the previous version
//   - Products that WERE in the previous version are returned as `excludedProducts`
//     so the frontend can offer them in an "Add back" panel
//   - If `products` is explicitly provided in the body, use those directly
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
      const nameParts  = clientName.trim().split(/[\s\-\/,]+/);
      const lastWord   = [...nameParts].reverse().find(p => /[a-zA-Z]/.test(p)) || 'CLT';
      const clientCode = lastWord.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

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

    // ── Smart product filtering (instance-aware, all versions) ──
    // products === null → auto-compute: only include products never proposed before
    // products explicitly provided → use as-is
    let finalProducts = [];
    let excludedProducts = [];
    const autoCompute = products == null;

    if (autoCompute) {
      const allVersions = await ProposalVersion.find({ orderId }).lean();
      const classify = buildPrevProposalClassifier(allVersions);
      const { included, excluded } = classify(order.selectedProducts || []);
      finalProducts = included;
      excludedProducts = excluded;
      console.log(`[proposal] New v${nextVersion}: ${finalProducts.length} new, ${excludedProducts.length} excluded`);
    } else {
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
      depositPercent:   depositPercent ?? 90,
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

// ─── SAVE CURRENT VERSION (upsert, no version bump) ──────────────────────────
const saveCurrentVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, depositPercent } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    );

    if (latestVersion) {
      if (products !== undefined) latestVersion.selectedProducts = products;
      if (clientInfo) latestVersion.clientInfo = clientInfo;
      if (depositPercent !== undefined) latestVersion.depositPercent = depositPercent;
      latestVersion.updatedAt = new Date();
      latestVersion.updatedBy = req.user.id;
      await latestVersion.save();

      const proposalNumber = latestVersion.proposalNumber || order.proposalNumber;
      return res.json({
        success: true,
        message: `Version ${latestVersion.version} updated`,
        data: latestVersion,
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
      depositPercent:   depositPercent ?? 90,
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

// ─── NEW: Get available (excluded) products for a proposal version ─────────────
// @route GET /api/proposals/:orderId/:version/available-products
// Returns order products NOT included in the specified proposal version
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

    const pvProductIds = new Set(
      (proposalVersion?.selectedProducts || [])
        .map(p => p.product_id || p._id?.toString())
        .filter(Boolean)
    );

    const available = (order.selectedProducts || []).filter(p => {
      const pid = p.product_id || p._id?.toString();
      return pid && !pvProductIds.has(pid);
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