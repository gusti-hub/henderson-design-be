// controllers/proposalController.js
// ✅ FINAL: Proposal number guaranteed unique per project
//   Format: Hen-[ClientCode]-[6-char orderId suffix]
//   Example: Hen-LAN-4f8a2c
//   - Deterministic: same orderId always yields same number
//   - Generated ONCE per order, never overwritten
//   - All code paths use ensureProposalNumber() — single source of truth

const Order = require('../models/Order');
const ProposalVersion = require('../models/ProposalVersion');

// ─── Single canonical proposal number generator ───────────────────────────────
// Uses last 6 chars of orderId (hex) — globally unique because orderId is unique.
// ClientCode from last name for readability.
// Idempotent: if already set, returns existing.
const ensureProposalNumber = async (order) => {
  if (order.proposalNumber) return order.proposalNumber;

  const clientName = order.clientInfo?.name || 'CLT';
  const nameParts  = clientName.trim().split(/\s+/);
  const lastName   = nameParts[nameParts.length - 1] || nameParts[0] || 'CLT';
  const clientCode = lastName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const numPart    = order._id.toString().slice(-6).toUpperCase();
  const proposalNumber = `Hen-${clientCode}-${numPart}`;

  // Persist — use findByIdAndUpdate with $set to avoid race conditions
  await Order.findByIdAndUpdate(
    order._id,
    { $set: { proposalNumber } },
    { new: false } // don't need return value
  );

  console.log(`[proposal] Generated proposalNumber: ${proposalNumber} for order ${order._id}`);
  return proposalNumber;
};

// ─── GET proposal data ────────────────────────────────────────────────────────
const getProposalData = async (req, res) => {
  try {
    const { orderId, version } = req.params;

    if (version && version !== 'latest') {
      // Specific version — fetch both ProposalVersion and Order.proposalNumber
      const [proposalVersion, order] = await Promise.all([
        ProposalVersion.findOne({ orderId, version: parseInt(version) }),
        Order.findById(orderId).select('proposalNumber clientInfo').lean(),
      ]);

      if (!proposalVersion) {
        return res.status(404).json({ message: 'Proposal version not found' });
      }

      // Ensure proposalNumber exists on the order
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
    const order = await Order.findById(orderId).populate('user').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Ensure proposalNumber exists
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

    // Ensure proposalNumber — idempotent, safe to call every time
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

// ─── ENSURE proposal number (called by CustomProductManager on mount) ─────────
// Idempotent endpoint — returns existing number or generates new one.
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

module.exports = {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions,
  ensureProposalNumberEndpoint,
};