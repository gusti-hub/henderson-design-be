// controllers/logisticController.js
// Logistic Order Tracker — Developer Order (No Proposal) only (packageType: 'investor')
// Data source: Order.selectedProducts[] joined with POVersion for PO-level info.
// Scope: iteration 1 — investor orders only. Retail/Custom to follow in future iterations.

const Order            = require('../models/Order');
const POVersion        = require('../models/POVersion');
const LogisticAuditLog = require('../models/LogisticAuditLog');

// ─── Field metadata for audit logging ────────────────────────────────────────
const LOG_FIELDS = {
  cargoReadyDate:      { label: 'Cargo Ready Date',    optsKey: 'cargoReadyDate' },
  shipmentDate:        { label: 'Shipment Date',       optsKey: 'shipmentDate' },
  logDrawing:          { label: 'Drawing',             optsKey: 'logDrawing' },
  logMachining:        { label: 'Machining',           optsKey: 'logMachining' },
  logAssembly:         { label: 'Assembly',            optsKey: 'logAssembly' },
  logFinishing:        { label: 'Finishing',           optsKey: 'logFinishing' },
  logQcChecking:       { label: 'QC Checking',         optsKey: 'logQcChecking' },
  logPacking:          { label: 'Packing',             optsKey: 'logPacking' },
  containerNumber:     { label: 'Container #',         optsKey: 'containerNumber' },
  statusCategory:      { label: 'Status Category',     optsKey: 'statusCategory' },
  expectedShipDate:    { label: 'Exp. Ship Date',      optsKey: 'expectedShipDate' },
  expectedArrivalDate: { label: 'Exp. Arrival Date',   optsKey: 'expectedArrivalDate' },
  remark:              { label: 'Remark',              optsKey: 'notes' },
  orderDate:           { label: 'Order Date',          optsKey: 'orderDate' },
};

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
    orderDate:           opts.orderDate || '',
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

      // Build PO lookup by vendorId — same vendor-grouping as POEditor
      const poByVendorId = new Map();
      for (const po of orderPOs) {
        poByVendorId.set(po.vendorId?.toString(), po);
      }

      // Iterate over Order's selectedProducts (mirrors POEditor logic):
      // show every non-parent product that has a vendor with a PO
      for (const sp of sps) {
        if (sp.isParent) continue;

        const vendorId = sp.vendor?._id?.toString() || sp.vendor?.toString();
        if (!vendorId) continue;

        const po = poByVendorId.get(vendorId);
        if (!po) continue; // no PO for this vendor — only show PO-linked items

        // Find matching poProd for unitPrice / description etc. (optional)
        const poProd = (po.products || []).find(pp =>
          (pp.product_id && pp.product_id === sp.product_id) ||
          (pp.name       && pp.name       === sp.name)
        ) || null;

        rows.push(buildRow(order, sp, poProd, po));
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
      orderDate,
    } = req.body;

    const mongoose = require('mongoose');
    const elemId = new mongoose.Types.ObjectId(productId);
    const pf     = (f) => `selectedProducts.$[elem].selectedOptions.${f}`;

    // Read current product state (needed for QC logic and resolvedPoQty)
    const orderSnap = await Order.findOne(
      { _id: orderId, 'selectedProducts._id': elemId },
      { 'selectedProducts.$': 1 }
    ).lean();
    if (!orderSnap) return res.status(404).json({ message: 'Order not found' });
    const sp   = orderSnap.selectedProducts?.[0];
    if (!sp)   return res.status(404).json({ message: 'Product not found in order' });
    const opts = sp.selectedOptions || {};

    // Per-field $set — each field is independent so concurrent saves of different fields
    // on the same product never overwrite each other
    const setFields = { updatedAt: Date.now(), updatedBy: req.user._id };
    const incFields = {};

    if (projectCode !== undefined)         setFields.projectCode             = projectCode;
    // location/room is not editable via Logistic tracker
    if (cargoReadyDate !== undefined)      setFields[pf('cargoReadyDate')]   = cargoReadyDate;
    if (shipmentDate !== undefined)        setFields[pf('shipmentDate')]      = shipmentDate;
    if (logDrawing != null)                setFields[pf('logDrawing')]        = Number(logDrawing);
    if (logMachining != null)              setFields[pf('logMachining')]      = Number(logMachining);
    if (logAssembly != null)               setFields[pf('logAssembly')]       = Number(logAssembly);
    if (logFinishing != null)              setFields[pf('logFinishing')]      = Number(logFinishing);
    if (logPacking != null)                setFields[pf('logPacking')]        = Number(logPacking);
    if (containerNumber !== undefined)     setFields[pf('containerNumber')]   = containerNumber;
    if (statusCategory !== undefined)      setFields[pf('statusCategory')]    = statusCategory;
    if (expectedShipDate !== undefined)    setFields[pf('expectedShipDate')]  = expectedShipDate;
    if (expectedArrivalDate !== undefined) setFields[pf('expectedArrivalDate')] = expectedArrivalDate;
    if (remark !== undefined)              setFields[pf('notes')]             = remark;
    if (orderDate !== undefined)           setFields[pf('orderDate')]         = orderDate;

    // PO QTY
    let resolvedPoQty = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (sp.quantity ?? 1);
    if (poQuantity !== undefined) {
      resolvedPoQty = Number(poQuantity);
      setFields[pf('poQtyOverride')]                      = resolvedPoQty;
      setFields['selectedProducts.$[elem].quantity']      = resolvedPoQty;
    }

    // Packing list: $inc for atomic accumulation — prevents double-count on concurrent saves
    if (packingList !== undefined) {
      const batchQty = Number(packingList);
      if (batchQty > 0) {
        incFields[pf('shippedQty')]    = batchQty;
        setFields[pf('packingListQty')] = batchQty;
      }
    }

    // QC Checking: auto-fill dateInspected when reaches 100%
    let newDateInspected = opts.dateInspected || '';
    if (logQcChecking !== undefined) {
      const prev = opts.logQcChecking ?? 0;
      setFields[pf('logQcChecking')] = Number(logQcChecking);
      if (Number(logQcChecking) === 5 && prev < 5 && !opts.dateInspected) {
        newDateInspected = new Date().toISOString().split('T')[0];
        setFields[pf('dateInspected')] = newDateInspected;
      }
    }

    const updateOp = { $set: setFields };
    if (Object.keys(incFields).length > 0) updateOp.$inc = incFields;

    const updated = await Order.findOneAndUpdate(
      { _id: orderId },
      updateOp,
      { arrayFilters: [{ 'elem._id': elemId }], new: true }
    );

    const updatedProduct = (updated?.selectedProducts || []).find(p => p._id?.equals(elemId));
    const updatedOpts    = updatedProduct?.selectedOptions || {};
    const resolvedShipped = Math.max(0, Number(updatedOpts.shippedQty ?? 0));
    const resolvedBalance = Math.max(0, resolvedPoQty - resolvedShipped);

    // ── Audit log ────────────────────────────────────────────────────────────
    const auditChanges = [];
    for (const [reqField, meta] of Object.entries(LOG_FIELDS)) {
      const newVal = req.body[reqField];
      if (newVal === undefined) continue;
      const oldVal  = opts[meta.optsKey];
      const newNorm = reqField.startsWith('log') ? Number(newVal) : newVal;
      if (String(oldVal ?? '') !== String(newNorm ?? '')) {
        auditChanges.push({ field: meta.optsKey, label: meta.label, oldValue: oldVal ?? null, newValue: newNorm });
      }
    }
    if (poQuantity !== undefined) {
      const oldPQ = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (sp.quantity ?? 1);
      if (oldPQ !== Number(poQuantity)) {
        auditChanges.push({ field: 'poQtyOverride', label: 'PO Quantity', oldValue: oldPQ, newValue: Number(poQuantity) });
      }
    }
    if (packingList !== undefined && Number(packingList) > 0) {
      const oldShipped = Number(opts.shippedQty ?? 0);
      auditChanges.push({ field: 'shippedQty', label: 'Shipped Qty (batch)', oldValue: oldShipped, newValue: oldShipped + Number(packingList) });
    }
    if (projectCode !== undefined && String(sp.projectCode ?? '') !== String(projectCode)) {
      auditChanges.push({ field: 'projectCode', label: 'Project Code', oldValue: sp.projectCode ?? null, newValue: projectCode });
    }
    if (auditChanges.length > 0) {
      LogisticAuditLog.create({
        orderId,
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email || '',
        action: 'product_edited',
        productId: String(elemId),
        productName: sp.name || sp.product_id || '',
        changes: auditChanges,
      }).catch(e => console.error('audit log write error:', e));
    }

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

    const mongoose = require('mongoose');
    const poElemId = new mongoose.Types.ObjectId(poProductId);
    const ppf      = (f) => `products.$[elem].selectedOptions.${f}`;

    // Read current product state (needed for QC logic and resolvedPoQty)
    const poSnap = await POVersion.findOne(
      { _id: poVersionId, 'products._id': poElemId },
      { 'products.$': 1 }
    ).lean();
    if (!poSnap) return res.status(404).json({ message: 'POVersion not found' });
    const poProd = poSnap.products?.[0];
    if (!poProd) return res.status(404).json({ message: 'Product not found in POVersion' });
    const opts   = poProd.selectedOptions || {};

    const poSetFields = {};
    const poIncFields = {};

    // location is not editable via Logistic tracker
    if (cargoReadyDate !== undefined)      poSetFields[ppf('cargoReadyDate')]     = cargoReadyDate;
    if (shipmentDate !== undefined)        poSetFields[ppf('shipmentDate')]        = shipmentDate;
    if (logDrawing != null)                poSetFields[ppf('logDrawing')]          = Number(logDrawing);
    if (logMachining != null)              poSetFields[ppf('logMachining')]        = Number(logMachining);
    if (logAssembly != null)               poSetFields[ppf('logAssembly')]         = Number(logAssembly);
    if (logFinishing != null)              poSetFields[ppf('logFinishing')]        = Number(logFinishing);
    if (logPacking != null)                poSetFields[ppf('logPacking')]          = Number(logPacking);
    if (containerNumber !== undefined)     poSetFields[ppf('containerNumber')]     = containerNumber;
    if (statusCategory !== undefined)      poSetFields[ppf('statusCategory')]      = statusCategory;
    if (expectedShipDate !== undefined)    poSetFields[ppf('expectedShipDate')]    = expectedShipDate;
    if (expectedArrivalDate !== undefined) poSetFields[ppf('expectedArrivalDate')] = expectedArrivalDate;
    if (remark !== undefined)              poSetFields[ppf('remark')]              = remark;

    // PO QTY
    let resolvedPoQty = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (poProd.quantity ?? 1);
    if (poQuantity !== undefined) {
      resolvedPoQty = Number(poQuantity);
      poSetFields[ppf('poQtyOverride')]         = resolvedPoQty;
      poSetFields['products.$[elem].quantity']  = resolvedPoQty;
    }

    // Packing list: $inc for atomic accumulation
    if (packingList !== undefined) {
      const batchQty = Number(packingList);
      if (batchQty > 0) {
        poIncFields[ppf('shippedQty')]    = batchQty;
        poSetFields[ppf('packingListQty')] = batchQty;
      }
    }

    // QC Checking: auto-fill dateInspected when reaches 100%
    let newDateInspected = opts.dateInspected || '';
    if (logQcChecking !== undefined) {
      const prev = opts.logQcChecking ?? 0;
      poSetFields[ppf('logQcChecking')] = Number(logQcChecking);
      if (Number(logQcChecking) === 5 && prev < 5 && !opts.dateInspected) {
        newDateInspected = new Date().toISOString().split('T')[0];
        poSetFields[ppf('dateInspected')] = newDateInspected;
      }
    }

    const poUpdateOp = { $set: poSetFields };
    if (Object.keys(poIncFields).length > 0) poUpdateOp.$inc = poIncFields;

    const poUpdated = await POVersion.findOneAndUpdate(
      { _id: poVersionId },
      poUpdateOp,
      { arrayFilters: [{ 'elem._id': poElemId }], new: true }
    );

    const updatedPoProd   = (poUpdated?.products || []).find(p => p._id?.equals(poElemId));
    const updatedPoOpts   = updatedPoProd?.selectedOptions || {};
    const resolvedShipped = Math.max(0, Number(updatedPoOpts.shippedQty ?? 0));
    const resolvedBalance = Math.max(0, resolvedPoQty - resolvedShipped);

    // ── Audit log ────────────────────────────────────────────────────────────
    const poAuditChanges = [];
    for (const [reqField, meta] of Object.entries(LOG_FIELDS)) {
      const newVal = req.body[reqField];
      if (newVal === undefined) continue;
      const optsKey = reqField === 'remark' ? 'remark' : meta.optsKey;
      const oldVal  = opts[optsKey];
      const newNorm = reqField.startsWith('log') ? Number(newVal) : newVal;
      if (String(oldVal ?? '') !== String(newNorm ?? '')) {
        poAuditChanges.push({ field: optsKey, label: meta.label, oldValue: oldVal ?? null, newValue: newNorm });
      }
    }
    if (poQuantity !== undefined) {
      const oldPQ = opts.poQtyOverride != null ? Number(opts.poQtyOverride) : (poProd.quantity ?? 1);
      if (oldPQ !== Number(poQuantity)) {
        poAuditChanges.push({ field: 'poQtyOverride', label: 'PO Quantity', oldValue: oldPQ, newValue: Number(poQuantity) });
      }
    }
    if (packingList !== undefined && Number(packingList) > 0) {
      const oldShipped = Number(opts.shippedQty ?? 0);
      poAuditChanges.push({ field: 'shippedQty', label: 'Shipped Qty (batch)', oldValue: oldShipped, newValue: oldShipped + Number(packingList) });
    }
    if (poAuditChanges.length > 0) {
      // For PO-based products, use poVersionId as orderId substitute for grouping
      LogisticAuditLog.create({
        orderId: poSnap._id,
        performedBy: req.user._id,
        performedByName: req.user.name || req.user.email || '',
        action: 'product_edited',
        productId: String(poElemId),
        productName: poProd.name || poProd.product_id || '',
        changes: poAuditChanges,
      }).catch(e => console.error('audit log write error:', e));
    }

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

// ─── GET /api/logistic/audit — global audit log (all orders/products) ────────────
exports.getGlobalAuditLog = async (req, res) => {
  try {
    const { q, user, from, to, limit = 200, skip = 0 } = req.query;
    const query = {};
    if (user)  query.performedByName = { $regex: user, $options: 'i' };
    if (from)  query.createdAt = { ...query.createdAt, $gte: new Date(from) };
    if (to)    query.createdAt = { ...query.createdAt, $lte: new Date(new Date(to).getTime() + 86399999) };
    if (q) {
      query.$or = [
        { productName:      { $regex: q, $options: 'i' } },
        { performedByName:  { $regex: q, $options: 'i' } },
        { 'changes.label':  { $regex: q, $options: 'i' } },
      ];
    }
    const [logs, total] = await Promise.all([
      LogisticAuditLog.find(query).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
      LogisticAuditLog.countDocuments(query),
    ]);
    res.json({ logs, total });
  } catch (err) {
    console.error('getGlobalAuditLog error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/logistic/audit/rollback-global — rollback across any orders ───────
exports.rollbackGlobal = async (req, res) => {
  try {
    const { logIds } = req.body;
    if (!Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ message: 'logIds array required' });
    }
    const logs = await LogisticAuditLog.find({ _id: { $in: logIds }, action: { $ne: 'rollback' } }).lean();
    for (const log of logs) {
      await applyRollback(log, req.user);
    }
    res.json({ message: `${logs.length} entries rolled back` });
  } catch (err) {
    console.error('rollbackGlobal error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/logistic/:orderId/audit — fetch audit trail for an order ──────────
exports.getAuditLog = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId } = req.query;
    const query = { orderId };
    if (productId) query.productId = productId;
    const logs = await LogisticAuditLog.find(query).sort({ createdAt: -1 }).limit(300).lean();
    res.json(logs);
  } catch (err) {
    console.error('getAuditLog error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Shared rollback helper ───────────────────────────────────────────────────
async function applyRollback(log, user) {
  const mongoose = require('mongoose');
  const elemId   = new mongoose.Types.ObjectId(log.productId);
  const setFields = {};

  for (const change of log.changes) {
    const { field, oldValue } = change;
    if (field === 'projectCode') {
      setFields['selectedProducts.$[elem].projectCode'] = oldValue;
    } else {
      setFields[`selectedProducts.$[elem].selectedOptions.${field}`] = oldValue;
    }
  }

  if (Object.keys(setFields).length > 0) {
    await Order.findOneAndUpdate(
      { _id: log.orderId },
      { $set: { ...setFields, updatedAt: Date.now(), updatedBy: user._id } },
      { arrayFilters: [{ 'elem._id': elemId }] }
    );
  }

  await LogisticAuditLog.create({
    orderId: log.orderId,
    performedBy: user._id,
    performedByName: user.name || user.email || '',
    action: 'rollback',
    productId: log.productId,
    productName: log.productName,
    changes: log.changes.map(c => ({ field: c.field, label: c.label, oldValue: c.newValue, newValue: c.oldValue })),
    rollbackOf: log._id,
  });
}

// ─── POST /api/logistic/:orderId/audit/:logId/rollback — rollback single ────────
exports.rollbackEntry = async (req, res) => {
  try {
    const { orderId, logId } = req.params;
    const log = await LogisticAuditLog.findOne({ _id: logId, orderId }).lean();
    if (!log) return res.status(404).json({ message: 'Audit log not found' });
    if (log.action === 'rollback') return res.status(400).json({ message: 'Cannot rollback a rollback entry' });
    await applyRollback(log, req.user);
    res.json({ message: 'Rolled back successfully' });
  } catch (err) {
    console.error('rollbackEntry error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/logistic/:orderId/audit/rollback-bulk — rollback multiple ────────
exports.rollbackBulk = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { logIds } = req.body; // array of log _id strings
    if (!Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ message: 'logIds array required' });
    }
    const logs = await LogisticAuditLog.find({ _id: { $in: logIds }, orderId, action: { $ne: 'rollback' } }).lean();
    for (const log of logs) {
      await applyRollback(log, req.user);
    }
    res.json({ message: `${logs.length} entries rolled back` });
  } catch (err) {
    console.error('rollbackBulk error:', err);
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
