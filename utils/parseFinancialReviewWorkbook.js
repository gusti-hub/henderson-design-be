const ExcelJS = require('exceljs');

const isEmptyValue = (v) => v === null || v === undefined || v === '';

const cellToPlainValue = (cell) => {
  let c = cell;
  if (c.type === ExcelJS.ValueType.Merge && c.master) {
    c = c.master;
  }
  const v = c.value;
  if (isEmptyValue(v)) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.error) return String(v.error);
    if (Array.isArray(v.richText)) return v.richText.map((rt) => rt.text).join('');
    if (v.text !== undefined) return v.text; // hyperlink
    if (v.result !== undefined) return isEmptyValue(v.result) ? null : v.result; // formula
    return null;
  }
  return v;
};

// Reads a row into plain values (merged cells inherit their master's value, so a
// group header spanning several columns still shows up under every column it
// spans) plus a parallel "isMaster" flag (false for the non-top-left cells of a
// merge) so header detection can ignore merge-inflated duplicate counts.
const rowToValues = (row, colCount) => {
  const values = [];
  const isMaster = [];
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    isMaster.push(cell.type !== ExcelJS.ValueType.Merge);
    values.push(cellToPlainValue(cell));
  }
  return { values, isMaster };
};

const isLabelRow = ({ values, isMaster }) => {
  const idxs = values.map((_, i) => i).filter((i) => !isEmptyValue(values[i]) && isMaster[i]);
  if (idxs.length === 0) return { isLabel: false, count: 0 };
  const allText = idxs.every((i) => typeof values[i] === 'string');
  return { isLabel: allText, count: idxs.length };
};

const parseReportDate = (values) => {
  for (const v of values) {
    if (typeof v === 'string') {
      const m = v.match(/Update\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
      if (m) {
        const [, mm, dd, yyyy] = m;
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      }
    }
  }
  return null;
};

// Appends " (2)", " (3)", ... to repeated header names so columns with the same
// label (e.g. a sheet with several "Estimate"/"Date" sub-columns under
// different group headers) don't silently overwrite each other.
const makeHeadersUnique = (headers) => {
  const seen = new Map();
  return headers.map((h) => {
    const n = (seen.get(h) || 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h} (${n})`;
  });
};

const rowValuesToObject = (headers, values) => {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i] !== undefined ? values[i] : null;
  });
  return obj;
};

const parseFinancialReviewWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let reportDate = null;
  const sheets = [];

  workbook.eachSheet((worksheet) => {
    const colCount = Math.max(worksheet.columnCount || 0, worksheet.actualColumnCount || 0, 1);
    const rowCount = Math.max(worksheet.rowCount || 0, worksheet.actualRowCount || 0);

    const rawRows = [];
    for (let r = 1; r <= rowCount; r++) {
      rawRows.push(rowToValues(worksheet.getRow(r), colCount));
    }

    if (!reportDate) {
      for (const rv of rawRows.slice(0, 6)) {
        const d = parseReportDate(rv.values);
        if (d) { reportDate = d; break; }
      }
    }

    // Header row = the densest all-text row (by real, non-merge-duplicated
    // cells) within the first 15 rows. This skips 1-cell title/"Update ..."
    // rows and lands on the real column-header row, including the denser
    // sub-header row on sheets with a two-tier merged header.
    const scanLimit = Math.min(15, rawRows.length);
    let headerRowIndex = -1;
    let bestCount = 0;
    for (let i = 0; i < scanLimit; i++) {
      const { isLabel, count } = isLabelRow(rawRows[i]);
      // Require at least 2 real columns — a single-cell label row is a
      // section title, not a table header (e.g. "FINANCIAL POSITION",
      // "Update 08.03.2026"), even once merge-duplication is discounted.
      if (isLabel && count >= 2 && count > bestCount) {
        bestCount = count;
        headerRowIndex = i;
      }
    }

    let headers = [];
    let dataRows = [];

    if (headerRowIndex === -1) {
      // No clear tabular header (e.g. "Dashboard"/"Executive Dashboard" are
      // label/value lists, not column tables) — keep every non-blank row,
      // generically indexed by column position.
      const maxCols = rawRows.reduce((m, rv) => Math.max(m, rv.values.length), 0);
      headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      dataRows = rawRows
        .map((rv) => rv.values)
        .filter((rv) => rv.some((v) => !isEmptyValue(v)))
        .map((rv) => rowValuesToObject(headers, rv));
    } else {
      // If the row directly above the header row is itself a multi-cell
      // label row, treat it as a merged group-header tier and fold it into
      // the column names (e.g. "Deposit US Product - Estimate").
      let groupValues = null;
      if (headerRowIndex > 0) {
        const above = isLabelRow(rawRows[headerRowIndex - 1]);
        if (above.isLabel && above.count >= 2) {
          groupValues = rawRows[headerRowIndex - 1].values;
        }
      }

      const subValues = rawRows[headerRowIndex].values;
      const rawHeaders = subValues.map((v, i) => {
        const sub = isEmptyValue(v) ? null : String(v);
        const group = groupValues && !isEmptyValue(groupValues[i]) ? String(groupValues[i]) : null;
        if (group && sub) return `${group} - ${sub}`;
        if (sub) return sub;
        if (group) return group;
        return `Column ${i + 1}`;
      });
      headers = makeHeadersUnique(rawHeaders);

      dataRows = rawRows
        .slice(headerRowIndex + 1)
        .map((rv) => rv.values)
        .filter((rv) => rv.some((v) => !isEmptyValue(v)))
        // Some sheets repeat the header text verbatim as the first "data"
        // row (a print-title artifact) — drop exact header-text duplicates.
        .filter((rv) => !rv.every((v, i) => isEmptyValue(v) || String(v) === rawHeaders[i]))
        .map((rv) => rowValuesToObject(headers, rv));
    }

    sheets.push({ name: worksheet.name, headers, rows: dataRows });
  });

  return { reportDate, sheets };
};

module.exports = { parseFinancialReviewWorkbook };
