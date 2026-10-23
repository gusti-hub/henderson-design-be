// controllers/sessionController.js
// Staff work sessions: login / heartbeat / logout tracking and the admin "Team attendance" report.

const UserSession = require('../models/UserSession');
const ActivityLog = require('../models/ActivityLog');

const IDLE_MS = 15 * 60 * 1000;          // no heartbeat for 15 min → session is over (check-out = last heartbeat)
const ONLINE_MS = 5 * 60 * 1000;         // "online now" = heartbeat within the last 5 min
const MAX_RANGE_DAYS = 31;

const clientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '';

const whoFields = (user) => ({ userId: user._id, userName: user.name || '', userEmail: user.email || '', userRole: user.role || '' });

// Called by the login endpoint: a fresh login always starts a new session
const startSession = async (req, user) => {
  try {
    const now = new Date();
    await UserSession.create({ ...whoFields(user), loginAt: now, lastSeenAt: now, startedBy: 'login', ipAddress: clientIp(req), userAgent: req.headers['user-agent'] || '' });
  } catch (err) {
    console.error('startSession error:', err.message);
  }
};

// The currently running session of a user (not logged out, heartbeat within the idle window)
const findOpenSession = (userId, now = new Date()) =>
  UserSession.findOne({ userId, logoutAt: null, lastSeenAt: { $gte: new Date(now - IDLE_MS) } }).sort({ lastSeenAt: -1 });

// POST /api/activity/heartbeat — sent every ~2 min while the app is open and visible
const heartbeat = async (req, res) => {
  try {
    const now = new Date();
    const open = await findOpenSession(req.user._id, now);
    if (open) {
      open.lastSeenAt = now;
      await open.save();
    } else {
      // App was left open past the idle window (or the token predates tracking) → this is a new work session
      await UserSession.create({ ...whoFields(req.user), loginAt: now, lastSeenAt: now, startedBy: 'heartbeat', ipAddress: clientIp(req), userAgent: req.headers['user-agent'] || '' });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/activity/logout — the user pressed Logout
const endSession = async (req, res) => {
  try {
    const now = new Date();
    await UserSession.updateMany(
      { userId: req.user._id, logoutAt: null, lastSeenAt: { $gte: new Date(now - IDLE_MS) } },
      { $set: { logoutAt: now, lastSeenAt: now } },
    );
    await ActivityLog.create({
      ...whoFields(req.user), action: 'logout', actionType: 'logout',
      ipAddress: clientIp(req), userAgent: req.headers['user-agent'] || '', status: 'success', timestamp: now,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── time zone helpers (no extra dependency) ───────────────────────────────────
const tzOffsetMs = (date, tz) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
};
const zonedStart = (ymd, tz) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
};
const dayKey = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };

// Total time covered by a set of [start,end] intervals (several tabs / overlapping sessions are not double counted)
const unionMs = (intervals) => {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let total = 0, curS = null, curE = null;
  for (const [s, e] of sorted) {
    if (curE === null || s > curE) { if (curE !== null) total += curE - curS; curS = s; curE = e; }
    else if (e > curE) curE = e;
  }
  if (curE !== null) total += curE - curS;
  return total;
};

// GET /api/activity/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Asia/Jakarta   (admin / view_users)
const getAttendance = async (req, res) => {
  try {
    // Admin, or anyone allowed into User Management
    if (req.user?.role !== 'admin' && !(req.user?.permissions || []).includes('view_users')) return res.status(403).json({ message: 'Not allowed to view attendance' });

    const tz = validTz(req.query.tz) ? req.query.tz : 'Asia/Jakarta';
    const today = dayKey(new Date(), tz);
    const re = /^\d{4}-\d{2}-\d{2}$/;
    let from = re.test(req.query.from) ? req.query.from : today;
    let to   = re.test(req.query.to)   ? req.query.to   : from;
    if (to < from) [from, to] = [to, from];
    const startAt = zonedStart(from, tz);
    const endAt   = new Date(zonedStart(to, tz).getTime() + 26 * 3600 * 1000);          // generous; trimmed by day key below
    const spanDays = Math.round((zonedStart(to, tz) - startAt) / 86400000) + 1;
    if (spanDays > MAX_RANGE_DAYS) return res.status(400).json({ message: `Range is limited to ${MAX_RANGE_DAYS} days` });

    const now = new Date();
    const [sessions, logins] = await Promise.all([
      UserSession.find({ loginAt: { $gte: startAt, $lt: endAt } }).sort({ loginAt: 1 }).lean(),
      ActivityLog.find({ actionType: 'login', userId: { $ne: null }, timestamp: { $gte: startAt, $lt: endAt } }).sort({ timestamp: 1 })
        .select('userId userName userRole timestamp ipAddress').lean(),
    ]);

    const rows = new Map();                                                                // `${day}|${userId}`
    const inRange = (day) => day >= from && day <= to;
    const rowFor = (day, userId, name, role) => {
      const k = `${day}|${userId}`;
      if (!rows.has(k)) rows.set(k, { date: day, userId: String(userId), name: name || 'Unknown', role: role || '', intervals: [], sessions: [], firstIn: null, lastOut: null, online: false, source: 'sessions', logins: 0 });
      return rows.get(k);
    };

    for (const s of sessions) {
      const day = dayKey(s.loginAt, tz);
      if (!inRange(day)) continue;
      const r = rowFor(day, s.userId, s.userName, s.userRole);
      const open = !s.logoutAt && (now - s.lastSeenAt) < IDLE_MS;
      const end = s.logoutAt || s.lastSeenAt;
      const endReason = s.logoutAt ? 'logout' : open ? 'online' : 'idle';
      r.sessions.push({ loginAt: s.loginAt, endAt: end, minutes: Math.max(0, Math.round((end - s.loginAt) / 60000)), endReason, ip: s.ipAddress || '', startedBy: s.startedBy });
      r.intervals.push([+s.loginAt, +end]);
      if (!r.firstIn || s.loginAt < r.firstIn) r.firstIn = s.loginAt;
      if (!r.lastOut || end > r.lastOut) r.lastOut = end;
      if (open) r.online = true;
    }

    // Days from before session tracking existed: only the login events are known (no check-out)
    for (const l of logins) {
      const day = dayKey(l.timestamp, tz);
      if (!inRange(day) || rows.has(`${day}|${l.userId}`)) continue;
      const r = rowFor(day, l.userId, l.userName, l.userRole);
      r.source = 'login-log';
      r.logins++;
      if (!r.firstIn || l.timestamp < r.firstIn) r.firstIn = l.timestamp;
      r.sessions.push({ loginAt: l.timestamp, endAt: null, minutes: null, endReason: 'unknown', ip: l.ipAddress || '', startedBy: 'login' });
    }

    const out = [...rows.values()].map(r => ({
      date: r.date, userId: r.userId, name: r.name, role: r.role,
      firstIn: r.firstIn, lastOut: r.source === 'sessions' ? r.lastOut : null,
      onlineMinutes: r.source === 'sessions' ? Math.round(unionMs(r.intervals) / 60000) : null,
      sessionCount: r.sessions.length, online: r.online, source: r.source,
      sessions: r.sessions.sort((a, b) => new Date(a.loginAt) - new Date(b.loginAt)),
    })).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

    const onlineNow = (await UserSession.find({ logoutAt: null, lastSeenAt: { $gte: new Date(now - ONLINE_MS) } }).sort({ loginAt: 1 })
      .select('userId userName userRole loginAt lastSeenAt').lean())
      .reduce((acc, s) => { if (!acc.find(x => x.userId === String(s.userId))) acc.push({ userId: String(s.userId), name: s.userName, role: s.userRole, since: s.loginAt, lastSeen: s.lastSeenAt }); return acc; }, []);

    const firstTracked = await UserSession.findOne().sort({ loginAt: 1 }).select('loginAt').lean();
    res.json({ tz, from, to, rows: out, onlineNow, trackingSince: firstTracked?.loginAt || null });
  } catch (error) {
    console.error('Error building attendance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Users currently online (heartbeat within 5 min) — used by the small "online" label on the dashboard
const countOnline = async () => (await UserSession.distinct('userId', { logoutAt: null, lastSeenAt: { $gte: new Date(Date.now() - ONLINE_MS) } })).map(String);

module.exports = { startSession, heartbeat, endSession, getAttendance, countOnline };
