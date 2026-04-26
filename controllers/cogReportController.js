// controllers/cogReportController.js
// Generates COG Excel report matching HDG format (screenshot):
//   Row 1: "Project: [ClientName] - Lot [Unit] - [ShortID]"
//   Row 2: Yellow bar
//   Row 3: Black header — HDG PO# | Vendor | HDG PO Total
//   Row 4+: One row per unique PO number (per vendor)
//   Last:   Bold SUM total
//
// Logic: group products by poNumber (selectedOptions.poNumber).
//   If a product has no PO#, use vendorOrderNumber as fallback,
//   or generate "ClientCode-XXXXXXX" placeholder.
//   Each distinct PO# = one row in the report.

const Order = require('../models/Order');
const ExcelJS = require('exceljs');

// ─── Resolve vendor name from product ────────────────────────────────────────
const getVendorName = (p) => {
  if (p.vendor && typeof p.vendor === 'object' && p.vendor.name) return p.vendor.name;
  if (typeof p.vendor === 'string' && p.vendor) return p.vendor;
  return p.selectedOptions?.shipToName || 'Unknown Vendor';
};

// ─── Resolve PO number ─────────────────────────────────────────────────────
// Prefer explicit poNumber, fall back to vendorOrderNumber, then generate one
const getPoNumber = (p, clientCode, index) => {
  return (
    p.selectedOptions?.poNumber?.trim()        ||
    p.selectedOptions?.vendorOrderNumber?.trim() ||
    `${clientCode}-${String(2067600 + index).padStart(7, '0')}`
  );
};

// ─── Group products into PO rows ──────────────────────────────────────────
// Each unique poNumber → one row. If multiple products share the same PO#
// (same vendor order), sum their totals.
const buildPoRows = (products, clientCode) => {
  const map = new Map(); // poNumber → { poNumber, vendorName, total }

  products.forEach((p, i) => {
    const poNumber   = getPoNumber(p, clientCode, i);
    const vendorName = getVendorName(p);
    const total      = parseFloat(p.finalPrice) || 0;

    if (map.has(poNumber)) {
      map.get(poNumber).total += total;
    } else {
      map.set(poNumber, { poNumber, vendorName, total });
    }
  });

  return Array.from(map.values());
};

// ─── Generate Excel ───────────────────────────────────────────────────────
const generateCogExcel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('selectedProducts.vendor').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const clientName = order.clientInfo?.name || 'Client';
    const unitNumber = order.clientInfo?.unitNumber || '';
    const shortId    = orderId.toString().slice(-4).toUpperCase();

    // Client code: first 3 alpha chars of last name, uppercase
    const nameParts  = clientName.trim().split(/\s+/);
    const lastName   = nameParts[nameParts.length - 1] || nameParts[0] || 'CLT';
    const clientCode = lastName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

    const lotLabel     = unitNumber ? ` - Lot ${unitNumber}` : '';
    const projectLabel = `Project: ${clientName}${lotLabel} - ${shortId}`;

    const products = order.selectedProducts || [];
    const poRows   = buildPoRows(products, clientCode);

    // ── Build workbook ──────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Henderson Design Group';
    wb.modified = new Date();
    const ws = wb.addWorksheet('COG Report');

    // Row 1 — project title
    ws.mergeCells('A1:C1');
    const r1 = ws.getCell('A1');
    r1.value     = projectLabel;
    r1.font      = { name: 'Arial', bold: true, size: 11 };
    r1.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 20;

    // Row 2 — yellow bar
    ['A2','B2','C2'].forEach(addr => {
      ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });
    ws.getRow(2).height = 14;

    // Row 3 — black header
    ['HDG PO#', 'Vendor', 'HDG PO Total'].forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value     = h;
      cell.font      = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(3).height = 28;

    // Data rows
    poRows.forEach((row, i) => {
      const r     = i + 4;
      const wsRow = ws.getRow(r);
      wsRow.height = 22;

      const poCell     = ws.getCell(r, 1);
      const vendorCell = ws.getCell(r, 2);
      const totalCell  = ws.getCell(r, 3);

      poCell.value     = row.poNumber;
      vendorCell.value = row.vendorName;
      totalCell.value  = row.total;

      [poCell, vendorCell, totalCell].forEach(c => {
        c.font   = { name: 'Arial', size: 10 };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      });
      poCell.alignment     = { horizontal: 'left',  vertical: 'middle', indent: 1 };
      vendorCell.alignment = { horizontal: 'left',  vertical: 'middle', indent: 1 };
      totalCell.alignment  = { horizontal: 'right', vertical: 'middle' };
      totalCell.numFmt     = '"$"#,##0.00';
    });

    // Total row
    const lastData   = poRows.length + 3;
    const totalRowN  = poRows.length + 4;
    ws.getRow(totalRowN).height = 22;

    const grandTotal = ws.getCell(totalRowN, 3);
    grandTotal.value     = { formula: `SUM(C4:C${lastData})` };
    grandTotal.font      = { name: 'Arial', bold: true, size: 11 };
    grandTotal.alignment = { horizontal: 'right', vertical: 'middle' };
    grandTotal.numFmt    = '"$"#,##0.00';
    grandTotal.border    = { top: { style: 'thin', color: { argb: 'FF000000' } } };

    // Column widths
    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 18;

    // Stream response
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename  = `COG_${safeName}_${shortId}.xlsx`;
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('generateCogExcel error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateCogExcel };