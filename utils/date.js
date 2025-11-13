// utils/date.js

// convert "2025-11-16" → parts
function getDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m: m - 1, d };
}

// pure day-of-week without timezone shifting
const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
};

// Tambah hari ke string "YYYY-MM-DD"
const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

module.exports = {
  getDayOfWeek,
  addDays
};
