const User = require('../models/User');
const Journey = require('../models/Journey');
const Order = require('../models/Order');
const { JOURNEY_STEPS } = require('../data/journeySteps');
const { sendApprovalEmail, sendRejectionEmail } = require('./authController');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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

  const isLani = collection?.includes('Lani') && !collection?.includes('Developer');
  
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
      "Residence 00A", "Residence 00B",
      "Residence 01A", "Residence 01B",
      "Residence 02A", "Residence 02B",
      "Residence 03A", "Residence 03B",
      "Residence 04A", "Residence 04B",
      "Residence 05A", "Residence 05B",
      "Residence 06A", "Residence 06B",
      "Residence 07A", "Residence 07B",
      "Residence 08A", "Residence 08B",
      "Residence 09A", "Residence 09B",
      "Residence 10A", "Residence 10B",
      "Residence 11A", "Residence 11B",
      "Residence 12A", "Residence 12B",
      "Residence 13A", "Residence 13B",
      "Residence 14A", "Residence 14B",
      "Residence 15A", "Residence 15B",
      "Residence 16A", "Residence 16B",
      "Residence 17A", "Residence 17B",

      // Special formats
      "Residence 08", 
      "Residence 10A/12A",
      "Residence 10/12"
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
      unitNumber2,
      unitNumber3,
      unitNumber4,
      unitNumber5,
      phoneNumber,
      floorPlan,
      floorPlan2,
      floorPlan3,
      floorPlan4,
      floorPlan5,
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
      unitNumber2,
      unitNumber3,
      unitNumber4,
      unitNumber5,
      phoneNumber: phoneNumber || '',
      floorPlan: floorPlan || '',
      floorPlan2: floorPlan2 || '',
      floorPlan3: floorPlan3 || '',
      floorPlan4: floorPlan4 || '',
      floorPlan5: floorPlan5 || '',
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
      'bedroomCount', 'packageType', 'teamAssignment', 'unitNumber2','floorPlan2','unitNumber3','floorPlan3',
      'unitNumber4','floorPlan4','unitNumber5','floorPlan5'
    ];
    
  const updates = {};
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });


  // ✅ Normalize bedroomCount
  if (updates.bedroomCount !== undefined) {
    const bc = String(updates.bedroomCount).trim();
    updates.bedroomCount = (bc && bc !== '0') ? bc : undefined;
    if (updates.bedroomCount === undefined) delete updates.bedroomCount;
  }

  // Get current client data
  const currentClient = await User.findById(req.params.id);
  if (!currentClient) {
    return res.status(404).json({ 
      success: false,
      message: 'Client not found' 
    });
  }

  // Regenerate client code if name or unitNumber changed
  if (req.body.name || req.body.unitNumber) {
    const newName = req.body.name || currentClient.name;
    const newUnitNumber = req.body.unitNumber || currentClient.unitNumber;
    updates.clientCode = await generateClientCode(newName, newUnitNumber);
  }

  // Process team assignment
  if (req.body.teamAssignment) {
    updates.teamAssignment = {
      designer: req.body.teamAssignment.designer || '',
      projectManager: req.body.teamAssignment.projectManager || '',
      projectManagerAssistant: req.body.teamAssignment.projectManagerAssistant || '',
      designerAssistant: req.body.teamAssignment.designerAssistant || ''
    };
  }

  if (req.body.password && req.body.password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(req.body.password, salt);
  }

  // ✅ Handle email — unset jika dikosongkan
  const unsetFields = {};
  if (req.body.email !== undefined) {
    if (!req.body.email || req.body.email.trim() === '') {
      unsetFields.email = '';
      delete updates.email;
    } else {
      updates.email = req.body.email.trim();
    }
  }

  const updateQuery = Object.keys(unsetFields).length > 0
    ? { $set: updates, $unset: unsetFields }
    : { $set: updates };

  const client = await User.findByIdAndUpdate(
    req.params.id,
    updateQuery,
    { new: true, runValidators: false }
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

const exportClientsToExcel = async (req, res) => {
  try {
    const XLSX = require('xlsx-js-style');
 
    // ── Fetch data ──────────────────────────────────────────────
    const clients = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
 
    const journeys = await Journey.find({
      clientId: { $in: clients.map(c => c._id) }
    }).lean();
 
    const journeyMap = {};
    journeys.forEach(j => {
      const completed  = (j.steps || []).filter(s => s.status === 'completed');
      const inProgress = (j.steps || []).find(s => s.status === 'in-progress');
      const last       = completed.length ? completed[completed.length - 1] : null;
      journeyMap[String(j.clientId)] = {
        step:  last?.step  ?? inProgress?.step  ?? '-',
        stage: last?.stage ?? inProgress?.stage ?? 'Not Started',
      };
    });
 
    // ── Palette ─────────────────────────────────────────────────
    const C = {
      TEAL:        '005670',
      TEAL_DARK:   '003D50',
      TEAL_LIGHT:  'E8F4F8',
      TEAL_MID:    'CCE8F0',
      PURPLE:      '6C3483',
      GREEN:       '117A65',
      BLUE:        '1A5276',
      AMBER:       '7D6608',
      WHITE:       'FFFFFF',
      GRAY_ROW:    'F0F8FB',
      GRAY_BORDER: 'D0D7DE',
      DARK:        '1A2937',
      GRAY_TEXT:   '6B7280',
    };
 
    // ── Helpers ──────────────────────────────────────────────────
    const border = (color = C.GRAY_BORDER) => ({
      top:    { style: 'thin', color: { rgb: color } },
      bottom: { style: 'thin', color: { rgb: color } },
      left:   { style: 'thin', color: { rgb: color } },
      right:  { style: 'thin', color: { rgb: color } },
    });
 
    const sc = (ws, r, c, s) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = s;
    };
 
    const merge = (ws, r1, c1, r2, c2) => {
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    };
 
    const sTitle = () => ({
      font:      { bold: true, sz: 14, color: { rgb: C.WHITE }, name: 'Arial' },
      fill:      { fgColor: { rgb: C.TEAL } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
 
    const sSub = () => ({
      font:      { italic: true, sz: 9, color: { rgb: C.TEAL }, name: 'Arial' },
      fill:      { fgColor: { rgb: C.TEAL_LIGHT } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
 
    const sGroup = (bg) => ({
      font:      { bold: true, sz: 9, color: { rgb: C.WHITE }, name: 'Arial' },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    border(bg),
    });
 
    const sColHeader = () => ({
      font:      { bold: true, sz: 9, color: { rgb: C.TEAL_DARK }, name: 'Arial' },
      fill:      { fgColor: { rgb: C.TEAL_MID } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border:    border(),
    });
 
    const sCell = (isAlt, extra = {}) => ({
      font:      { sz: 9, color: { rgb: C.DARK }, name: 'Arial', ...extra.font },
      fill:      { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
      alignment: { vertical: 'center', wrapText: true, ...extra.alignment },
      border:    border(),
    });
 
    const STATUS_COLORS = {
      'admin-created': { bg: 'DBEAFE', fg: '1E40AF' },
      'approved':      { bg: 'D1FAE5', fg: '065F46' },
      'pending':       { bg: 'FEF3C7', fg: '92400E' },
      'rejected':      { bg: 'FEE2E2', fg: '991B1B' },
    };
 
    const COLL_COLORS = {
      'Nalu (Client)':    C.GREEN,
      'Lani (Client)':    C.BLUE,
      'Nalu (Developer)': C.PURPLE,
      'Lani (Developer)': C.AMBER,
      'Custom':           'C0392B',
    };
 
    const now = new Date();
    const wb  = XLSX.utils.book_new();
 
    // ════════════════════════════════════════════════════════════
    //  SHEET 1 — CLIENT LIST
    // ════════════════════════════════════════════════════════════
    const COL_HEADERS = [
      'No.', 'Client Code', 'Full Name', 'Email', 'Phone',
      'Primary Unit', 'Floor Plan', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5',
      'Designer', 'Project Manager', 'PM Assistant', 'Designer Asst.',
      'Step', 'Journey Stage',
      'Collection', 'Bedrooms', 'Package', 'Property Type', 'Status', 'Registered'
    ];
 
    const COL_WIDTHS = [
      5, 14, 24, 28, 16,
      10, 20, 10, 10, 10, 10,
      22, 22, 18, 18,
      7, 24,
      20, 10, 12, 20, 14, 14
    ];
 
    const GROUPS = [
      { label: 'CLIENT INFO',          s: 0,  e: 2,  bg: C.TEAL      },
      { label: 'CONTACT',              s: 3,  e: 4,  bg: C.BLUE      },
      { label: 'PROPERTY',             s: 5,  e: 10, bg: C.GREEN     },
      { label: 'TEAM ASSIGNMENT',      s: 11, e: 14, bg: C.PURPLE    },
      { label: 'JOURNEY',              s: 15, e: 16, bg: C.AMBER     },
      { label: 'COLLECTION & PRICING', s: 17, e: 20, bg: C.BLUE      },
      { label: 'STATUS',               s: 21, e: 22, bg: C.TEAL_DARK },
    ];
 
    const row2groups = Array(COL_HEADERS.length).fill(null);
    GROUPS.forEach(g => { row2groups[g.s] = g.label; });
 
    const ws1aoa = [
      ['HENDERSON DESIGN GROUP — CLIENT MANAGEMENT REPORT', ...Array(COL_HEADERS.length - 1).fill(null)],
      [`Generated: ${now.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}  |  Henderson Design Group Admin Portal`, ...Array(COL_HEADERS.length - 1).fill(null)],
      row2groups,
      COL_HEADERS,
      ...clients.map((client, idx) => {
        const j = journeyMap[String(client._id)] || { step: '-', stage: 'Not Started' };
        return [
          idx + 1,
          client.clientCode || '',
          client.name || '',
          client.email || '',
          client.phoneNumber || '',
          client.unitNumber || '',
          client.floorPlan || '',
          client.unitNumber2 || '',
          client.unitNumber3 || '',
          client.unitNumber4 || '',
          client.unitNumber5 || '',
          client.teamAssignment?.designer || '',
          client.teamAssignment?.projectManager || '',
          client.teamAssignment?.projectManagerAssistant || '',
          client.teamAssignment?.designerAssistant || '',
          j.step,
          j.stage,
          client.collection || '',
          client.bedroomCount || '',
          client.packageType || '',
          client.propertyType || '',
          client.status || '',
          client.createdAt ? new Date(client.createdAt).toLocaleDateString('en-US') : '',
        ];
      }),
      [],
      ['REPORT SUMMARY', ...Array(COL_HEADERS.length - 1).fill(null)],
      ['Total Clients', clients.length],
      ['With Team Assigned', clients.filter(c => c.teamAssignment?.designer).length],
      ['Admin Created', clients.filter(c => c.status === 'admin-created').length],
      ['Pending Approval', clients.filter(c => c.status === 'pending').length],
    ];
 
    const ws1 = XLSX.utils.aoa_to_sheet(ws1aoa, { skipHeader: true });
    ws1['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));
    ws1['!rows'] = [
      { hpt: 36 }, { hpt: 20 }, { hpt: 22 }, { hpt: 30 },
      ...clients.map(() => ({ hpt: 22 })),
      { hpt: 8 }, { hpt: 24 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 },
    ];
 
    // Merges
    merge(ws1, 0, 0, 0, COL_HEADERS.length - 1);
    merge(ws1, 1, 0, 1, COL_HEADERS.length - 1);
    GROUPS.forEach(g => { if (g.e > g.s) merge(ws1, 2, g.s, 2, g.e); });
 
    // Row 0: title
    for (let c = 0; c < COL_HEADERS.length; c++) sc(ws1, 0, c, sTitle());
    // Row 1: subtitle
    for (let c = 0; c < COL_HEADERS.length; c++) sc(ws1, 1, c, sSub());
    // Row 2: group headers
    GROUPS.forEach(g => { for (let c = g.s; c <= g.e; c++) sc(ws1, 2, c, sGroup(g.bg)); });
    // Row 3: column headers
    COL_HEADERS.forEach((_, c) => sc(ws1, 3, c, sColHeader()));
 
    // Data rows
    clients.forEach((client, ri) => {
      const rowIdx = 4 + ri;
      const isAlt  = ri % 2 === 1;
 
      COL_HEADERS.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
        if (!ws1[addr]) return;
        ws1[addr].s = sCell(isAlt, {
          alignment: { horizontal: ci === 0 ? 'center' : 'left', vertical: 'center', wrapText: true }
        });
      });
 
      // Status badge (col 21)
      const statusAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 21 });
      const stc = STATUS_COLORS[client.status] || { bg: 'F3F4F6', fg: '374151' };
      if (ws1[statusAddr]) ws1[statusAddr].s = {
        font:      { bold: true, sz: 9, color: { rgb: stc.fg }, name: 'Arial' },
        fill:      { fgColor: { rgb: stc.bg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      };
 
      // Journey step bold teal (col 15)
      const stepAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 15 });
      if (ws1[stepAddr]) ws1[stepAddr].s = {
        font:      { bold: true, sz: 10, color: { rgb: C.TEAL }, name: 'Arial' },
        fill:      { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      };
    });
 
    // Summary section
    const sumStart = 4 + clients.length + 1;
    for (let c = 0; c < COL_HEADERS.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: sumStart, c });
      if (!ws1[addr]) ws1[addr] = { t: 's', v: '' };
      ws1[addr].s = {
        font:      { bold: true, sz: 10, color: { rgb: C.WHITE }, name: 'Arial' },
        fill:      { fgColor: { rgb: C.TEAL } },
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border:    border(C.TEAL),
      };
    }
    merge(ws1, sumStart, 0, sumStart, COL_HEADERS.length - 1);
 
    [sumStart + 1, sumStart + 2, sumStart + 3, sumStart + 4].forEach((r, i) => {
      const isAlt = i % 2 === 1;
      const la = XLSX.utils.encode_cell({ r, c: 0 });
      const va = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws1[la]) ws1[la].s = {
        font:  { bold: true, sz: 9, color: { rgb: C.TEAL }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.TEAL_LIGHT } },
        alignment: { vertical: 'center', indent: 1 },
        border: border(),
      };
      if (ws1[va]) ws1[va].s = {
        font:  { bold: true, sz: 12, color: { rgb: C.TEAL_DARK }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.TEAL_LIGHT } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: border(),
      };
    });
 
    XLSX.utils.book_append_sheet(wb, ws1, 'Client List');
 
    // ════════════════════════════════════════════════════════════
    //  SHEET 2 — SUMMARY
    // ════════════════════════════════════════════════════════════
    const collCounts = {};
    const desCounts  = {};
    const statCounts = {};
    clients.forEach(c => {
      const key = c.collection || 'Unset';
      collCounts[key] = (collCounts[key] || 0) + 1;
      if (c.teamAssignment?.designer) desCounts[c.teamAssignment.designer] = (desCounts[c.teamAssignment.designer] || 0) + 1;
      statCounts[c.status || 'unknown'] = (statCounts[c.status || 'unknown'] || 0) + 1;
    });
 
    const ws2aoa = [
      ['CLIENT SUMMARY DASHBOARD', null, null, null],
      [`Report Date: ${now.toLocaleDateString('en-US', { dateStyle: 'long' })}`, null, null, null],
      [],
      ['OVERVIEW', null, 'Value', null],
      ['Total Clients',      null, clients.length, null],
      ['With Team Assigned', null, clients.filter(c => c.teamAssignment?.designer).length, null],
      ['Without Team',       null, clients.filter(c => !c.teamAssignment?.designer).length, null],
      ['Admin Created',      null, statCounts['admin-created'] || 0, null],
      ['Pending Approval',   null, statCounts['pending'] || 0, null],
      ['Approved',           null, statCounts['approved'] || 0, null],
      [],
      ['COLLECTION BREAKDOWN', null, 'Count', 'Percentage'],
      ...Object.entries(collCounts).map(([k, v]) => [
        k, null, v,
        clients.length ? `${((v / clients.length) * 100).toFixed(1)}%` : '0%'
      ]),
      [],
      ['DESIGNER WORKLOAD', null, 'Clients', null],
      ...Object.entries(desCounts).sort((a,b) => b[1]-a[1]).map(([k,v]) => [k, null, v, null]),
    ];
 
    const ws2 = XLSX.utils.aoa_to_sheet(ws2aoa, { skipHeader: true });
    ws2['!cols'] = [{ wch: 26 }, { wch: 4 }, { wch: 14 }, { wch: 14 }];
    ws2['!rows'] = [{ hpt: 36 }, { hpt: 20 }];
 
    // Title & subtitle
    for (let c = 0; c < 4; c++) { sc(ws2, 0, c, sTitle()); sc(ws2, 1, c, sSub()); }
    merge(ws2, 0, 0, 0, 3);
    merge(ws2, 1, 0, 1, 3);
 
    // Section headers
    const collEnd = 11 + Object.keys(collCounts).length;
    [3, 11, collEnd + 1].forEach(r => {
      for (let c = 0; c < 4; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws2[addr]) ws2[addr] = { t: 's', v: '' };
        ws2[addr].s = sGroup(C.TEAL);
      }
      merge(ws2, r, 0, r, 1);
    });
 
    // KPI rows
    [4,5,6,7,8,9].forEach((r, i) => {
      const isAlt = i % 2 === 1;
      const la = XLSX.utils.encode_cell({ r, c: 0 });
      const va = XLSX.utils.encode_cell({ r, c: 2 });
      if (ws2[la]) ws2[la].s = {
        font:  { sz: 10, color: { rgb: C.DARK }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
        alignment: { vertical: 'center', indent: 1 },
        border: border(),
      };
      if (ws2[va]) ws2[va].s = {
        font:  { bold: true, sz: 14, color: { rgb: C.TEAL }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: border(),
      };
      merge(ws2, r, 0, r, 1);
      merge(ws2, r, 2, r, 3);
    });
 
    // Collection rows
    Object.entries(collCounts).forEach(([key, val], i) => {
      const r     = 12 + i;
      const color = COLL_COLORS[key] || '555555';
      const la    = XLSX.utils.encode_cell({ r, c: 0 });
      const va    = XLSX.utils.encode_cell({ r, c: 2 });
      const pa    = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws2[la]) ws2[la].s = {
        font:  { bold: true, sz: 10, color: { rgb: C.WHITE }, name: 'Arial' },
        fill:  { fgColor: { rgb: color } },
        alignment: { vertical: 'center', indent: 1 },
        border: border(color),
      };
      if (ws2[va]) ws2[va].s = {
        font:  { bold: true, sz: 12, color: { rgb: color }, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: border(),
      };
      if (ws2[pa]) ws2[pa].s = {
        font:  { sz: 9, color: { rgb: C.GRAY_TEXT }, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: border(),
      };
      merge(ws2, r, 0, r, 1);
    });
 
    // Designer rows
    Object.entries(desCounts).sort((a,b) => b[1]-a[1]).forEach(([name, count], i) => {
      const r  = collEnd + 2 + i;
      const la = XLSX.utils.encode_cell({ r, c: 0 });
      const va = XLSX.utils.encode_cell({ r, c: 2 });
      const isAlt = i % 2 === 1;
      if (ws2[la]) ws2[la].s = {
        font:  { sz: 10, color: { rgb: C.DARK }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
        alignment: { vertical: 'center', indent: 1 },
        border: border(),
      };
      if (ws2[va]) ws2[va].s = {
        font:  { bold: true, sz: 12, color: { rgb: C.PURPLE }, name: 'Arial' },
        fill:  { fgColor: { rgb: isAlt ? C.GRAY_ROW : C.WHITE } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: border(),
      };
      merge(ws2, r, 0, r, 1);
      merge(ws2, r, 2, r, 3);
    });
 
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
 
    // ════════════════════════════════════════════════════════════
    //  SHEET 3 — TEAM ROSTER
    // ════════════════════════════════════════════════════════════
    const TEAM_ROSTER = [
      { name: 'Joanna Staniszewski', role: 'Designer',             field: 'designer'               },
      { name: 'Janelle Balci',       role: 'Designer',             field: 'designer'               },
      { name: 'Ash Agustin',         role: 'Designer',             field: 'designer'               },
      { name: 'Benny Kristanto',     role: 'Designer Assistant',   field: 'designerAssistant'      },
      { name: 'Madeline Clifford',   role: 'Project Manager',      field: 'projectManager'         },
      { name: 'Daiki Matsumaru',     role: 'Project Manager',      field: 'projectManager'         },
      { name: 'Savanna Gonzales',    role: 'Project Manager',      field: 'projectManager'         },
      { name: 'Haley Spitz',         role: 'PM Assistant',         field: 'projectManagerAssistant'},
      { name: 'Florence Sosrita',    role: 'PM Assistant',         field: 'projectManagerAssistant'},
    ];
 
    const ROLE_COLORS = {
      'Designer':           { bg: 'F5EEF8', accent: C.PURPLE },
      'Designer Assistant': { bg: 'EBF5FB', accent: C.BLUE   },
      'Project Manager':    { bg: 'EAF2FF', accent: C.BLUE   },
      'PM Assistant':       { bg: 'E9F7EF', accent: C.GREEN  },
    };
 
    const ws3aoa = [
      ['TEAM ASSIGNMENT ROSTER', null, null, null, null],
      ['Team Member', 'Role', 'Clients', 'Client Names (Unit)', 'Notes'],
      ...TEAM_ROSTER.map(m => {
        const assigned = clients.filter(c => c.teamAssignment?.[m.field] === m.name);
        return [
          m.name, m.role, assigned.length,
          assigned.map(c => `${c.name} (${c.unitNumber})`).join(', '),
          ''
        ];
      }),
    ];
 
    const ws3 = XLSX.utils.aoa_to_sheet(ws3aoa, { skipHeader: true });
    ws3['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 10 }, { wch: 55 }, { wch: 20 }];
    ws3['!rows'] = [{ hpt: 36 }, { hpt: 28 }, ...TEAM_ROSTER.map(() => ({ hpt: 24 }))];
 
    // Title row
    for (let c = 0; c < 5; c++) sc(ws3, 0, c, sGroup(C.PURPLE));
    merge(ws3, 0, 0, 0, 4);
 
    // Header row
    for (let c = 0; c < 5; c++) sc(ws3, 1, c, {
      font:      { bold: true, sz: 10, color: { rgb: C.WHITE }, name: 'Arial' },
      fill:      { fgColor: { rgb: C.PURPLE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border:    border(C.WHITE),
    });
 
    // Data rows
    TEAM_ROSTER.forEach((m, ri) => {
      const r  = 2 + ri;
      const rc = ROLE_COLORS[m.role] || { bg: C.WHITE, accent: C.TEAL };
 
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws3[addr]) ws3[addr] = { t: 's', v: '' };
        ws3[addr].s = {
          font:      { sz: 9, color: { rgb: C.DARK }, name: 'Arial' },
          fill:      { fgColor: { rgb: rc.bg } },
          alignment: { vertical: 'center', wrapText: true },
          border:    border(),
        };
      }
      // Name col — bold
      const na = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws3[na]) ws3[na].s.font = { bold: true, sz: 9, color: { rgb: C.DARK }, name: 'Arial' };
      // Role col — colored badge style
      const ra = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws3[ra]) ws3[ra].s = {
        font:      { bold: true, sz: 9, color: { rgb: rc.accent }, name: 'Arial' },
        fill:      { fgColor: { rgb: rc.bg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      };
      // Count col — large number
      const ca = XLSX.utils.encode_cell({ r, c: 2 });
      if (ws3[ca]) ws3[ca].s = {
        font:      { bold: true, sz: 14, color: { rgb: rc.accent }, name: 'Arial' },
        fill:      { fgColor: { rgb: rc.bg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      };
    });
 
    XLSX.utils.book_append_sheet(wb, ws3, 'Team Roster');
 
    // ── Stream response ──────────────────────────────────────────
    const dateStr     = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
 
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=HDG_ClientReport_${dateStr}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
 
  } catch (error) {
    console.error('❌ Export clients error:', error);
    res.status(500).json({ success: false, message: 'Failed to export clients', error: error.message });
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
  recordPayment,
  exportClientsToExcel
};