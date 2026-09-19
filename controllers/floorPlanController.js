const FloorPlanLayout = require('../models/FloorPlanLayout');
const Order           = require('../models/Order');
const POVersion       = require('../models/POVersion');
const { generatePresignedUploadUrl, HARDCODED_CONFIG, s3Client } = require('../config/s3');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const FOLDER = 'floor-plans';

// ── GET presigned upload URL ─────────────────────────────────────────────────
const getUploadUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType)
      return res.status(400).json({ message: 'filename and contentType required' });
    const result = await generatePresignedUploadUrl({ folder: FOLDER, filename, contentType });
    res.json({ uploadUrl: result.uploadUrl, key: result.key, publicUrl: result.publicUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET all floor plans for a client ────────────────────────────────────────
const getFloorPlans = async (req, res) => {
  try {
    const { clientUserId } = req.params;
    const plans = await FloorPlanLayout.find({ clientUserId }).sort({ type: -1, room: 1 }).lean();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST create / replace a floor plan ──────────────────────────────────────
const createFloorPlan = async (req, res) => {
  try {
    const { clientUserId } = req.params;
    const { type, room, imageUrl, imageKey } = req.body;
    if (!type || !imageUrl || !imageKey)
      return res.status(400).json({ message: 'type, imageUrl, imageKey required' });

    // Replace existing plan for same slot
    const query = type === 'room'
      ? { clientUserId, type: 'room', room: room || '' }
      : { clientUserId, type: 'full' };

    const existing = await FloorPlanLayout.findOne(query);
    if (existing) {
      try { await s3Client.send(new DeleteObjectCommand({ Bucket: HARDCODED_CONFIG.bucket, Key: existing.imageKey })); } catch {}
      await FloorPlanLayout.deleteOne({ _id: existing._id });
    }

    const plan = await FloorPlanLayout.create({
      clientUserId, type, room: room || '', imageUrl, imageKey, pins: [],
    });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT update pins on full floor plan ──────────────────────────────────────
const updatePins = async (req, res) => {
  try {
    const { id } = req.params;
    const { pins } = req.body;
    // Strip frontend-generated string _id (e.g. "pin_1234") — Mongoose expects ObjectId
    const mongoose = require('mongoose');
    const cleanPins = (pins || []).map(({ _id, ...rest }) => {
      if (_id && mongoose.Types.ObjectId.isValid(_id)) return { _id, ...rest };
      return rest;
    });
    const plan = await FloorPlanLayout.findByIdAndUpdate(id, { pins: cleanPins }, { new: true });
    if (!plan) return res.status(404).json({ message: 'Not found' });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE a floor plan ──────────────────────────────────────────────────────
const deleteFloorPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await FloorPlanLayout.findById(id);
    if (!plan) return res.status(404).json({ message: 'Not found' });
    try { await s3Client.send(new DeleteObjectCommand({ Bucket: HARDCODED_CONFIG.bucket, Key: plan.imageKey })); } catch {}
    await FloorPlanLayout.deleteOne({ _id: id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET products + rooms for a client (for pin selector) ────────────────────
const getClientProducts = async (req, res) => {
  try {
    const { clientUserId } = req.params;
    const orders = await Order.find({ user: clientUserId })
      .populate('selectedProducts.vendor')
      .lean();

    const products = [];
    const roomSet  = new Set();

    for (const order of orders) {
      const poVersions = await POVersion.find({ orderId: order._id }).sort({ version: -1 }).lean();
      const vendorPOMap = new Map();
      poVersions.forEach(po => {
        const k = po.vendorId?.toString();
        if (k && !vendorPOMap.has(k)) vendorPOMap.set(k, po.poNumber || '');
      });

      for (const p of (order.selectedProducts || [])) {
        if (p.isParent) continue;
        const room = p.selectedOptions?.room || '';
        if (room) roomSet.add(room);
        const vendorId = p.vendor?._id?.toString() || (typeof p.vendor === 'string' ? p.vendor : '');
        const poNumber = vendorPOMap.get(vendorId) || p.selectedOptions?.poNumber || '';
        products.push({
          _id:        p._id,
          product_id: p.product_id || '',
          name:       p.name || '',
          room,
          vendorName: p.vendor?.name || '',
          poNumber,
          quantity:   p.quantity || 1,
          orderId:    order._id,
        });
      }
    }

    res.json({ products, rooms: [...roomSet].sort() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET PDF — full floor plan + per-room pages ───────────────────────────────
const generatePDF = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const axios       = require('axios');
    const { clientUserId } = req.params;

    const [plans, orders] = await Promise.all([
      FloorPlanLayout.find({ clientUserId }).sort({ type: -1, room: 1 }).lean(),
      Order.find({ user: clientUserId }).populate('selectedProducts.vendor').lean(),
    ]);

    if (!plans.length) return res.status(404).json({ message: 'No floor plans found' });

    const clientName = orders[0]?.clientInfo?.name || 'Client';
    const unitNumber = orders[0]?.clientInfo?.unitNumber || '';

    // Build products list grouped by room
    const byRoom = new Map();
    const allPoVersions = await POVersion.find({
      orderId: { $in: orders.map(o => o._id) }
    }).sort({ version: -1 }).lean();
    const vendorPOMap = new Map();
    allPoVersions.forEach(po => {
      const k = po.vendorId?.toString();
      if (k && !vendorPOMap.has(k)) vendorPOMap.set(k, po.poNumber || '');
    });

    for (const order of orders) {
      for (const p of (order.selectedProducts || [])) {
        if (p.isParent) continue;
        const room = p.selectedOptions?.room || 'Other';
        const vendorId = p.vendor?._id?.toString() || '';
        if (!byRoom.has(room)) byRoom.set(room, []);
        byRoom.get(room).push({
          name:       p.name || '',
          vendorName: p.vendor?.name || '',
          poNumber:   vendorPOMap.get(vendorId) || p.selectedOptions?.poNumber || '',
          qty:        p.quantity || 1,
          desc:       buildDesc(p),
          imageUrl:   getPrimaryImage(p),
          vendorOrderNumber: p.selectedOptions?.vendorOrderNumber || '',
        });
      }
    }

    const fetchImg = async (url) => {
      if (!url || !url.startsWith('http')) return null;
      try {
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        const buf = Buffer.from(r.data);
        // Strip JPEG EXIF to avoid jpeg-exif buffer-bounds crash in pdfkit
        const stripped = stripJpegExif(buf);
        return { buffer: stripped };
      } catch { return null; }
    };

    // Remove all APP markers (0xFFE0–0xFFEF) from JPEG — pdfkit's jpeg-exif crashes on some
    const stripJpegExif = (buf) => {
      if (buf[0] !== 0xFF || buf[1] !== 0xD8) return buf; // not a JPEG, return as-is
      const out = [Buffer.from([0xFF, 0xD8])];
      let i = 2;
      while (i < buf.length - 1) {
        if (buf[i] !== 0xFF) break;
        const marker = buf[i + 1];
        if (marker === 0xD9) { out.push(buf.slice(i)); break; } // EOI
        if (marker === 0xDA) { out.push(buf.slice(i)); break; } // SOS — rest is image data
        const segLen = buf.length > i + 3 ? buf.readUInt16BE(i + 2) : 0;
        // Skip APP0–APP15 (0xE0–0xEF) to strip EXIF/metadata, keep everything else
        if (marker >= 0xE0 && marker <= 0xEF) {
          i += 2 + segLen;
        } else {
          out.push(buf.slice(i, i + 2 + segLen));
          i += 2 + segLen;
        }
      }
      return Buffer.concat(out);
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FloorPlan_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);

    const doc = new PDFDocument({ layout: 'landscape', size: 'letter', margins: { top: 36, bottom: 36, left: 36, right: 36 }, autoFirstPage: false });
    doc.pipe(res);

    const PW = 792, PH = 612, M = 36;

    const drawHeader = (title) => {
      doc.fontSize(14).fillColor('#005670').font('Helvetica-Bold').text('Henderson Design Group', M, M);
      doc.fontSize(8).fillColor('#666').font('Helvetica').text('Interior Design', M, M + 18);
      doc.fontSize(16).fillColor('#005670').font('Helvetica-Bold').text('Floor Plan', PW - M - 120, M, { width: 120, align: 'right' });
      doc.fontSize(8).fillColor('#333').font('Helvetica')
        .text(`Client: ${clientName}`, PW - M - 200, M + 18, { width: 200, align: 'right' })
        .text(`Project: ${clientName}${unitNumber ? ' - ' + unitNumber : ''}`, PW - M - 200, M + 28, { width: 200, align: 'right' });
      if (title) {
        doc.fontSize(10).fillColor('#005670').font('Helvetica-Bold').text(title, M, M + 36);
      }
      doc.moveTo(M, M + 50).lineTo(PW - M, M + 50).strokeColor('#005670').lineWidth(1.5).stroke();
    };

    // ── Cover page ────────────────────────────────────────────────────────────
    doc.addPage();
    // Top accent bar
    doc.rect(0, 0, PW, 8).fillColor('#005670').fill();
    // Brand
    doc.fontSize(28).fillColor('#005670').font('Helvetica-Bold')
       .text('Henderson Design Group', M, PH / 2 - 80, { width: PW - M * 2, align: 'center' });
    doc.fontSize(11).fillColor('#888').font('Helvetica')
       .text('Interior Design', M, PH / 2 - 44, { width: PW - M * 2, align: 'center' });
    // Divider
    doc.moveTo(PW / 2 - 80, PH / 2 - 20).lineTo(PW / 2 + 80, PH / 2 - 20)
       .strokeColor('#005670').lineWidth(1).stroke();
    // Document title
    doc.fontSize(20).fillColor('#333').font('Helvetica-Bold')
       .text('FLOOR PLAN PACKAGE', M, PH / 2, { width: PW - M * 2, align: 'center' });
    // Client info
    doc.fontSize(12).fillColor('#555').font('Helvetica')
       .text(clientName, M, PH / 2 + 36, { width: PW - M * 2, align: 'center' });
    if (unitNumber) {
      doc.fontSize(10).fillColor('#888').font('Helvetica')
         .text(`Unit ${unitNumber}`, M, PH / 2 + 54, { width: PW - M * 2, align: 'center' });
    }
    // Date
    doc.fontSize(9).fillColor('#aaa').font('Helvetica')
       .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), M, PH - M - 12, { width: PW - M * 2, align: 'center' });
    // Bottom accent bar
    doc.rect(0, PH - 8, PW, 8).fillColor('#005670').fill();

    // ── Page 2: Full floor plan with pins ────────────────────────────────────
    const fullPlan = plans.find(p => p.type === 'full');
    if (fullPlan) {
      doc.addPage();
      drawHeader(null);
      const imgData = await fetchImg(fullPlan.imageUrl);
      const imgY = M + 56, imgH = PH - imgY - M - 10;
      const imgW = PW - M * 2;
      if (imgData) {
        try { doc.image(imgData.buffer, M, imgY, { width: imgW, height: imgH, fit: [imgW, imgH] }); } catch (e) { console.warn('PDF image embed failed:', e.message); }
        // Draw pins as text labels
        for (const pin of (fullPlan.pins || [])) {
          const px = M + (pin.x / 100) * imgW;
          const py = imgY + (pin.y / 100) * imgH;
          const fontSize = Math.max(6, Math.round(8 * (pin.scale || 1)));
          doc.save();
          doc.translate(px, py);
          if (pin.rotation) doc.rotate(pin.rotation);
          // Label — no background, just bold colored text directly on floor plan
          const labelW = Math.min(120, Math.max(40, pin.skuLabel.length * fontSize * 0.65));
          doc.fontSize(fontSize).fillColor('#005670').font('Helvetica-Bold')
             .text(pin.skuLabel, -labelW / 2, -fontSize - 2, { width: labelW, align: 'center', lineBreak: false });
          doc.restore();
        }
      }
    }

    // ── Per-room pages ────────────────────────────────────────────────────────
    const roomPlans = plans.filter(p => p.type === 'room');
    const allRooms  = [...new Set([...roomPlans.map(p => p.room), ...byRoom.keys()])].sort();

    // Shared column config + fitText for product tables
    const TABLE_COLS = [
      { label: 'Vendor Name',        w: 80  },
      { label: 'Vendor Description', w: 200 },
      { label: 'HDG PO#',            w: 80  },
      { label: 'Qty',                w: 30  },
      { label: 'Vendor Order #',     w: 80  },
      { label: 'Date Received',      w: 70  },
      { label: 'Tracking Info',      w: 80  },
      { label: 'Shipping Carrier',   w: 60  },
      { label: 'Notes',              w: 60  },
    ];
    const tableScale = (PW - M * 2) / TABLE_COLS.reduce((s, c) => s + c.w, 0);
    const tableCols  = TABLE_COLS.map(c => ({ ...c, w: c.w * tableScale }));
    const fitText = (text, colW) => {
      const s = stripHtml(String(text || ''));
      const max = Math.max(1, Math.floor((colW - 4) / 3.8));
      return s.length > max ? s.slice(0, max - 1) + '…' : s;
    };

    const drawTable = (prods, startY) => {
      let y = startY;
      // Header row
      doc.rect(M, y, PW - M * 2, 18).fillColor('#1a1a1a').fill();
      let cx = M;
      tableCols.forEach(c => {
        doc.fontSize(7).fillColor('#fff').font('Helvetica-Bold')
          .text(fitText(c.label, c.w), cx + 2, y + 5, { lineBreak: false });
        cx += c.w;
      });
      y += 18;
      for (const p of prods) {
        if (y > PH - M - 20) break;
        const rowH = 18;
        doc.rect(M, y, PW - M * 2, rowH).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
        cx = M;
        const cells = [p.vendorName, p.desc, p.poNumber, String(p.qty), p.vendorOrderNumber, '', '', '', ''];
        cells.forEach((val, i) => {
          doc.fontSize(7).fillColor('#333').font('Helvetica')
            .text(fitText(val, tableCols[i].w), cx + 2, y + 5, { lineBreak: false });
          cx += tableCols[i].w;
        });
        y += rowH;
      }
    };

    for (const room of allRooms) {
      const roomPlan = roomPlans.find(p => p.room === room);
      const prods    = byRoom.get(room) || [];

      // ── Room floor plan — full page (same layout as full floor plan page) ──
      if (roomPlan) {
        const imgData = await fetchImg(roomPlan.imageUrl);
        doc.addPage();
        drawHeader(room.toUpperCase());
        const imgY = M + 56, imgH = PH - (M + 56) - M - 10;
        const imgW = PW - M * 2;
        if (imgData) {
          try { doc.image(imgData.buffer, M, imgY, { width: imgW, height: imgH, fit: [imgW, imgH] }); }
          catch (e) { console.warn('PDF image embed failed:', e.message); }
        }
      }

      // ── Product table — separate page ─────────────────────────────────────
      if (prods.length) {
        doc.addPage();
        drawHeader(room.toUpperCase());
        drawTable(prods, M + 60);
      }
    }

    // Footer on last page
    doc.fontSize(8).fillColor('#666').font('Helvetica')
      .text('Henderson Design Group  |  4343 Royal Place, Honolulu, HI 96816  |  (808) 315-8782', M, PH - M, { align: 'center', width: PW - M * 2 });

    doc.end();
  } catch (err) {
    console.error('Floor plan PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    } else {
      res.end();
    }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const stripHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]+>/g, ' ')   // remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')    // collapse whitespace
    .trim();
};

const buildDesc = (p) => {
  const opts = p.selectedOptions || {};
  const parts = [
    stripHtml(p.name),
    opts.size         ? `Size: ${stripHtml(opts.size)}`           : null,
    opts.finish       ? `Finish: ${stripHtml(opts.finish)}`       : null,
    opts.fabric       ? `Fabric: ${stripHtml(opts.fabric)}`       : null,
    opts.specifications ? stripHtml(opts.specifications)          : null,
  ].filter(Boolean);
  return parts.join(' | ');
};

const getPrimaryImage = (p) => {
  if (p.selectedOptions?.image)                            return p.selectedOptions.image;
  if (p.selectedOptions?.images?.length)                   return p.selectedOptions.images[0];
  if (p.selectedOptions?.uploadedImages?.length)           return p.selectedOptions.uploadedImages[0]?.url || null;
  return null;
};

module.exports = {
  getUploadUrl,
  getFloorPlans,
  createFloorPlan,
  updatePins,
  deleteFloorPlan,
  getClientProducts,
  generatePDF,
};
