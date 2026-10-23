// controllers/dashboardOverview.js
// Data for the admin Dashboard: what needs attention today, logistics pipeline, purchasing and project progress.
// Everything is computed from live order items (same rules as the PO Editor / Combined PO export).

const Order            = require('../models/Order');
const POVersion        = require('../models/POVersion');
const ProposalVersion  = require('../models/ProposalVersion');
const Expense          = require('../models/Expense');
const BillInvoice      = require('../models/BillInvoice');
const User             = require('../models/User');
const Vendor           = require('../models/Vendor');
const OrderAuditLog    = require('../models/OrderAuditLog');
const LogisticAuditLog = require('../models/LogisticAuditLog');

// Logistic "Status" is free text in the tracker → group it into a few stages
const STAGES = [
  { key: 'notStarted', label: 'No status yet' },
  { key: 'ordered',    label: 'Ordered / In production' },
  { key: 'transit',    label: 'In transit' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'installed',  label: 'Installed / Completed' },
  { key: 'issue',      label: 'On hold / Issue' },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.key, s.label]));

const stageOf = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return 'notStarted';
  if (/hold|damag|return|reject|not available|no longer|does not ship|removed|cancel/i.test(s)) return 'issue';
  if (/to be delivered|pending delivery/i.test(s)) return 'transit';
  if (/install|complet/i.test(s)) return 'installed';
  if (/deliver/i.test(s)) return 'delivered';
  if (/transit|shipped|freight|forwarder/i.test(s)) return 'transit';
  if (/order|purchas|production|acknowledg/i.test(s)) return 'ordered';
  return 'notStarted';
};
const ARRIVING_STAGES = new Set(['notStarted', 'ordered', 'transit']);   // not on site yet

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

// Same rule as the PO editor: net cost override if set, else MSRP / unit price
const itemCost = (p) => {
  const o = p.selectedOptions || {};
  const v = (o.netCostOverride !== null && o.netCostOverride !== undefined && o.netCostOverride !== '')
    ? parseFloat(o.netCostOverride) : parseFloat(o.msrp || p.unitPrice || 0);
  return (isNaN(v) ? 0 : v) * (p.quantity || 1);
};

const ORDER_SELECT = [
  'proposalNumber', 'status', 'projectCode', 'user', 'createdAt', 'updatedAt',
  'clientInfo.name', 'clientInfo.unitNumber',
  'selectedProducts.name', 'selectedProducts.product_id', 'selectedProducts.quantity', 'selectedProducts.isParent',
  'selectedProducts.vendor', 'selectedProducts.unitPrice',
  'selectedProducts.selectedOptions.statusCategory', 'selectedProducts.selectedOptions.expectedArrivalDate',
  'selectedProducts.selectedOptions.msrp', 'selectedProducts.selectedOptions.netCostOverride',
].join(' ');

const CACHE_MS = 60 * 1000;
let cache = { at: 0, key: '', data: null };

const build = async (includeMoney) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });   // YYYY-MM-DD (company is in Honolulu)
  const soon  = addDays(today, 14);

  const [orders, pos, vendors, proposals] = await Promise.all([
    Order.find({ status: { $ne: 'cancelled' } }).select(ORDER_SELECT).populate('user', 'collection').lean(),
    POVersion.find({ status: { $ne: 'cancelled' } })
      .select('orderId vendorId status version additionalLines shipping others').sort({ version: -1 }).lean(),
    Vendor.find().select('name').lean(),
    ProposalVersion.find().select('orderId version status').sort({ version: -1 }).lean(),
  ]);

  const vendorName = new Map(vendors.map(v => [String(v._id), String(v.name || '').trim()]));
  const latestPo = new Map();                                   // `${orderId}__${vendorId}` -> latest non-cancelled PO
  pos.forEach(po => { const k = `${po.orderId}__${po.vendorId}`; if (!latestPo.has(k)) latestPo.set(k, po); });

  // ── per item / per project ────────────────────────────────────────────────
  const stageCount = Object.fromEntries(STAGES.map(s => [s.key, 0]));
  const overdue = [], arriving = [];
  const projects = [];
  const funnel = { none: { count: 0, amount: 0 }, draft: { count: 0, amount: 0 }, sent: { count: 0, amount: 0 }, confirmed: { count: 0, amount: 0 }, paid: { count: 0, amount: 0 } };
  const vendorSpend = new Map();                                // vendorId -> amount
  let totalItems = 0;

  for (const o of orders) {
    const items = (o.selectedProducts || []).filter(p => !p.isParent);
    const client = o.clientInfo?.name || 'Unknown';
    const unit   = o.clientInfo?.unitNumber || '';
    const proj = { orderId: String(o._id), proposalNumber: o.proposalNumber || '', client, unit, collection: o.user?.collection || '', items: items.length, delivered: 0, installed: 0, transit: 0, issue: 0, overdue: 0, poAmount: 0, updatedAt: o.updatedAt || o.createdAt };

    const byVendor = new Map();
    for (const p of items) {
      totalItems++;
      const opts = p.selectedOptions || {};
      const st = stageOf(opts.statusCategory);
      stageCount[st]++;
      if (st === 'delivered') proj.delivered++;
      if (st === 'installed') proj.installed++;
      if (st === 'transit') proj.transit++;
      if (st === 'issue') proj.issue++;

      const vid = p.vendor ? String(p.vendor) : '';
      if (vid) { if (!byVendor.has(vid)) byVendor.set(vid, []); byVendor.get(vid).push(p); }

      const arr = opts.expectedArrivalDate;
      if (ARRIVING_STAGES.has(st) && isDate(arr)) {
        const row = { orderId: proj.orderId, client, unit, item: p.name || '', sku: p.product_id || '', vendor: vid ? (vendorName.get(vid) || '') : '', date: arr, stage: STAGE_LABEL[st] };
        if (arr < today) { proj.overdue++; overdue.push({ ...row, daysLate: daysBetween(arr, today) }); }
        else if (arr <= soon) arriving.push({ ...row, inDays: daysBetween(today, arr) });
      }
    }

    // PO value per vendor (live items + extra cost lines + shipping + others, like the PO editor)
    for (const [vid, list] of byVendor) {
      const po = latestPo.get(`${o._id}__${vid}`);
      const amount = list.reduce((s, p) => s + itemCost(p), 0)
        + (po ? (po.additionalLines || []).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) + (parseFloat(po.shipping) || 0) + (parseFloat(po.others) || 0) : 0);
      const status = po ? (funnel[po.status] ? po.status : 'draft') : 'none';
      funnel[status].count++;
      funnel[status].amount += amount;
      proj.poAmount += amount;
      vendorSpend.set(vid, (vendorSpend.get(vid) || 0) + amount);
    }
    projects.push(proj);
  }

  overdue.sort((a, b) => b.daysLate - a.daysLate);
  arriving.sort((a, b) => a.date.localeCompare(b.date));

  // ── accounting / approvals ────────────────────────────────────────────────
  const noQb = { $in: [null, ''] };
  const latestProposal = new Map();
  proposals.forEach(p => { const k = String(p.orderId); if (!latestProposal.has(k)) latestProposal.set(k, p.status); });
  const proposalCount = { draft: 0, sent: 0, approved: 0, paid: 0, rejected: 0 };
  latestProposal.forEach(s => { if (s in proposalCount) proposalCount[s]++; });

  const [pendingUsers, billReady, billFailed, expReady, expFailed] = await Promise.all([
    User.countDocuments({ status: 'pending', registrationType: 'self-registered' }),   // staff created by an admin keep the default 'pending' and are not waiting for anything
    BillInvoice.countDocuments({ status: 'confirmed', quickbooksId: noQb }),
    BillInvoice.countDocuments({ quickbooksStatus: 'failed' }),
    Expense.countDocuments({ status: 'confirmed', quickbooksId: noQb }),
    Expense.countDocuments({ quickbooksStatus: 'failed' }),
  ]);

  // ── recent changes (orders + logistic tracker) ────────────────────────────
  const [oLogs, lLogs] = await Promise.all([
    OrderAuditLog.find().sort({ createdAt: -1 }).limit(8).select('orderId performedByName action productName changes createdAt').lean(),
    LogisticAuditLog.find().sort({ createdAt: -1 }).limit(8).select('orderId performedByName action productName changes context createdAt').lean(),
  ]);
  const orderLabel = new Map(projects.map(p => [p.orderId, p.unit ? `${p.client} · Unit ${p.unit}` : p.client]));
  const ACTION_TEXT = { product_added: 'added', product_removed: 'removed', product_edited: 'edited', order_field_changed: 'changed order field', rollback: 'rolled back' };
  const describe = (l, source) => {
    const first = (l.changes || [])[0];
    const more = (l.changes || []).length > 1 ? ` +${l.changes.length - 1} more` : '';
    return {
      source, who: l.performedByName || 'Unknown', at: l.createdAt, orderId: String(l.orderId),
      project: orderLabel.get(String(l.orderId)) || l.context?.client || '',
      item: l.productName || '',
      text: `${ACTION_TEXT[l.action] || l.action}${first?.label ? ` · ${first.label}` : ''}${more}`,
    };
  };
  const recent = [...oLogs.map(l => describe(l, 'Order')), ...lLogs.map(l => describe(l, 'Logistic'))]
    .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);

  // ── shape the response ────────────────────────────────────────────────────
  const money = (n) => (includeMoney ? round2(n) : null);
  const open = (k) => funnel[k].count;
  const doneItems = stageCount.delivered + stageCount.installed;

  const attention = [
    { id: 'overdue',   level: 'danger',  count: overdue.length,       title: 'Items past expected arrival date', hint: 'Not delivered yet and the arrival date has passed', go: '/logistic-tracker' },
    { id: 'issue',     level: 'danger',  count: stageCount.issue,     title: 'Items on hold / with issues',      hint: 'On hold, damaged, returned or no longer available', go: '/logistic-tracker' },
    { id: 'qbFailed',  level: 'danger',  count: billFailed + expFailed, title: 'QuickBooks sync failed',          hint: 'Bill invoices / expenses that need a retry', go: '/expenses' },
    { id: 'billReady', level: 'warning', count: billReady + expReady, title: 'Ready to send to QuickBooks',      hint: 'Confirmed bill invoices / expenses not yet in QuickBooks', go: '/expenses' },
    { id: 'poSent',    level: 'warning', count: open('sent'),         title: 'POs sent, waiting for confirmation', hint: 'Vendor has not confirmed the latest PO', go: '/orders' },
    { id: 'proposalSent', level: 'warning', count: proposalCount.sent, title: 'Proposals sent to client',        hint: 'Waiting for client approval', go: '/orders' },
    { id: 'approvedUnpaid', level: 'info', count: proposalCount.approved, title: 'Approved proposals, not paid yet', hint: 'Client approved; payment not recorded', go: '/expenses' },
    { id: 'pendingUsers', level: 'info', count: pendingUsers,        title: 'Self-registered accounts waiting for approval', hint: 'Review them in User Management', go: '/user-management' },
  ];

  const topVendors = [...vendorSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([vid, amount]) => ({ vendor: vendorName.get(vid) || 'Unknown vendor', amount: money(amount) }));

  const projectRows = projects
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10)
    .map(p => ({ ...p, poAmount: money(p.poAmount) }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    includeMoney,
    kpis: {
      activeProjects: orders.length,
      totalItems,
      itemsOnSite: doneItems,
      onSitePct: totalItems ? Math.round((doneItems / totalItems) * 100) : 0,
      arrivingSoon: arriving.length,
      overdue: overdue.length,
      openPos: open('draft') + open('sent') + open('confirmed'),
      poOutstanding: money(funnel.sent.amount + funnel.confirmed.amount),
    },
    attention: attention.filter(a => a.count > 0),
    pipeline: STAGES.map(s => ({ key: s.key, label: s.label, count: stageCount[s.key] })),
    arriving: arriving.slice(0, 8),
    overdue: overdue.slice(0, 8),
    purchasing: {
      stages: [
        { key: 'none',      label: 'No PO yet',  count: funnel.none.count,      amount: money(funnel.none.amount) },
        { key: 'draft',     label: 'Draft',      count: funnel.draft.count,     amount: money(funnel.draft.amount) },
        { key: 'sent',      label: 'Sent',       count: funnel.sent.count,      amount: money(funnel.sent.amount) },
        { key: 'confirmed', label: 'Confirmed',  count: funnel.confirmed.count, amount: money(funnel.confirmed.amount) },
        { key: 'paid',      label: 'Paid',       count: funnel.paid.count,      amount: money(funnel.paid.amount) },
      ],
      topVendors,
    },
    projects: projectRows,
    recent,
  };
};

const getDashboardOverview = async (req, res) => {
  try {
    const perms = req.user?.permissions || [];
    if (req.user?.role !== 'admin' && !perms.includes('view_dashboard')) {
      return res.status(403).json({ message: 'Not allowed to view the dashboard' });
    }
    const includeMoney = req.user?.role === 'admin' || perms.includes('view_financial_review');
    const key = includeMoney ? 'money' : 'plain';
    const fresh = req.query.refresh === '1' || Date.now() - cache.at > CACHE_MS || cache.key !== key || !cache.data;
    if (fresh) cache = { at: Date.now(), key, data: await build(includeMoney) };
    res.json(cache.data);
  } catch (error) {
    console.error('Error building dashboard overview:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardOverview };
