// controllers/quickbooksController.js - FIXED without req.session
const { quickbooksClient, QUICKBOOKS_CONFIG } = require('../utils/quickbooksClient');
const QuickBooksToken = require('../models/QuickBooksToken');
const User = require('../models/User');
const axios = require('axios');
const crypto = require('crypto');

// Simple in-memory state storage for OAuth (development)
// In production, consider using Redis
const oauthStates = new Map();

/**
 * Load tokens from database and set in client
 * Call this on server start and before each API call
 */
const loadTokensFromDatabase = async () => {
  try {
    const token = await QuickBooksToken.findOne();
    
    if (!token) {
      console.log('No QuickBooks tokens found in database');
      return false;
    }

    const isRefreshTokenExpired = new Date() >= token.refreshTokenExpiresAt;
    
    if (isRefreshTokenExpired) {
      console.log('QuickBooks refresh token expired, need to reconnect');
      return false;
    }

    // Set tokens in client
    const expiresIn = Math.floor((token.expiresAt - new Date()) / 1000);
    quickbooksClient.setTokens(
      token.accessToken,
      token.refreshToken,
      token.realmId,
      expiresIn
    );

    // Check if access token expired, refresh if needed
    const isAccessTokenExpired = new Date() >= token.expiresAt;
    
    if (isAccessTokenExpired) {
      console.log('Access token expired, refreshing...');
      await quickbooksClient.refreshAccessToken();
      
      // Update database with new tokens
      token.accessToken = quickbooksClient.accessToken;
      token.refreshToken = quickbooksClient.refreshToken;
      token.expiresAt = quickbooksClient.tokenExpiry;
      await token.save();
      
      console.log('Access token refreshed successfully');
    }

    console.log('QuickBooks tokens loaded from database');
    return true;
  } catch (error) {
    console.error('Error loading tokens from database:', error);
    return false;
  }
};

/**
 * Clean up expired OAuth states (older than 10 minutes)
 */
const cleanupExpiredStates = () => {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > tenMinutes) {
      oauthStates.delete(state);
    }
  }
};

/**
 * Initiate QuickBooks OAuth
 * GET /api/quickbooks/connect
 */
const connectQuickBooks = async (req, res) => {
  try {
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state with timestamp
    oauthStates.set(state, {
      userId: req.user?._id?.toString() || 'anonymous',
      timestamp: Date.now()
    });
    
    // Clean up old states
    cleanupExpiredStates();
    
    // Get OAuth URL
    const authUrl = quickbooksClient.getAuthorizationUrl(state);
    
    console.log('QuickBooks OAuth initiated:', { state, authUrl });
    
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('QuickBooks connect error:', error);
    res.status(500).json({ 
      message: 'Failed to initiate QuickBooks connection', 
      error: error.message 
    });
  }
};

/**
 * OAuth Callback Handler
 * GET /api/quickbooks/callback
 */
const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, realmId, error: oauthError } = req.query;

    console.log('QuickBooks callback received:', { code: !!code, state, realmId, oauthError });

    // Check for OAuth errors
    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=${encodeURIComponent(oauthError)}`);
    }

    // Validate state to prevent CSRF
    const stateData = oauthStates.get(state);
    if (!stateData) {
      console.error('Invalid or expired state:', state);
      return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=invalid_state`);
    }

    // Remove used state
    oauthStates.delete(state);

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=no_code`);
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokens = await quickbooksClient.getTokensFromCode(code);

    // Set tokens in client
    quickbooksClient.setTokens(
      tokens.accessToken,
      tokens.refreshToken,
      realmId,
      tokens.expiresIn
    );

    // Save tokens to database
    await QuickBooksToken.findOneAndUpdate(
      {},
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        realmId: realmId,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000)
      },
      { upsert: true, new: true }
    );

    console.log('QuickBooks connected successfully:', { realmId });

    // Redirect to success page
    res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?qb_connected=true`);

  } catch (error) {
    console.error('QuickBooks callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Get QuickBooks Connection Status
 * GET /api/quickbooks/status
 */
const getConnectionStatus = async (req, res) => {
  try {
    // ALWAYS load tokens from database first
    await loadTokensFromDatabase();
    
    const token = await QuickBooksToken.findOne();
    
    if (!token) {
      return res.json({
        connected: false,
        message: 'QuickBooks not connected'
      });
    }

    const isExpired = new Date() >= token.expiresAt;
    const isRefreshTokenExpired = new Date() >= token.refreshTokenExpiresAt;

    if (isRefreshTokenExpired) {
      return res.json({
        connected: false,
        message: 'QuickBooks connection expired. Please reconnect.',
        needsReconnect: true
      });
    }

    res.json({
      connected: true,
      realmId: token.realmId,
      expiresAt: token.expiresAt,
      message: 'QuickBooks connected'
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ 
      connected: false,
      message: 'Failed to get connection status', 
      error: error.message 
    });
  }
};

/**
 * Disconnect QuickBooks
 * POST /api/quickbooks/disconnect
 */
const disconnectQuickBooks = async (req, res) => {
  try {
    // Remove tokens from database
    await QuickBooksToken.deleteMany({});
    
    // Clear client tokens
    quickbooksClient.accessToken = null;
    quickbooksClient.refreshToken = null;
    quickbooksClient.realmId = null;
    quickbooksClient.tokenExpiry = null;

    console.log('QuickBooks disconnected successfully');

    res.json({
      success: true,
      message: 'QuickBooks disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ 
      message: 'Failed to disconnect QuickBooks', 
      error: error.message 
    });
  }
};

/**
 * Test QuickBooks Connection
 * GET /api/quickbooks/test
 */
const testConnection = async (req, res) => {
  try {
    if (!quickbooksClient.accessToken) {
      return res.status(400).json({ 
        success: false,
        message: 'QuickBooks not connected' 
      });
    }

    // Try to query company info
    const url = `${QUICKBOOKS_CONFIG.environment === 'production' 
      ? 'https://quickbooks.api.intuit.com' 
      : 'https://sandbox-quickbooks.api.intuit.com'}/v3/company/${quickbooksClient.realmId}/companyinfo/${quickbooksClient.realmId}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${quickbooksClient.accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('Connection test successful');

    res.json({
      success: true,
      connected: true,
      companyInfo: response.data.CompanyInfo
    });

  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Connection test failed', 
      error: error.response?.data || error.message
    });
  }
};

/**
 * Sync Invoice to QuickBooks
 * POST /api/quickbooks/sync-invoice/:clientId/:invoiceNumber
 */
const syncInvoiceToQuickBooks = async (req, res) => {
  try {
    const { clientId, invoiceNumber } = req.params;

    // CRITICAL: Load tokens from database first!
    const tokensLoaded = await loadTokensFromDatabase();
    
    if (!tokensLoaded) {
      return res.status(400).json({ 
        message: 'QuickBooks not connected. Please connect first.',
        needsReconnect: true
      });
    }

    // Now check if client has tokens
    if (!quickbooksClient.accessToken || !quickbooksClient.realmId) {
      return res.status(400).json({ 
        message: 'QuickBooks not connected. Please connect first.' 
      });
    }

    // 2. Get client and invoice from database
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const invoice = client.invoices?.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // 3. Check if already synced
    if (invoice.quickbooksSyncStatus === 'synced') {
      return res.status(400).json({ 
        message: 'Invoice already synced to QuickBooks',
        quickbooksId: invoice.quickbooksId
      });
    }

    // 4. Get or create customer in QuickBooks
    let customerId = client.quickbooksCustomerId;
    
    if (!customerId) {
      console.log('Creating customer in QuickBooks...');
      
      const customerData = {
        name: client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client',
        email: client.email,
        phone: client.phone,
        unitNumber: client.unitNumber,
        clientCode: client.clientCode
      };

      const qbCustomer = await quickbooksClient.getOrCreateCustomer(customerData);
      customerId = qbCustomer.Id;
      
      // Save customer ID to client
      client.quickbooksCustomerId = customerId;
      await client.save();
      
      console.log('Customer created:', customerId);
    }

    // 5. Create invoice in QuickBooks
    console.log('Creating invoice in QuickBooks...');
    
    // FIX: Safe date handling
    const formatDate = (date) => {
      if (!date) return new Date().toISOString().split('T')[0];
      try {
        return new Date(date).toISOString().split('T')[0];
      } catch (error) {
        return new Date().toISOString().split('T')[0];
      }
    };

    const invoiceData = {
      customerId: customerId,
      invoiceNumber: invoice.invoiceNumber,
      amount: (invoice.invoiceAmount || 0) + (invoice.taxAmount || 0) + 0.06,
      description: `Design Fee Invoice (${invoice.currentPercentage || 0}%) - ${invoice.collection || 'Nalu'} - ${invoice.bedroomCount || '1'} Bedroom Package`,
      invoiceDate: formatDate(invoice.invoiceDate),
      dueDate: formatDate(invoice.dueDate),
      memo: 'Thank you for your business!'
    };

    const qbInvoice = await quickbooksClient.createInvoice(invoiceData);
    const qbInvoiceId = qbInvoice.Id;

    console.log('Invoice created in QuickBooks:', qbInvoiceId);

    // 6. Update invoice in database
    const invoiceIndex = client.invoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);
    client.invoices[invoiceIndex].quickbooksSyncStatus = 'synced';
    client.invoices[invoiceIndex].quickbooksId = qbInvoiceId;
    client.invoices[invoiceIndex].quickbooksSyncedAt = new Date();

    await client.save();

    // 7. Return success
    res.json({
      success: true,
      message: 'Invoice synced to QuickBooks successfully',
      quickbooksId: qbInvoiceId,
      invoiceNumber: invoiceNumber
    });

  } catch (error) {
    console.error('Sync invoice error:', error);
    
    // FIX: Update invoice status to 'pending' instead of 'error'
    try {
      const client = await User.findById(req.params.clientId);
      const invoiceIndex = client.invoices?.findIndex(inv => inv.invoiceNumber === req.params.invoiceNumber);
      if (invoiceIndex !== -1) {
        client.invoices[invoiceIndex].quickbooksSyncStatus = 'pending'; // Changed from 'error'
        client.invoices[invoiceIndex].quickbooksSyncError = error.message;
        await client.save();
      }
    } catch (updateError) {
      console.error('Failed to update invoice error status:', updateError);
    }

    res.status(500).json({ 
      message: 'Failed to sync invoice to QuickBooks',
      error: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message
    });
  }
};

module.exports = {
  connectQuickBooks,
  handleOAuthCallback,
  getConnectionStatus,
  disconnectQuickBooks,
  testConnection,
  syncInvoiceToQuickBooks,
  loadTokensFromDatabase
};