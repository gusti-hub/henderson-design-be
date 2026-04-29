// controllers/proposalController.js
// ✅ FIXED: Proposal number now uses sequential counter format: Hen-[ClientCode]-[000001]
//   - ClientCode = 3 huruf dari last name client
//   - Counter = nomor urut 6 digit dari total proposals yang sudah ada
//   - Contoh: Hen-LAN-000001, Hen-FAR-000002
//   - Idempotent: jika sudah ada, tidak dibuat ulang

const Order = require('../models/Order');
const ProposalVersion = require('../models/ProposalVersion');

// ─── Single canonical proposal number generator ───────────────────────────────
const ensureProposalNumber = async (order) => {
  if (order.proposalNumber) return order.proposalNumber;

  // Client code: 3 huruf dari last name
  const clientName = order.clientInfo?.name || 'CLT';
  // Extract first alphabetic word from client name — handles formats like:
  // "Fang - The Park - Unit 1015" → "FAN"
  // "Langford" → "LAN"
  // "John Smith" → "JOH"
  const nameParts  = clientName.trim().split(/[\s\-\/]+/);
  const firstWord  = nameParts.find(p => /[a-zA-Z]/.test(p)) || 'CLT';
  const clientCode = firstWord.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

  // ✅ FIX: Counter urut — hitung orders yang sudah punya proposalNumber
  const count = await Order.countDocuments({
    proposalNumber: { $exists: true, $ne: null, $ne: '' }
  });
  const counter = String(count + 1).padStart(6, '0'); // "000001", "000002", dst

  const proposalNumber = `Hen-${clientCode}-${counter}`;

  // Persist — use findByIdAndUpdate with $set to avoid race conditions
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
        Order.findById(orderId).select('proposalNumber clientInfo').lean(),
      ]);

      if (!proposalVersion) {
        return res.status(404).json({ message: 'Proposal version not found' });
      }

      let proposalNumber = order?.proposalNumber;
      if (!proposalNumber && order) {
        const fullOrder = await Order.findById(orderId);
        proposalNumber = await ensureProposalNumber(fullOrder);
      }

      return res.json({
        success: true,
        data: {
          ...proposalVersion.toObject(),
          proposalNumber: proposalNumber || null,
        }
      });
    }

    // Latest version
    const order = await Order.findById(orderId).populate('user', 'name email address unitNumber phoneNumber').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let proposalNumber = order.proposalNumber;
    if (!proposalNumber) {
      const fullOrder = await Order.findById(orderId);
      proposalNumber = await ensureProposalNumber(fullOrder);
    }

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      { version: 1 },
      { sort: { version: -1 } }
    );

    res.json({
      success: true,
      data: {
        orderId:          order._id,
        version:          latestVersion ? latestVersion.version : 0,
        proposalNumber,
        clientInfo:       order.clientInfo,
        user:             order.user,
        selectedPlan:     order.selectedPlan,
        selectedProducts: order.selectedProducts || [],
        createdAt:        order.createdAt,
        updatedAt:        order.updatedAt
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
const saveAsNewVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, notes } = req.body;

    if (!notes?.trim()) return res.status(400).json({ message: 'Version notes are required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const proposalNumber = await ensureProposalNumber(order);

    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      { version: 1 },
      { sort: { version: -1 } }
    );
    const nextVersion = (latestVersion?.version || 0) + 1;

    const newVersion = await ProposalVersion.create({
      orderId,
      version:          nextVersion,
      selectedProducts: products,
      clientInfo,
      notes,
      status:           'draft',
      createdBy:        req.user.id
    });

    res.json({
      success:        true,
      message:        `Version ${nextVersion} created`,
      data:           newVersion,
      proposalNumber,
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
    const versions = await ProposalVersion.find({ orderId })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ version: -1 })
      .lean();
    res.json({ success: true, data: versions });
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


// ─── ONE-TIME MIGRATION: Reset old hex-format proposal numbers ───────────────
// @route POST /api/proposals/migrate-numbers
// Run once to reset all old "Hen-XXX-8FC2CA" format numbers so they get
// regenerated as sequential "Hen-LAN-000001" format on next proposal open.
// Safe to call multiple times — only touches old hex-format numbers.
const migrateProposalNumbers = async (req, res) => {
  try {
    // Match old format: Hen-[3 letters]-[6 hex chars]  e.g. Hen-LAN-8FC2CA
    const oldFormatRegex = /^Hen-[A-Z]{3}-[0-9A-F]{6}$/;

    // Find all orders with old-format proposal numbers
    const orders = await Order.find({
      proposalNumber: { $exists: true, $ne: null, $ne: '' }
    }).select('proposalNumber').lean();

    const toReset = orders.filter(o => oldFormatRegex.test(o.proposalNumber));

    if (toReset.length === 0) {
      return res.json({ success: true, message: 'No old-format numbers found. Nothing to migrate.', reset: 0 });
    }

    // Unset proposalNumber on all old-format orders
    const ids = toReset.map(o => o._id);
    await Order.updateMany(
      { _id: { $in: ids } },
      { $unset: { proposalNumber: '' } }
    );

    console.log(`[migration] Reset ${toReset.length} old proposal numbers`);
    res.json({
      success: true,
      message: `Reset ${toReset.length} old proposal numbers. New sequential numbers will be generated when each proposal is next opened.`,
      reset: toReset.length,
      examples: toReset.slice(0, 5).map(o => o.proposalNumber),
    });
  } catch (error) {
    console.error('migrateProposalNumbers error:', error);
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
};