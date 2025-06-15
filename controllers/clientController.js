const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendApprovalEmail, sendRejectionEmail } = require('./authController');

// Get all clients (including pending registrations)
const getClients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status; // New filter for status
    const skip = (page - 1) * limit;

    let searchQuery = {
      role: 'user'
    };

    // Add search conditions
    if (search) {
      searchQuery.$or = [
        { clientCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } },
        { floorPlan: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    const total = await User.countDocuments(searchQuery);
    const clients = await User.find(searchQuery)
      .select('-password')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      clients,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getClients:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
};

// Get single client
const getClient = async (req, res) => {
  try {
    const client = await User.findById(req.params.id)
      .select('-password')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name');
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client' });
  }
};

// Create client (admin only)
const createClient = async (req, res) => {
  try {
    const { clientCode, name, email, password, unitNumber, floorPlan } = req.body;

    if (!clientCode || !name || !email || !password || !unitNumber || !floorPlan) {
      return res.status(400).json({ 
        message: 'Please provide all required fields (client code, name, email, password, unit number, and floor plan)' 
      });
    }

    // Check if client code already exists
    const clientCodeExists = await User.findOne({ clientCode });
    if (clientCodeExists) {
      return res.status(400).json({ message: 'Client code already exists' });
    }

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const client = await User.create({
      clientCode,
      name,
      email,
      password,
      unitNumber,
      floorPlan,
      role: 'user',
      registrationType: 'admin-created',
      status: 'approved' // Admin-created clients are automatically approved
    });

    res.status(201).json({
      _id: client._id,
      clientCode: client.clientCode,
      name: client.name,
      email: client.email,
      unitNumber: client.unitNumber,
      floorPlan: client.floorPlan,
      role: client.role,
      status: client.status
    });
  } catch (error) {
    console.error('Error in createClient:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client code or email already exists' });
    }
    res.status(500).json({ message: 'Error creating client' });
  }
};

// Update client
const updateClient = async (req, res) => {
  try {
    const { clientCode, name, email, password, unitNumber, floorPlan } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!clientCode && !name && !email && !password && !unitNumber && !floorPlan) {
      return res.status(400).json({ message: 'Please provide at least one field to update' });
    }

    // Check if new client code already exists
    if (clientCode && clientCode !== client.clientCode) {
      const clientCodeExists = await User.findOne({ clientCode });
      if (clientCodeExists) {
        return res.status(400).json({ message: 'Client code already exists' });
      }
    }

    // Check if new email already exists
    if (email && email !== client.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updateData = {
      clientCode: clientCode || client.clientCode,
      name: name || client.name,
      email: email || client.email,
      unitNumber: unitNumber || client.unitNumber,
      floorPlan: floorPlan || client.floorPlan
    };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updateData.password = hashedPassword;
    }

    const updatedClient = await User.findByIdAndUpdate(
      client._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      _id: updatedClient._id,
      clientCode: updatedClient.clientCode,
      name: updatedClient.name,
      email: updatedClient.email,
      unitNumber: updatedClient.unitNumber,
      floorPlan: updatedClient.floorPlan,
      role: updatedClient.role,
      status: updatedClient.status
    });
  } catch (error) {
    console.error('Error in updateClient:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client code or email already exists' });
    }
    res.status(500).json({ message: 'Error updating client' });
  }
};

// Delete client
const deleteClient = async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error in deleteClient:', error);
    res.status(500).json({ message: 'Error deleting client' });
  }
};

// Approve client registration
const approveClient = async (req, res) => {
  try {
    const { clientCode, floorPlan } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (client.status === 'approved') {
      return res.status(400).json({ message: 'Client is already approved' });
    }

    // Validate required fields for approval
    if (!clientCode || !floorPlan) {
      return res.status(400).json({ 
        message: 'Client code and floor plan are required for approval' 
      });
    }

    // Check if client code already exists (if provided)
    if (clientCode) {
      const clientCodeExists = await User.findOne({ 
        clientCode, 
        _id: { $ne: client._id } 
      });
      if (clientCodeExists) {
        return res.status(400).json({ message: 'Client code already exists' });
      }
    }

    // Update client with approval details
    const updateData = {
      status: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      clientCode: clientCode,
      floorPlan: floorPlan
    };

    const updatedClient = await User.findByIdAndUpdate(
      client._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Send approval email
    try {
      await sendApprovalEmail(client.email, client.name);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Continue with response even if email fails
    }

    res.json({
      message: 'Client approved successfully',
      client: updatedClient
    });
  } catch (error) {
    console.error('Error in approveClient:', error);
    res.status(500).json({ message: 'Error approving client' });
  }
};

// Reject client registration
const rejectClient = async (req, res) => {
  try {
    const { reason } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (client.status === 'rejected') {
      return res.status(400).json({ message: 'Client is already rejected' });
    }

    if (client.status === 'approved') {
      return res.status(400).json({ message: 'Cannot reject an already approved client' });
    }

    // Update client with rejection details
    const updatedClient = await User.findByIdAndUpdate(
      client._id,
      {
        status: 'rejected',
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        rejectionReason: reason || 'No reason provided'
      },
      { new: true, runValidators: true }
    ).select('-password');

    // Send rejection email
    try {
      await sendRejectionEmail(client.email, client.name, reason);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Continue with response even if email fails
    }

    res.json({
      message: 'Client rejected successfully',
      client: updatedClient
    });
  } catch (error) {
    console.error('Error in rejectClient:', error);
    res.status(500).json({ message: 'Error rejecting client' });
  }
};

// Get pending registrations count
const getPendingCount = async (req, res) => {
  try {
    const pendingCount = await User.countDocuments({ 
      role: 'user', 
      status: 'pending',
      registrationType: 'self-registered'
    });
    
    res.json({ pendingCount });
  } catch (error) {
    console.error('Error in getPendingCount:', error);
    res.status(500).json({ message: 'Error getting pending count' });
  }
};

// Get registration statistics
const getRegistrationStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $match: { role: 'user' }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const registrationTypeStats = await User.aggregate([
      {
        $match: { role: 'user' }
      },
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      byStatus: stats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: registrationTypeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

    res.json(formattedStats);
  } catch (error) {
    console.error('Error in getRegistrationStats:', error);
    res.status(500).json({ message: 'Error getting registration statistics' });
  }
};

// Get floor plans
const getFloorPlans = async (req, res) => {
  try {
    const floorPlans = [
      "Residence 00A", "Residence 01B", "Residence 03A",
      "Residence 05A", "Residence 08", "Residence 10A/12A",
      "Residence 03B", "Residence 05B", "Residence 07B",
      "Residence 09B", "Residence 10/12", "Residence 11B",
      "Residence 13A"
    ];
    
    res.json(floorPlans);
  } catch (error) {
    console.error('Error in getFloorPlans:', error);
    res.status(500).json({ message: 'Error fetching floor plans' });
  }
};

// Reset client password (admin only)
const resetClientPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the client's password
    await User.findByIdAndUpdate(client._id, { password: hashedPassword });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error in resetClientPassword:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

// Bulk approve clients
const bulkApproveClients = async (req, res) => {
  try {
    const { clientIds, defaultClientCodePrefix, defaultFloorPlan } = req.body;

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ message: 'Client IDs array is required' });
    }

    const results = [];
    
    for (let i = 0; i < clientIds.length; i++) {
      try {
        const clientId = clientIds[i];
        const client = await User.findById(clientId);
        
        if (!client) {
          results.push({ clientId, status: 'error', message: 'Client not found' });
          continue;
        }

        if (client.status !== 'pending') {
          results.push({ clientId, status: 'skipped', message: 'Client is not pending' });
          continue;
        }

        // Generate client code if not provided
        const clientCode = defaultClientCodePrefix 
          ? `${defaultClientCodePrefix}${String(i + 1).padStart(3, '0')}`
          : `CL${Date.now()}${i}`;

        // Check if client code exists
        const codeExists = await User.findOne({ clientCode });
        if (codeExists) {
          results.push({ clientId, status: 'error', message: 'Generated client code already exists' });
          continue;
        }

        // Update client
        await User.findByIdAndUpdate(clientId, {
          status: 'approved',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          clientCode: clientCode,
          floorPlan: defaultFloorPlan || 'Residence 00A'
        });

        // Send approval email
        try {
          await sendApprovalEmail(client.email, client.name);
        } catch (emailError) {
          console.error(`Failed to send approval email to ${client.email}:`, emailError);
        }

        results.push({ clientId, status: 'approved', clientCode });
      } catch (error) {
        results.push({ clientId: clientIds[i], status: 'error', message: error.message });
      }
    }

    res.json({
      message: 'Bulk approval completed',
      results
    });
  } catch (error) {
    console.error('Error in bulkApproveClients:', error);
    res.status(500).json({ message: 'Error in bulk approval' });
  }
};

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  approveClient,
  rejectClient,
  getPendingCount,
  getRegistrationStats,
  getFloorPlans,
  resetClientPassword,
  bulkApproveClients
};