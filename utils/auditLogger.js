// utils/auditLogger.js  v5 — fixed _id matching + better diagnostics

const mongoose    = require('mongoose');
const OrderAuditLog = require('../models/OrderAuditLog');

const FIELD_LABELS = {
  status:             'Order Status',
  installationDate:   'Installation Date',
  installationNotes:  'Installation Notes',
  proposalNumber:     'Proposal Number',
  'Package':          'Package',
  name:               'Product Name',
  product_id:         'SKU / Item #',
  category:           'Category',
  spotName:           'Spot Name',
  quantity:           'Quantity',
  unitPrice:          'Unit Price',
  finalPrice:         'Final Price',
  'selectedOptions.finish':                  'Color / Finish',
  'selectedOptions.fabric':                  'Fabric',
  'selectedOptions.size':                    'Dimensions',
  'selectedOptions.sidemark':                'Sidemark',
  'selectedOptions.group':                   'Group',
  'selectedOptions.tags':                    'Tags',
  'selectedOptions.itemClass':               'Item Class',
  'selectedOptions.cfaSampleApproval':       'CFA / Sample Approval',
  'selectedOptions.vendorDescription':       'Vendor Description',
  'selectedOptions.specifications':          'Client Description',
  'selectedOptions.notes':                   'Notes',
  'selectedOptions.leadTime':                'Lead Time',
  'selectedOptions.links':                   'Item URL(s)',
  'selectedOptions.image':                   'Primary Image',
  'selectedOptions.images':                  'Gallery Images',
  'selectedOptions.shipToName':              'Ship To Name',
  'selectedOptions.shippingStreet':          'Shipping Street',
  'selectedOptions.shippingCity':            'Shipping City',
  'selectedOptions.shippingState':           'Shipping State',
  'selectedOptions.shippingPostalCode':      'Shipping Postal Code',
  'selectedOptions.shippingCountry':         'Shipping Country',
  'selectedOptions.shipToPhone':             'Ship To Phone',
  'selectedOptions.poNumber':                'HDG PO#',
  'selectedOptions.vendorOrderNumber':       'Vendor Order Number',
  'selectedOptions.trackingInfo':            'Tracking Info',
  'selectedOptions.deliveryStatus':          'Delivery Status',
  'selectedOptions.installerNotes':          'Installer Notes',
  'selectedOptions.room':                    'Room',
  'selectedOptions.statusCategory':          'Status Category',
  'selectedOptions.shipTo':                  'Ship To',
  'selectedOptions.orderDate':               'Order Date',
  'selectedOptions.expectedShipDate':        'Expected Ship Date',
  'selectedOptions.expectedArrivalDate':     'Expected Arrival Date',
  'selectedOptions.dateReceived':            'Date Received',
  'selectedOptions.dateInspected':           'Date Inspected',
  'selectedOptions.estimatedDeliveryDate':   'Estimated Delivery Date',
  'selectedOptions.shippingCarrier':         'Shipping Carrier',
  'selectedOptions.orderStatus':             'Order Status',
  'selectedOptions.nextStep':                'Next Step',
  'selectedOptions.nextStepDate':            'Next Step Date',
  'selectedOptions.warehouseReceivingNumber':'Warehouse Receiving #',
  'selectedOptions.msrp':                    'MSRP / List Price',
  'selectedOptions.discountPercent':         'Discount %',
  'selectedOptions.netCostOverride':         'Net Cost',
  'selectedOptions.noNetPurchaseCost':       'No Net Purchase Cost',
  'selectedOptions.discountTaken':           'Discount Taken',
  'selectedOptions.shippingCost':            'Shipping Cost',
  'selectedOptions.otherCost':               'Other Cost',
  'selectedOptions.units':                   'Units',
  'selectedOptions.markupPercent':           'Markup %',
  'selectedOptions.shippingMarkupPercent':   'Shipping Markup %',
  'selectedOptions.otherMarkupPercent':      'Other Cost Markup %',
  'selectedOptions.depositPercent':          'Deposit %',
  'selectedOptions.vendorDepositPercent':    'Vendor Deposit %',
  'selectedOptions.salesTaxRate':            'Sales Tax Rate %',
  'selectedOptions.taxableCost':             'Taxable: Cost',
  'selectedOptions.taxableMarkup':           'Taxable: Markup',
  'selectedOptions.taxableShippingCost':     'Taxable: Shipping Cost',
  'selectedOptions.taxableShippingMarkup':   'Taxable: Shipping Markup',
  'selectedOptions.taxableOtherCost':        'Taxable: Other Cost',
  'selectedOptions.taxableOtherMarkup':      'Taxable: Other Markup',
};

const SKIP_FIELDS = new Set([
  'updatedAt', 'updatedBy', '__v',
  'selectedOptions.uploadedImages',
  'selectedOptions.customAttributes',
]);

const NUMERIC_ZERO_EQUIV = new Set([
  'selectedOptions.shippingCost',
  'selectedOptions.otherCost',
  'selectedOptions.discountPercent',
  'selectedOptions.markupPercent',
  'selectedOptions.shippingMarkupPercent',
  'selectedOptions.otherMarkupPercent',
  'selectedOptions.depositPercent',
  'selectedOptions.vendorDepositPercent',
  'selectedOptions.salesTaxRate',
  'quantity', 'unitPrice', 'finalPrice',
]);

const ORDER_LEVEL_FIELDS = [
  'status', 'installationDate', 'installationNotes', 'proposalNumber', 'Package',
];

// ── FIX 1: normalize vendor correctly — populated object vs raw ObjectId ──────
// Before: vendor populated = { _id, name } → normalize returns _id string
// After save: vendor might be raw ObjectId string, or still populated
// Both cases now produce the same normalized string
const normalize = (v) => {
  if (v === undefined || v === null) return '__NULL__';
  if (typeof v === 'number' && isNaN(v)) return '__NULL__';
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v && typeof v === 'object') {
    // ObjectId instance
    if (v instanceof mongoose.Types.ObjectId) return v.toString();
    // Populated vendor object { _id, name }
    if (v._id) return String(v._id);
    return JSON.stringify(v);
  }
  return String(v);
};

const normalizeField = (field, v) => {
  if (NUMERIC_ZERO_EQUIV.has(field)) {
    if (v === null || v === undefined || v === '' || v === false) return '__ZERO__';
    const n = parseFloat(v);
    if (isNaN(n) || n === 0) return '__ZERO__';
    return String(n);
  }
  return normalize(v);
};

const storeValue = (v) => {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v;
  return v ?? null;
};

const flattenProduct = (product) => {
  const flat = {};
  const TOP = [
    'name', 'product_id', 'category', 'spotName',
    'quantity', 'unitPrice', 'finalPrice', 'vendor',
    'sourceType', 'isEditable', 'package',
  ];
  TOP.forEach(k => {
    if (product[k] !== undefined) flat[k] = product[k];
  });
  const opts = product.selectedOptions || {};
  Object.keys(opts).forEach(k => {
    const path = `selectedOptions.${k}`;
    if (!SKIP_FIELDS.has(path)) flat[path] = opts[k];
  });
  return flat;
};

const diffFlatMaps = (before, after, productName = '') => {
  const changes = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  allKeys.forEach(field => {
    if (SKIP_FIELDS.has(field)) return;
    const oldNorm = normalizeField(field, before[field]);
    const newNorm = normalizeField(field, after[field]);
    if (oldNorm === newNorm) return;
    changes.push({
      field,
      label:    FIELD_LABELS[field] || field,
      oldValue: storeValue(before[field]),
      newValue: storeValue(after[field]),
    });
  });

  return changes;
};

// ── FIX 2: buildProductMap — handle both ObjectId and plain string _id ────────
const buildProductMap = (products = []) => {
  const map = new Map();
  (products || []).forEach(p => {
    // _id can be: ObjectId instance, string, or undefined
    const key = p._id
      ? (p._id instanceof mongoose.Types.ObjectId ? p._id.toString() : String(p._id))
      : null;
    if (key) map.set(key, p);
  });
  return map;
};

// ── FIX 3: validate performer before inserting ────────────────────────────────
const resolvePerformerId = (performer) => {
  const id = performer?._id || performer?.id;
  if (!id) return null;
  // If it's already a valid ObjectId, return as-is
  if (mongoose.Types.ObjectId.isValid(id)) return id;
  return null;
};

const logOrderChanges = async ({ before, after, performer }) => {
  try {
    if (!before || !after) {
      console.warn('[audit] ⚠️  missing before or after snapshot — skipping');
      return;
    }

    // ── FIX 3: validate performer _id early so insertMany doesn't fail silently
    const performerId = resolvePerformerId(performer);
    if (!performerId) {
      console.error('[audit] ❌ performer._id is missing or invalid:', performer);
      return;
    }

    console.log(
      `[audit] order ${after._id} — ` +
      `before: ${before.selectedProducts?.length ?? 0} products, ` +
      `after: ${after.selectedProducts?.length ?? 0} products, ` +
      `performer: ${performer.name} (${performerId})`
    );

    const logs = [];
    const base = {
      orderId:         after._id,
      performedBy:     performerId,
      performedByName: performer.name || 'Unknown',
    };

    // ── 1. Order-level ───────────────────────────────────────────────────────
    const orderChanges = [];
    ORDER_LEVEL_FIELDS.forEach(field => {
      const oldN = normalizeField(field, before[field]);
      const newN = normalizeField(field, after[field]);
      if (oldN === newN) return;
      orderChanges.push({
        field,
        label:    FIELD_LABELS[field] || field,
        oldValue: storeValue(before[field]),
        newValue: storeValue(after[field]),
      });
    });
    if (orderChanges.length > 0) {
      console.log(`[audit] order-level changes: ${orderChanges.map(c => c.field).join(', ')}`);
      logs.push({ ...base, action: 'order_field_changed', changes: orderChanges });
    }

    // ── 2. Product-level ─────────────────────────────────────────────────────
    const beforeMap = buildProductMap(before.selectedProducts);
    const afterMap  = buildProductMap(after.selectedProducts);

    console.log(`[audit] beforeMap keys: [${[...beforeMap.keys()].join(', ')}]`);
    console.log(`[audit] afterMap keys:  [${[...afterMap.keys()].join(', ')}]`);

    // Removed products
    beforeMap.forEach((product, id) => {
      if (!afterMap.has(id)) {
        console.log(`[audit] product removed: "${product.name}" (${id})`);
        logs.push({
          ...base,
          action:      'product_removed',
          productId:   id,
          productName: product.name || 'Unnamed',
          changes: [{
            field:    'product',
            label:    'Product',
            oldValue: { name: product.name, product_id: product.product_id },
            newValue: null,
          }],
          snapshot: null,
        });
      }
    });

    // Added or edited products
    afterMap.forEach((product, id) => {
      if (!beforeMap.has(id)) {
        console.log(`[audit] product added: "${product.name}" (${id})`);
        logs.push({
          ...base,
          action:      'product_added',
          productId:   id,
          productName: product.name || 'Unnamed',
          changes: [{
            field:    'product',
            label:    'Product',
            oldValue: null,
            newValue: { name: product.name, product_id: product.product_id },
          }],
          snapshot: product,
        });
      } else {
        const beforeFlat = flattenProduct(beforeMap.get(id));
        const afterFlat  = flattenProduct(product);
        const changes    = diffFlatMaps(beforeFlat, afterFlat, product.name || id);

        if (changes.length > 0) {
          console.log(
            `[audit] product edited: "${product.name}" — ` +
            changes.map(c => `${c.field}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join(' | ')
          );
          logs.push({
            ...base,
            action:      'product_edited',
            productId:   id,
            productName: product.name || 'Unnamed',
            changes,
            snapshot:    product,
          });
        } else {
          console.log(`[audit] product "${product.name || id}" — no diff`);
        }
      }
    });

    // ── 3. Insert ────────────────────────────────────────────────────────────
    if (logs.length > 0) {
      const result = await OrderAuditLog.insertMany(logs, { ordered: false });
      console.log(`[audit] ✅ ${result.length} log entry(s) saved`);
    } else {
      console.log(`[audit] nothing to log`);
    }

  } catch (err) {
    // Show full error — including validation failures
    console.error('[audit] ❌ write failed:', err.message);
    if (err.writeErrors) {
      err.writeErrors.forEach((we, i) => {
        console.error(`[audit]   writeError[${i}]:`, we.err?.errmsg || we.err?.message);
      });
    }
    if (err.errors) {
      Object.entries(err.errors).forEach(([k, v]) => {
        console.error(`[audit]   validation[${k}]:`, v.message);
      });
    }
  }
};

module.exports = { logOrderChanges, FIELD_LABELS };