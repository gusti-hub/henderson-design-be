const BillInvoice = require('../models/BillInvoice');
const POVersion   = require('../models/POVersion');
const { quickbooksClient } = require('../utils/quickbooksClient');
const QuickBooksToken      = require('../models/QuickBooksToken');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// ─── Load QB tokens (same helper pattern as quickbooksController) ─────────────
const loadTokensFromDatabase = async () => {
  try {
    const token = await QuickBooksToken.findOne().sort({ createdAt: -1 });
    if (!token) return false;
    const now = new Date();
    const expiresIn = Math.max(0, Math.floor((token.expiresAt - now) / 1000));
    quickbooksClient.setTokens(token.accessToken, token.refreshToken, token.realmId, expiresIn);
    if (token.expiresAt <= now) {
      await quickbooksClient.refreshAccessToken();
      token.accessToken  = quickbooksClient.accessToken;
      token.refreshToken = quickbooksClient.refreshToken;
      token.expiresAt    = quickbooksClient.tokenExpiry;
      await token.save();
    }
    return true;
  } catch {
    return false;
  }
};

// ─── GET (or create from PO) ──────────────────────────────────────────────────
// GET /api/orders/:orderId/po/:vendorId/bill-invoice?poVersionId=xxx
const getOrCreateBillInvoice = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const { poVersionId }       = req.query;

    if (!poVersionId) return res.status(400).json({ message: 'poVersionId query param required' });

    // Return existing if found
    const existing = await BillInvoice.findOne({ poVersionId });
    if (existing) return res.json({ success: true, data: existing });

    // Create from PO
    const po = await POVersion.findById(poVersionId).lean();
    if (!po) return res.status(404).json({ message: 'PO version not found' });

    const poNum    = po.poNumber || po._id.toString().slice(-8).toUpperCase();
    const billNum  = `BI-${poNum}`;

    const bill = await BillInvoice.create({
      orderId,
      vendorId,
      poVersionId,
      poNumber:   poNum,
      billNumber: billNum,

      orderDate:      po.orderDate,
      accountNumber:  po.accountNumber,
      repName:        po.repName,
      repPhone:       po.repPhone,
      repEmail:       po.repEmail,
      terms:          po.terms,
      estimateNumber: po.estimateNumber,

      shipTo:     po.shipTo,
      clientInfo: po.clientInfo,
      vendorInfo: po.vendorInfo,

      originalProducts: (po.products || []).map(p => ({
        product_id: p.product_id,
        name:       p.name,
        quantity:   p.quantity  || 1,
        unitPrice:  p.unitPrice || 0,
        totalPrice: p.totalPrice || 0,
      })),

      products:        po.products        || [],
      additionalLines: po.additionalLines || [],

      subTotal: po.subTotal || 0,
      shipping: po.shipping || 0,
      others:   po.others   || 0,
      total:    po.total    || 0,

      comments: po.comments || '',
      notes:    po.notes    || '',

      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: bill });
  } catch (err) {
    console.error('getOrCreateBillInvoice error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
// PUT /api/orders/:orderId/po/:vendorId/bill-invoice
const updateBillInvoice = async (req, res) => {
  try {
    const { poVersionId } = req.query;
    if (!poVersionId) return res.status(400).json({ message: 'poVersionId query param required' });

    const allowed = [
      'orderDate','accountNumber','repName','repPhone','repEmail','terms','estimateNumber',
      'shipTo','clientInfo','vendorInfo',
      'products','additionalLines',
      'subTotal','shipping','others','total',
      'comments','notes','status',
    ];

    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    update.updatedAt = new Date();

    const bill = await BillInvoice.findOneAndUpdate(
      { poVersionId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!bill) return res.status(404).json({ message: 'Bill Invoice not found' });

    res.json({ success: true, data: bill });
  } catch (err) {
    console.error('updateBillInvoice error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── SYNC TO QUICKBOOKS ───────────────────────────────────────────────────────
// POST /api/quickbooks/sync-bill-invoice/:billInvoiceId
const syncBillInvoiceToQuickBooks = async (req, res) => {
  try {
    const tokensLoaded = await loadTokensFromDatabase();
    if (!tokensLoaded) {
      return res.status(400).json({ message: 'QuickBooks not connected. Please connect first.', needsReconnect: true });
    }

    const bill = await BillInvoice.findById(req.params.billInvoiceId).lean();
    if (!bill) return res.status(404).json({ message: 'Bill Invoice not found' });

    const isResync = req.query.force === 'true' && !!bill.quickbooksId;

    if (!isResync && bill.quickbooksId) {
      return res.status(400).json({
        message: 'Already synced to QuickBooks',
        quickbooksId: bill.quickbooksId,
      });
    }

    // Vendor + Customer lookup/create
    const vendorName = bill.vendorInfo?.name || 'Unknown Vendor';
    const vendor     = await quickbooksClient.getOrCreateVendor(vendorName);

    const clientName = bill.clientInfo?.name || 'Unknown Client';
    const customer   = await quickbooksClient.getOrCreateCustomer({
      name:       clientName,
      email:      bill.clientInfo?.email      || '',
      unitNumber: bill.clientInfo?.unitNumber || '',
      clientCode: bill.billNumber             || bill.poNumber || '',
    });

    // Product lines
    const productLines = (bill.products || [])
      .map(p => {
        const qty       = parseFloat(p.quantity)  || 1;
        const unitPrice = parseFloat(p.unitPrice) || 0;
        const total     = round2(unitPrice * qty);
        if (total <= 0) return null;

        const desc = [
          p.name,
          p.description                         ? p.description                              : null,
          p.selectedOptions?.vendorDescription  ? p.selectedOptions.vendorDescription        : null,
          p.selectedOptions?.finish             ? `Finish: ${p.selectedOptions.finish}`      : null,
          p.selectedOptions?.fabric             ? `Fabric: ${p.selectedOptions.fabric}`      : null,
          p.selectedOptions?.size               ? `Size: ${p.selectedOptions.size}`          : null,
          p.selectedOptions?.sidemark           ? `Sidemark: ${p.selectedOptions.sidemark}`  : null,
        ].filter(Boolean).join(' | ');

        return { description: desc || p.name || 'Product', amount: total, qty: 1, unitPrice: total, lineType: 'Product' };
      })
      .filter(Boolean);

    // Additional lines
    const additionalLines = (bill.additionalLines || [])
      .map(al => {
        const total = round2(parseFloat(al.amount || 0));
        if (total <= 0) return null;
        return { description: al.description || al.lineType || 'Additional', amount: total, qty: 1, unitPrice: total, lineType: al.lineType || 'Other' };
      })
      .filter(Boolean);

    const shippingAmount = round2(parseFloat(bill.shipping || 0));
    const othersAmount   = round2(parseFloat(bill.others   || 0));
    const refNum         = bill.billNumber || bill.poNumber || bill._id.toString().slice(-8).toUpperCase();

    const shippingLine = shippingAmount > 0 ? [{
      description: `Shipping - ${refNum}`, amount: shippingAmount, qty: 1, unitPrice: shippingAmount, lineType: 'FDI',
    }] : [];

    const othersLine = othersAmount > 0 ? [{
      description: `Tax - ${refNum}`, amount: othersAmount, qty: 1, unitPrice: othersAmount, lineType: 'Other',
    }] : [];

    const allLines = [...productLines, ...additionalLines, ...shippingLine, ...othersLine];
    if (allLines.length === 0) return res.status(400).json({ message: 'Bill Invoice has no billable line items' });

    const billDate = bill.orderDate
      ? new Date(bill.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const billPayload = {
      vendorId:   vendor.Id,
      customerId: customer.Id,
      docNumber:  refNum,
      date:       billDate,
      dueDate:    billDate,
      lines:      allLines,
    };

    let qbBill;
    if (isResync) {
      const exists = await quickbooksClient.billExists(bill.quickbooksId);
      if (exists) {
        qbBill = await quickbooksClient.updateBill(bill.quickbooksId, billPayload);
        console.log(`✅ BillInvoice ${refNum} → QB Bill ${qbBill.Id} (updated)`);
      } else {
        qbBill = await quickbooksClient.createBill(billPayload);
        console.log(`✅ BillInvoice ${refNum} → QB Bill ${qbBill.Id} (recreated)`);
      }
    } else {
      qbBill = await quickbooksClient.createBill(billPayload);
      console.log(`✅ BillInvoice ${refNum} → QB Bill ${qbBill.Id} (created)`);
    }

    await BillInvoice.findByIdAndUpdate(req.params.billInvoiceId, {
      quickbooksId:       qbBill.Id,
      quickbooksSyncedAt: new Date(),
      quickbooksStatus:   'synced',
      quickbooksError:    null,
      status:             'synced',
    });

    res.json({
      success:      true,
      message:      isResync ? 'Bill Invoice updated in QuickBooks' : 'Bill Invoice synced to QuickBooks',
      quickbooksId: qbBill.Id,
    });
  } catch (error) {
    console.error('syncBillInvoiceToQuickBooks error:', error);

    // Record error on the bill
    if (req.params.billInvoiceId) {
      await BillInvoice.findByIdAndUpdate(req.params.billInvoiceId, {
        quickbooksStatus: 'failed',
        quickbooksError:  error.message,
      }).catch(() => {});
    }

    res.status(500).json({
      message: error.response?.data?.Fault?.Error?.[0]?.Detail || error.message,
    });
  }
};

// ─── GET all Bill Invoices for an order ──────────────────────────────────────
// GET /api/orders/:orderId/bill-invoices
const getBillInvoicesForOrder = async (req, res) => {
  try {
    const bills = await BillInvoice.find({ orderId: req.params.orderId })
      .select('_id poVersionId billNumber poNumber status quickbooksId quickbooksSyncedAt quickbooksStatus quickbooksError')
      .lean();
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOrCreateBillInvoice, updateBillInvoice, syncBillInvoiceToQuickBooks, getBillInvoicesForOrder };
