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
  'Installed',
  'On Hold',
  'Cancelled',
];

// ─── Helper: compute poQty / shippedQty / balanceQty from stored opts ────────
const resolveQty = (opts, poProd, orderProd) => {
  // Prefer orderProd qty so Order-tab changes are reflected; fall back to poProd qty
  const poQty   = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (orderProd?.quantity ?? poProd?.quantity ?? 1);
  const shipped = Math.max(0, Number(opts.shippedQty ?? 0));
  const balance = Math.max(0, poQty - shipped);
  return { poQty, shipped, balance };
};

// ─── Helper: build a row for a POVersion product that has no matching selectedProduct ──
const buildRowFromPO = (order, poProd, po) => {
  const poProdOpts = poProd.selectedOptions || {};
  const { poQty, shipped, balance } = resolveQty(poProdOpts, poProd, null);
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
    shippedQuantity: shipped,
    balanceQuantity: balance,
    vendor:      po.vendorInfo?.name || '',
    description: poProd.description || '',

    projectCode: order.projectCode || '',
    unitNumber:  order.clientInfo?.unitNumber || '',
    clientName:  order.clientInfo?.name || '',
    orderNumber: order.orderNumber,

    location:            poProdOpts.location || '',
    cargoReadyDate:      poProdOpts.cargoReadyDate || '',
    shipmentDate:        poProdOpts.shipmentDate || '',
    logDrawing:          poProdOpts.logDrawing ?? 0,
    logMachining:        poProdOpts.logMachining ?? 0,
    logAssembly:         poProdOpts.logAssembly ?? 0,
    logFinishing:        poProdOpts.logFinishing ?? 0,
    logQcChecking:       poProdOpts.logQcChecking ?? 0,
    logPacking:          poProdOpts.logPacking ?? 0,
    packingList:         Number(poProdOpts.packingListQty ?? 0),
    containerNumber:     poProdOpts.containerNumber || '',
    statusCategory:      poProdOpts.statusCategory || '',
    expectedShipDate:    poProdOpts.expectedShipDate || '',
    expectedArrivalDate: poProdOpts.expectedArrivalDate || '',
    remark:              poProdOpts.remark || '',
    dateInspected:       poProdOpts.dateInspected || '',
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

  // Quantity, shipped, balance — resolved from stored overrides
  const { poQty, shipped, balance } = resolveQty(opts, poProd, orderProd);
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
    shippedQuantity: shipped,
    balanceQuantity: balance,
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
    packingList:         Number(opts.packingListQty ?? 0),
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
            // Skip duplicate — same selectedProduct already added from this PO
            if (coveredSpIds.has(sp._id?.toString())) continue;
            coveredSpIds.add(sp._id?.toString());
            rows.push(buildRow(order, sp, poProd, po));
          } else {
            rows.push(buildRowFromPO(order, poProd, po));
          }
        }
      }

      // Step 2: intentionally omitted — only show PO-linked items
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
      poQuantity,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const prodIdx = order.selectedProducts.findIndex(
      sp => sp._id?.toString() === productId
    );
    if (prodIdx === -1) return res.status(404).json({ message: 'Product not found in order' });

    const opts   = order.selectedProducts[prodIdx].selectedOptions || {};
    const sp     = order.selectedProducts[prodIdx];
    const prefix = `selectedProducts.${prodIdx}.selectedOptions`;
    const $set   = {};

    if (projectCode !== undefined)        $set['projectCode'] = projectCode;
    if (location !== undefined)           $set[`${prefix}.room`] = location;
    if (cargoReadyDate !== undefined)     $set[`${prefix}.cargoReadyDate`] = cargoReadyDate;
    if (shipmentDate !== undefined)       $set[`${prefix}.shipmentDate`] = shipmentDate;
    if (logDrawing != null)               $set[`${prefix}.logDrawing`] = Number(logDrawing);
    if (logMachining != null)             $set[`${prefix}.logMachining`] = Number(logMachining);
    if (logAssembly != null)              $set[`${prefix}.logAssembly`] = Number(logAssembly);
    if (logFinishing != null)             $set[`${prefix}.logFinishing`] = Number(logFinishing);
    if (logPacking != null)               $set[`${prefix}.logPacking`] = Number(logPacking);
    if (containerNumber !== undefined)    $set[`${prefix}.containerNumber`] = containerNumber;
    if (statusCategory !== undefined)     $set[`${prefix}.statusCategory`] = statusCategory;
    if (expectedShipDate !== undefined)   $set[`${prefix}.expectedShipDate`] = expectedShipDate;
    if (expectedArrivalDate !== undefined)$set[`${prefix}.expectedArrivalDate`] = expectedArrivalDate;
    if (remark !== undefined)             $set[`${prefix}.notes`] = remark;

    // PO QTY override — syncs to CPM product quantity as well
    let resolvedPoQty = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (sp.quantity ?? 1);
    if (poQuantity !== undefined) {
      resolvedPoQty = Number(poQuantity);
      $set[`${prefix}.poQtyOverride`] = resolvedPoQty;
      $set[`selectedProducts.${prodIdx}.quantity`] = resolvedPoQty;
    }

    // Packing list: additive accumulation of shipped qty
    let resolvedShipped = Math.max(0, Number(opts.shippedQty ?? 0));
    if (packingList !== undefined) {
      const batchQty = Number(packingList);
      if (batchQty > 0) {
        resolvedShipped += batchQty;
        $set[`${prefix}.shippedQty`]      = resolvedShipped;
        $set[`${prefix}.packingListQty`]  = batchQty;
      }
    }

    // QC Checking business logic: auto-fill dateInspected when reaches 100%
    let newDateInspected = opts.dateInspected || '';
    if (logQcChecking !== undefined) {
      const prev = opts.logQcChecking ?? 0;
      $set[`${prefix}.logQcChecking`] = Number(logQcChecking);
      if (Number(logQcChecking) === 5 && prev < 5 && !opts.dateInspected) {
        newDateInspected = new Date().toISOString().split('T')[0];
        $set[`${prefix}.dateInspected`] = newDateInspected;
      }
    }

    $set['updatedAt'] = Date.now();
    $set['updatedBy'] = req.user._id;

    await Order.updateOne({ _id: orderId }, { $set }, { strict: false });

    const resolvedBalance = Math.max(0, resolvedPoQty - resolvedShipped);

    res.json({
      message: 'Updated',
      dateInspected: newDateInspected,
      poQuantity: resolvedPoQty,
      shippedQuantity: resolvedShipped,
      balanceQuantity: resolvedBalance,
    });
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
      poQuantity,
    } = req.body;

    const po = await POVersion.findById(poVersionId);
    if (!po) return res.status(404).json({ message: 'POVersion not found' });

    const prodIdx = (po.products || []).findIndex(
      p => p._id?.toString() === poProductId
    );
    if (prodIdx === -1) return res.status(404).json({ message: 'Product not found in POVersion' });

    if (!po.products[prodIdx].selectedOptions) po.products[prodIdx].selectedOptions = {};
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
    setIfDefined('containerNumber',     containerNumber);
    setIfDefined('statusCategory',      statusCategory);
    setIfDefined('expectedShipDate',    expectedShipDate);
    setIfDefined('expectedArrivalDate', expectedArrivalDate);
    setIfDefined('remark',              remark);

    // PO QTY override — syncs to PO product quantity as well
    if (poQuantity !== undefined) {
      const qty = Number(poQuantity);
      opts.poQtyOverride = qty;
      po.products[prodIdx].quantity = qty;
    }

    // Packing list: additive accumulation of shipped qty
    if (packingList !== undefined) {
      const batchQty = Number(packingList);
      if (batchQty > 0) {
        opts.shippedQty = Math.max(0, Number(opts.shippedQty ?? 0)) + batchQty;
        opts.packingListQty = batchQty;
      }
    }

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

    const poProd = po.products[prodIdx];
    const resolvedPoQty = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (poProd.quantity ?? 1);
    const resolvedShipped = Math.max(0, Number(opts.shippedQty ?? 0));
    const resolvedBalance = Math.max(0, resolvedPoQty - resolvedShipped);

    res.json({
      message: 'Updated',
      dateInspected: opts.dateInspected || '',
      poQuantity: resolvedPoQty,
      shippedQuantity: resolvedShipped,
      balanceQuantity: resolvedBalance,
    });
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
