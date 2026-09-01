// controllers/logisticController.js
// Logistic Order Tracker — Developer Order (No Proposal) only (packageType: 'investor')
// Data source: Order.selectedProducts[] joined with POVersion for PO-level info.
// Scope: iteration 1 — investor orders only. Retail/Custom to follow in future iterations.

const Order      = require('../models/Order');
const POVersion  = require('../models/POVersion');

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

// ─── Helper: build a row for a POVersion product that has no matching selectedProduct ──
const buildRowFromPO = (order, poProd, po) => {
  const poQty = poProd.quantity ?? 1;
  return {
    orderId:     order._id,
    productId:   null,          // no selectedProduct — row is read-only
    poVersionId: po._id,
    poProductId: poProd._id,
    _readOnly:   true,

    poNumber:    po.poNumber || '',
    poStatus:    po.status || '',
    poDate:      po.orderDate || '',
    skuNo:       poProd.product_id || '',
    itemName:    poProd.name || '',
    unitPrice:   poProd.unitPrice ?? 0,
    totalPrice:  (poProd.unitPrice ?? 0) * poQty,
    poQuantity:  poQty,
    shippedQuantity: 0,
    balanceQuantity: poQty,
    vendor:      po.vendorInfo?.name || '',
    description: poProd.description || '',

    projectCode: order.projectCode || '',
    unitNumber:  order.clientInfo?.unitNumber || '',
    clientName:  order.clientInfo?.name || '',
    orderNumber: order.orderNumber,

    location:            '',
    cargoReadyDate:      '',
    shipmentDate:        '',
    logDrawing:          0,
    logMachining:        0,
    logAssembly:         0,
    logFinishing:        0,
    logQcChecking:       0,
    logPacking:          0,
    packingList:         '',
    containerNumber:     '',
    statusCategory:      '',
    expectedShipDate:    '',
    expectedArrivalDate: '',
    remark:              '',
    dateInspected:       '',
  };
};

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

  // Vendor name: prefer PO vendorInfo, fallback to product's populated vendor object
  const vendorName = po?.vendorInfo?.name || orderProd.vendor?.name || '';

  return {
    // ── Identifiers ──
    orderId:     order._id,
    productId:   orderProd._id,   // always set — all rows are editable
    poVersionId: po?._id || null,
    poProductId: poProd?._id || null,

    // ── Read-only from CPM ──
    poNumber:    po?.poNumber || '',
    poStatus:    po?.status || '',
    poDate:      po?.orderDate || '',
    skuNo:       orderProd.product_id || poProd?.product_id || '',
    itemName:    orderProd.name || '',
    unitPrice:   poProd?.unitPrice ?? orderProd.unitPrice ?? 0,
    totalPrice:  (poProd?.unitPrice ?? orderProd.unitPrice ?? 0) * poQty,
    poQuantity:  poQty,
    shippedQuantity: computeShipped(poQty, packing),
    balanceQuantity: computeBalance(poQty, packing),
    vendor:      vendorName,
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
// 2-query approach: one Order fetch + one POVersion $in fetch (no N+1).
// JS groups results; O(n+m) instead of O(n×m).
exports.listEntries = async (req, res) => {
  try {
    const { projectCode, vendor, statusCategory, poStatus, expectedArrivalDate, search,
            page = '1', limit = '200' } = req.query;

    // 1. Fetch orders — project only the fields we actually use
    const orders = await Order.find({})
      .select([
        '_id', 'clientInfo.name', 'clientInfo.unitNumber',
        'projectCode', 'orderNumber',
        'selectedProducts._id', 'selectedProducts.isParent',
        'selectedProducts.product_id', 'selectedProducts.name',
        'selectedProducts.quantity', 'selectedProducts.unitPrice',
        'selectedProducts.vendor', 'selectedProducts.parentId',
        'selectedProducts.selectedOptions',
      ].join(' '))
      .populate('selectedProducts.vendor', 'name')
      .lean();

    if (!orders.length) return res.json({ data: [], total: 0, totalPages: 1 });

    const orderIds = orders.map(o => o._id);

    // 2. One POVersion query for all orders — project only needed fields
    const allPoVersions = await POVersion.find({
      orderId: { $in: orderIds },
      status:  { $ne: 'cancelled' },
    })
      .select('orderId vendorId vendorInfo.name poNumber orderDate status version products')
      .sort({ version: -1 })
      .lean();

    // Build latestByVendor: `orderId__vendorId` → latest PO (sorted desc, so first = latest)
    const latestPoFlat = new Map(); // `orderId__vendorId` → PO
    for (const po of allPoVersions) {
      const key = `${po.orderId?.toString()}__${po.vendorId?.toString()}`;
      if (!latestPoFlat.has(key)) latestPoFlat.set(key, po);
    }

    // Group by orderId → O(n+m) instead of O(n×m) startsWith scan
    const orderPOsMap = new Map(); // orderId_str → PO[]
    for (const po of latestPoFlat.values()) {
      const oid = po.orderId?.toString();
      if (!orderPOsMap.has(oid)) orderPOsMap.set(oid, []);
      orderPOsMap.get(oid).push(po);
    }

    // 3. Build rows
    const rows = [];

    for (const order of orders) {
      const oid    = order._id.toString();
      const sps    = order.selectedProducts || [];
      const orderPOs = orderPOsMap.get(oid) || [];

      // Build a quick name→sp and product_id→sp lookup to avoid O(n²) inner loop
      const spByProductId = new Map();
      const spByName      = new Map();
      for (const sp of sps) {
        if (!sp.isParent) {
          if (sp.product_id) spByProductId.set(sp.product_id, sp);
          if (sp.name)       spByName.set(sp.name, sp);
        }
      }

      const coveredSpIds = new Set();

      // Step 1: rows from POVersion.products[]
      for (const po of orderPOs) {
        for (const poProd of (po.products || [])) {
          const sp = (poProd.product_id && spByProductId.get(poProd.product_id))
                  || (poProd.name      && spByName.get(poProd.name))
                  || null;
          if (sp) {
            coveredSpIds.add(sp._id?.toString());
            rows.push(buildRow(order, sp, poProd, po));
          } else {
            rows.push(buildRowFromPO(order, poProd, po));
          }
        }
      }

      // Step 2: selectedProducts not covered by any PO
      for (const sp of sps) {
        if (coveredSpIds.has(sp._id?.toString())) continue;
        rows.push(buildRow(order, sp, null, null));
      }
    }

    // 4. Apply filters
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.itemName?.toLowerCase().includes(q) ||
        r.poNumber?.toLowerCase().includes(q) ||
        r.vendor?.toLowerCase().includes(q) ||
        r.projectCode?.toLowerCase().includes(q) ||
        r.clientName?.toLowerCase().includes(q)
      );
    }
    if (projectCode)         filtered = filtered.filter(r => r.projectCode?.toLowerCase().includes(projectCode.toLowerCase()));
    if (vendor)              filtered = filtered.filter(r => r.vendor?.toLowerCase().includes(vendor.toLowerCase()));
    if (statusCategory)      filtered = filtered.filter(r => r.statusCategory === statusCategory);
    if (poStatus)            filtered = filtered.filter(r => r.poStatus === poStatus);
    if (expectedArrivalDate) filtered = filtered.filter(r => r.expectedArrivalDate === expectedArrivalDate);

    // 5. Paginate
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

// ─── GET /api/logistic/clients — distinct client names across all orders ────────
exports.listClients = async (_req, res) => {
  try {
    const clients = await Order.distinct('clientInfo.name', {
      'clientInfo.name': { $exists: true, $ne: '' },
    });
    res.json({ clients: clients.filter(Boolean).sort() });
  } catch (err) {
    console.error('logistic listClients error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/logistic/config — return dropdown configs ─────────────────────
exports.getConfig = async (_req, res) => {
  try {
    const rawStatuses = await POVersion.distinct('status', { status: { $exists: true, $ne: null } });
    const poStatuses  = rawStatuses.filter(Boolean).sort();
    res.json({ statusCategories: STATUS_CATEGORIES, poStatuses });
  } catch (err) {
    res.json({ statusCategories: STATUS_CATEGORIES, poStatuses: [] });
  }
};
