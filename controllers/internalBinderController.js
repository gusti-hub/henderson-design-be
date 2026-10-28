// controllers/internalBinderController.js
// "Install Binder (PDF)": the internal working master for HDG (restricted) — Standards Review format:
// overall plan with the drag-and-drop pins, project / release controls, per-room placement + item register
// (supplier / PO), detailed item control cards, receiving, approvals, deferred register, references and closeout.
// Same shared item IDs as the Field Pack. Only stored data is printed; anything missing is a dash or a blank line to complete.

const path = require('path');
const FloorPlanLayout = require('../models/FloorPlanLayout');
const Order = require('../models/Order');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const POVersion = require('../models/POVersion');
const { vendorDescriptionText, latestNotePoints } = require('../utils/installBinderText');
const {
  C, PW, PH, M, DASH, UNASSIGNED_HEX, MARKER_COLORS, unitMarker, drawMarker,
  lc, titleCase, stripHtml, fetchImage, runPool, buildRooms, statusStyle, STATUS_LEGEND, attachInstallInstructions,
} = require('../utils/binderShared');

const ALIA_ADDRESS = '888 Ala Moana Boulevard, Honolulu HI 96814';
const REGISTER_PER_PAGE = 5, DETAIL_PER_PAGE = 2, RECEIVING_PER_PAGE = 9, DEFERRED_PER_PAGE = 8, CLOSEOUT_PER_PAGE = 6;
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const shortQty = (it) => it.qty.replace(/^QTY\s+/, '');
const val = (v) => (v === undefined || v === null || String(v).trim() === '' ? DASH : String(v).trim());

const generateInternalBinder = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { clientUserId } = req.params;

    const [plans, orders, clientUser] = await Promise.all([
      FloorPlanLayout.find({ clientUserId }).lean(),
      Order.find({ user: clientUserId }).lean(),
      User.findById(clientUserId).select('name teamAssignment').lean().catch(() => null),
    ]);
    if (!orders.length) return res.status(404).json({ message: 'No orders found for this client' });

    const clientName = (orders[0]?.clientInfo?.name || clientUser?.name || 'Client').trim();
    const unit = String(orders[0]?.clientInfo?.unitNumber || '').trim() || DASH;
    const residence = String(orders[0]?.clientInfo?.floorPlan || '').trim();
    const marker = unitMarker(unit);
    const markerHex = marker.confirmed ? MARKER_COLORS[marker.color] : UNASSIGNED_HEX;
    const markerName = marker.confirmed ? `${marker.color} ${marker.shape}` : 'TO BE ASSIGNED';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });

    const rooms = buildRooms(orders, plans, unit);
    await attachInstallInstructions(rooms);
    if (!rooms.length) return res.status(404).json({ message: 'No items or floor plans to put in a binder' });
    // same item objects as in rooms[].items (they are enriched below and read by every page)
    const allItems = rooms.flatMap(r => r.items);

    // ── Supplier + PO per item (latest non-cancelled PO of the item's own order + vendor) ──
    const vendorIdOf = (it) => String(it.raw.vendor?._id || it.raw.vendor || '');
    const vendorIds = [...new Set(allItems.map(vendorIdOf).filter(Boolean))];
    const [vendors, pos] = await Promise.all([
      Vendor.find({ _id: { $in: vendorIds } }).select('name representativeName contactInfo').lean(),
      POVersion.find({ orderId: { $in: orders.map(o => o._id) }, status: { $ne: 'cancelled' } }).select('orderId vendorId poNumber').sort({ version: -1 }).lean(),
    ]);
    const vendorById = {}; vendors.forEach(v => { vendorById[String(v._id)] = v; });
    const poByKey = {}; pos.forEach(po => { const k = `${po.orderId}__${po.vendorId}`; if (!(k in poByKey)) poByKey[k] = po.poNumber || ''; });
    allItems.forEach(it => {
      const o = it.raw.selectedOptions || {};
      const vid = vendorIdOf(it);
      const v = vendorById[vid];
      it.o = o;
      it.supplier = v?.name || '';
      it.po = poByKey[`${it.orderId}__${vid}`] || o.poNumber || '';
      it.contact = [v?.representativeName, v?.contactInfo?.phone, v?.contactInfo?.email]
        .filter(x => x && !/^(n\/?a|na|-|—)$/i.test(String(x).trim())).join(' · ');
      it.status = statusStyle(it.installStatus);
      it.collection = o.customAttributes?.collection || '';
    });

    // ── Page plan ────────────────────────────────────────────────────────────
    const plan = [];
    let page = 4;                                          // 1 cover, 2 overall plan, 3 project controls
    const sections = [['2', 'Overall unit plan'], ['3', 'Project / site / release controls']];
    const roomStart = page;
    rooms.forEach(r => {
      if (r.plan) plan.push({ type: 'placement', room: r, page: page++ });
      for (let k = 0; k < r.items.length; k += REGISTER_PER_PAGE) plan.push({ type: 'register', room: r, items: r.items.slice(k, k + REGISTER_PER_PAGE), page: page++ });
    });
    if (page > roomStart) sections.push([page - 1 > roomStart ? `${roomStart}-${page - 1}` : String(roomStart), 'Room placement plans / item register (supplier + PO)']);
    const detailStart = page;
    rooms.forEach(r => { for (let k = 0; k < r.items.length; k += DETAIL_PER_PAGE) plan.push({ type: 'detail', room: r, items: r.items.slice(k, k + DETAIL_PER_PAGE), page: page++ }); });
    if (page > detailStart) sections.push([page - 1 > detailStart ? `${detailStart}-${page - 1}` : String(detailStart), 'Detailed item control cards']);
    const recvStart = page;
    for (let k = 0; k < allItems.length; k += RECEIVING_PER_PAGE) plan.push({ type: 'receiving', items: allItems.slice(k, k + RECEIVING_PER_PAGE), page: page++ });
    if (page > recvStart) sections.push([page - 1 > recvStart ? `${recvStart}-${page - 1}` : String(recvStart), 'Receiving / cartons / assemblies']);
    plan.push({ type: 'approvals', page }); sections.push([String(page), 'Approvals, quality and open decisions']); page++;
    const deferred = allItems.filter(it => isYmd(it.o.expectedArrivalDate) && it.o.expectedArrivalDate > today)
      .sort((a, b) => a.o.expectedArrivalDate.localeCompare(b.o.expectedArrivalDate));
    const defStart = page;
    for (let k = 0; k < Math.max(1, deferred.length); k += DEFERRED_PER_PAGE) plan.push({ type: 'deferred', items: deferred.slice(k, k + DEFERRED_PER_PAGE), page: page++ });
    sections.push([page - 1 > defStart ? `${defStart}-${page - 1}` : String(defStart), 'Subsequent deliveries / deferred work']);
    plan.push({ type: 'technical', page }); sections.push([String(page), 'Technical / financial / evidence references']); page++;
    const closeStart = page;
    for (let k = 0; k < allItems.length; k += CLOSEOUT_PER_PAGE) plan.push({ type: 'closeout', items: allItems.slice(k, k + CLOSEOUT_PER_PAGE), page: page++, last: k + CLOSEOUT_PER_PAGE >= allItems.length });
    if (page > closeStart) sections.push([page - 1 > closeStart ? `${closeStart}-${page - 1}` : String(closeStart), 'Installation progress / closeout']);

    // ── Images: item photos + room plans + the overall plan ──────────────────
    const overallPlan = plans.find(p => p.type === 'room' && p.room === '_fullview_') || plans.find(p => p.type === 'full');
    const pinPlan = plans.find(p => p.type === 'full');
    const itemImgs = {}, planImgs = {};
    let overallImg = null;
    const jobs = [];
    if (overallPlan) jobs.push(async () => { overallImg = await fetchImage(overallPlan.imageUrl, 1800, 80); });
    rooms.forEach(r => {
      if (r.plan) jobs.push(async () => { planImgs[r.name] = await fetchImage(r.plan.imageUrl, 1800, 80); });
      r.items.forEach(i => { if (i.imageUrl) jobs.push(async () => { itemImgs[i.productId || i.id] = await fetchImage(i.imageUrl, 360, 70); }); });
    });
    await runPool(jobs, 8, (j) => j());

    // ── PDF ──────────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="InstallBinder_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_Unit_${unit.replace(/[^a-zA-Z0-9]/g, '')}.pdf"`);
    const doc = new PDFDocument({ size: 'letter', layout: 'landscape', margins: { top: 0, bottom: 0, left: 0, right: 0 }, autoFirstPage: false, bufferPages: false });
    doc.pipe(res);
    const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
    doc.registerFont('CL', path.join(FONT_DIR, 'CalibriLight.ttf'));
    doc.registerFont('CB', path.join(FONT_DIR, 'CalibriBold.ttf'));

    const txt = (s, x, y, o = {}) => {
      doc.font(o.bold ? 'CB' : 'CL').fontSize(o.size || 9).fillColor(o.color || C.ink);
      doc.text(String(s), x, y, { width: o.width, height: o.height, align: o.align || 'left', lineBreak: o.lineBreak !== false, ellipsis: o.ellipsis });
    };
    const hline = (y, x1 = M, x2 = PW - M, color = C.line, w = 0.7) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke();
    const box = (x, y, w, h, fill, stroke) => { doc.lineWidth(0.7).rect(x, y, w, h); if (fill && stroke) doc.fillAndStroke(fill, stroke); else if (fill) doc.fill(fill); else doc.stroke(stroke || C.line); };
    const putImage = (img, x, y, w, h) => {
      if (!img) return false;
      const s = Math.min(w / img.w, h / img.h), iw = img.w * s, ih = img.h * s;
      try { doc.image(img.buffer, x + (w - iw) / 2, y + (h - ih) / 2, { width: iw, height: ih }); return true; } catch { return false; }
    };
    const photoBox = (img, x, y, w, h) => {
      if (!putImage(img, x, y, w, h)) { box(x, y, Math.min(w, 60), 30, C.panel, C.line); txt('PHOTO\nREQUIRED', x + 3, y + 6, { bold: true, size: 6.5, color: C.gray, width: 56 }); }
    };
    const circleNum = (cx, cy, r, num, color) => {
      doc.save().circle(cx, cy, r).fill(color).restore();
      doc.circle(cx, cy, r).lineWidth(Math.max(0.8, r * 0.12)).strokeColor('#ffffff').stroke();
      txt(num, cx - r, cy - r * 0.46, { bold: true, size: r * 0.95, color: '#ffffff', width: r * 2, align: 'center', lineBreak: false });
    };
    const legendRow = (x, y) => {
      let cx = x;
      STATUS_LEGEND.forEach(l => {
        doc.save().circle(cx + 4, y + 4.5, 3.6).fill(l.color).restore();
        txt(l.label, cx + 11, y, { size: 7.5, color: C.gray, lineBreak: false });
        cx += 20 + l.label.length * 3.9;
      });
    };

    const startPage = (title, subtitle, pageNo) => {
      doc.addPage();
      txt('HENDERSON', M, 24, { bold: true, size: 15, color: C.navy, lineBreak: false });
      txt('D E S I G N   G R O U P', M, 42, { size: 6, color: C.teal, lineBreak: false });
      txt('RESTRICTED / HDG ONLY', 380, 24, { bold: true, size: 8.5, color: C.rust, lineBreak: false });
      txt(`${unit} INTERNAL BINDER / ${dateStr}`, 380, 38, { size: 7.5, color: C.gray, lineBreak: false });
      drawMarker(doc, marker.shape, PW - M - 14, 36, 26, markerHex);
      txt(unit, PW - M - 34, 31, { bold: true, size: 8.5, color: C.white, width: 40, align: 'center', lineBreak: false });
      hline(56, M, PW - M, C.teal, 0.8);
      if (title) txt(title, M, 66, { bold: true, size: 21, color: C.navy, width: PW - M * 2, lineBreak: false, ellipsis: true });
      if (subtitle) txt(subtitle, M, 94, { size: 8.5, color: C.gray, width: PW - M * 2, lineBreak: false, ellipsis: true });
      hline(PH - 30, M, PW - M);
      txt('Internal control / Same IDs as field binder, floor plan, product tag and carton label.', M, PH - 24, { size: 6.5, color: C.gray, width: 600, lineBreak: false });
      txt(String(pageNo).padStart(2, '0'), PW - M - 40, PH - 26, { bold: true, size: 9, color: C.navy, width: 40, align: 'right', lineBreak: false });
    };
    const tableHeader = (y, cols, labels) => {
      box(M, y, PW - M * 2, 26, C.navy);
      labels.forEach((l, i) => txt(l, cols[i], y + 8, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
    };

    // ── 1. Cover + contents ──────────────────────────────────────────────────
    startPage('Internal installation control', 'One working master per unit. Supplier, PO and decision detail stay out of the field export.', 1);
    box(M, 112, PW - M * 2, 120, C.navy);
    txt(`ĀLIA / UNIT ${unit}${residence ? ' / ' + residence.toUpperCase() : ''}`, M + 26, 128, { bold: true, size: 14, color: C.white, lineBreak: false });
    txt('Internal binder / working master', M + 26, 152, { bold: true, size: 30, color: C.white, lineBreak: false });
    txt('Private coordination, purchasing and installation evidence', M + 26, 196, { size: 12, color: C.white, lineBreak: false });
    drawMarker(doc, marker.shape, PW - M - 80, 172, 78, markerHex);
    txt(unit, PW - M - 130, 156, { bold: true, size: 26, color: C.white, width: 100, align: 'center', lineBreak: false });
    txt('The same visual identity as the field binder, with the source facts behind each item. Information that is not stored in the system is shown as a dash or a blank line to be completed.', M, 246, { size: 11, width: PW - M * 2, height: 40 });
    const half = Math.ceil(sections.length / 2);
    const colX = [M, M + 60, M + 362, M + 422];
    box(M, 296, PW - M * 2, 24, C.navy);
    ['Page', 'Section', 'Page', 'Section'].forEach((h, i) => txt(h, colX[i] + 8, 303, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
    for (let i = 0; i < half; i++) {
      const y = 320 + i * 38;
      if (i % 2 === 0) box(M, y, PW - M * 2, 38, C.panel);
      hline(y + 38);
      [[0, sections[i]], [2, sections[i + half]]].forEach(([c, sec]) => {
        if (!sec) return;
        txt(sec[0], colX[c] + 8, y + 13, { size: 10, lineBreak: false });
        txt(sec[1], colX[c + 1] + 8, y + 13, { size: 10, width: 290, height: 24, ellipsis: true });
      });
    }
    txt(`Evidence standard: source snapshot taken ${now.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}. Receipt, completion and release evidence appears only where it is recorded in the system; blank lines remain open.`, M, 320 + half * 38 + 10, { size: 8.5, color: C.gray, width: PW - M * 2 });

    // ── 2. Overall plan with the pins from the Install Binder pin layout ─────
    startPage('Overall floor plan / unit routing', `${marker.confirmed ? `${unit} = ${markerName}. ` : ''}Use the numbered room sheets for installation. Pins show the item number, coloured by Install Status.`, 2);
    const OX = M, OY = 104, OW = PW - M * 2, OH = 396;
    if (overallImg) {
      const s = Math.min(OW / overallImg.w, OH / overallImg.h), rw = overallImg.w * s, rh = overallImg.h * s;
      const ix = OX + (OW - rw) / 2, iy = OY + (OH - rh) / 2;
      doc.image(overallImg.buffer, ix, iy, { width: rw, height: rh });
      const byProduct = {};
      orders.forEach(o => (o.selectedProducts || []).forEach(p => { byProduct[String(p._id)] = p; }));
      const numByProduct = {}; allItems.forEach(it => { numByProduct[it.productId] = it.num; });
      for (const pin of (pinPlan?.pins || [])) {
        const p = byProduct[String(pin.productId)];
        const color = statusStyle(p?.selectedOptions?.installStatus).color;
        const r = Math.max(10, rw * 0.024) * (pin.scale || 1) / 2;       // same ratio as the editor
        circleNum(ix + (pin.x / 100) * rw, iy + (pin.y / 100) * rh, r, numByProduct[String(pin.productId)] || DASH, p ? color : UNASSIGNED_HEX);
      }
    } else {
      txt('Overall floor plan not uploaded.', OX, OY + OH / 2, { size: 11, color: C.gray, width: OW, align: 'center' });
    }
    box(M, 508, PW - M * 2, 28, C.panel, C.line);
    txt('ROUTING ONLY / Unnumbered source symbols do not authorize work. Match the pin number to the item register.', M + 14, 516, { bold: true, size: 9.5, color: C.teal, lineBreak: false });
    legendRow(M, 546);

    // ── 3. Project / site / release controls ─────────────────────────────────
    startPage('Project / site / release controls', 'Known project facts are prefilled. Blank lines identify information still to be assigned or verified.', 3);
    const team = clientUser?.teamAssignment || {};
    const designerLine = [team.designer, team.projectManager].filter((v, i, a) => v && a.indexOf(v) === i).join(' / ');
    box(M, 116, 352, 20 + 6 * 34 + 16, C.white, C.line); box(M, 116, 352, 26, C.panel, C.line);
    txt('Project and current issue', M + 14, 123, { bold: true, size: 11.5, color: C.teal, lineBreak: false });
    [['Project / unit', `Ālia / ${unit}${marker.confirmed ? ' / ' + markerName.toLowerCase() : ''}`], ['Site address', ALIA_ADDRESS], ['Scope baseline', DASH], ['Progress reported', DASH], ['Item-level closeout', DASH], ['Internal / field revisions', '__________']]
      .forEach(([k, v], i) => txt(`${k}  ${v}`, M + 14, 152 + i * 34, { size: 10, width: 326, height: 30 }));
    box(M + 368, 116, 352, 20 + 6 * 34 + 16, C.white, C.line); box(M + 368, 116, 352, 26, C.panel, C.line);
    txt('People and access', M + 382, 123, { bold: true, size: 11.5, color: C.teal, lineBreak: false });
    [['HDG lead / mobile', '____________________'], ['Designer / administration', designerLine || '____________________'], ['Building / delivery contact', '____________________'], ['Loading / elevator / hours', '____________________'], ['Access restrictions / protection', '____________________']]
      .forEach(([k, v], i) => txt(`${k}  ${v}`, M + 382, 152 + i * 28, { size: 10, width: 326, lineBreak: false }));
    const relY = 116 + 20 + 6 * 34 + 16 + 20;
    tableHeader(relY, [M + 12, M + 330], ['Release requirement', 'Evidence / owner']);
    [['Scope, quantities and delivery allocation', 'Baseline reference: __________   Owner: __________'], ['Drawing / technical approvals', 'Drawing revision: __________   Approved by: __________'], ['Stock, cartons and access checked', 'Evidence: __________   Checked by: __________'], ['Paired field issue authorized', 'Revision / date: __________   Issued by: __________']]
      .forEach(([a, b], i) => { const y = relY + 26 + i * 34; if (i % 2 === 0) box(M, y, PW - M * 2, 34, C.panel); hline(y + 34); txt(a, M + 12, y + 11, { size: 10, lineBreak: false }); txt(b, M + 330, y + 11, { size: 10, lineBreak: false }); });

    // ── Room pages / details / forms ─────────────────────────────────────────
    const roomTitle = (r) => titleCase(r.name);
    for (const pg of plan) {
      if (pg.type === 'placement') {
        const r = pg.room;
        startPage(`${roomTitle(r)} / ${r.code} / Placement`, 'Source drawing. Item IDs of this room are in the register that follows. Verify written dimensions; do not scale drawing.', pg.page);
        if (!putImage(planImgs[r.name], M, 104, PW - M * 2, 440)) txt('Floor plan not uploaded for this room.', M, 300, { size: 11, color: C.gray, width: PW - M * 2, align: 'center' });
        if (!r.items.length) txt('HOLD / Product schedule missing for this room.', M, 552, { bold: true, size: 10, color: C.rust, lineBreak: false });
      } else if (pg.type === 'register') {
        const r = pg.room;
        startPage(`${roomTitle(r)} / ${r.code} / Internal item register`, 'Same IDs as the field plan. Source movement notes and present verification are separate records.', pg.page);
        const cols = [M + 12, M + 106, M + 186, M + 372, M + 542];
        tableHeader(112, cols, ['Shared ID', 'Photo', 'Item / required quantity', 'Supplier / PO', 'Movement / verification']);
        pg.items.forEach((it, i) => {
          const y = 138 + i * 78;
          if (i % 2 === 0) box(M, y, PW - M * 2, 78, C.panel);
          hline(y + 78);
          circleNum(M + 30, y + 24, 13, it.num, it.status.color);
          txt(it.id, M + 12, y + 46, { bold: true, size: 8.5, width: 90, lineBreak: false });
          photoBox(itemImgs[it.productId || it.id], cols[1], y + 8, 66, 62);
          txt(it.name, cols[2], y + 10, { size: 10, width: 176, height: 38, ellipsis: true });
          txt(shortQty(it), cols[2], y + 50, { size: 9.5, color: C.teal, bold: true, lineBreak: false });
          txt(val(it.supplier), cols[3], y + 10, { size: 10, width: 160, height: 30, ellipsis: true });
          txt(`PO ${val(it.po)}`, cols[3], y + 46, { size: 9.5, lineBreak: false });
          txt(`${val(it.statusCategory)} / source`, cols[4], y + 10, { size: 9.5, width: 140, height: 24, ellipsis: true });
          txt(`Install: ${it.status.label}`, cols[4], y + 36, { size: 9.5, bold: true, color: it.status.color, lineBreak: false });
          txt('Physical / closeout check: ____', cols[4], y + 54, { size: 8.5, color: C.gray, width: 140, lineBreak: false });
        });
        txt('Required quantities are retained from source. Ordered rolls are not an installed count. Duplicate PO rows must not add to required quantities. Collection is not decoded from HDG codes without the code key.', M, 534, { size: 8, color: C.gray, width: PW - M * 2, height: 22 });
        legendRow(M, 562);
      } else if (pg.type === 'detail') {
        const r = pg.room;
        startPage(`${roomTitle(r)} / ${r.code} / Detailed control`, 'Source facts, approved changes, receipt evidence and installation checks stay behind the same shared ID.', pg.page);
        pg.items.forEach((it, i) => {
          const y = 104 + i * 224, o = it.o;
          box(M, y, PW - M * 2, 214, C.white, C.line);
          circleNum(M + 24, y + 24, 14, it.num, it.status.color);
          txt(`${it.id} / ${it.name}`, M + 48, y + 8, { bold: true, size: 13, color: C.navy, width: 600, lineBreak: false, ellipsis: true });
          txt(`Required: ${shortQty(it)}`, M + 48, y + 26, { bold: true, size: 9.5, color: C.teal, lineBreak: false });
          photoBox(itemImgs[it.productId || it.id], M + 12, y + 46, 118, 76);
          txt('Original HDG product code', M + 12, y + 126, { size: 7.5, color: C.gray, lineBreak: false });
          txt(val(it.sku), M + 12, y + 135, { bold: true, size: 8, width: 118, height: 18, ellipsis: true });
          txt('Collection', M + 12, y + 156, { size: 7.5, color: C.gray, lineBreak: false });
          txt(val(it.collection), M + 12, y + 165, { size: 8, width: 118, lineBreak: false, ellipsis: true });
          // purchasing / movement
          box(M + 142, y + 44, 236, 126, C.white, C.line); box(M + 142, y + 44, 236, 17, C.panel, C.line);
          txt('Purchasing / movement', M + 150, y + 48, { bold: true, size: 9, color: C.teal, lineBreak: false });
          [['Supplier', it.supplier], ['Manufacturer', ''], ['PO', it.po], ['Order / invoice ref', o.vendorOrderNumber], ['Supplier contact', it.contact],
            ['Shipment reference', o.trackingInfo || o.containerNumber], ['Source status', it.statusCategory], ['Order / ship / arrival', [o.orderDate, o.expectedShipDate, o.expectedArrivalDate].map(v => val(v)).join(' / ')], ['Install status', it.status.label]]
            .forEach(([k, v], j) => txt(`${k}  ${val(v)}`, M + 150, y + 65 + j * 11.5, { size: 7.5, width: 222, height: 11, lineBreak: false, ellipsis: true }));
          // specification / receipt / install
          const cx = M + 392, cw = PW - M * 2 - 404;
          txt('Specification as supplied', cx, y + 44, { bold: true, size: 8.5, lineBreak: false });
          txt(val(vendorDescriptionText(o.vendorDescription)), cx, y + 55, { size: 7.5, width: cw, height: 46, ellipsis: true });
          txt('Receipt / verification', cx, y + 106, { bold: true, size: 8.5, lineBreak: false });
          txt(`Received ${val(o.dateReceived)} · Inspected ${val(o.dateInspected)} · Receiving no. ${val(o.warehouseReceivingNumber)}`, cx, y + 117, { size: 7.5, width: cw, height: 20, ellipsis: true });
          txt('Installation / QC', cx, y + 140, { bold: true, size: 8.5, lineBreak: false });
          txt(`Instruction: ${val(it.installInstruction)}\nInstall date ${val(o.installDate)} · ${val(stripHtml(o.installerNotes))}`, cx, y + 151, { size: 7.5, width: cw, height: 27, ellipsis: true });
          // follow-up
          box(M + 1, y + 178, PW - M * 2 - 2, 35, C.panel);
          txt('Internal follow-up', M + 12, y + 183, { bold: true, size: 8.5, lineBreak: false });
          txt(val(latestNotePoints(o.notes, 2).replace(/\n/g, ' · ')), M + 100, y + 183, { size: 7.5, width: 420, height: 20, ellipsis: true });
          txt('Owner / evidence reference: ______________', PW - M - 200, y + 197, { size: 8, color: C.gray, lineBreak: false });
        });
      } else if (pg.type === 'receiving') {
        startPage('Receiving / Cartons / Complete assemblies', 'Do not invent carton totals. Reconcile physical boxes to the same item ID before dispatch and closeout.', pg.page);
        const cols = [M + 12, M + 190, M + 372, M + 560];
        tableHeader(112, cols, ['Shared ID / physical instance', 'Carton count', 'Assembly / stock location', 'Receiving evidence']);
        pg.items.forEach((it, i) => {
          const y = 138 + i * 48;
          if (i % 2 === 0) box(M, y, PW - M * 2, 48, C.panel);
          hline(y + 48);
          txt(it.id, cols[0], y + 8, { bold: true, size: 9, lineBreak: false });
          txt(`${shortQty(it)} · ${it.name}`, cols[0], y + 22, { size: 8, color: C.gray, width: 172, lineBreak: false, ellipsis: true });
          txt('Expected: ____\nReceived: ____\nBoxes: ____ of ____', cols[1], y + 7, { size: 8.5, width: 170, height: 36 });
          txt('Contents / hardware: __________\nLocation: ____________________', cols[2], y + 10, { size: 8.5, width: 180, height: 30 });
          txt('Date / checker: __________\nCondition / photo: ________', cols[3], y + 10, { size: 8.5, width: 160, height: 30 });
        });
      } else if (pg.type === 'approvals') {
        startPage('Approvals / Quality / Open decisions', 'One issue register records impact, ownership and resolution. Closed decisions must not remain active field holds.', pg.page);
        const cols = [M + 12, M + 200, M + 400, M + 580];
        tableHeader(112, cols, ['Item / decision status', 'Evidence / observation', 'Required action / record', 'Impact / accountability']);
        for (let i = 0; i < 6; i++) {
          const y = 138 + i * 62;
          if (i % 2 === 0) box(M, y, PW - M * 2, 62, C.panel);
          hline(y + 62);
          txt('________________\nOPEN / CLOSED: ______', cols[0], y + 10, { size: 9, width: 170, height: 40 });
          txt('______________________\n______________________', cols[1], y + 10, { size: 9, width: 180, height: 40 });
          txt('Due: ______  Evidence: ______', cols[2], y + 10, { size: 9, width: 170, lineBreak: false });
          txt('Impact: ______________\nOwner: ______________', cols[3], y + 10, { size: 9, width: 140, height: 40 });
        }
        txt('New damage / defect: item ______ photo ______ repair / replace / accept ______ authorized by ______ claim ref ______', M, 526, { size: 9, color: C.gray, width: PW - M * 2, lineBreak: false });
      } else if (pg.type === 'deferred') {
        startPage('Subsequent deliveries / Deferred work', 'Items whose expected arrival date is after today. Actual later delivery or completion is not known from the system.', pg.page);
        const cols = [M + 12, M + 106, M + 330, M + 372, M + 552];
        tableHeader(112, cols, ['Stable ID', 'Deferred item', 'Qty', 'Private supplier / PO', 'Movement / next installation']);
        if (!pg.items.length) txt('No item has an expected arrival date after today.', M + 12, 156, { size: 10.5, color: C.gray, lineBreak: false });
        pg.items.forEach((it, i) => {
          const y = 138 + i * 46;
          if (i % 2 === 0) box(M, y, PW - M * 2, 46, C.panel);
          hline(y + 46);
          txt(it.id, cols[0], y + 14, { size: 9, lineBreak: false });
          txt(it.name, cols[1], y + 8, { size: 9.5, width: 218, height: 30, ellipsis: true });
          txt(String(it.qtyNum), cols[2], y + 14, { size: 9.5, lineBreak: false });
          txt(`${val(it.supplier)}\nPO ${val(it.po)}`, cols[3], y + 8, { size: 9, width: 172, height: 32, ellipsis: true });
          txt(`Source allocation: ${it.o.expectedArrivalDate}\nActual / next action: __________`, cols[4], y + 8, { size: 9, width: 160, height: 32 });
        });
        txt('Owner: __________   Current stock / ETA: __________   Next install phase: __________   Verified on: __________', M, 534, { size: 9, color: C.gray, lineBreak: false });
      } else if (pg.type === 'technical') {
        startPage('Technical / Financial / Evidence references', 'Keep current references visible; file the full supporting documents behind the item or project record.', pg.page);
        const planDate = plans.map(p => p.updatedAt || p.createdAt).filter(Boolean).sort().pop();
        const L = [['Overall / room plans', `Uploaded ${planDate ? new Date(planDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : DASH}; design approval / revision evidence: __________`], ['Placement markers', 'Shared IDs are listed in the item register; Designer verifies positions.'], ['Assembly sheets / hardware lists', '__________'], ['Fixing / backing / electrical details', 'Assign the responsible trade and approved detail: __________'], ['Code key / current finish photos', 'Link the approved HDG code legend and actual-finish images.'], ['Receiving / QC / approval files', 'Reference by stable item ID; file / date / checker required.']];
        const R = [['Supplier contact / order confirmation', 'Record name / contact and accepted order reference.'], ['Cost / freight / tax', 'Link to the restricted financial record.'], ['Paid / balance / release restriction', 'Finance verifies if it affects release.'], ['Damage / shortage claims', 'Item / supplier / claim ref / amount / owner / deadline.'], ['Change authorization', 'Record approver, date, scope and any cost impact.'], ['Invoice / warranty / care information', 'Document reference: ______________']];
        [[M, 'Technical and source documents', L], [M + 368, 'Private commercial references', R]].forEach(([x, title, rows]) => {
          box(x, 112, 352, 340, C.white, C.line); box(x, 112, 352, 26, C.panel, C.line);
          txt(title, x + 14, 119, { bold: true, size: 11.5, color: C.teal, lineBreak: false });
          rows.forEach(([k, v], i) => txt(`${k}  ${v}`, x + 14, 150 + i * 49, { size: 9.5, width: 326, height: 44 }));
        });
        box(M, 466, PW - M * 2, 70, C.panel, C.line);
        txt('Maintain once / publish twice', M + 14, 476, { bold: true, size: 10, lineBreak: false });
        txt('Project administration maintains source records; Designer resolves selections and placement; the issue coordinator checks paired revisions; the install lead verifies physical progress. Supplier, PO, tracking, cost and decision history stay out of the field export.', M + 14, 492, { size: 9.5, width: PW - M * 2 - 28, height: 40 });
      } else if (pg.type === 'closeout') {
        startPage('Installation progress / Closeout', 'Item-level completion below must be supported by a dated checker record.', pg.page);
        const cols = [M + 12, M + 110, M + 290, M + 470, M + 620];
        tableHeader(112, cols, ['Shared ID', 'Receipt / routing', 'Placement / assembly', 'Test / exception', 'Signoff']);
        pg.items.forEach((it, i) => {
          const y = 138 + i * 52;
          if (i % 2 === 0) box(M, y, PW - M * 2, 52, C.panel);
          hline(y + 52);
          txt(it.id, cols[0], y + 10, { size: 9, bold: true, width: 96, lineBreak: false });
          txt(it.name, cols[0], y + 24, { size: 7.5, color: C.gray, width: 94, height: 22, ellipsis: true });
          txt('Unit / room: ____\nCount / condition: ____', cols[1], y + 10, { size: 8.5, width: 170, height: 32 });
          txt('Placed: ____\nAssembled / secured: ____', cols[2], y + 10, { size: 8.5, width: 170, height: 32 });
          txt('Test / photo: ____\nOpen work: ____', cols[3], y + 10, { size: 8.5, width: 140, height: 32 });
          txt('Checker: ____\nDate: ____', cols[4], y + 10, { size: 8.5, width: 90, height: 32 });
        });
        if (pg.last) {
          const by = 138 + pg.items.length * 52 + 16;
          box(M, by, PW - M * 2, 74, C.panel, C.line);
          txt('Final room acceptance', M + 14, by + 8, { bold: true, size: 10, lineBreak: false });
          txt('Packing removed / building protected: ______   Final photos: ______   Keys / access returned: ______\nOpen-work owner and due date: __________________   Accepted by / date: __________________\nPreparation and performance: binder preparation hours ____  install hours ____  wrong-room items ____  missing cartons ____  clarification calls ____  rework hours ____',
            M + 14, by + 24, { size: 8.5, width: PW - M * 2 - 28, height: 46 });
        }
      }
    }

    doc.end();
  } catch (err) {
    console.error('Internal binder PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
    else res.end();
  }
};

module.exports = { generateInternalBinder };
