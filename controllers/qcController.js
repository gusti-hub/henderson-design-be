const QCInspection = require('../models/QCInspection');
const POVersion    = require('../models/POVersion');
const Order        = require('../models/Order');
const { uploadFileToS3 } = require('../utils/s3Upload');

// ─── Helper: generate checks from product spec ───────────────────────────────
const generateChecks = (product) => {
  const opts = product.selectedOptions || {};
  const checks = [
    { label: 'Physical Condition', expectedValue: 'Good condition, no damage' },
    { label: 'Packaging',          expectedValue: 'Packaging intact and undamaged' },
    { label: 'Quantity',           expectedValue: String(product.quantity || 1) },
  ];
  if (opts.finish)     checks.push({ label: 'Color / Finish',   expectedValue: opts.finish });
  if (opts.size)       checks.push({ label: 'Size / Dimensions', expectedValue: opts.size });
  if (opts.fabric)     checks.push({ label: 'Fabric',           expectedValue: opts.fabric });
  if (opts.insetPanel) checks.push({ label: 'Panel Type',       expectedValue: opts.insetPanel });
  return checks.map(c => ({ ...c, result: 'pending', notes: '', photos: [] }));
};

// ─── GET /api/qc/pos — list POs available for QC ─────────────────────────────
exports.listPOs = async (req, res) => {
  try {
    const { type } = req.query; // 'receiving' | 'pre_delivery'

    const pos = await POVersion.find({ status: { $in: ['sent', 'confirmed', 'paid'] } })
      .populate({ path: 'orderId', select: 'clientInfo orderNumber' })
      .sort({ createdAt: -1 })
      .lean();

    // Attach existing QC inspection status per PO
    const poIds = pos.map(p => p._id);
    const inspections = await QCInspection.find({
      poId: { $in: poIds },
      ...(type ? { type } : {}),
    }).select('poId type status overallResult').lean();

    const inspMap = {};
    inspections.forEach(i => {
      const key = `${i.poId}_${i.type}`;
      inspMap[key] = { status: i.status, overallResult: i.overallResult, _id: i._id };
    });

    const result = pos.map(po => ({
      _id:        po._id,
      poNumber:   po.poNumber,
      vendorName: po.vendorInfo?.name || '',
      clientName: po.clientInfo?.name || po.orderId?.clientInfo?.name || '',
      orderNumber: po.orderId?.orderNumber || '',
      orderId:    po.orderId?._id || po.orderId,
      productCount: (po.products || []).length,
      poStatus:   po.status,
      createdAt:  po.createdAt,
      qcReceiving:   inspMap[`${po._id}_receiving`]   || null,
      qcPreDelivery: inspMap[`${po._id}_pre_delivery`] || null,
    }));

    res.json({ data: result });
  } catch (err) {
    console.error('listPOs error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/qc/inspections — create inspection from PO ────────────────────
exports.createInspection = async (req, res) => {
  try {
    const { poId, type } = req.body;
    if (!poId || !type) return res.status(400).json({ message: 'poId and type are required' });

    const po = await POVersion.findById(poId).lean();
    if (!po) return res.status(404).json({ message: 'PO not found' });

    // Prevent duplicate active inspection
    const existing = await QCInspection.findOne({ poId, type, status: 'in_progress' });
    if (existing) return res.json({ data: existing });

    const items = (po.products || []).map(product => ({
      product_id:   product.product_id,
      productName:  product.name,
      productImage: product.selectedOptions?.image || product.selectedOptions?.images?.[0] || '',
      quantity:     product.quantity || 1,
      checks:       generateChecks(product),
      overallResult: 'pending',
      notes:        '',
    }));

    const inspection = await QCInspection.create({
      orderId:    po.orderId,
      poId:       po._id,
      poNumber:   po.poNumber,
      vendorName: po.vendorInfo?.name || '',
      clientName: po.clientInfo?.name || '',
      type,
      status:     'in_progress',
      inspector:  { userId: req.user._id, name: req.user.name, email: req.user.email },
      items,
    });

    res.status(201).json({ data: inspection });
  } catch (err) {
    console.error('createInspection error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/qc/inspections — list all inspections ──────────────────────────
exports.listInspections = async (req, res) => {
  try {
    const { status, type, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const inspections = await QCInspection.find(filter)
      .select('poNumber vendorName clientName type status overallResult inspector startedAt completedAt')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ data: inspections });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/qc/inspections/:id — get inspection detail ─────────────────────
exports.getInspection = async (req, res) => {
  try {
    const inspection = await QCInspection.findById(req.params.id).lean();
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    res.json({ data: inspection });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/qc/inspections/:id — save progress ─────────────────────────────
exports.updateInspection = async (req, res) => {
  try {
    const { items, notes } = req.body;
    const inspection = await QCInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });
    if (inspection.status === 'completed') return res.status(400).json({ message: 'Inspection already completed' });

    if (items)  inspection.items = items;
    if (notes !== undefined) inspection.notes = notes;

    await inspection.save();
    res.json({ data: inspection });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/qc/inspections/:id/submit — final submit ──────────────────────
exports.submitInspection = async (req, res) => {
  try {
    const { items, notes, signature, overallResult } = req.body;
    const inspection = await QCInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ message: 'Inspection not found' });

    if (items)  inspection.items = items;
    if (notes !== undefined)   inspection.notes = notes;
    if (signature)             inspection.signature = { url: signature, signedAt: new Date() };
    inspection.overallResult = overallResult || computeOverallResult(items || inspection.items);
    inspection.status        = 'completed';
    inspection.completedAt   = new Date();

    await inspection.save();
    res.json({ data: inspection });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/qc/po/:poId/status — QC status for web ────────────────────────
exports.getPOQCStatus = async (req, res) => {
  try {
    const inspections = await QCInspection.find({ poId: req.params.poId })
      .select('type status overallResult completedAt inspector')
      .lean();
    res.json({ data: inspections });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const computeOverallResult = (items = []) => {
  const results = items.map(i => i.overallResult);
  if (results.includes('fail'))    return 'fail';
  if (results.includes('flagged')) return 'flagged';
  if (results.every(r => r === 'pass')) return 'pass';
  return 'pending';
};
