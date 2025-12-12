// controllers/agreementController.js
const User = require('../models/User');

/**
 * Generate Agreement (Design Fee or Deposit to Hold)
 * POST /api/agreements/generate/:clientId/:agreementType
 */
exports.generateAgreement = async (req, res) => {
  try {
    const { clientId, agreementType } = req.params;

    // Validate agreement type
    if (!['design-fee', 'deposit-hold'].includes(agreementType)) {
      return res.status(400).json({ message: 'Invalid agreement type' });
    }

    // Get client
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check if agreement already exists
    const existingAgreement = client.agreements?.find(
      a => a.agreementType === agreementType
    );

    if (existingAgreement) {
      return res.status(400).json({ 
        message: `${agreementType === 'design-fee' ? 'Design Fee Agreement' : 'Deposit to Hold'} already exists`,
        agreement: existingAgreement
      });
    }

    // Generate agreement number
    const agreementCount = (client.agreements?.length || 0) + 1;
    const agreementNumber = `${client.clientCode || 'AGR'}-${String(agreementCount).padStart(2, '0')}`;

    // Get collection and bedroom info from client
    const collection = client.collection || 'Nalu';
    const bedroomCount = client.bedroomCount || '1';

    // Calculate amounts based on agreement type
    let amount = 5000; // Design fee default
    let packageDescription = `Client has a ${bedroomCount} bedroom unit and would like to proceed with a ${collection} package.`;

    if (agreementType === 'deposit-hold') {
      // Get total package amount from client or calculate
      // For now, using example amount
      const totalPackage = client.totalPackageAmount || 87780.20;
      const depositPercentage = 0.30; // 30%
      const designFee = 5000;
      
      amount = (totalPackage * depositPercentage);
      packageDescription = `Client has a ${bedroomCount} bedroom unit and would like to proceed with a ${collection} package. (Lani, Nalu, Foundation).`;
    }

    // Create agreement object
    const newAgreement = {
      agreementNumber,
      agreementType,
      effectiveDate: new Date(),
      clientName: client.name || `${client.firstName} ${client.lastName}`,
      unitNumber: client.unitNumber || '',
      invoiceNumber: client.clientCode || '',
      packageDescription,
      amount,
      collection,
      bedroomCount,
      generatedAt: new Date(),
      status: 'generated'
    };

    // Add to client agreements array
    if (!client.agreements) {
      client.agreements = [];
    }
    client.agreements.push(newAgreement);

    await client.save();

    res.json({
      success: true,
      message: 'Agreement generated successfully',
      agreement: newAgreement
    });

  } catch (error) {
    console.error('Generate agreement error:', error);
    res.status(500).json({ 
      message: 'Failed to generate agreement',
      error: error.message
    });
  }
};

/**
 * Get all agreements for a client
 * GET /api/agreements/client/:clientId
 */
exports.getClientAgreements = async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({
      success: true,
      agreements: client.agreements || []
    });

  } catch (error) {
    console.error('Get agreements error:', error);
    res.status(500).json({ 
      message: 'Failed to get agreements',
      error: error.message
    });
  }
};

/**
 * Get agreement data
 * GET /api/agreements/data/:clientId/:agreementNumber
 */
exports.getAgreementData = async (req, res) => {
  try {
    const { clientId, agreementNumber } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const agreement = client.agreements?.find(
      a => a.agreementNumber === agreementNumber
    );

    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' });
    }

    res.json({
      success: true,
      agreement,
      client: {
        name: client.name || `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
        unitNumber: client.unitNumber
      }
    });

  } catch (error) {
    console.error('Get agreement data error:', error);
    res.status(500).json({ 
      message: 'Failed to get agreement data',
      error: error.message
    });
  }
};

/**
 * Delete agreement
 * DELETE /api/agreements/client/:clientId/:agreementNumber
 */
exports.deleteAgreement = async (req, res) => {
  try {
    const { clientId, agreementNumber } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const agreementIndex = client.agreements?.findIndex(
      a => a.agreementNumber === agreementNumber
    );

    if (agreementIndex === -1) {
      return res.status(404).json({ message: 'Agreement not found' });
    }

    client.agreements.splice(agreementIndex, 1);
    await client.save();

    res.json({
      success: true,
      message: 'Agreement deleted successfully'
    });

  } catch (error) {
    console.error('Delete agreement error:', error);
    res.status(500).json({ 
      message: 'Failed to delete agreement',
      error: error.message
    });
  }
};