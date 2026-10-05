// scripts/verifyCogTotals.js
// Compares stored POVersion.total vs recalculated total (same formula as PO document).
// Run: node scripts/verifyCogTotals.js
// Or with env file: MONGO_URI="..." node scripts/verifyCogTotals.js

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set. Pass via .env or environment variable.');
  process.exit(1);
}

// ─── Minimal schemas (lean — no virtuals needed) ──────────────────────────────
const POVersion = mongoose.model('POVersion', new mongoose.Schema({}, { strict: false }), 'poversions');
const Order     = mongoose.model('Order',     new mongoose.Schema({}, { strict: false }), 'orders');

const fmt = (n) => `$${Number(n).toFixed(2)}`;
const TOLERANCE = 0.01; // cents

const computeNetCost = (p) => {
  const opts = p.selectedOptions || {};
  if (opts.netCostOverride != null && opts.netCostOverride !== '') return parseFloat(opts.netCostOverride) || 0;
  return parseFloat(opts.msrp || p.unitPrice || 0);
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const poVersions = await POVersion.find({}).lean();
  console.log(`Checking ${poVersions.length} POVersions...\n`);

  // Fetch all related orders (for client name + live product data)
  const orderIds = [...new Set(poVersions.map(p => p.orderId?.toString()).filter(Boolean))];
  const orders   = await Order.find({ _id: { $in: orderIds } }).lean();
  const orderMap = Object.fromEntries(orders.map(o => [o._id.toString(), o]));

  // Build product_id → order product map for live price/qty lookup (same as PO Editor sync)
  const globalProductMap = {};
  orders.forEach(o => {
    (o.selectedProducts || []).forEach(p => {
      if (p.product_id) globalProductMap[p.product_id] = p;
    });
  });

  const mismatches = [];
  const matches    = [];

  for (const po of poVersions) {
    // Recalculate using order data (mirrors PO Editor live sync)
    const prodTotal = (po.products || []).reduce((sum, poProduct) => {
      const op = globalProductMap[poProduct.product_id];
      if (op) return sum + computeNetCost(op) * (parseFloat(op.quantity) || 1);
      return sum + (parseFloat(poProduct.unitPrice) || 0) * (parseFloat(poProduct.quantity) || 1);
    }, 0);
    const addLines  = (po.additionalLines || []).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const shipping  = parseFloat(po.shipping) || 0;
    const others    = parseFloat(po.others)   || 0;
    const correct   = prodTotal + addLines + shipping + others;
    const stored    = parseFloat(po.total)    || 0;
    const diff      = Math.abs(correct - stored);

    const order      = orderMap[po.orderId?.toString()];
    const clientName = order?.clientInfo?.name || '—';
    const unitNum    = order?.clientInfo?.unitNumber || '';
    const vendor     = po.vendorInfo?.name || po.vendorId?.toString() || '—';
    const poNum      = po.poNumber || '(no PO#)';
    const version    = po.version ?? '?';
    const status     = po.status || 'draft';

    if (diff > TOLERANCE) {
      mismatches.push({ clientName, unitNum, vendor, poNum, version, status, stored, correct, diff, prodTotal, addLines, shipping, others });
    } else {
      matches.push({ clientName, vendor, poNum, correct });
    }
  }

  // ── Print results ────────────────────────────────────────────────────────────
  console.log(`✅ ${matches.length} PO(s) match exactly`);
  console.log(`❌ ${mismatches.length} PO(s) have discrepancies\n`);

  if (mismatches.length === 0) {
    console.log('All COG totals match PO documents. No action needed.');
    await mongoose.disconnect();
    return;
  }

  // Sort by biggest discrepancy first
  mismatches.sort((a, b) => b.diff - a.diff);

  console.log('─'.repeat(110));
  console.log(
    'Client'.padEnd(25) +
    'Unit'.padEnd(8) +
    'Vendor'.padEnd(30) +
    'PO#'.padEnd(22) +
    'Ver'.padEnd(5) +
    'Status'.padEnd(10) +
    'Stored'.padEnd(12) +
    'Correct'.padEnd(12) +
    'Diff'
  );
  console.log('─'.repeat(110));

  for (const m of mismatches) {
    console.log(
      m.clientName.slice(0, 24).padEnd(25) +
      (m.unitNum || '—').padEnd(8) +
      m.vendor.slice(0, 29).padEnd(30) +
      m.poNum.slice(0, 21).padEnd(22) +
      String(m.version).padEnd(5) +
      m.status.padEnd(10) +
      fmt(m.stored).padEnd(12) +
      fmt(m.correct).padEnd(12) +
      (m.correct > m.stored ? '+' : '-') + fmt(Math.abs(m.diff))
    );

    // Show breakdown if any component beyond products
    if (m.addLines || m.shipping || m.others) {
      const parts = [`  prod ${fmt(m.prodTotal)}`];
      if (m.addLines) parts.push(`addl ${fmt(m.addLines)}`);
      if (m.shipping) parts.push(`ship ${fmt(m.shipping)}`);
      if (m.others)   parts.push(`other ${fmt(m.others)}`);
      console.log('  └─ ' + parts.join(' + ') + ` = ${fmt(m.correct)}`);
    }
  }

  console.log('─'.repeat(110));
  console.log(`\nTotal discrepancy across all mismatched POs: ${fmt(mismatches.reduce((s, m) => s + m.diff, 0))}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
