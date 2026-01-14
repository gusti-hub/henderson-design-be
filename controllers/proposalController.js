// controllers/proposalController.js - NEW FILE
const Order = require('../models/Order');
const ProposalVersion = require('../models/ProposalVersion');

// Get proposal data for editing
const getProposalData = async (req, res) => {
  try {
    const { orderId, version } = req.params;

    if (version && version !== 'latest') {
      // Get specific version
      const proposalVersion = await ProposalVersion.findOne({
        orderId,
        version: parseInt(version)
      });

      if (!proposalVersion) {
        return res.status(404).json({ message: 'Proposal version not found' });
      }

      return res.json({
        success: true,
        data: proposalVersion
      });
    }

    // Get latest from order
    const order = await Order.findById(orderId)
      .populate('user')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get latest version number
    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      { version: 1 },
      { sort: { version: -1 } }
    );

    const currentVersion = latestVersion ? latestVersion.version : 0;

    res.json({
      success: true,
      data: {
        orderId: order._id,
        version: currentVersion,
        clientInfo: order.clientInfo,
        user: order.user,
        selectedPlan: order.selectedPlan,
        selectedProducts: order.selectedProducts || [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('Error getting proposal data:', error);
    res.status(500).json({ message: error.message });
  }
};

// Save proposal (update current version)
const saveProposal = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { version, products, clientInfo, notes } = req.body;

    if (version === 0) {
      // Create first version
      const newVersion = await ProposalVersion.create({
        orderId,
        version: 1,
        selectedProducts: products,
        clientInfo,
        notes: notes || 'Initial proposal',
        status: 'draft',
        createdBy: req.user.id
      });

      return res.json({
        success: true,
        message: 'First version created',
        data: newVersion
      });
    }

    // Update existing version
    const updated = await ProposalVersion.findOneAndUpdate(
      { orderId, version },
      {
        selectedProducts: products,
        clientInfo,
        notes,
        updatedAt: new Date(),
        updatedBy: req.user.id
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Version not found' });
    }

    res.json({
      success: true,
      message: 'Proposal updated',
      data: updated
    });

  } catch (error) {
    console.error('Error saving proposal:', error);
    res.status(500).json({ message: error.message });
  }
};

// Save as new version
const saveAsNewVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, notes } = req.body;

    if (!notes || !notes.trim()) {
      return res.status(400).json({ 
        message: 'Version notes are required' 
      });
    }

    // Get next version number
    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      { version: 1 },
      { sort: { version: -1 } }
    );

    const nextVersion = (latestVersion?.version || 0) + 1;

    const newVersion = await ProposalVersion.create({
      orderId,
      version: nextVersion,
      selectedProducts: products,
      clientInfo,
      notes,
      status: 'draft',
      createdBy: req.user.id
    });

    res.json({
      success: true,
      message: `Version ${nextVersion} created`,
      data: newVersion
    });

  } catch (error) {
    console.error('Error creating new version:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all versions
const getAllVersions = async (req, res) => {
  try {
    const { orderId } = req.params;

    const versions = await ProposalVersion.find({ orderId })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ version: -1 })
      .lean();

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProposalData,
  saveProposal,
  saveAsNewVersion,
  getAllVersions
};