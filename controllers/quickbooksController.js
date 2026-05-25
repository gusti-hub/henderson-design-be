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

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

const SERVICE_TYPE_ITEM_MAP = {
  'decommission':    '5',   // Other
  'procurement':     '3',   // Product
  'design_pm':       '7',   // Design Fees
  'engagement_fee':  '11',  // Project Management Fees
  'admin':           '7',   // Design Fees
  'business_dev':    '7',   // Design Fees
  'design_services': '7',   // Design Fees
  'finance':         '7',   // Design Fees
  'holiday':         '2',   // Hours
  'installation':    '4',   // FDI
  'travel':          '6',   // Reimbursable
  'products':        '3', 
  'default':         '3',   // Product
};

const oauthStates = new Map();

// ─── Product Item ID cache ────────────────────────────────────────────────────
let cachedProductItemId = null;

const getProductItemId = async () => {
  if (cachedProductItemId) return cachedProductItemId;
  try {
    const item = await quickbooksClient.findItemByName('Product');
    if (item) {
      cachedProductItemId = item.Id;
      console.log('QB: Product item ID resolved:', cachedProductItemId);
      return cachedProductItemId;
    }
  } catch (err) {
    console.warn('QB: Could not find "Product" item:', err.message);
  }
  console.warn('QB: Falling back to item ID "1" (Services)');
  return '1';
};

// ─── Class ID cache ───────────────────────────────────────────────────────────
const classIdCache = new Map();

const resolveClassId = async (itemClass) => {
  if (!itemClass || !itemClass.trim()) return null;
  const key = itemClass.trim();
  if (classIdCache.has(key)) return classIdCache.get(key);
  try {
    const cls = await quickbooksClient.findClassByName(key);
    if (cls) {
      classIdCache.set(key, cls.Id);
      console.log(`QB resolveClassId: "${key}" → ID ${cls.Id}`);
      return cls.Id;
    }
    console.warn(`QB resolveClassId: class "${key}" NOT FOUND in QuickBooks`);
  } catch (err) {
    console.warn(`QB resolveClassId: error resolving "${key}":`, err.message);
  }
  classIdCache.set(key, null);
  return null;
};

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

const cleanupExpiredStates = () => {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > tenMinutes) oauthStates.delete(state);
  }
};

// ─── Connect ──────────────────────────────────────────────────────────────────
const connectQuickBooks = async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, { userId: req.user?._id?.toString() || 'anonymous', timestamp: Date.now() });
    cleanupExpiredStates();
    const authUrl = quickbooksClient.getAuthorizationUrl(state);
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
    if (oauthError) return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=${encodeURIComponent(oauthError)}`);

    const stateData = oauthStates.get(state);
    if (!stateData) return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=invalid_state`);
    oauthStates.delete(state);

    if (!code) return res.redirect(`${process.env.FRONTEND_URL}/admin/quickbooks?error=no_code`);

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

    // Reset caches saat reconnect
    cachedProductItemId = null;
    classIdCache.clear();

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
    cachedProductItemId = null;
    classIdCache.clear();
    res.json({ success: true, message: 'QuickBooks disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disconnect QuickBooks', error: error.message });
  }
};

// ─── Test ─────────────────────────────────────────────────────────────────────
const testConnection = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ success: false, message: 'QuickBooks not connected.', needsReconnect: true });

    const BASE_URL = QUICKBOOKS_CONFIG.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const url = `${BASE_URL}/v3/company/${quickbooksClient.realmId}/companyinfo/${quickbooksClient.realmId}`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${quickbooksClient.accessToken}`, 'Accept': 'application/json' }
    });

    res.json({ success: true, connected: true, companyInfo: response.data.CompanyInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Connection test failed', error: error.response?.data || error.message });
  }
};

// ─── Get QB Items ─────────────────────────────────────────────────────────────
const getQBItems = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected' });

    const BASE_URL = QUICKBOOKS_CONFIG.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const response = await axios.get(
      `${BASE_URL}/v3/company/${quickbooksClient.realmId}/query`,
      {
        params: { query: "SELECT * FROM Item MAXRESULTS 1000" },
        headers: { 'Authorization': `Bearer ${quickbooksClient.accessToken}`, 'Accept': 'application/json' },
      }
    );

    const items = (response.data.QueryResponse?.Item || [])
      .sort((a, b) => a.Name.localeCompare(b.Name));

    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Legacy client invoice sync ───────────────────────────────────────────────
const syncInvoiceToQuickBooks = async (req, res) => {
  try {
    const { clientId, invoiceNumber } = req.params;
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected.', needsReconnect: true });

    const client = await User.findById(clientId);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const invoice = client.invoices?.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.quickbooksSyncStatus === 'synced') return res.status(400).json({ message: 'Invoice already synced', quickbooksId: invoice.quickbooksId });

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

    const itemId = await getProductItemId();
    const qbInvoice = await quickbooksClient.createInvoice({
      customerId,
      invoiceNumber: invoice.invoiceNumber,
      amount:        (invoice.invoiceAmount || 0) + (invoice.taxAmount || 0) + 0.06,
      description:   `Design Fee Invoice (${invoice.currentPercentage || 0}%) - ${invoice.collection || 'Nalu'} - ${invoice.bedroomCount || '1'} Bedroom Package`,
      invoiceDate:   formatDate(invoice.invoiceDate),
      dueDate:       formatDate(invoice.dueDate),
    }, itemId);

    const invoiceIndex = client.invoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);
    client.invoices[invoiceIndex].quickbooksSyncStatus = 'synced';
    client.invoices[invoiceIndex].quickbooksId         = qbInvoice.Id;
    client.invoices[invoiceIndex].quickbooksSyncedAt   = new Date();
    await client.save();

    res.json({ success: true, message: 'Invoice synced to QuickBooks', quickbooksId: qbInvoice.Id, invoiceNumber });
  } catch (error) {
    console.error('Sync invoice error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Sync Expense → QB Invoice ────────────────────────────────────────────────
const syncExpenseToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected.', needsReconnect: true });

    const expense = await Expense.findById(req.params.expenseId).lean();
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (expense.status !== 'confirmed' && expense.status !== 'paid') {
      return res.status(400).json({ message: 'Only confirmed or paid expenses can be synced to QuickBooks' });
    }

    const isResync = req.query.force === 'true';

    const customer = await quickbooksClient.getOrCreateCustomer({
      name:       expense.clientInfo?.name  || 'Unknown Client',
      email:      expense.clientInfo?.email || '',
      unitNumber: expense.clientInfo?.unitNumber || '',
      clientCode: expense.expenseNumber,
    });

    const taxRate      = parseFloat(expense.taxRate || 0) / 100;
    const employeeName = expense.employeeName || '';

    const lineClassRefs = await Promise.all(
      (expense.lines || []).map(line => resolveClassId(line.itemClass || ''))
    );

    const lines = [];
    for (let i = 0; i < (expense.lines || []).length; i++) {
      const line     = expense.lines[i];
      const subtotal = round2(parseFloat(line.amount || 0));
      if (subtotal <= 0) continue;

      const parts = [];
      if (line.description) parts.push(line.description);

      lines.push({
        description: parts.filter(Boolean).join(' — '),
        amount:      subtotal,   // ✅ subtotal saja tanpa tax
        qty:         1,
        unitPrice:   subtotal,
        classRef:    lineClassRefs[i] || null,
        lineType:    line.serviceType || 'design_pm',
        lineItemId,           // ✅ per line QB item ID
        lineName, 
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({ message: 'No billable line items found' });
    }

    const invoiceDate = expense.expenseDate
      ? new Date(expense.expenseDate + 'T12:00:00').toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const itemId = await getProductItemId();
    const invoicePayload = {
      customerId:    customer.Id,
      invoiceNumber: expense.expenseNumber,
      lines,
      invoiceDate,
      dueDate:       invoiceDate,
    };

    let qbInvoice;
    if (isResync && expense.quickbooksId) {
      // ✅ Cek apakah invoice masih ada di QB sebelum update
      const exists = await quickbooksClient.invoiceExists(expense.quickbooksId);
      if (exists) {
        qbInvoice = await quickbooksClient.updateInvoice(expense.quickbooksId, invoicePayload, itemId);
        console.log(`✅ Expense ${expense.expenseNumber} → QB Invoice UPDATED ${qbInvoice.Id}`);
      } else {
        // Invoice sudah dihapus di QB — buat baru
        console.log(`⚠️ Invoice ${expense.quickbooksId} not found in QB, creating new...`);
        qbInvoice = await quickbooksClient.createInvoice(invoicePayload, itemId);
        console.log(`✅ Expense ${expense.expenseNumber} → QB Invoice RECREATED ${qbInvoice.Id}`);
      }
    } else {
      qbInvoice = await quickbooksClient.createInvoice(invoicePayload, itemId);
      console.log(`✅ Expense ${expense.expenseNumber} → QB Invoice CREATED ${qbInvoice.Id}`);
    }

    await Expense.findByIdAndUpdate(req.params.expenseId, {
      quickbooksId:       qbInvoice.Id,
      quickbooksSyncedAt: new Date(),
      quickbooksStatus:   'synced',
      quickbooksError:    null,
    });

    res.json({
      success:      true,
      message:      isResync ? 'Expense updated in QuickBooks' : 'Expense synced to QuickBooks as Invoice',
      quickbooksId: qbInvoice.Id,
    });

  } catch (error) {
    console.error('syncExpenseToQuickBooks error:', error);
    await Expense.findByIdAndUpdate(req.params.expenseId, {
      quickbooksStatus: 'failed',
      quickbooksError:  error.response?.data?.Fault?.Error?.[0]?.Detail || error.message,
    }).catch(() => {});
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Sync PO → QB Bill ────────────────────────────────────────────────────────
const syncPOToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected. Please connect first.', needsReconnect: true });

    const po = await POVersion.findById(req.params.poVersionId).lean();
    if (!po) return res.status(404).json({ message: 'PO not found' });

    if (po.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed POs can be synced to QuickBooks' });
    }

    const isResync = req.query.force === 'true' && !!po.quickbooksId;

    if (!isResync && po.quickbooksId) {
      return res.status(400).json({ message: 'Already synced to QuickBooks', quickbooksId: po.quickbooksId });
    }

    const vendorName = po.vendorInfo?.name || 'Unknown Vendor';
    const vendor     = await quickbooksClient.getOrCreateVendor(vendorName);

    // ✅ Tambahkan ini setelah getOrCreateVendor
    const clientName = po.clientInfo?.name || 'Unknown Client';
    const customer   = await quickbooksClient.getOrCreateCustomer({
      name:       clientName,
      email:      po.clientInfo?.email      || '',
      unitNumber: po.clientInfo?.unitNumber || '',
      clientCode: po.poNumber               || '',
    });

    // Build product lines
    const productLines = (po.products || [])
      .map(p => {
        const qty       = parseFloat(p.quantity)  || 1;
        const unitPrice = parseFloat(p.unitPrice) || 0;
        const total     = round2(unitPrice * qty);
        if (total <= 0) return null;

        const desc = [
          p.name,
          p.description                ? p.description                            : null,
          p.selectedOptions?.vendorDescription ? p.selectedOptions.vendorDescription : null,
          p.selectedOptions?.finish   ? `Finish: ${p.selectedOptions.finish}`     : null,
          p.selectedOptions?.fabric   ? `Fabric: ${p.selectedOptions.fabric}`     : null,
          p.selectedOptions?.size     ? `Size: ${p.selectedOptions.size}`         : null,
          p.selectedOptions?.sidemark ? `Sidemark: ${p.selectedOptions.sidemark}` : null,
        ].filter(Boolean).join(' | ');

        return {
          description: desc || p.name || 'Product',
          amount:      total,
          qty:         1,
          unitPrice:   total,
          lineType:    'Product',
        };
      })
      .filter(Boolean);

    // Build additional lines (FDI, freight, tax, dll)
    const additionalLines = (po.additionalLines || [])
      .map(al => {
        const total = round2(parseFloat(al.amount || 0));
        if (total <= 0) return null;
        return {
          description: al.description || al.lineType || 'Additional',
          amount:      total,
          qty:         1,
          unitPrice:   total,
          lineType:    al.lineType || 'Other',
        };
      })
      .filter(Boolean);

    const shippingAmount = round2(parseFloat(po.shipping || 0));
    const othersAmount   = round2(parseFloat(po.others   || 0));

    const poNum = po.poNumber || po._id.toString().slice(-8).toUpperCase();

    const shippingLine = shippingAmount > 0 ? [{
      description: `Shipping - ${poNum}`,   // ✅ FDI → Shipping - PO Number
      amount:      shippingAmount,
      qty:         1,
      unitPrice:   shippingAmount,
      lineType:    'FDI',
    }] : [];

    const othersLine = othersAmount > 0 ? [{
      description: `Tax - ${poNum}`,        // ✅ Others → Tax - PO Number
      amount:      othersAmount,
      qty:         1,
      unitPrice:   othersAmount,
      lineType:    'Other',
    }] : [];

    const allLines = [...productLines, ...additionalLines, ...shippingLine, ...othersLine];

    if (allLines.length === 0) {
      return res.status(400).json({ message: 'PO has no billable line items' });
    }

    const billDate = po.orderDate
      ? new Date(po.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const billPayload = {
      vendorId:   vendor.Id,
      customerId: customer.Id,   // ✅ tambahkan ini
      docNumber:  po.poNumber || po._id.toString().slice(-8).toUpperCase(),
      date:       billDate,
      dueDate:    billDate,
      lines:      allLines,
    };

    let qbBill;
    if (isResync) {
      // ✅ Cek apakah bill masih ada di QB sebelum update
      const exists = await quickbooksClient.billExists(po.quickbooksId);
      if (exists) {
        qbBill = await quickbooksClient.updateBill(po.quickbooksId, billPayload);
        console.log(`✅ PO ${po.poNumber} → QB Bill ${qbBill.Id} (updated)`);
      } else {
        // Bill sudah dihapus di QB — buat baru
        console.log(`⚠️ Bill ${po.quickbooksId} not found in QB, creating new...`);
        qbBill = await quickbooksClient.createBill(billPayload);
        console.log(`✅ PO ${po.poNumber} → QB Bill ${qbBill.Id} (recreated)`);
      }
    } else {
      qbBill = await quickbooksClient.createBill(billPayload);
      console.log(`✅ PO ${po.poNumber} → QB Bill ${qbBill.Id} (created)`);
    }

    await POVersion.findByIdAndUpdate(req.params.poVersionId, {
      quickbooksId:       qbBill.Id,
      quickbooksSyncedAt: new Date(),
      quickbooksStatus:   'synced',
    });

    res.json({
      success:      true,
      message:      isResync ? 'PO Bill updated in QuickBooks' : 'PO synced to QuickBooks as Bill',
      quickbooksId: qbBill.Id,
    });

  } catch (error) {
    console.error('syncPOToQuickBooks error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Sync Proposal → QB Invoice ──────────────────────────────────────────────
const syncProposalToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) return res.status(400).json({ message: 'QuickBooks not connected.', needsReconnect: true });

    const { orderId, pvId } = req.params;
    const isResync = req.query.force === 'true';

    const pv = await ProposalVersion.findById(pvId).lean();
    if (!pv) return res.status(404).json({ message: 'Proposal version not found' });

    const order = await Order.findById(orderId).populate('user').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const invoiceNumber = pv.proposalNumber || order.proposalNumber;
    if (!invoiceNumber) return res.status(400).json({ message: 'No proposal number — generate a proposal first' });

    const clientName = order.clientInfo?.name || 'Unknown Client';

    const customer = await quickbooksClient.getOrCreateCustomer({
      name:       clientName,
      email:      order.clientInfo?.email || order.user?.email || '',
      unitNumber: order.clientInfo?.unitNumber || '',
      clientCode: invoiceNumber,
    });

    const lines = [];
    for (const p of (pv.selectedProducts || [])) {
      const opts      = p.selectedOptions || {};
      const qty       = parseFloat(p.quantity) || 1;
      const msrp      = parseFloat(opts.msrp) || 0;
      const markupPct = parseFloat(opts.markupPercent) || 0;
      const sell      = round2(msrp * (1 + markupPct / 100));
      const subtotal  = round2(sell * qty);
      const taxRate   = parseFloat(opts.salesTaxRate) || 0;
      const tax       = round2(subtotal * (taxRate / 100));
      const total     = round2(subtotal + tax);
      if (total <= 0) continue;

      const descParts = [];
      if (opts.room)           descParts.push(`Room: ${opts.room}`);
      if (p.name)              descParts.push(p.name);
      if (opts.specifications) descParts.push(opts.specifications);
      if (opts.finish)         descParts.push(`Finish: ${opts.finish}`);
      if (opts.fabric)         descParts.push(`Fabric: ${opts.fabric}`);
      if (opts.size)           descParts.push(`Size: ${opts.size}`);
      if (opts.leadTime)       descParts.push(`Lead Time: ${opts.leadTime}`);

      const classRef = await resolveClassId(opts.itemClass || '');
      lines.push({
        description: descParts.join(' | '),
        amount:      total,
        qty:         1,
        unitPrice:   total,
        classRef:    classRef || undefined,
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({ message: 'Proposal has no products with pricing' });
    }

    const invoiceDate = pv.createdAt
      ? new Date(pv.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const itemId = await getProductItemId();
    const invoicePayload = {
      customerId:    customer.Id,
      invoiceNumber,
      lines,
      invoiceDate,
      dueDate:       invoiceDate,
    };

    let qbInvoice;
    if (isResync && pv.quickbooksId) {
      // ✅ Cek apakah invoice masih ada di QB sebelum update
      const exists = await quickbooksClient.invoiceExists(pv.quickbooksId);
      if (exists) {
        qbInvoice = await quickbooksClient.updateInvoice(pv.quickbooksId, invoicePayload, itemId);
        console.log(`✅ Proposal ${invoiceNumber} v${pv.version} → QB Invoice UPDATED ${qbInvoice.Id}`);
      } else {
        // Invoice sudah dihapus di QB — buat baru
        console.log(`⚠️ Invoice ${pv.quickbooksId} not found in QB, creating new...`);
        qbInvoice = await quickbooksClient.createInvoice(invoicePayload, itemId);
        console.log(`✅ Proposal ${invoiceNumber} v${pv.version} → QB Invoice RECREATED ${qbInvoice.Id}`);
      }
    } else {
      qbInvoice = await quickbooksClient.createInvoice(invoicePayload, itemId);
      console.log(`✅ Proposal ${invoiceNumber} v${pv.version} → QB Invoice CREATED ${qbInvoice.Id}`);
    }

    await ProposalVersion.findByIdAndUpdate(pvId, {
      quickbooksId:       qbInvoice.Id,
      quickbooksSyncedAt: new Date(),
    });

    res.json({
      success:      true,
      message:      isResync ? 'Proposal updated in QuickBooks' : 'Proposal synced to QuickBooks as Invoice',
      quickbooksId: qbInvoice.Id,
    });

  } catch (error) {
    console.error('syncProposalToQuickBooks error:', error);
    res.status(500).json({ message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message });
  }
};

// ─── Get latest confirmed POs ────────────────────────────────────────────────
const getLatestConfirmedPOs = async (req, res) => {
  try {
    const { orderId } = req.params;
    const confirmed = await POVersion.aggregate([
      { $match: { orderId: require('mongoose').Types.ObjectId.createFromHexString(orderId), status: 'confirmed' } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:                '$vendorId',
          poVersionId:        { $first: '$_id' },
          poNumber:           { $first: '$poNumber' },
          vendorName:         { $first: '$vendorInfo.name' },
          quickbooksId:       { $first: '$quickbooksId' },
          quickbooksSyncedAt: { $first: '$quickbooksSyncedAt' },
          quickbooksStatus:   { $first: '$quickbooksStatus' },
      }},
    ]);

    if (!confirmed.length) return res.status(404).json({ message: 'No confirmed POs found for this order' });

    res.json({
      success:      true,
      poVersionIds: confirmed.map(c => c.poVersionId.toString()),
      details:      confirmed.map(c => ({
        poVersionId:        c.poVersionId,
        poNumber:           c.poNumber,
        vendorId:           c._id,
        vendorName:         c.vendorName,
        quickbooksId:       c.quickbooksId       || null,
        quickbooksSyncedAt: c.quickbooksSyncedAt || null,
        quickbooksStatus:   c.quickbooksStatus   || null,
      })),
    });
  } catch (error) {
    console.error('getLatestConfirmedPOs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get all PO vendors ───────────────────────────────────────────────────────
const getAllPOVendors = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');

    const vendors = await POVersion.aggregate([
      { $match: { orderId: mongoose.Types.ObjectId.createFromHexString(orderId) } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:                '$vendorId',
          poVersionId:        { $first: '$_id' },
          poNumber:           { $first: '$poNumber' },
          vendorName:         { $first: '$vendorInfo.name' },
          status:             { $first: '$status' },
          quickbooksId:       { $first: '$quickbooksId' },
          quickbooksSyncedAt: { $first: '$quickbooksSyncedAt' },
          quickbooksStatus:   { $first: '$quickbooksStatus' },
      }},
      { $sort: { vendorName: 1 } },
    ]);

    res.json({
      success: true,
      vendors: vendors.map(v => ({
        poVersionId:        v.poVersionId,
        poNumber:           v.poNumber           || '',
        vendorId:           v._id,
        vendorName:         v.vendorName         || 'Unknown Vendor',
        status:             v.status             || 'draft',
        quickbooksId:       v.quickbooksId       || null,
        quickbooksSyncedAt: v.quickbooksSyncedAt || null,
        quickbooksStatus:   v.quickbooksStatus   || null,
      })),
    });
  } catch (error) {
    console.error('getAllPOVendors error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get finance summary ──────────────────────────────────────────────────────
const getProjectFinanceSummary = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');
    const oid = mongoose.Types.ObjectId.createFromHexString(orderId);

    const latestProposal = await ProposalVersion.findOne(
      { orderId: oid },
      { version: 1, status: 1, createdAt: 1 },
      { sort: { version: -1 } }
    ).lean();

    const poVendors = await POVersion.aggregate([
      { $match: { orderId: oid } },
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:                '$vendorId',
          poVersionId:        { $first: '$_id' },
          poNumber:           { $first: '$poNumber' },
          vendorName:         { $first: '$vendorInfo.name' },
          status:             { $first: '$status' },
          quickbooksId:       { $first: '$quickbooksId' },
          quickbooksSyncedAt: { $first: '$quickbooksSyncedAt' },
          quickbooksStatus:   { $first: '$quickbooksStatus' },
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
        poNumber:           v.poNumber           || '',
        vendorId:           v._id,
        vendorName:         v.vendorName         || 'Unknown Vendor',
        status:             v.status             || 'draft',
        quickbooksId:       v.quickbooksId       || null,
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
  syncExpenseToQuickBooks,
  syncPOToQuickBooks,
  getLatestConfirmedPOs,
  syncProposalToQuickBooks,
  getAllPOVendors,
  getProjectFinanceSummary,
  getQBItems,
};