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
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } }
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
    const { name, email, password, unitNumber } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const client = await User.create({
      name,
      email,
      password,
      unitNumber,
      role: 'user'
    });

    res.status(201).json({
      _id: client._id,
      name: client.name,
      email: client.email,
      unitNumber: client.unitNumber,
      role: client.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating client' });
  }
};

// Update client
const updateClient = async (req, res) => {
  try {
    const { name, email, password, unitNumber } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (email && email !== client.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    client.name = name || client.name;
    client.email = email || client.email;
    client.unitNumber = unitNumber || client.unitNumber;

    // Handle password update if provided
    if (password) {
        // Directly hash the password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Update user with new hashed password
        await User.findByIdAndUpdate(client._id, {
          name: name || client.name,
          email: email || client.email,
          unitNumber: unitNumber || client.unitNumber,
          password: hashedPassword
        });
    } else {
        // Update without changing password
        await User.findByIdAndUpdate(client._id, {
          name: name || client.name,
          email: email || client.email,
          unitNumber: unitNumber || client.unitNumber
        });
    }
  
      // Fetch updated user (without password)
    const updatedClient = await User.findById(client._id).select('-password');

    res.json({
      _id: updatedClient._id,
      name: updatedClient.name,
      email: updatedClient.email,
      unitNumber: updatedClient.unitNumber,
      role: updatedClient.role
    });
  } catch (error) {
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
    res.status(500).json({ message: 'Error deleting client' });
  }
};

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient
};