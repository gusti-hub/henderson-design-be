const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get all clients
const getClients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const searchQuery = {
      role: 'user',
      $or: [
        { clientCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } },
        { floorPlan: { $regex: search, $options: 'i' } }
      ]
    };

    const total = await User.countDocuments(searchQuery);
    const clients = await User.find(searchQuery)
      .select('-password')
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
    const client = await User.findById(req.params.id).select('-password');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client' });
  }
};

// Create client
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
      role: 'user'
    });

    res.status(201).json({
      _id: client._id,
      clientCode: client.clientCode,
      name: client.name,
      email: client.email,
      unitNumber: client.unitNumber,
      floorPlan: client.floorPlan,
      role: client.role
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
      role: updatedClient.role
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

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getFloorPlans
};