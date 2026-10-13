// Text helpers shared by the Install Binder documents (PDF and Excel)

// Rich text / HTML -> plain text, keeping line breaks
const richToText = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Vendor description as entered (plain text, line breaks kept) — no other field is mixed in
const vendorDescriptionText = (html) => richToText(html);

// Notes are usually one dated point per line ("9/28/26 LP will pick up..."), not always newest first.
// Keep only the n most recent points, newest first.
const DATE_START = /^\s*(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?|(\d{4})-(\d{2})-(\d{2}))(?=\D|$)/;
const latestNotePoints = (html, n = 2, now = new Date()) => {
  const lines = richToText(html).split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';

  const entries = [];
  lines.forEach(line => {
    const m = line.match(DATE_START);
    if (m) {
      let y, mo, d;
      if (m[4]) { y = +m[4]; mo = +m[5]; d = +m[6]; }
      else { mo = +m[1]; d = +m[2]; y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null; }
      entries.push({ text: line, y, mo, d, idx: entries.length });
    } else if (entries.length) {
      entries[entries.length - 1].text += '\n' + line;          // continuation of the previous point
    } else {
      entries.push({ text: line, y: null, mo: null, d: null, idx: 0 });
    }
  });

  // Dates without a year take the year of the closest dated point that has one (else the current year)
  const yearOf = (e) => {
    if (e.y) return e.y;
    let best = null, bestDist = Infinity;
    entries.forEach(o => { if (o.y && Math.abs(o.idx - e.idx) < bestDist) { best = o.y; bestDist = Math.abs(o.idx - e.idx); } });
    return best || now.getFullYear();
  };
  entries.forEach(e => { e.t = e.mo ? Date.UTC(yearOf(e), e.mo - 1, e.d) : null; });

  const dated = entries.filter(e => e.t !== null).sort((a, b) => (b.t - a.t) || (a.idx - b.idx));
  const undated = entries.filter(e => e.t === null);
  // Cut at the n-th line break: at most n lines in total, even if a point continues on extra lines
  return [...dated, ...undated].slice(0, n).map(e => e.text).join('\n').split('\n').slice(0, n).join('\n');
};

// Items whose Install Status is "Pending" are left out of the Install Binder (PDF and Excel)
const isInstallPending = (opts) => String(opts?.installStatus || '').trim().toLowerCase() === 'pending';

module.exports = { richToText, vendorDescriptionText, latestNotePoints, isInstallPending };
