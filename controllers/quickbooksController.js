// controllers/quickbooksController.js
const { quickbooksClient, QUICKBOOKS_CONFIG } = require('../utils/quickbooksClient');
const QuickBooksToken = require('../models/QuickBooksToken');
const User    = require('../models/User');
const Expense = require('../models/Expense');
const Order   = require('../models/Order');
const POVersion = require('../models/POVersion');
const ProposalVersion = require('../models/ProposalVersion');
const axios   = require('axios');
const crypto  = require('crypto');

// Simple in-memory state storage for OAuth (development)
const oauthStates = new Map();

// ─── Load tokens from DB ──────────────────────────────────────────────────────
const loadTokensFromDatabase = async () => {
  try {
    const token = await QuickBooksToken.findOne();
    if (!token) { console.log('No QuickBooks tokens found in database'); return false; }

    const isRefreshTokenExpired = new Date() >= token.refreshTokenExpiresAt;
    if (isRefreshTokenExpired) { console.log('QB refresh token expired, need to reconnect'); return false; }

    const expiresIn = Math.floor((token.expiresAt - new Date()) / 1000);
    quickbooksClient.setTokens(token.accessToken, token.refreshToken, token.realmId, expiresIn);

    const isAccessTokenExpired = new Date() >= token.expiresAt;
    if (isAccessTokenExpired) {
      console.log('Access token expired, refreshing...');
      await quickbooksClient.refreshAccessToken();
      token.accessToken  = quickbooksClient.accessToken;
      token.refreshToken = quickbooksClient.refreshToken;
      token.expiresAt    = quickbooksClient.tokenExpiry;
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

// ─── Clean expired OAuth states ───────────────────────────────────────────────
const cleanupExpiredStates = () => {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > tenMinutes) oauthStates.delete(state);
  }
};

// ─── Connect ─────────────────────────────────────────────────────────────────
const connectQuickBooks = async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, { userId: req.user?._id?.toString() || 'anonymous', timestamp: Date.now() });
    cleanupExpiredStates();
    const authUrl = quickbooksClient.getAuthorizationUrl(state);
    console.log('QuickBooks OAuth initiated:', { state, authUrl });
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('QuickBooks connect error:', error);
    res.status(500).json({ message: 'Failed to initiate QuickBooks connection', error: error.message });
  }
};

// ─── OAuth Callback ───────────────────────────────────────────────────────────
const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, realmId, error: oauthError } = req.query;
    console.log('QuickBooks callback received:', { code: !!code, state, realmId, oauthError });

    if (oauthError) return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=${encodeURIComponent(oauthError)}`);

    const stateData = oauthStates.get(state);
    if (!stateData) { console.error('Invalid or expired state:', state); return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=invalid_state`); }
    oauthStates.delete(state);

    if (!code) return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=no_code`);

    console.log('Exchanging code for tokens...');
    const tokens = await quickbooksClient.getTokensFromCode(code);
    quickbooksClient.setTokens(tokens.accessToken, tokens.refreshToken, realmId, tokens.expiresIn);

    await QuickBooksToken.findOneAndUpdate(
      {},
      {
        accessToken:           tokens.accessToken,
        refreshToken:          tokens.refreshToken,
        realmId,
        expiresAt:             new Date(Date.now() + tokens.expiresIn * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000),
      },
      { upsert: true, new: true }
    );

    console.log('QuickBooks connected successfully:', { realmId });
    res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?qb_connected=true`);
  } catch (error) {
    console.error('QuickBooks callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=${encodeURIComponent(error.message)}`);
  }
};

// ─── Status ───────────────────────────────────────────────────────────────────
const getConnectionStatus = async (req, res) => {
  try {
    await loadTokensFromDatabase();
    const token = await QuickBooksToken.findOne();
    if (!token) return res.json({ connected: false, message: 'QuickBooks not connected' });

    const isRefreshTokenExpired = new Date() >= token.refreshTokenExpiresAt;
    if (isRefreshTokenExpired) return res.json({ connected: false, message: 'QB connection expired. Please reconnect.', needsReconnect: true });

    res.json({ connected: true, realmId: token.realmId, expiresAt: token.expiresAt, message: 'QuickBooks connected' });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ connected: false, message: 'Failed to get connection status', error: error.message });
  }
};

// ─── Disconnect ───────────────────────────────────────────────────────────────
const disconnectQuickBooks = async (req, res) => {
  try {
    await QuickBooksToken.deleteMany({});
    quickbooksClient.accessToken  = null;
    quickbooksClient.refreshToken = null;
    quickbooksClient.realmId      = null;
    quickbooksClient.tokenExpiry  = null;
    console.log('QuickBooks disconnected successfully');
    res.json({ success: true, message: 'QuickBooks disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ message: 'Failed to disconnect QuickBooks', error: error.message });
  }
};

// ─── Test ─────────────────────────────────────────────────────────────────────
const testConnection = async (req, res) => {
  try {
    if (!quickbooksClient.accessToken) return res.status(400).json({ success: false, message: 'QuickBooks not connected' });

    const url = `${QUICKBOOKS_CONFIG.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com'}/v3/company/${quickbooksClient.realmId}/companyinfo/${quickbooksClient.realmId}`;

    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${quickbooksClient.accessToken}`, 'Accept': 'application/json' }
    });

    res.json({ success: true, connected: true, companyInfo: response.data.CompanyInfo });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ success: false, message: 'Connection test failed', error: error.response?.data || error.message });
  }
};

// ─── Sync existing client Invoice → QB ───────────────────────────────────────
const syncInvoiceToQuickBooks = async (req, res) => {
  try {
    const { clientId, invoiceNumber } = req.params;
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected. Please connect first.', needsReconnect: true });
    if (!quickbooksClient.accessToken || !quickbooksClient.realmId) return res.status(400).json({ message: 'QuickBooks not connected.' });

    const client = await User.findById(clientId);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const invoice = client.invoices?.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.quickbooksSyncStatus === 'synced') return res.status(400).json({ message: 'Invoice already synced to QuickBooks', quickbooksId: invoice.quickbooksId });

    let customerId = client.quickbooksCustomerId;
    if (!customerId) {
      const customerData = {
        name: client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client',
        email: client.email, phone: client.phone, unitNumber: client.unitNumber, clientCode: client.clientCode
      };
      const qbCustomer = await quickbooksClient.getOrCreateCustomer(customerData);
      customerId = qbCustomer.Id;
      client.quickbooksCustomerId = customerId;
      await client.save();
    }

    const formatDate = (date) => {
      if (!date) return new Date().toISOString().split('T')[0];
      try { return new Date(date).toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; }
    };

    const qbInvoice = await quickbooksClient.createInvoice({
      customerId,
      invoiceNumber: invoice.invoiceNumber,
      amount:        (invoice.invoiceAmount || 0) + (invoice.taxAmount || 0) + 0.06,
      description:   `Design Fee Invoice (${invoice.currentPercentage || 0}%) - ${invoice.collection || 'Nalu'} - ${invoice.bedroomCount || '1'} Bedroom Package`,
      invoiceDate:   formatDate(invoice.invoiceDate),
      dueDate:       formatDate(invoice.dueDate),
      memo:          'Thank you for your business!',
    });

    const invoiceIndex = client.invoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);
    client.invoices[invoiceIndex].quickbooksSyncStatus = 'synced';
    client.invoices[invoiceIndex].quickbooksId         = qbInvoice.Id;
    client.invoices[invoiceIndex].quickbooksSyncedAt   = new Date();
    await client.save();

    res.json({ success: true, message: 'Invoice synced to QuickBooks successfully', quickbooksId: qbInvoice.Id, invoiceNumber });
  } catch (error) {
    console.error('Sync invoice error:', error);
    try {
      const client = await User.findById(req.params.clientId);
      const invoiceIndex = client.invoices?.findIndex(inv => inv.invoiceNumber === req.params.invoiceNumber);
      if (invoiceIndex !== -1) {
        client.invoices[invoiceIndex].quickbooksSyncStatus = 'pending';
        client.invoices[invoiceIndex].quickbooksSyncError  = error.message;
        await client.save();
      }
    } catch (updateError) { console.error('Failed to update invoice error status:', updateError); }
    res.status(500).json({ message: 'Failed to sync invoice to QuickBooks', error: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Sync Expense → QB Invoice ────────────────────────────────────────────────
// POST /api/quickbooks/sync-expense/:expenseId
// Only confirmed or paid expenses can be synced
const syncExpenseToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected. Please connect first.', needsReconnect: true });

    const expense = await Expense.findById(req.params.expenseId).lean();
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (expense.status !== 'confirmed' && expense.status !== 'paid') {
      return res.status(400).json({ message: 'Only confirmed or paid expenses can be synced to QuickBooks' });
    }
    if (expense.quickbooksId) {
      return res.status(400).json({ message: 'Already synced to QuickBooks', quickbooksId: expense.quickbooksId });
    }

    // Get or create QB customer
    const customer = await quickbooksClient.getOrCreateCustomer({
      name:       expense.clientInfo?.name  || 'Unknown Client',
      email:      expense.clientInfo?.email || '',
      unitNumber: expense.clientInfo?.unitNumber || '',
      clientCode: expense.expenseNumber,
    });

    // Compute total
    const subtotal = (expense.lines || []).reduce((s, l) => s + parseFloat(l.amount || 0), 0);
    const taxes    = subtotal * (parseFloat(expense.taxRate || 0) / 100);
    const total    = subtotal + taxes;

    // Build description from line items
    const description = (expense.lines || []).map(l => {
      const parts = [];
      if (l.personName)  parts.push(l.personName);
      if (l.description) parts.push(l.description);
      return parts.join(' — ');
    }).filter(Boolean).join('\n') || expense.projectName || 'Time & Expenses';

    const qbInvoice = await quickbooksClient.createInvoice({
      customerId:    customer.Id,
      invoiceNumber: expense.expenseNumber,
      amount:        total,
      description,
      invoiceDate:   expense.expenseDate || new Date().toISOString().split('T')[0],
      memo:          `Project: ${expense.projectName || ''} | Ref: ${expense.expenseNumber}`,
    });

    // Save QB ID back to Expense
    await Expense.findByIdAndUpdate(req.params.expenseId, {
      quickbooksId:       qbInvoice.Id,
      quickbooksSyncedAt: new Date(),
      quickbooksStatus:   'synced',
    });

    console.log(`✅ Expense ${expense.expenseNumber} → QB Invoice ${qbInvoice.Id}`);
    res.json({ success: true, message: 'Expense synced to QuickBooks as Invoice', quickbooksId: qbInvoice.Id });

  } catch (error) {
    console.error('syncExpenseToQuickBooks error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Sync PO → QB Bill ────────────────────────────────────────────────────────
// POST /api/quickbooks/sync-po/:poVersionId
// Only confirmed POVersions can be synced
const syncPOToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected. Please connect first.', needsReconnect: true });

    const po = await POVersion.findById(req.params.poVersionId).lean();
    if (!po) return res.status(404).json({ message: 'PO not found' });

    if (po.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed POs can be synced to QuickBooks' });
    }
    if (po.quickbooksId) {
      return res.status(400).json({ message: 'Already synced to QuickBooks', quickbooksId: po.quickbooksId });
    }

    // Get or create QB vendor
    const vendorName = po.vendorInfo?.name || 'Unknown Vendor';
    const vendor     = await quickbooksClient.getOrCreateVendor(vendorName);

    // Build bill lines from PO products
    const lines = (po.products || [])
      .map(p => ({
        amount:      parseFloat(p.totalPrice) || 0,
        description: [p.name, p.description].filter(Boolean).join(' — ') || 'Product',
      }))
      .filter(l => l.amount > 0);

    if (lines.length === 0) {
      return res.status(400).json({ message: 'PO has no billable line items' });
    }

    const qbBill = await quickbooksClient.createBill({
      vendorId:  vendor.Id,
      docNumber: po.poNumber || po._id.toString().slice(-8).toUpperCase(),
      date:      po.orderDate ? new Date(po.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      lines,
      notes:     `Client: ${po.clientInfo?.name || ''} | PO v${po.version}`,
    });

    // Save QB ID back to POVersion
    await POVersion.findByIdAndUpdate(req.params.poVersionId, {
      quickbooksId:       qbBill.Id,
      quickbooksSyncedAt: new Date(),
      quickbooksStatus:   'synced',
    });

    console.log(`✅ PO ${po.poNumber} → QB Bill ${qbBill.Id}`);
    res.json({ success: true, message: 'PO synced to QuickBooks as Bill', quickbooksId: qbBill.Id });

  } catch (error) {
    console.error('syncPOToQuickBooks error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Get latest confirmed PO versions for an order (for bulk sync) ────────────
// GET /api/orders/:orderId/po/latest-confirmed
const getLatestConfirmedPOs = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get latest confirmed PO per vendor for this order
    const confirmed = await POVersion.aggregate([
      { $match: { orderId: require('mongoose').Types.ObjectId.createFromHexString(orderId), status: 'confirmed' } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:               '$vendorId',
          poVersionId:       { $first: '$_id' },
          poNumber:          { $first: '$poNumber' },
          vendorName:        { $first: '$vendorInfo.name' },
          quickbooksId:      { $first: '$quickbooksId' },
          quickbooksSyncedAt:{ $first: '$quickbooksSyncedAt' },
          quickbooksStatus:  { $first: '$quickbooksStatus' },
      }},
    ]);

    if (!confirmed.length) {
      return res.status(404).json({ message: 'No confirmed POs found for this order' });
    }

    res.json({
      success:      true,
      poVersionIds: confirmed.map(c => c.poVersionId.toString()),
      details:      confirmed.map(c => ({
        poVersionId:        c.poVersionId,
        poNumber:           c.poNumber,
        vendorName:         c.vendorName,
        quickbooksId:       c.quickbooksId   || null,
        quickbooksSyncedAt: c.quickbooksSyncedAt || null,
        quickbooksStatus:   c.quickbooksStatus  || null,
      })),
    });
  } catch (error) {
    console.error('getLatestConfirmedPOs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Sync Proposal → QB Invoice ──────────────────────────────────────────────
// POST /api/quickbooks/sync-proposal/:orderId
// Syncs the order's proposal total as a QB Invoice
const syncProposalToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected.', needsReconnect: true });

    const order = await Order.findById(req.params.orderId)
      .populate('user')
      .populate('selectedProducts.vendor')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.proposalNumber) return res.status(400).json({ message: 'No proposal number — generate a proposal first' });
    // Check both Order.proposalQbId AND latest ProposalVersion.quickbooksId
    if (order.proposalQbId) return res.status(400).json({ message: 'Already synced to QuickBooks', quickbooksId: order.proposalQbId });

    const latestPV = await ProposalVersion.findOne(
      { orderId: req.params.orderId },
      { quickbooksId: 1 },
      { sort: { version: -1 } }
    ).lean();
    if (latestPV?.quickbooksId) return res.status(400).json({ message: 'Already synced to QuickBooks', quickbooksId: latestPV.quickbooksId });

    // Calculate proposal total (sell price)
    let totalAmount = 0;
    (order.selectedProducts || []).forEach(p => {
      const opts     = p.selectedOptions || {};
      const qty      = parseFloat(p.quantity) || 1;
      const msrp     = parseFloat(opts.msrp) || 0;
      const discount = parseFloat(opts.discountPercent) || 0;
      const netCost  = (opts.netCostOverride != null && opts.netCostOverride !== '')
        ? parseFloat(opts.netCostOverride) : msrp * (1 - discount / 100);
      const markup   = parseFloat(opts.markupPercent) || 0;
      totalAmount   += netCost * (1 + markup / 100) * qty;
    });

    if (totalAmount <= 0) return res.status(400).json({ message: 'Proposal total is $0 — add products with pricing first' });

    // Get/create customer
    const clientName = order.clientInfo?.name || 'Unknown Client';
    const customer   = await quickbooksClient.getOrCreateCustomer({
      name:       clientName,
      email:      order.clientInfo?.email || order.user?.email || '',
      unitNumber: order.clientInfo?.unitNumber || '',
      clientCode: order.proposalNumber,
    });

    const qbInvoice = await quickbooksClient.createInvoice({
      customerId:    customer.Id,
      invoiceNumber: order.proposalNumber,
      amount:        totalAmount,
      description:   `Proposal ${order.proposalNumber} — ${clientName}${order.clientInfo?.unitNumber ? ' Unit ' + order.clientInfo.unitNumber : ''}`,
      invoiceDate:   new Date().toISOString().split('T')[0],
      memo:          `Henderson Design Group Proposal`,
    });

    // Save QB ID to order
// Save QB ID to Order
    await Order.findByIdAndUpdate(req.params.orderId, {
      proposalQbId:       qbInvoice.Id,
      proposalQbSyncedAt: new Date(),
    });

    // Save QB ID to latest ProposalVersion — ini yang dibaca FE
    await ProposalVersion.findOneAndUpdate(
      { orderId: req.params.orderId },
      { quickbooksId: qbInvoice.Id, quickbooksSyncedAt: new Date() },
      { sort: { version: -1 } }
    );

    console.log(`✅ Proposal ${order.proposalNumber} → QB Invoice ${qbInvoice.Id}`);
    res.json({ success: true, message: 'Proposal synced to QuickBooks as Invoice', quickbooksId: qbInvoice.Id });

  } catch (error) {
    console.error('syncProposalToQuickBooks error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Get all vendors with any PO version for an order ────────────────────────
// GET /api/orders/:orderId/po/vendors
// Returns all vendors regardless of PO status (draft, sent, confirmed, etc)
const getAllPOVendors = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');

    // Get latest PO version per vendor (any status)
    const vendors = await POVersion.aggregate([
      { $match: { orderId: mongoose.Types.ObjectId.createFromHexString(orderId) } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:               '$vendorId',
          poVersionId:       { $first: '$_id' },
          poNumber:          { $first: '$poNumber' },
          vendorName:        { $first: '$vendorInfo.name' },
          status:            { $first: '$status' },
          quickbooksId:      { $first: '$quickbooksId' },
          quickbooksSyncedAt:{ $first: '$quickbooksSyncedAt' },
          quickbooksStatus:  { $first: '$quickbooksStatus' },
      }},
      { $sort: { vendorName: 1 } },
    ]);

    res.json({
      success: true,
      vendors: vendors.map(v => ({
        poVersionId:        v.poVersionId,
        poNumber:           v.poNumber || '',
        vendorName:         v.vendorName || 'Unknown Vendor',
        status:             v.status || 'draft',
        quickbooksId:       v.quickbooksId   || null,
        quickbooksSyncedAt: v.quickbooksSyncedAt || null,
        quickbooksStatus:   v.quickbooksStatus  || null,
      })),
    });
  } catch (error) {
    console.error('getAllPOVendors error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get finance summary for a project ───────────────────────────────────────
// GET /api/quickbooks/project-summary/:orderId
// Returns proposal status + all PO vendors with status
const getProjectFinanceSummary = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');
    const ProposalVersion = require('../models/ProposalVersion');
    const oid = mongoose.Types.ObjectId.createFromHexString(orderId);

    // Get latest proposal version status
    const latestProposal = await ProposalVersion.findOne(
      { orderId: oid },
      { version: 1, status: 1, createdAt: 1 },
      { sort: { version: -1 } }
    ).lean();

    // Get latest PO per vendor (any status)
    const poVendors = await POVersion.aggregate([
      { $match: { orderId: oid } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:               '$vendorId',
          poVersionId:       { $first: '$_id' },
          poNumber:          { $first: '$poNumber' },
          vendorName:        { $first: '$vendorInfo.name' },
          status:            { $first: '$status' },
          quickbooksId:      { $first: '$quickbooksId' },
          quickbooksSyncedAt:{ $first: '$quickbooksSyncedAt' },
          quickbooksStatus:  { $first: '$quickbooksStatus' },
      }},
      { $sort: { vendorName: 1 } },
    ]);

    res.json({
      success: true,
      proposal: latestProposal ? {
        version:   latestProposal.version,
        status:    latestProposal.status,
        createdAt: latestProposal.createdAt,
      } : null,
      poVendors: poVendors.map(v => ({
        poVersionId:        v.poVersionId,
        poNumber:           v.poNumber || '',
        vendorName:         v.vendorName || 'Unknown Vendor',
        status:             v.status || 'draft',
        quickbooksId:       v.quickbooksId    || null,
        quickbooksSyncedAt: v.quickbooksSyncedAt || null,
        quickbooksStatus:   v.quickbooksStatus   || null,
      })),
    });
  } catch (error) {
    console.error('getProjectFinanceSummary error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  connectQuickBooks,
  handleOAuthCallback,
  getConnectionStatus,
  disconnectQuickBooks,
  testConnection,
  syncInvoiceToQuickBooks,
  loadTokensFromDatabase,
  // ✅ New:
  syncExpenseToQuickBooks,
  syncPOToQuickBooks,
  getLatestConfirmedPOs,
  syncProposalToQuickBooks,
  getAllPOVendors,
  getProjectFinanceSummary,
};