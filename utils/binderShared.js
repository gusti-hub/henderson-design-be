// utils/binderShared.js
// Shared by the Install Binder PDFs (Field Pack + Internal Binder) and the floor-plan pin editor:
// look & feel, unit marker, room codes, the numbered item model (same IDs everywhere) and the status colours.
// Rule: only stored data is used; anything missing prints as a dash.

const path = require('path');
const { roomCompare } = require('./roomOrder');

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
      if (p.isParent || isService(p)) continue;   // Install Status Pending stays in the PDFs (shown with its amber status colour)
      const room = roomName(p.selectedOptions?.room);
      if (!byRoom.has(room)) byRoom.set(room, []);
      byRoom.get(room).push({ p, orderId: String(order._id) });
    }
  }
  const planByRoom = new Map();
  plans.filter(p => p.type === 'room' && p.room && p.room !== '_fullview_')
    .forEach(p => planByRoom.set(String(p.room).trim().toUpperCase(), p));

  const names = [...new Set([...byRoom.keys(), ...[...planByRoom.values()].map(p => String(p.room).trim())])]
    .sort(roomCompare);

  return names.map(name => {
    const code = ROOM_CODES[name.toUpperCase()] || DASH;
    const unitPart = unit || DASH;
    const items = (byRoom.get(name) || []).map(({ p, orderId }) => {
      const sku = String(p.product_id || '').trim();
      // Install ID comes only from the item (CPM → Install Binder). A plain number (12) is completed as unit-room-number
      // (711-LIV-12); a full code typed by hand is kept as typed; nothing typed → dash (nothing is numbered automatically)
      const t = String(p.selectedOptions?.installId || '').trim();
      const plain = /^\d+$/.test(t);
      const numPart = !t ? DASH : plain ? t : (t.split('-').pop() || t);
      const id = !t ? DASH : plain ? `${unitPart}-${code}-${numPart}` : t;
      const num = numPart;     // short number shown in circles / "ITEM 12"
      return {
        num, id, name: stripHtml(p.name) || DASH,
        qty: qtyText(p), qtyNum: Number(p.quantity) || 1,
        size: stripHtml(p.selectedOptions?.size),
        sku: sku ? (code !== DASH ? `${code}-${sku}` : sku) : '',
        imageUrl: imageUrlOf(p),
        productId: String(p._id || ''), orderId, raw: p,
        statusCategory: String(p.selectedOptions?.statusCategory || '').trim(),
        installStatus: String(p.selectedOptions?.installStatus || '').trim(),
        isLighting: lc(p.selectedOptions?.itemClass).trim() === 'lighting',   // from the item's own class
      };
    });
    return { name, code, plan: planByRoom.get(name.toUpperCase()) || null, items };
  });
};


// ── Install instructions come from Product Config (SKU level): matched by the item's library product, else by an exact,
// unique SKU. No match → empty (printed as a dash). Nothing is inferred from the item name.
const attachInstallInstructions = async (rooms) => {
  const mongoose = require('mongoose');
  const Product = require('../models/Product');
  const items = rooms.flatMap(r => r.items);
  const libIds = [...new Set(items.map(i => String(i.raw.libraryProductId || '')).filter(id => mongoose.Types.ObjectId.isValid(id)))];
  const skus = [...new Set(items.map(i => String(i.raw.product_id || '').trim()).filter(Boolean))];
  const pick = 'product_id installInstruction';
  const [byLib, bySku] = await Promise.all([
    libIds.length ? Product.find({ _id: { $in: libIds } }).select(pick).lean() : [],
    skus.length ? Product.find({ product_id: { $in: skus } }).select(pick).lean() : [],
  ]);
  const libMap = {}; byLib.forEach(p => { libMap[String(p._id)] = p; });
  const skuCount = {}, skuMap = {};
  bySku.forEach(p => { skuCount[p.product_id] = (skuCount[p.product_id] || 0) + 1; skuMap[p.product_id] = p; });
  items.forEach(it => {
    const sku = String(it.raw.product_id || '').trim();
    const prod = libMap[String(it.raw.libraryProductId || '')] || (skuCount[sku] === 1 ? skuMap[sku] : null);
    // one plain line of text from Product Config (any line breaks are flattened to spaces)
    it.installInstruction = String(prod?.installInstruction || '').replace(/\s+/g, ' ').trim();
  });
};

// ── Install Status → colour (floor-plan pins, legends). The Install Status dropdown has exactly these values; the colours are
// the ones agreed for the Install Binder. A value outside the list is shown neutral grey as "Other" — never guessed.
const INSTALL_STATUS_GROUPS = [
  { key: 'notset',    label: 'Not set',   color: '#16A34A', names: [''] },
  { key: 'pending',   label: 'Pending',   color: '#F59E0B', names: ['pending'] },
  { key: 'scheduled', label: 'Scheduled', color: '#3B82F6', names: ['scheduled'] },
  { key: 'installed', label: 'Installed', color: '#8B5CF6', names: ['installed'] },
  { key: 'issue',     label: 'Issue',     color: '#DC2626', names: ['issue'] },
];
const OTHER_STATUS = { key: 'other', label: 'Other', color: '#8a979c' };
const INSTALL_STATUS_LOOKUP = new Map(INSTALL_STATUS_GROUPS.flatMap(g => g.names.map(n => [n, g])));
const statusStyle = (installStatus) => {
  const raw = String(installStatus || '').trim();
  const g = INSTALL_STATUS_LOOKUP.get(raw.toLowerCase()) || OTHER_STATUS;
  return { key: g.key, label: raw && g === OTHER_STATUS ? raw : g.label, color: g.color };
};
const STATUS_LEGEND = INSTALL_STATUS_GROUPS.map(({ key, label, color }) => ({ key, label, color }));

module.exports = {
  C, PW, PH, M, DASH,
  MARKER_COLORS, CONFIRMED_MARKERS, UNASSIGNED_HEX, unitMarker, drawMarker,
  ROOM_CODES, lc, sentenceCase, titleCase, stripHtml, isService, qtyText, imageUrlOf,
  fetchImage, runPool, buildRooms,
  statusStyle, STATUS_LEGEND, attachInstallInstructions,
};
