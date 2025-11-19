const User = require('../models/User');
const { sendApprovalEmail, sendRejectionEmail } = require('./authController');
const crypto = require('crypto');

// @desc    Get all clients (pending, approved, rejected)
// @route   GET /api/clients
// @access  Private (Admin)
const getAllClients = async (req, res) => {
  try {
    
    const { status, registrationType, page = 1, limit = 10, search = '' } = req.query;
    
    // Build filter
    let filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (registrationType) {
      filter.registrationType = registrationType;
    }
    
    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } }
      ];
    }    
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await User.countDocuments(filter);
    
    // Get clients
    const clients = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    
    // CRITICAL: Return in exact format frontend expects
    const response = {
      success: true,
      count: total,
      data: clients,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Get all clients error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get pending registrations
// @route   GET /api/clients/pending
// @access  Private (Admin)
const getPendingClients = async (req, res) => {
  try {
    const pendingClients = await User.find({ 
      status: 'pending',
      registrationType: 'self-registered'
    })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: pendingClients.length,
      data: pendingClients
    });
  } catch (error) {
    console.error('Get pending clients error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error' 
    });
  }
};

// @desc    Get pending count
// @route   GET /api/clients/pending-count
// @access  Private (Admin)
const getPendingCount = async (req, res) => {
  try {
    const count = await User.countDocuments({ 
      status: 'pending',
      registrationType: 'self-registered'
    });
    
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error' 
    });
  }
};

// @desc    Get floor plans (unique floor plans from users)
// @route   GET /api/clients/floor-plans
// @access  Private (Admin)
const getFloorPlans = async (req, res) => {
  try {
    // Get distinct floor plans from users
    const floorPlans = [
      "Residence 00A", "Residence 01B", "Residence 03A",
      "Residence 05A", "Residence 08", "Residence 10A/12A",
      "Residence 03B", "Residence 05B", "Residence 07B",
      "Residence 09B", "Residence 10/12", "Residence 11B",
      "Residence 13A"
    ];
    
    // Filter out null/undefined values
    const validFloorPlans = floorPlans.filter(fp => fp);
    
    res.json({
      success: true,
      data: validFloorPlans
    });
  } catch (error) {
    console.error('Get floor plans error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error' 
    });
  }
};

// @desc    Get client by ID
// @route   GET /api/clients/:id
// @access  Private (Admin)
const getClientById = async (req, res) => {
  try {
    const client = await User.findById(req.params.id).select('-password');
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('Get client by ID error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error' 
    });
  }
};

// @desc    Approve client registration
// @route   PUT /api/clients/:id/approve
// @access  Private (Admin)
const approveClient = async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    if (client.status === 'approved') {
      return res.status(400).json({ 
        success: false,
        message: 'Client is already approved' 
      });
    }
    
    // Generate temporary password (8 characters, alphanumeric)
    const temporaryPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Update client password with temporary password
    client.password = temporaryPassword; // Will be hashed by pre-save hook
    
    // Approve the client
    await client.approve(req.user.id);
    
    // Send approval email with credentials
    try {
      await sendApprovalEmail(client, temporaryPassword);
      console.log(`✅ Approval email sent to ${client.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send approval email:', emailError);
      // Continue even if email fails
    }
    
    res.json({
      success: true,
      message: 'Client approved successfully and notification email sent',
      data: {
        _id: client._id,
        name: client.name,
        email: client.email,
        status: client.status,
        approvedAt: client.approvedAt
      }
    });
  } catch (error) {
    console.error('Approve client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to approve client' 
    });
  }
};

// @desc    Reject client registration
// @route   PUT /api/clients/:id/reject
// @access  Private (Admin)
const rejectClient = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const client = await User.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    if (client.status === 'rejected') {
      return res.status(400).json({ 
        success: false,
        message: 'Client is already rejected' 
      });
    }
    
    // Reject the client
    await client.reject(req.user.id, reason);
    
    // Send rejection email
    try {
      await sendRejectionEmail(client.email, client.name, reason);
      console.log(`✅ Rejection email sent to ${client.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send rejection email:', emailError);
      // Continue even if email fails
    }
    
    res.json({
      success: true,
      message: 'Client rejected and notification email sent',
      data: {
        _id: client._id,
        name: client.name,
        email: client.email,
        status: client.status,
        rejectedAt: client.rejectedAt,
        rejectionReason: client.rejectionReason
      }
    });
  } catch (error) {
    console.error('Reject client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reject client' 
    });
  }
};

const recordPayment = async (req, res) => {
  try {
    console.log('💰 Recording payment for client:', req.params.id);
    console.log('Payment data:', req.body);
    
    const {
      amount,
      paymentDate,
      paymentMethod,
      transactionReference,
      notes
    } = req.body;
    
    // Validate required fields
    if (!amount || !paymentDate || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount, payment date, and payment method'
      });
    }
    
    // Find client
    const client = await User.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Initialize paymentInfo if it doesn't exist
    if (!client.paymentInfo) {
      client.paymentInfo = {
        totalAmount: 0,
        downPaymentPercentage: 30,
        amountPaid: 0,
        payments: []
      };
    }
    
    if (!Array.isArray(client.paymentInfo.payments)) {
      client.paymentInfo.payments = [];
    }


    // Create payment record
    const payment = {
      amount: parseFloat(amount),
      paymentDate: new Date(paymentDate),
      paymentMethod: paymentMethod,
      transactionReference: transactionReference || '',
      notes: notes || '',
      recordedBy: req.user.name || req.user.email,
      recordedAt: new Date()
    };
    
    // Add payment to payments array
    client.paymentInfo.payments.push(payment);
    
    // Update total amount paid
    const previousAmountPaid = client.paymentInfo.amountPaid || 0;
    client.paymentInfo.amountPaid = previousAmountPaid + parseFloat(amount);
    
    // Calculate required down payment
    const requiredDP = (client.paymentInfo.totalAmount || 0) * 
      ((client.paymentInfo.downPaymentPercentage || 30) / 100);
    
    // Update down payment status
    if (client.paymentInfo.amountPaid >= requiredDP) {
      client.paymentInfo.downPaymentStatus = 'paid';
    } else if (client.paymentInfo.amountPaid > 0) {
      client.paymentInfo.downPaymentStatus = 'partial';
    } else {
      client.paymentInfo.downPaymentStatus = 'not-paid';
    }
    
    // Save client
    await client.save();
    
    console.log('✅ Payment recorded successfully');
    console.log('Amount paid:', client.paymentInfo.amountPaid);
    console.log('Status:', client.paymentInfo.downPaymentStatus);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        clientId: client._id,
        clientName: client.name,
        payment: payment,
        totalAmountPaid: client.paymentInfo.amountPaid,
        downPaymentStatus: client.paymentInfo.downPaymentStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
};

// @desc    Create new client (admin-created)
// @route   POST /api/clients
// @access  Private (Admin)
const createClient = async (req, res) => {
  try {
    console.log('📝 Creating new client...');
    console.log('Request body:', req.body);
    
    const {
      clientCode,
      name,
      email,
      password,
      unitNumber,
      phoneNumber,
      floorPlan,
      propertyType,
      totalAmount,
      downPaymentPercentage
    } = req.body;
    
    // Validate required fields
    if (!clientCode || !name || !email || !password || !unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user
    const user = await User.create({
      clientCode,
      name,
      email,
      password, // Will be hashed by pre-save hook
      unitNumber,
      phoneNumber: phoneNumber || '',
      floorPlan: floorPlan || '',
      propertyType: propertyType || '',
      registrationType: 'admin-created',
      status: 'approved', // Admin-created clients are auto-approved
      approvedAt: new Date(),
      approvedBy: req.user.id, // Admin who created it
      paymentInfo: {
        totalAmount: totalAmount || 0,
        downPaymentPercentage: downPaymentPercentage || 30,
        downPaymentStatus: 'not-paid',
        amountPaid: 0,
        payments: []
      }
    });
    

    console.log('✅ Client created:', user._id);
    await sendApprovalEmail(user, password);
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: {
        _id: user._id,
        clientCode: user.clientCode,
        name: user.name,
        email: user.email,
        unitNumber: user.unitNumber,
        status: user.status
      }
    });
    
  } catch (error) {
    console.error('❌ Create client error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
};

// @desc    Update client information
// @route   PUT /api/clients/:id
// @access  Private (Admin)
const updateClient = async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'email', 'unitNumber', 'phoneNumber', 'propertyType',
      'floorPlan', 'questionnaire', 'paymentInfo'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const client = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update client' 
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private (Admin)
const deleteClient = async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    await client.deleteOne();
    
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete client' 
    });
  }
};

// @desc    Get client statistics
// @route   GET /api/clients/stats
// @access  Private (Admin)
const getClientStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };
    
    stats.forEach(stat => {
      if (stat._id) {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
      }
    });
    
    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error' 
    });
  }
};

module.exports = {
  getAllClients,
  getPendingClients,
  getPendingCount,        // ✅ Added
  getFloorPlans,          // ✅ Added
  getClientById,
  approveClient,
  rejectClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  recordPayment
};