const User = require('../models/User');
const Journey = require('../models/Journey');
const Order = require('../models/Order');
const { JOURNEY_STEPS } = require('../data/journeySteps');
const { sendApprovalEmail, sendRejectionEmail } = require('./authController');
const crypto = require('crypto');

// ✅ HELPER: Get image path based on config ID
const getFloorPlanImagePath = (configId) => {
  const imageMap = {
    'investor-a': '/images/investor_plan/Alia_05A.png',
    'investor-b': '/images/investor_plan/Alia_03A.png',
    'investor-c': '/images/investor_plan/Alia_03B.png',
    'custom-a': '/images/custom_plan/Alia_05A.png',
    'custom-b': '/images/custom_plan/Alia_03A.png',
    'custom-c': '/images/custom_plan/Alia_03B.png',
  };
  
  return imageMap[configId] || '/images/investor_plan/investor_1.png';
};

// ✅ HELPER: Map Residence + Collection + PackageType to Config ID
const getFloorPlanConfigId = (floorPlan, collection, packageType = 'investor') => {
  if (!floorPlan) return 'investor-a';
  
  // For library, always use investor floor plans
  if (packageType === 'library') {
    const residenceMap = {
      'Residence 05A': 'investor-a',
      'Residence 03A': 'investor-b',
      'Residence 03B': 'investor-c',
      'Residence 00A': 'investor-a',
      'Residence 01B': 'investor-b',
      'Residence 05B': 'investor-b',
      'Residence 07B': 'investor-b',
      'Residence 08': 'investor-c',
      'Residence 09B': 'investor-b',
      'Residence 10/12': 'investor-c',
      'Residence 10A/12A': 'investor-a',
      'Residence 11B': 'investor-b',
      'Residence 13A': 'investor-a',
    };
    return residenceMap[floorPlan] || 'investor-a';
  }
  
  // For custom/investor, use collection to determine
  const isLani = collection?.includes('Lani');
  
  const residenceMap = {
    'Residence 05A': isLani ? 'custom-a' : 'investor-a',
    'Residence 03A': isLani ? 'custom-b' : 'investor-b',
    'Residence 03B': isLani ? 'custom-c' : 'investor-c',
    'Residence 00A': 'investor-a',
    'Residence 01B': 'investor-b',
    'Residence 05B': 'investor-b',
    'Residence 07B': 'custom-b',
    'Residence 08': 'custom-c',
    'Residence 09B': 'investor-b',
    'Residence 10/12': 'custom-c',
    'Residence 10A/12A': 'custom-a',
    'Residence 11B': 'custom-b',
    'Residence 13A': 'custom-a',
  };

  return residenceMap[floorPlan] || 'investor-a';
};

// @desc    Get all clients (pending, approved, rejected)
// @route   GET /api/clients
// @access  Private (Admin)
const getAllClients = async (req, res) => {
  try {
    const { status, registrationType, page = 1, limit = 10, search = '' } = req.query;
    
    let filter = {role: 'user'};
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (registrationType) {
      filter.registrationType = registrationType;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } }
      ];
    }    
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    
    const clients = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
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

// @desc    Get floor plans
// @route   GET /api/clients/floor-plans
// @access  Private (Admin)
const getFloorPlans = async (req, res) => {
  try {
    const floorPlans = [
      "Residence 00A", "Residence 01B", "Residence 03A",
      "Residence 05A", "Residence 08", "Residence 10A/12A",
      "Residence 03B", "Residence 05B", "Residence 07B",
      "Residence 09B", "Residence 10/12", "Residence 11B",
      "Residence 13A"
    ];
    
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
    
    const temporaryPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    client.password = temporaryPassword;
    await client.approve(req.user.id);
    
    if (client.email) {
      try {
        await sendApprovalEmail(client, temporaryPassword);
        console.log(`✅ Approval email sent to ${client.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send approval email (non-fatal):', emailError.message);
      }
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
    
    await client.reject(req.user.id, reason);
    
    if (client.email) {
      try {
        await sendRejectionEmail(client.email, client.name, reason);
        console.log(`✅ Rejection email sent to ${client.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send rejection email (non-fatal):', emailError.message);
      }
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
    
    const {
      amount,
      paymentDate,
      paymentMethod,
      transactionReference,
      notes
    } = req.body;
    
    if (!amount || !paymentDate || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount, payment date, and payment method'
      });
    }
    
    const client = await User.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
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

    const payment = {
      amount: parseFloat(amount),
      paymentDate: new Date(paymentDate),
      paymentMethod: paymentMethod,
      transactionReference: transactionReference || '',
      notes: notes || '',
      recordedBy: req.user.name || req.user.email,
      recordedAt: new Date()
    };
    
    client.paymentInfo.payments.push(payment);
    
    const previousAmountPaid = client.paymentInfo.amountPaid || 0;
    client.paymentInfo.amountPaid = previousAmountPaid + parseFloat(amount);
    
    const requiredDP = (client.paymentInfo.totalAmount || 0) * 
      ((client.paymentInfo.downPaymentPercentage || 30) / 100);
    
    if (client.paymentInfo.amountPaid >= requiredDP) {
      client.paymentInfo.downPaymentStatus = 'paid';
    } else if (client.paymentInfo.amountPaid > 0) {
      client.paymentInfo.downPaymentStatus = 'partial';
    } else {
      client.paymentInfo.downPaymentStatus = 'not-paid';
    }
    
    await client.save();
    
    console.log('✅ Payment recorded successfully');

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

const generateClientCode = async (name, unitNumber) => {
  // Get the last user to determine the next sequential number
  const lastUser = await User.findOne({ clientCode: { $regex: /^\d{3}[A-Z]{1,3}\d{4}$/ } })
    .sort({ clientCode: -1 });

  let sequentialNumber = 1;
  if (lastUser && lastUser.clientCode) {
    // Extract the first 3 digits from the last client code
    const lastNumber = parseInt(lastUser.clientCode.substring(0, 3), 10);
    sequentialNumber = lastNumber + 1;
  }

  // Format sequential number to 3 digits
  const formattedSequentialNumber = String(sequentialNumber).padStart(3, "0");

  // Extract name code (1-3 capital letters from first letters of words)
  const nameCode = extractNameCode(name);

  // Format unit number to 4 digits
  const formattedUnitNumber = String(unitNumber).padStart(4, "0");

  // Combine: 001JUN2342 or 002GO0045
  return formattedSequentialNumber + nameCode + formattedUnitNumber;
};

const extractNameCode = (name) => {
  if (!name) return "";

  // Remove extra spaces and split by space
  const words = name.trim().split(/\s+/);
  
  // Get first letter of each word (up to 3)
  let nameCode = words
    .slice(0, 3)
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  // If less than 3 letters, try to get more from first word
  if (nameCode.length < 3 && words.length > 0) {
    const firstWord = words[0].toUpperCase();
    for (let i = 1; i < firstWord.length && nameCode.length < 3; i++) {
      nameCode += firstWord.charAt(i);
    }
  }

  // Return as is (1-3 characters), no padding with X
  return nameCode.substring(0, 3);
};


const createClient = async (req, res) => {
  try {
    console.log('📝 Creating new client with auto-journey and auto-order...');

    const {
      name,
      email: rawEmail,
      password,
      unitNumber,
      phoneNumber,
      floorPlan,
      propertyType,
      collection,
      bedroomCount,
      packageType = 'investor',
      customNotes,
      teamAssignment // ✅ NEW: Team assignment object
    } = req.body;

    const email = rawEmail && rawEmail.trim() !== '' ? rawEmail.trim() : null;

    // Log untuk konfirmasi
    console.log('📧 Email normalized:', email);

    if (!name || !password || !unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!floorPlan && collection !== 'Custom') {
      return res.status(400).json({
        success: false,
        message: 'Floor plan is required'
      });
    }

    if (packageType !== 'custom' && packageType !== 'library' && !bedroomCount) {
      return res.status(400).json({
        success: false,
        message: 'Bedroom count is required'
      });
    } 

    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    // Calculate totalAmount
    let totalAmount = 0;
    if (packageType !== 'library') {
      const pricingTable = {
        'Nalu Foundation Collection': { '1': 2500, '2': 3500, '3': 4500 },
        'Nalu Collection': { '1': 5000, '2': 7500, '3': 10000 },
        'Lani': { '1': 10000, '2': 15000, '3': 20000 }
      };
      totalAmount = pricingTable[collection]?.[bedroomCount] || 0;
    }

    const clientCode = await generateClientCode(name, unitNumber);

    // ✅ Process team assignment
    const processedTeamAssignment = {
      designer: teamAssignment?.designer || '',
      projectManager: teamAssignment?.projectManager || '',
      projectManagerAssistant: teamAssignment?.projectManagerAssistant || '',
      designerAssistant: teamAssignment?.designerAssistant || ''
    };

    // Create user
    const user = await User.create({
      clientCode,
      name,
      email: email || undefined,
      password,
      unitNumber,
      phoneNumber: phoneNumber || '',
      floorPlan: floorPlan || '',
      propertyType: propertyType || 'Lock 2025 Pricing',
      collection: collection || '',
      bedroomCount: bedroomCount || 0,
      packageType,
      customNotes: customNotes || '',
      teamAssignment: processedTeamAssignment, // ✅ NEW FIELD
      registrationType: 'admin-created',
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: req.user.id,
      paymentInfo: {
        totalAmount,
        downPaymentPercentage: 30,
        downPaymentStatus: 'not-paid',
        amountPaid: 0,
        payments: []
      }
    });

    console.log('✅ Client created:', user.clientCode, 'Package:', packageType);
    console.log('✅ Team assigned:', processedTeamAssignment);

    // AUTO-INITIALIZE JOURNEY
    const journey = await Journey.create({
      clientId: user._id,
      steps: JOURNEY_STEPS.map(stepData => ({
        step: stepData.step,
        stage: stepData.stage,
        owner: stepData.owner,
        adminDescription: stepData.adminDescription,
        clientDescription: stepData.clientDescription || '',
        clientVisible: stepData.clientVisible || false,
        autoEmail: stepData.autoEmail || false,
        docAutoGenerated: stepData.docAutoGenerated || false,
        clientActionNeeded: stepData.clientActionNeeded || false,
        notes: stepData.notes || '',
        status: stepData.step === 1 ? 'in-progress' : 'not-started',
        deadlineDate: null,
        completedDate: null,
        updatedBy: req.user.id,
        updatedAt: new Date()
      }))
    });

    console.log('✅ Journey auto-initialized with', JOURNEY_STEPS.length, 'steps');

    // ✅ AUTO-CREATE ORDER with packageType
    const floorPlanConfigId = getFloorPlanConfigId(user.floorPlan, collection, packageType);
    const floorPlanImage = getFloorPlanImagePath(floorPlanConfigId);
    
    const order = await Order.create({
      user: user._id,
      packageType,
      clientInfo: {
        name: user.name,
        unitNumber: user.unitNumber,
        floorPlan: user.floorPlan
      },
      selectedPlan: {
        id: floorPlanConfigId,
        title: user.floorPlan || 'Residence',
        description: collection
  ? (packageType === 'custom' ? `${collection} - Custom Package` : `${collection} - ${bedroomCount} Bedroom`)
  : 'Library Package',
        image: floorPlanImage,
        clientInfo: {
          name: user.name,
          unitNumber: user.unitNumber,
          floorPlan: user.floorPlan
        }
      },
      Package: collection
  ? (packageType === 'custom' ? collection : `${collection} - ${bedroomCount}BR`)
  : 'Library',
      selectedProducts: [],
      occupiedSpots: {},
      status: 'ongoing',
      step: 1
    });

    console.log('✅ Order auto-created:', order._id, 'Config:', floorPlanConfigId, 'Package Type:', packageType);

    // Send approval email
    // Send approval email — only if email exists
    if (user.email) {
      try {
        await sendApprovalEmail(user, password);
        console.log(`✅ Approval email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send approval email (non-fatal):', emailError.message);
        // Tidak throw error — client tetap terbuat meski email gagal
      }
    }

    res.status(201).json({
      success: true,
      message: 'Client, journey, and order initialized successfully',
      data: {
        _id: user._id,
        clientCode: user.clientCode,
        name: user.name,
        email: user.email,
        unitNumber: user.unitNumber,
        status: user.status,
        packageType: user.packageType,
        teamAssignment: user.teamAssignment, // ✅ Return team info
        totalAmount,
        journeyId: journey._id,
        orderId: order._id
      }
    });

  } catch (error) {
    console.error('❌ Create client error:', error);

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

// @desc    Update client information (with order sync, library, and team support)
// @route   PUT /api/clients/:id
// @access  Private (Admin)
const updateClient = async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'email', 'unitNumber', 'phoneNumber', 'propertyType',
      'floorPlan', 'questionnaire', 'paymentInfo', 'collection', 
      'bedroomCount', 'packageType', 'teamAssignment'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Normalize email untuk update
    if (updates.email !== undefined) {
      updates.email = updates.email && updates.email.trim() !== '' 
        ? updates.email.trim() 
        : null;
    }

    // Get current client data
    const currentClient = await User.findById(req.params.id);
    if (!currentClient) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }

    // ✅ Regenerate client code if name or unitNumber changed
    if (req.body.name || req.body.unitNumber) {
      const newName = req.body.name || currentClient.name;
      const newUnitNumber = req.body.unitNumber || currentClient.unitNumber;
      updates.clientCode = await generateClientCode(newName, newUnitNumber);
      console.log('✅ Client code regenerated:', updates.clientCode);
    }

    // Process team assignment if provided
    if (req.body.teamAssignment) {
      updates.teamAssignment = {
        designer: req.body.teamAssignment.designer || '',
        projectManager: req.body.teamAssignment.projectManager || '',
        projectManagerAssistant: req.body.teamAssignment.projectManagerAssistant || '',
        designerAssistant: req.body.teamAssignment.designerAssistant || ''
      };
      console.log('✅ Updating team assignment:', updates.teamAssignment);
    }

    if (req.body.password && req.body.password.trim() !== '') {
      updates.password = req.body.password;
    }
    
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

    // UPDATE ORDER
    const orderUpdateFields = {};
    let shouldUpdateOrder = false;

    if (updates.name || updates.unitNumber || updates.floorPlan) {
      orderUpdateFields.clientInfo = {
        name: client.name,
        unitNumber: client.unitNumber,
        floorPlan: client.floorPlan
      };
      shouldUpdateOrder = true;
    }

    if (updates.collection || updates.bedroomCount || updates.floorPlan || updates.packageType) {
      const collection = updates.collection || client.collection;
      const bedroomCount = updates.bedroomCount || client.bedroomCount;
      const floorPlan = updates.floorPlan || client.floorPlan;
      const packageType = updates.packageType || client.packageType || 'investor';
      
      if (floorPlan) {
        const floorPlanConfigId = getFloorPlanConfigId(floorPlan, collection, packageType);
        const floorPlanImage = getFloorPlanImagePath(floorPlanConfigId);
        
        orderUpdateFields.packageType = packageType;
        orderUpdateFields.selectedPlan = {
          id: floorPlanConfigId,
          title: floorPlan || 'Residence',
          Package: collection
  ? (packageType === 'custom' ? collection : `${collection} - ${bedroomCount}BR`)
  : 'Library',
          image: floorPlanImage,
          clientInfo: {
            name: client.name,
            unitNumber: client.unitNumber,
            floorPlan: floorPlan
          }
        };
        orderUpdateFields.Package = collection ? `${collection} - ${bedroomCount}BR` : 'Library';
        shouldUpdateOrder = true;

        // Update payment total if not library
        if (packageType !== 'library' && collection && bedroomCount) {
          const pricingTable = {
            'Nalu Foundation Collection': { '1': 2500, '2': 3500, '3': 4500 },
            'Nalu Collection': { '1': 5000, '2': 7500, '3': 10000 },
            'Lani': { '1': 10000, '2': 15000, '3': 20000 }
          };

          const newTotalAmount = pricingTable[collection]?.[bedroomCount] || client.paymentInfo?.totalAmount || 0;
          
          await User.findByIdAndUpdate(req.params.id, {
            'paymentInfo.totalAmount': newTotalAmount
          });
        }
        
        console.log('✅ Updated to config ID:', floorPlanConfigId, 'Package Type:', packageType);
      }
    }

    // Update order if needed
    if (shouldUpdateOrder) {
      const order = await Order.findOne({ user: client._id });
      
      if (order) {
        await Order.findByIdAndUpdate(order._id, orderUpdateFields);
        console.log('✅ Order updated for client:', client.clientCode);
      } else if (client.status === 'approved') {
        const collection = client.collection;
        const floorPlan = client.floorPlan;
        const packageType = client.packageType || 'investor';
        const floorPlanConfigId = getFloorPlanConfigId(floorPlan, collection, packageType);
        const floorPlanImage = getFloorPlanImagePath(floorPlanConfigId);
        
        const newOrder = await Order.create({
          user: client._id,
          packageType,
          clientInfo: orderUpdateFields.clientInfo || {
            name: client.name,
            unitNumber: client.unitNumber,
            floorPlan: client.floorPlan
          },
          selectedPlan: orderUpdateFields.selectedPlan || {
            id: floorPlanConfigId,
            title: client.floorPlan || 'Residence',
            description: client.collection ? (packageType === 'custom' ? `${collection} - Custom Package` : `${collection} - ${bedroomCount} Bedroom`)
  : 'Library Package',
            image: floorPlanImage,
            clientInfo: {
              name: client.name,
              unitNumber: client.unitNumber,
              floorPlan: client.floorPlan
            }
          },
          Package: orderUpdateFields.Package || (client.collection ? `${client.collection} - ${client.bedroomCount}BR` : 'Library'),
          selectedProducts: [],
          occupiedSpots: {},
          status: 'ongoing',
          step: 1
        });
        console.log('✅ Order auto-created for approved client:', client.clientCode);
      }
    }
    
    console.log('✅ Client updated successfully:', client.clientCode);
    if (updates.teamAssignment) {
      console.log('✅ Team updated:', client.teamAssignment);
    }
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });
  } catch (error) {
    console.error('❌ Update client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update client',
      error: error.message
    });
  }
};

// @desc    Delete client (cascade delete order and journey)
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
    
    console.log('🗑️ Deleting client:', client.clientCode);
    
    // ✅ DELETE ASSOCIATED ORDER(S)
    const deletedOrders = await Order.deleteMany({ user: client._id });
    console.log(`✅ Deleted ${deletedOrders.deletedCount} order(s) for client ${client.clientCode}`);
    
    // ✅ DELETE ASSOCIATED JOURNEY
    const deletedJourney = await Journey.deleteOne({ clientId: client._id });
    console.log(`✅ Deleted journey for client ${client.clientCode}`);
    
    // ✅ DELETE CLIENT
    await client.deleteOne();
    console.log(`✅ Client ${client.clientCode} deleted successfully`);
    
    res.json({
      success: true,
      message: 'Client and all associated data deleted successfully',
      deletedData: {
        client: client.clientCode,
        orders: deletedOrders.deletedCount,
        journey: deletedJourney.deletedCount > 0
      }
    });
  } catch (error) {
    console.error('❌ Delete client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete client',
      error: error.message
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
  getPendingCount,
  getFloorPlans,
  getClientById,
  approveClient,
  rejectClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
  recordPayment
};