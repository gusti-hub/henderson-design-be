// controllers/logisticController.js
// Logistic Order Tracker — Developer Order (No Proposal) only (packageType: 'investor')
// Data source: Order.selectedProducts[] joined with POVersion for PO-level info.
// Scope: iteration 1 — investor orders only. Retail/Custom to follow in future iterations.

const Order           = require('../models/Order');
const POVersion       = require('../models/POVersion');
const ProposalVersion = require('../models/ProposalVersion');

// ─── Status Category options (TODO: replace with final list before production) ─
// These are placeholder values — confirm full list with operations team.
const STATUS_CATEGORIES = [
  'On Schedule',
  'Delayed',
  'In Transit',
  'Delivered',
  'On Hold',
  'Cancelled',
];

// ─── Helper: compute shipped/balance from packing stage ──────────────────────
// Shipped Quantity = full qty only when Packing = 5 (100%); otherwise 0.
// Per spec: "Shipped Quantity = Lookup dari kolom Packing"
const computeShipped = (poQty, logPacking) => (logPacking === 5 ? poQty : 0);
const computeBalance = (poQty, logPacking) => poQty - computeShipped(poQty, logPacking);

// ─── Helper: map product from order + poVersion into a logistic row ──────────
// orderProd (Order.selectedProducts entry) is always set — vendor-based matching guarantees it.
// poProd is the matching entry in POVersion.products (best-effort, may be null).
// po is the latest POVersion for this order+vendor (always set).
const buildRow = (order, orderProd, poProd, po) => {
  const opts = orderProd.selectedOptions || {};
  const ca   = (opts.customAttributes instanceof Map)
    ? Object.fromEntries(opts.customAttributes)
    : (typeof opts.customAttributes === 'object' ? opts.customAttributes || {} : {});

  // Quantity: prefer PO product quantity (what was actually ordered), fallback to Order
  const poQty   = poProd?.quantity ?? orderProd.quantity ?? 1;
  const packing = opts.logPacking ?? 0;

  return {
    // ── Identifiers ──
    orderId:     order._id,
    productId:   orderProd._id,   // always set — all rows are editable
    poVersionId: po._id,
    poProductId: poProd?._id,

    // ── Read-only from CPM ──
    poNumber:    po.poNumber || '',
    poDate:      po.orderDate || '',
    skuNo:       orderProd.product_id || poProd?.product_id || '',
    itemName:    orderProd.name || '',
    unitPrice:   poProd?.unitPrice ?? orderProd.unitPrice ?? 0,
    totalPrice:  (poProd?.unitPrice ?? orderProd.unitPrice ?? 0) * poQty,
    poQuantity:  poQty,
    shippedQuantity: computeShipped(poQty, packing),
    balanceQuantity: computeBalance(poQty, packing),
    vendor:      po.vendorInfo?.name || '',
    description: opts.specifications || opts.vendorDescription || poProd?.description || '',
    woodFinish:  opts.woodFinish || '',
    fabricFinish: opts.fabric || '',
    collection:  ca?.collection || '',

    // ── Editable — stored on Order.selectedOptions ──
    projectCode: order.projectCode || '',
    unitNumber:  order.clientInfo?.unitNumber || '',
    clientName:  order.clientInfo?.name || '',
    orderNumber: order.orderNumber,

    location:            opts.room || '',
    cargoReadyDate:      opts.cargoReadyDate || '',
    shipmentDate:        opts.shipmentDate || '',
    logDrawing:          opts.logDrawing ?? 0,
    logMachining:        opts.logMachining ?? 0,
    logAssembly:         opts.logAssembly ?? 0,
    logFinishing:        opts.logFinishing ?? 0,
    logQcChecking:       opts.logQcChecking ?? 0,
    logPacking:          packing,
    packingList:         opts.packingList || '',
    containerNumber:     opts.containerNumber || '',
    statusCategory:      opts.statusCategory || '',
    expectedShipDate:    opts.expectedShipDate || '',
    expectedArrivalDate: opts.expectedArrivalDate || '',
    remark:              opts.notes || '',
    dateInspected:       opts.dateInspected || '',
  };
};

// ─── GET /api/logistic — list all entries ────────────────────────────────────
// Logic mirrors PurchaseOrderEditor:
//   - Group by (orderId, vendorId) → find latest POVersion for that pair
//   - Show ALL Order.selectedProducts whose vendor matches (no name/SKU matching)
// This guarantees no cross-PO mixing and productId is always set (always editable).
exports.listEntries = async (req, res) => {
  try {
    const { projectCode, vendor, statusCategory, expectedArrivalDate, search,
            page = '1', limit = '50' } = req.query;

    // Developer Orders (No Proposal) = orders that have NO associated ProposalVersion.
    const orderIdsWithProposal = await ProposalVersion.distinct('orderId');
    const orders = await Order.find({
      _id: { $nin: orderIdsWithProposal },
    })
      .select('_id clientInfo projectCode orderNumber selectedProducts')
      .lean();

    console.log(`[logistic] developer orders (no proposal): ${orders.length}`);
    if (!orders.length) return res.json({ data: [] });

    const orderIds = orders.map(o => o._id);
    const orderMap = {};
    orders.forEach(o => { orderMap[o._id.toString()] = o; });

    // Get latest POVersion per (orderId, vendorId) — same as POEditor approach.
    // Sort version desc so first-seen per key = latest.
    const allPoVersions = await POVersion.find({ orderId: { $in: orderIds } })
      .sort({ version: -1 })
      .lean();

    // latestPo: `${orderId}__${vendorId}` → latest POVersion
    const latestPo = {};
    allPoVersions.forEach(po => {
      const key = `${po.orderId}__${po.vendorId}`;
      if (!latestPo[key]) latestPo[key] = po; // first = latest version
    });

    console.log(`[logistic] found ${allPoVersions.length} POVersions (${Object.keys(latestPo).length} latest)`);

    // For each Order product, look up the latest POVersion for its vendor.
    // poProd is used for reference quantity/price; sp is the authoritative source.
    const rows = [];
    orders.forEach(order => {
      (order.selectedProducts || []).forEach(sp => {
        if (sp.isParent) return;
        const vendorId = sp.vendor?._id?.toString() || sp.vendor?.toString() || '';
        if (!vendorId) return; // no vendor → no PO

        const key = `${order._id}__${vendorId}`;
        const po = latestPo[key];
        if (!po) return; // no POVersion for this order+vendor combination

        // Look up the matching PO product for reference price/qty (best-effort, not required)
        const poProd = (po.products || []).find(p =>
          (sp.name && p.name === sp.name) ||
          (sp.product_id && sp.product_id !== '' && p.product_id === sp.product_id)
        ) || null;

        rows.push(buildRow(order, sp, poProd, po));
      });
    });

    // Apply server-side filters (including search)
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.itemName?.toLowerCase().includes(q) ||
        r.poNumber?.toLowerCase().includes(q) ||
        r.vendor?.toLowerCase().includes(q) ||
        r.projectCode?.toLowerCase().includes(q)
      );
    }
    if (projectCode) {
      filtered = filtered.filter(r =>
        r.projectCode.toLowerCase().includes(projectCode.toLowerCase())
      );
    }
    if (vendor) {
      filtered = filtered.filter(r =>
        r.vendor.toLowerCase().includes(vendor.toLowerCase())
      );
    }
    if (statusCategory) {
      filtered = filtered.filter(r => r.statusCategory === statusCategory);
    }
    if (expectedArrivalDate) {
      filtered = filtered.filter(r => r.expectedArrivalDate === expectedArrivalDate);
    }

    // Paginate
    const total    = filtered.length;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10)));
    const start    = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(start, start + limitNum);

    res.json({ data: paginated, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('logistic listEntries error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/logistic/:orderId/:productId — get single entry detail ─────────
exports.getEntry = async (req, res) => {
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findById(orderId)
      .select('_id clientInfo projectCode orderNumber selectedProducts')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderProd = (order.selectedProducts || []).find(
      sp => sp._id?.toString() === productId
    );
    if (!orderProd) return res.status(404).json({ message: 'Product not found in order' });

    // Find matching POVersion (latest version for this order that contains the product)
    const poNumber = orderProd.selectedOptions?.poNumber;
    let po = null;
    if (poNumber) {
      po = await POVersion.findOne({ orderId, poNumber }).sort({ version: -1 }).lean();
    }
    if (!po) {
      po = await POVersion.findOne({
        orderId,
        'products.product_id': orderProd.product_id,
      }).sort({ version: -1 }).lean();
    }

    const poProd = po
      ? (po.products || []).find(p =>
          p._id?.toString() === productId ||
          p.product_id === orderProd.product_id
        )
      : null;

    res.json({ data: buildRow(order, orderProd, poProd, po) });
  } catch (err) {
    console.error('logistic getEntry error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/logistic/:orderId/:productId — update logistic fields ───────────
// Only logistic-specific fields can be updated. CPM read-only fields (name, price, etc.) are ignored.
exports.updateEntry = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const {
      projectCode,
      location,
      cargoReadyDate,
      shipmentDate,
      logDrawing,
      logMachining,
      logAssembly,
      logFinishing,
      logQcChecking,
      logPacking,
      packingList,
      containerNumber,
      statusCategory,
      expectedShipDate,
      expectedArrivalDate,
      remark,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const prodIdx = order.selectedProducts.findIndex(
      sp => sp._id?.toString() === productId
    );
    if (prodIdx === -1) return res.status(404).json({ message: 'Product not found in order' });

    const opts = order.selectedProducts[prodIdx].selectedOptions;

    // Update order-level field
    if (projectCode !== undefined) order.projectCode = projectCode;

    // Update product-level logistic fields
    const setIfDefined = (key, val) => { if (val !== undefined) opts[key] = val; };

    setIfDefined('room',               location);
    setIfDefined('cargoReadyDate',     cargoReadyDate);
    setIfDefined('shipmentDate',       shipmentDate);
    setIfDefined('logDrawing',         logDrawing != null ? Number(logDrawing) : undefined);
    setIfDefined('logMachining',       logMachining != null ? Number(logMachining) : undefined);
    setIfDefined('logAssembly',        logAssembly != null ? Number(logAssembly) : undefined);
    setIfDefined('logFinishing',       logFinishing != null ? Number(logFinishing) : undefined);
    setIfDefined('logPacking',         logPacking != null ? Number(logPacking) : undefined);
    setIfDefined('packingList',        packingList);
    setIfDefined('containerNumber',    containerNumber);
    setIfDefined('statusCategory',     statusCategory);
    setIfDefined('expectedShipDate',   expectedShipDate);
    setIfDefined('expectedArrivalDate',expectedArrivalDate);
    setIfDefined('notes',              remark);

    // QC Checking business logic: auto-fill dateInspected when reaches 100%
    if (logQcChecking !== undefined) {
      const prev = opts.logQcChecking ?? 0;
      opts.logQcChecking = Number(logQcChecking);
      if (opts.logQcChecking === 5 && prev < 5 && !opts.dateInspected) {
        opts.dateInspected = new Date().toISOString().split('T')[0];
      }
    }

    order.updatedAt  = Date.now();
    order.updatedBy  = req.user._id;
    order.markModified('selectedProducts');
    await order.save();

    res.json({ message: 'Updated', dateInspected: opts.dateInspected || '' });
  } catch (err) {
    console.error('logistic updateEntry error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/logistic/po/:poVersionId/:poProductId — update orphaned PO product ──
// Used when the POVersion product has no matching Order.selectedProduct.
// Logistic data is stored directly on POVersion.products[].selectedOptions.
exports.updatePoEntry = async (req, res) => {
  try {
    const { poVersionId, poProductId } = req.params;
    const {
      projectCode,
      location,
      cargoReadyDate,
      shipmentDate,
      logDrawing,
      logMachining,
      logAssembly,
      logFinishing,
      logQcChecking,
      logPacking,
      packingList,
      containerNumber,
      statusCategory,
      expectedShipDate,
      expectedArrivalDate,
      remark,
    } = req.body;

    const po = await POVersion.findById(poVersionId);
    if (!po) return res.status(404).json({ message: 'POVersion not found' });

    const prodIdx = (po.products || []).findIndex(
      p => p._id?.toString() === poProductId
    );
    if (prodIdx === -1) return res.status(404).json({ message: 'Product not found in POVersion' });

    const poOpts = po.products[prodIdx].selectedOptions;
    if (!poOpts) po.products[prodIdx].selectedOptions = {};
    const opts = po.products[prodIdx].selectedOptions;

    const setIfDefined = (key, val) => { if (val !== undefined) opts[key] = val; };

    setIfDefined('projectCode',         projectCode);
    setIfDefined('location',            location);
    setIfDefined('cargoReadyDate',      cargoReadyDate);
    setIfDefined('shipmentDate',        shipmentDate);
    setIfDefined('logDrawing',          logDrawing != null ? Number(logDrawing) : undefined);
    setIfDefined('logMachining',        logMachining != null ? Number(logMachining) : undefined);
    setIfDefined('logAssembly',         logAssembly != null ? Number(logAssembly) : undefined);
    setIfDefined('logFinishing',        logFinishing != null ? Number(logFinishing) : undefined);
    setIfDefined('logPacking',          logPacking != null ? Number(logPacking) : undefined);
    setIfDefined('packingList',         packingList);
    setIfDefined('containerNumber',     containerNumber);
    setIfDefined('statusCategory',      statusCategory);
    setIfDefined('expectedShipDate',    expectedShipDate);
    setIfDefined('expectedArrivalDate', expectedArrivalDate);
    setIfDefined('remark',              remark);

    // QC Checking business logic
    if (logQcChecking !== undefined) {
      const prev = opts.logQcChecking ?? 0;
      opts.logQcChecking = Number(logQcChecking);
      if (opts.logQcChecking === 5 && prev < 5 && !opts.dateInspected) {
        opts.dateInspected = new Date().toISOString().split('T')[0];
      }
    }

    po.markModified('products');
    await po.save();

    res.json({ message: 'Updated', dateInspected: opts.dateInspected || '' });
  } catch (err) {
    console.error('logistic updatePoEntry error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/logistic/clients — distinct client names across all developer orders ──
exports.listClients = async (_req, res) => {
  try {
    const orderIdsWithProposal = await ProposalVersion.distinct('orderId');
    const clients = await Order.distinct('clientInfo.name', {
      _id: { $nin: orderIdsWithProposal },
      'clientInfo.name': { $exists: true, $ne: '' },
    });
    res.json({ clients: clients.filter(Boolean).sort() });
  } catch (err) {
    console.error('logistic listClients error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/logistic/config — return dropdown configs ─────────────────────
exports.getConfig = (_req, res) => {
  res.json({ statusCategories: STATUS_CATEGORIES });
};
