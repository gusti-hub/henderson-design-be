// controllers/fieldPackController.js
// "Installation field pack": the crew-facing PDF of the Install Binder (unit marker, instructions, room guide,
// per-room plan + item cards, carton check, lighting key, completion sheet).
// Floor plan images are the ones already uploaded in the Install Binder (FloorPlanLayout, type 'room').
//
// Rule: only data that exists in the system is printed. Anything we do not have (install action, bulb pairing,
// unit marker, …) is printed as "—" so it can be completed by hand. Nothing is guessed from item names.

const path = require('path');
const FloorPlanLayout = require('../models/FloorPlanLayout');
const Order = require('../models/Order');
const User = require('../models/User');
const { isInstallPending } = require('../utils/installBinderText');
const { roomCompare } = require('../utils/roomOrder');

// ── Look & feel (taken from the approved sample pack) ────────────────────────
const C = {
  navy: '#17363f', teal: '#2e7570', ink: '#26343a', gray: '#6b7a80', line: '#cdd9d6',
  panel: '#eff4f0', rust: '#9b4a39', sand: '#e9d3a8', white: '#ffffff',
};
const PW = 792, PH = 612, M = 36;
const DASH = '—';

// ── Unit marker: colour + shape the crew matches against the unit entrance and every carton ──
// Only markers HDG has confirmed are printed. Add a unit here once HDG confirms it; every other unit prints "TO BE ASSIGNED".
const MARKER_COLORS = { BLUE: '#1f6fb5', ORANGE: '#e07b1f', PURPLE: '#7a4fa3', RED: '#c0392b', YELLOW: '#d9a800', GREEN: '#008c69' };
const CONFIRMED_MARKERS = { '701': { color: 'GREEN', shape: 'SQUARE' } };   // shape: SQUARE / CIRCLE / TRIANGLE / DIAMOND / HEXAGON
const UNASSIGNED_HEX = '#8a979c';

const unitMarker = (unit) => {
  const m = CONFIRMED_MARKERS[String(unit || '').trim()];
  return m ? { ...m, confirmed: true } : { color: '', shape: 'SQUARE', confirmed: false };
};

const drawMarker = (doc, shape, cx, cy, size, color) => {
  const h = size / 2;
  doc.save().fillColor(color);
  if (shape === 'CIRCLE') doc.circle(cx, cy, h).fill();
  else if (shape === 'TRIANGLE') doc.polygon([cx, cy - h], [cx + h, cy + h * 0.85], [cx - h, cy + h * 0.85]).fill();
  else if (shape === 'DIAMOND') doc.polygon([cx, cy - h], [cx + h, cy], [cx, cy + h], [cx - h, cy]).fill();
  else if (shape === 'HEXAGON') {
    const pts = Array.from({ length: 6 }, (_, i) => [cx + h * Math.cos(Math.PI / 3 * i), cy + h * Math.sin(Math.PI / 3 * i)]);
    doc.polygon(...pts).fill();
  } else doc.rect(cx - h, cy - h, size, size).fill();
  doc.restore();
};

// ── Room codes: the same table as the Install Binder item labels (Primary Bedroom = PBR as in the field pack sample).
// A room that is not in the table prints "—" as its code.
const ROOM_CODES = {
  'COURTYARD': 'COU', 'EXTERIOR ENTRY': 'EXT', 'INTERIOR ENTRY': 'INT', 'FOYER': 'FOY', 'KITCHEN': 'KIT', 'PANTRY': 'PAN',
  'BREAKFAST NOOK': 'BRK', 'DINING ROOM': 'DIN', 'DINING AREA': 'DIN', 'LIVING ROOM': 'LIV', 'GREAT ROOM': 'GRE',
  'FAMILY ROOM': 'FAM', 'DEN': 'DEN', 'WET BAR': 'WET', 'MEDIA ROOM': 'MED', 'HALLWAY': 'HAL', 'HALLWAY 1': 'HA1', 'HALLWAY 2': 'HA2',
  'LANAI': 'LAN', 'LANAI 1': 'LA1', 'LANAI 2': 'LA2', 'LANAI 3': 'LA3', 'MAIN LANAI': 'MAI', 'BBQ AREA': 'BBQ', 'POOL LANAI': 'POL',
  'POWDER ROOM': 'POW', 'PAVILLION': 'PAV', 'GYM': 'GYM', 'OFFICE': 'OFF', 'OFFICE 1': 'OF1', 'OFFICE 2': 'OF2', 'WINE ROOM': 'WIN',
  'REC ROOM': 'REC', 'GARAGE': 'GAR', 'PRIMARY BEDROOM': 'PBR', 'PRIMARY BATHROOM': 'PBA', 'PRIMARY CLOSET': 'PRC',
  'PRIMARY BEDROOM LANAI': 'PBL', 'BEDROOM 2': 'BE2', 'BATHROOM 2': 'BA2', 'BEDROOM 2 CLOSET': 'BC2', 'BEDROOM 2 LANAI': 'BL2',
  'BEDROOM 3': 'BE3', 'BATHROOM 3': 'BA3', 'BEDROOM 3 CLOSET': 'BC3', 'BEDROOM 3 LANAI': 'BL3', 'BEDROOM 4': 'BE4',
  'BATHROOM 4': 'BA4', 'BEDROOM 4 CLOSET': 'BC4', 'BEDROOM 4 LANAI': 'BL4', 'SITTING ROOM': 'SIT', 'FLEX SPACE': 'FLE',
  'LAUNDRY ROOM': 'LAU', 'MUD ROOM': 'MUD', 'TERRACE': 'TER', 'BALCONY': 'BAL', 'OUTDOOR DINING': 'ODI', 'OUTDOOR LIVING': 'ODL',
  'GUEST SUITE': 'GUE', 'THROUGHOUT': 'ACC', 'STYLING & ACCESSORIES': 'ACC',
};

// ── Item data (only what is stored on the item) ──────────────────────────────
const lc = (s) => String(s || '').toLowerCase();
const sentenceCase = (s) => { const t = lc(s); return t.charAt(0).toUpperCase() + t.slice(1); };
const titleCase = (s) => lc(s).replace(/\b\w/g, (c) => c.toUpperCase());
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Services / labor lines are not physical items: left out by the item class stored on the item (no name matching)
const isService = (p) => /^(installation \/ logistics|labor)$/.test(lc(p.selectedOptions?.itemClass).trim());

// "QTY 2 pc": the unit word comes from the item's own Units field; no Units value → just the number
const UNIT_WORDS = { each: 'pc', set: 'set', pair: 'pair', box: 'box', case: 'case', roll: 'roll', yard: 'yard', foot: 'ft', meter: 'm', panel: 'panel' };
const qtyText = (p) => {
  const q = Number(p.quantity) || 1;
  const u = lc(p.selectedOptions?.units).trim();
  if (!u) return `QTY ${q}`;
  const word = UNIT_WORDS[u] || u.replace('square foot', 'sq ft').replace('linear foot', 'lin ft');
  return `QTY ${q} ${q !== 1 && !['pc', 'ft', 'm'].includes(word) ? `${word}s` : word}`;
};

const imageUrlOf = (p) => {
  const o = p.selectedOptions || {};
  const u = o.image || (o.images || [])[0] || (o.uploadedImages || [])[0]?.url || '';
  return /^https?:/.test(u) ? u : '';
};

// ── Images ────────────────────────────────────────────────────────────────────
// A failed download must not silently look like "no photo", so each image gets 3 attempts before it is given up
const fetchImage = async (url, maxPx, quality) => {
  if (!url) return null;
  const axios = require('axios'), sharp = require('sharp');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      const { data, info } = await sharp(Buffer.from(r.data)).rotate()
        .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer({ resolveWithObject: true });
      return { buffer: data, w: info.width, h: info.height };
    } catch (e) {
      if (attempt === 3) console.warn('[FieldPack] image failed:', url.slice(0, 90), '-', e.message);
      else await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
  return null;
};

const runPool = async (items, size, fn) => {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
};

// ── Build the content model (rooms → numbered items) ─────────────────────────
const buildRooms = (orders, plans, unit) => {
  const byRoom = new Map();
  const roomName = (r) => String(r || '').trim() || 'Other';
  for (const order of orders) {
    for (const p of (order.selectedProducts || [])) {
      if (p.isParent || isInstallPending(p.selectedOptions) || isService(p)) continue;
      const room = roomName(p.selectedOptions?.room);
      if (!byRoom.has(room)) byRoom.set(room, []);
      byRoom.get(room).push(p);
    }
  }
  const planByRoom = new Map();
  plans.filter(p => p.type === 'room' && p.room && p.room !== '_fullview_')
    .forEach(p => planByRoom.set(String(p.room).trim().toUpperCase(), p));

  const names = [...new Set([...byRoom.keys(), ...[...planByRoom.values()].map(p => String(p.room).trim())])]
    .sort(roomCompare);

  return names.map(name => {
    const code = ROOM_CODES[name.toUpperCase()] || DASH;
    const items = (byRoom.get(name) || []).map((p, i) => {
      const num = String(i + 1).padStart(2, '0');           // numbered in the order the rows are saved in the order
      const sku = String(p.product_id || '').trim();
      return {
        num, id: `${unit}-${code}-${num}`, name: stripHtml(p.name) || DASH,
        qty: qtyText(p), qtyNum: Number(p.quantity) || 1,
        size: stripHtml(p.selectedOptions?.size),
        sku: sku ? (code !== DASH ? `${code}-${sku}` : sku) : '',
        imageUrl: imageUrlOf(p),
        isLighting: lc(p.selectedOptions?.itemClass).trim() === 'lighting',   // from the item's own class
      };
    });
    return { name, code, plan: planByRoom.get(name.toUpperCase()) || null, items };
  });
};

// ── Controller ───────────────────────────────────────────────────────────────
const generateFieldPack = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { clientUserId } = req.params;

    const [plans, orders, clientUser] = await Promise.all([
      FloorPlanLayout.find({ clientUserId }).lean(),
      Order.find({ user: clientUserId }).lean(),
      User.findById(clientUserId).select('name').lean().catch(() => null),
    ]);
    if (!orders.length) return res.status(404).json({ message: 'No orders found for this client' });

    const clientName = (orders[0]?.clientInfo?.name || clientUser?.name || 'Client').trim();
    const unit = String(orders[0]?.clientInfo?.unitNumber || '').trim() || DASH;
    const residence = String(orders[0]?.clientInfo?.floorPlan || '').trim();
    const marker = unitMarker(unit);
    const markerHex = marker.confirmed ? MARKER_COLORS[marker.color] : UNASSIGNED_HEX;
    const markerName = marker.confirmed ? `${marker.color} ${marker.shape}` : 'TO BE ASSIGNED';
    const footerNote = `${marker.confirmed ? `${unit} = ${markerName}` : `UNIT ${unit}`} · Match the SAME item ID on carton, photo and room plan.`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

    const rooms = buildRooms(orders, plans, unit);
    if (!rooms.length) return res.status(404).json({ message: 'No items or floor plans to put in a field pack' });

    // ── Page plan (page numbers are needed up front for the room guide) ──────
    const missingSchedule = rooms.filter(r => !r.items.length).map(r => sentenceCase(r.name));
    const holdRoomsText = missingSchedule.length ? ` ${missingSchedule.join(' and ')} remain${missingSchedule.length > 1 ? '' : 's'} on hold until HDG releases ${missingSchedule.length > 1 ? 'them' : 'it'}.` : '';
    const GUIDE_PER_PAGE = 13;
    const guidePages = Math.max(1, Math.ceil(rooms.length / GUIDE_PER_PAGE));
    let page = 3 + guidePages;                          // 1 cover, 2 instructions, 3.. room guide, then the rooms
    const plan = [];                                    // page descriptors, in order

    rooms.forEach(r => {
      r.guide = { plan: '-', inv: '-' };
      if (!r.items.length) {                            // plan only → schedule missing
        r.guide = { plan: r.plan ? String(page) : '-', inv: 'SCHEDULE MISSING' };
        plan.push({ type: 'planOnly', room: r, page: page++ });
      } else if (r.items.length <= 3) {                 // small room: one "photo plan" page
        r.guide = { plan: r.plan ? String(page) : '-', inv: String(page) };
        plan.push({ type: 'photoPlan', room: r, items: r.items, page: page++ });
      } else {
        if (r.plan) { r.guide.plan = String(page); plan.push({ type: 'planOnly', room: r, page: page++, hasItems: true }); }
        const first = page;
        for (let k = 0; k < r.items.length; k += 4) plan.push({ type: 'inventory', room: r, items: r.items.slice(k, k + 4), page: page++ });
        r.guide.inv = page - 1 > first ? `${first} - ${page - 1}` : String(first);
      }
    });
    const lightingRooms = rooms.filter(r => r.items.some(i => i.isLighting));
    const cartonPage = page++;
    const lightingPage = lightingRooms.length ? page++ : null;
    const completionPage = page++;

    // ── Fetch every image once, in parallel ──────────────────────────────────
    const itemImgs = new Map(), planImgs = new Map();
    const jobs = [];
    rooms.forEach(r => {
      if (r.plan) jobs.push(async () => planImgs.set(r.name, await fetchImage(r.plan.imageUrl, 1800, 80)));
      r.items.forEach(i => { if (i.imageUrl) jobs.push(async () => itemImgs.set(i.id, await fetchImage(i.imageUrl, 360, 70))); });
    });
    await runPool(jobs, 8, (j) => j());

    // ── PDF ──────────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FieldPack_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_Unit_${unit.replace(/[^a-zA-Z0-9]/g, '')}.pdf"`);
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
    const check = (x, y, label, w = 70) => { doc.rect(x, y + 1, 8, 8).lineWidth(0.6).strokeColor(C.line).stroke(); txt(label, x + 13, y, { size: 8.5, width: w, lineBreak: false }); };

    const startPage = (title, subtitle, pageNo) => {
      doc.addPage();
      txt('HENDERSON', M, 24, { bold: true, size: 15, color: C.navy, lineBreak: false });
      txt('D E S I G N   G R O U P', M, 42, { size: 6, color: C.teal, lineBreak: false });
      txt('FIELD / INSTALLATION CREW', 380, 24, { bold: true, size: 8, color: C.teal, lineBreak: false });
      txt(`ĀLIA ${unit} / ${dateStr}`, 380, 38, { size: 7.5, color: C.gray, lineBreak: false });
      drawMarker(doc, marker.shape, PW - M - 14, 36, 26, markerHex);
      txt(unit, PW - M - 34, 31, { bold: true, size: 8.5, color: C.white, width: 40, align: 'center', lineBreak: false });
      hline(56, M, PW - M, C.teal, 0.8);
      if (title) txt(title, M, 66, { bold: true, size: 21, color: C.navy, width: PW - M * 2, lineBreak: false, ellipsis: true });
      if (subtitle) txt(subtitle, M, 94, { size: 8.5, color: C.gray, width: PW - M * 2, lineBreak: false });
      hline(PH - 30, M, PW - M);
      txt(footerNote, M, PH - 24, { size: 6.5, color: C.gray, width: 600, lineBreak: false });
      txt(String(pageNo).padStart(2, '0'), PW - M - 40, PH - 26, { bold: true, size: 9, color: C.navy, width: 40, align: 'right', lineBreak: false });
    };

    // fit an image into a box, centred
    const putImage = (img, x, y, w, h) => {
      if (!img) return false;
      const s = Math.min(w / img.w, h / img.h);
      const iw = img.w * s, ih = img.h * s;
      try { doc.image(img.buffer, x + (w - iw) / 2, y + (h - ih) / 2, { width: iw, height: ih }); return true; } catch { return false; }
    };
    const photoBox = (img, x, y, w, h) => {
      if (!putImage(img, x, y, w, h)) {
        box(x, y, Math.min(w, 74), 34, C.panel, C.line);
        txt('PHOTO\nREQUIRED', x + 4, y + 7, { bold: true, size: 7.5, color: C.gray, width: 66 });
      }
    };

    // ── 1. Cover ─────────────────────────────────────────────────────────────
    startPage('Installation field pack', null, 1);
    box(M, 112, 456, 244, C.navy);
    txt(`ĀLIA${residence ? ' / ' + residence.toUpperCase() : ''}`, M + 30, 136, { size: 12, color: '#a9c7c3', lineBreak: false });
    txt(`UNIT ${unit}`, M + 30, 170, { bold: true, size: 56, color: C.white, lineBreak: false });
    txt('MATCH → MOVE → PLACE → CHECK', M + 30, 252, { bold: true, size: 17, color: C.white, lineBreak: false });
    txt('NOT RELEASED', M + 30, 318, { bold: true, size: 13, color: C.sand, lineBreak: false });
    box(M + 476, 112, PW - M * 2 - 476, 244, C.panel, C.line);
    txt('UNIT COLOR + SHAPE', M + 494, 128, { bold: true, size: 10, color: C.teal, lineBreak: false });
    drawMarker(doc, marker.shape, M + 476 + (PW - M * 2 - 476) / 2, 212, 104, markerHex);
    txt(unit, M + 476, 193, { bold: true, size: 40, color: C.white, width: PW - M * 2 - 476, align: 'center', lineBreak: false });
    txt(markerName, M + 494, 280, { bold: true, size: 14, color: markerHex, lineBreak: false });
    txt(marker.confirmed ? 'Match unit entrance + every carton.' : 'Color + shape not assigned yet. HDG assigns it before release.', M + 494, 304, { size: 9.5, width: PW - M * 2 - 500 });
    const steps = [['1 / UNIT', 'Match number + color + shape.'], ['2 / ROOM', 'Match carton room name to room sign.'], ['3 / ITEM', 'Match the same shared item ID + photo.'], ['4 / PLAN', 'Match the item number on the room plan.']];
    steps.forEach(([h, t], i) => {
      const x = M + (i % 2) * 360, y = 384 + Math.floor(i / 2) * 68;
      txt(h, x, y, { bold: true, size: 14, color: C.teal, lineBreak: false });
      txt(t, x, y + 24, { size: 11, width: 330 });
    });

    // ── 2. Today's instructions ──────────────────────────────────────────────
    startPage('Today’s instructions', 'One installation lead resolves exceptions. No substitutions or unmarked drilling.', 2);
    [['HDG installation lead / mobile - to be completed', M, 122, 330], ['Release date / working hours - to be completed', M + 372, 122, 348], ['Loading / elevator / building contact - to be completed', M, 188, 330]]
      .forEach(([t, x, y, w]) => { txt(t, x, y, { bold: true, size: 9.5, width: w + 20, lineBreak: false }); hline(y + 42, x, x + w, C.line, 0.8); });
    box(M, 262, PW - M * 2, 120, C.panel, C.line);
    txt('HOLD BEFORE RELEASE', M + 18, 276, { bold: true, size: 12, color: C.rust, lineBreak: false });
    const holdParts = [marker.confirmed ? `${unit} is confirmed ${markerName}.` : `${unit} color + shape is not assigned yet.`,
      'HDG must complete: carton counts, scope/quantity checks, installation lead, drawing release and technical details.'];
    missingSchedule.forEach(n => holdParts.push(`${n} schedule is missing.`));
    holdParts.push('Do not dispatch from this pack.');
    txt(holdParts.join(' '), M + 18, 298, { size: 10.5, width: PW - M * 2 - 36, height: 80 });
    [['MISMATCH / MISSING CARTON', 'Stop that item. Keep it together. Call HDG lead.'], ['DAMAGE / MISSING HARDWARE', 'Photograph label + damage. Do not repair or substitute.'], ['FINISHING', 'Protect floors. Retain product tag. Remove packing after checks.']]
      .forEach(([h, t], i) => { const y = 414 + i * 44; txt(h, M, y, { bold: true, size: 9.5, color: C.teal, lineBreak: false }); txt(t, 250, y, { size: 10.5, width: 480, lineBreak: false }); });

    // ── 3. Room guide ────────────────────────────────────────────────────────
    for (let g = 0; g < guidePages; g++) {
      startPage(g ? 'Room guide (continued)' : 'Room guide', 'Use the room name on the carton. Page numbers below lead directly to the matching room.', 3 + g);
      const cols = [M, M + 330, M + 430, M + 530], tableW = PW - M * 2;
      box(M, 118, tableW, 26, C.navy);
      ['ROOM', 'CODE', 'PLAN', 'INVENTORY'].forEach((h, i) => txt(h, cols[i] + 12, 126, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
      const slice = rooms.slice(g * GUIDE_PER_PAGE, (g + 1) * GUIDE_PER_PAGE);
      slice.forEach((room, i) => {
        const y = 144 + i * 28;
        if (i % 2 === 0) box(M, y, tableW, 28, C.panel);
        hline(y + 28);
        [titleCase(room.name), room.code, room.guide.plan, room.guide.inv]
          .forEach((v, k) => txt(v, cols[k] + 12, y + 9, { size: 10, width: k === 0 ? 300 : 110, lineBreak: false, ellipsis: true }));
      });
      if (g === guidePages - 1) txt(`Carton checks, lighting pairing key and completion forms follow the room inventories.${holdRoomsText}`, M, 144 + slice.length * 28 + 14, { size: 9, color: C.gray, width: tableW });
    }

    // ── Item cards: every field is stored data; the install action is not stored, so it prints "—" to be completed ──
    const titleOf = (it) => `${it.id} / ${it.name}`;
    const actionLine = (x, y, w) => txt(`${DASH}  (install action to be completed)`, x, y, { bold: true, size: 9.5, color: C.gray, width: w, height: 28 });

    const inventoryCard = (x, y, w, h, it) => {
      box(x, y, w, h, C.white, C.line);
      txt(titleOf(it), x + 12, y + 10, { bold: true, size: 11.5, width: w - 24, height: 30, ellipsis: true });
      txt(it.qty, x + 12, y + 40, { bold: true, size: 9.5, color: C.teal, lineBreak: false });
      photoBox(itemImgs.get(it.id), x + 12, y + 60, 120, h - 96);
      const tx = x + 144, tw = w - 156; let ty = y + 60;
      if (it.sku) { txt(it.sku, tx, ty, { bold: true, size: 8.5, color: C.teal, width: tw, lineBreak: false, ellipsis: true }); ty += 13; }
      if (it.size) { txt(`Size: ${it.size}`, tx, ty, { size: 9, width: tw, height: 24, ellipsis: true }); ty += doc.heightOfString(`Size: ${it.size}`, { width: tw }) + 3; }
      actionLine(tx, ty, tw);
      const by = y + h - 24;
      check(x + 12, by, 'Placed', 40); check(x + 82, by, 'Checked', 50);
      txt('Qty: ____ Initials: ____', x + 160, by, { size: 8.5, color: C.gray, lineBreak: false });
    };

    const planCard = (x, y, w, h, it) => {
      box(x, y, w, h, C.white, C.line);
      txt(titleOf(it), x + 10, y + 8, { bold: true, size: 10.5, width: w - 80, height: 28, ellipsis: true });
      txt(it.qty, x + w - 66, y + 8, { bold: true, size: 9, color: C.teal, width: 56, align: 'right', lineBreak: false });
      txt(`ITEM ${it.num}`, x + 10, y + 38, { bold: true, size: 8.5, color: C.teal, lineBreak: false });
      photoBox(itemImgs.get(it.id), x + 10, y + 52, 62, h - 82);
      txt(`${DASH}  (to be completed)`, x + 82, y + 54, { bold: true, size: 9, color: C.gray, width: w - 92, height: 28 });
      const by = y + h - 20;
      check(x + 10, by, 'Count OK', 46); check(x + 86, by, 'Placed', 40); check(x + 156, by, 'Checked', 46);
    };

    // ── Room pages ───────────────────────────────────────────────────────────
    for (const pg of plan) {
      const r = pg.room, title = titleCase(r.name);
      const planImg = planImgs.get(r.name);
      if (pg.type === 'planOnly') {
        startPage(`${title} / ${r.code}`, 'PLACEMENT / source drawing · approval pending', pg.page);
        if (planImg) putImage(planImg, M, 108, PW - M * 2, 392); else txt('Floor plan not uploaded for this room.', M, 300, { size: 11, color: C.gray, width: PW - M * 2, align: 'center' });
        box(M, 512, PW - M * 2, 40, C.panel, C.line);
        txt(pg.hasItems ? 'Match room + item number + photo.' : 'HOLD / Product schedule missing. HDG lead releases this room separately.',
          M + 16, 526, { bold: true, size: 11.5, color: pg.hasItems ? C.teal : C.rust, width: PW - M * 2 - 32, lineBreak: false });
      } else if (pg.type === 'photoPlan') {
        startPage(`${title} / ${r.code} / photo plan`, 'Match the SAME item number on plan, photo card and carton label.', pg.page);
        const px = M, pw = 440;
        if (planImg) putImage(planImg, px, 108, pw, 400); else { box(px, 108, pw, 400, C.panel, C.line); txt('Floor plan not uploaded for this room.', px, 296, { size: 11, color: C.gray, width: pw, align: 'center' }); }
        const cx = px + pw + 18, cw = PW - M - cx, gap = 8, n = pg.items.length;
        const ch = Math.min(152, (400 - gap * (n - 1)) / n);
        pg.items.forEach((it, i) => planCard(cx, 108 + i * (ch + gap), cw, ch, it));
        txt('Mismatch or unclear position? STOP / call HDG lead.', M, 524, { bold: true, size: 11.5, color: C.teal, lineBreak: false });
      } else {
        startPage(`${title} / Photo inventory`, 'Match shared item ID + photo. Same ID in internal pack and on carton / retained tag.', pg.page);
        pg.items.forEach((it, i) => inventoryCard(M + (i % 2) * 366, 112 + Math.floor(i / 2) * 210, 354, 198, it));
      }
    }

    // ── Carton check ─────────────────────────────────────────────────────────
    startPage('Carton check / unit delivery', `${marker.confirmed ? `${unit} = ${markerName}. ` : ''}Match shared install ID; keep each assembly’s cartons together.`, cartonPage);
    box(M, 112, PW - M * 2, 40, C.panel, C.line);
    txt('PACKING MANIFEST REQUIRED / HDG must populate expected cartons before release.', M + 16, 126, { bold: true, size: 11.5, color: C.rust, lineBreak: false });
    const cartonCols = [M + 12, M + 330, M + 520];
    box(M, 170, PW - M * 2, 24, C.navy);
    ['Shared install ID / room', 'Assembly / carton x of y', 'Received / missing / damage'].forEach((h, i) => txt(h, cartonCols[i], 177, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
    for (let i = 0; i < 4; i++) { const y = 194 + i * 56; if (i % 2 === 0) box(M, y, PW - M * 2, 56, C.panel); hline(y + 56); }
    txt('Unit received by: ________________   Date: ____________   Missing cartons reported to: ________________', M, 452, { size: 10.5, lineBreak: false });

    // ── Lighting: the items whose own class is Lighting. Which bulb goes with which light is not stored → "—" ──
    if (lightingPage) {
      startPage('Lighting / fit and test', 'Use this pairing key. No supplier names or purchasing numbers are needed.', lightingPage);
      const lcols = [M + 12, M + 330, M + 560, M + 610];
      box(M, 112, PW - M * 2, 24, C.navy);
      ['Shared install ID / light', 'Bulb ID / specification', 'Qty', 'Check'].forEach((h, i) => txt(h, lcols[i], 119, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
      const lights = lightingRooms.flatMap(r => r.items.filter(i => i.isLighting));
      const ROWS = 9;
      lights.slice(0, ROWS).forEach((L, i) => {
        const y = 136 + i * 38;
        if (i % 2 === 0) box(M, y, PW - M * 2, 38, C.panel);
        hline(y + 38);
        txt(`${L.id} / ${L.name}`, lcols[0], y + 12, { size: 9.5, width: 310, height: 24, ellipsis: true });
        txt(DASH, lcols[1], y + 12, { size: 9.5, color: C.gray, lineBreak: false });
        txt(String(L.qtyNum), lcols[2], y + 12, { size: 9.5, lineBreak: false });
        txt(DASH, lcols[3], y + 12, { size: 9.5, color: C.gray, lineBreak: false });
      });
      if (lights.length > ROWS) txt(`+ ${lights.length - ROWS} more lighting items: see the room inventories.`, M, 136 + ROWS * 38 + 6, { size: 8.5, color: C.gray, lineBreak: false });
      txt('Integrated bed / closet lighting: use the supplied approved detail. Check all lights, switches, outlets, USB ports and moving components before signing off.', M, 500, { size: 10, width: PW - M * 2 });
    }

    // ── Completion ───────────────────────────────────────────────────────────
    startPage('Room completion / open work', 'Record only what remains unresolved. Attach photographs to the HDG report.', completionPage);
    const ccols = [M + 12, M + 200, M + 540];
    box(M, 112, PW - M * 2, 24, C.navy);
    ['Shared install ID / room', 'Missing / damage / unfinished work', 'Lead / next action'].forEach((h, i) => txt(h, ccols[i], 119, { bold: true, size: 9.5, color: C.white, lineBreak: false }));
    for (let i = 0; i < 3; i++) { const y = 136 + i * 56; if (i % 2 === 0) box(M, y, PW - M * 2, 56, C.panel); hline(y + 56); }
    ['All agreed items placed; tags and quantities matched.', 'Assembly / fixings / operation checked where required.', 'Photos taken; packing removed; rooms protected and secured.']
      .forEach((t, i) => check(M, 322 + i * 28, t, 420));
    txt('Install lead: ________________   Date: ____________   Open-work refs: ________________', M, 440, { size: 10.5, lineBreak: false });

    doc.end();
  } catch (err) {
    console.error('Field pack PDF error:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
    else res.end();
  }
};

module.exports = { generateFieldPack };
