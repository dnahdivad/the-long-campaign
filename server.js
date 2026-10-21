/* ============================================================================
   THE LONG CAMPAIGN — game server
   Designed and built by Claude (Anthropic) with Dave.

   Serves the game, keeps every campaign, hides each player's orders until the
   turn resolves, and resolves turns at their deadline (or as soon as every
   human has submitted).  Storage: Postgres when DATABASE_URL is set, otherwise
   JSON files in DATA_DIR.
   ============================================================================ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('./public/engine.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const CRON_KEY = process.env.CRON_KEY || '';

/* ---------------- storage ---------------- */
const Store = (() => {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
    const ready = pool.query('CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated TIMESTAMPTZ DEFAULT now())');
    return {
      async get(id) { await ready; const r = await pool.query('SELECT data FROM campaigns WHERE id=$1', [id]); return r.rows[0] ? r.rows[0].data : null; },
      async put(id, data) { await ready; await pool.query('INSERT INTO campaigns (id, data, updated) VALUES ($1,$2,now()) ON CONFLICT (id) DO UPDATE SET data=$2, updated=now()', [id, data]); },
      async list() { await ready; const r = await pool.query("SELECT id FROM campaigns WHERE data->>'status' <> 'over' OR updated > now() - interval '30 days'"); return r.rows.map(x => x.id); }
    };
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = id => path.join(DATA_DIR, id.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
  return {
    async get(id) { try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch (e) { return null; } },
    async put(id, data) { const f = file(id), tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, f); },
    async list() { return fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)); }
  };
})();
// one change at a time per campaign
const locks = new Map();
function withLock(id, fn) { const prev = locks.get(id) || Promise.resolve(); const next = prev.then(fn, fn); locks.set(id, next.catch(() => { })); return next; }

/* ---------------- email (optional) ---------------- */
let mailer = null;
if (process.env.SMTP_HOST) {
  try {
    const nodemailer = require('nodemailer');
    mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  } catch (e) { console.warn('nodemailer not available; email is off'); }
}
async function mail(to, subject, text) { if (!mailer || !to) return; try { await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text }); } catch (e) { console.warn('mail failed', e.message); } }

/* ---------------- campaigns ---------------- */
const token = () => crypto.randomBytes(12).toString('base64url');
const gameIdOf = t => t.split('.')[0];
function seatOf(doc, t) { const i = doc.tokens.indexOf(t); return i; }

async function createCampaign(body) {
  const seats = Math.max(2, Math.min(6, body.seats | 0 || 4));
  const humans = Math.max(1, Math.min(seats, body.humans | 0 || seats));
  const id = crypto.randomBytes(5).toString('hex');
  const state = E.newGame({ id, seats, humans, seed: body.seed ? +body.seed : undefined, mapSize: body.mapSize, terrain: body.terrain, layout: body.layout === 'mirror' ? 'mirror' : 'matched', towns: body.towns, rivers: body.rivers === undefined ? undefined : +body.rivers, mode: body.mode, turnLimit: Math.max(8, Math.min(60, body.turnLimit | 0 || 30)), name: String(body.name || 'The Long Campaign').slice(0, 60) });
  const hours = Math.max(0.25, Math.min(168, +body.hours || 12));
  const doc = {
    id, status: 'active', created: Date.now(), hours, admin: id + '.' + token(),
    tokens: state.seats.map(() => id + '.' + token()), emails: state.seats.map(() => ''),
    orders: {}, deadline: Date.now() + hours * 3600e3, state
  };
  state.deadline = doc.deadline;
  await Store.put(id, doc);
  return doc;
}
function links(doc) { return doc.state.seats.map((s, i) => ({ seat: i, color: E.COLORS[i].name, bot: s.bot, name: s.name, joined: s.joined, url: s.bot ? null : `${PUBLIC_URL}/play/${doc.tokens[i]}` })); }
async function resolveTurn(doc, why) {
  const st = doc.state, turn = st.turn;
  E.resolve(st, doc.orders);
  doc.orders = {};
  doc.deadline = Date.now() + doc.hours * 3600e3; st.deadline = doc.deadline;
  if (st.over) doc.status = 'over';
  // email every player with an address
  const date = E.dateOf(st, turn).label;
  for (let i = 0; i < st.n; i++) {
    if (!doc.emails[i] || st.seats[i].bot) continue;
    const v = E.view(st, i);
    const lines = v.events.filter(e => e.text).slice(0, 12).map(e => '• ' + e.text).join('\n');
    mail(doc.emails[i], st.over ? `${st.name}: the war is over` : `${st.name}: ${date} has been fought`, `${st.over ? st.over.why : `The orders for ${date} have been carried out${why ? ' (' + why + ')' : ''}.`}\n\n${lines || 'A quiet month on your front.'}\n\nYour command: ${PUBLIC_URL}/play/${doc.tokens[i]}\n${st.over ? '' : `Orders for ${E.dateOf(st, st.turn).label} are due ${new Date(doc.deadline).toUTCString()}.`}`);
  }
  return doc;
}
async function tickCampaign(id) {
  return withLock(id, async () => {
    const doc = await Store.get(id); if (!doc || doc.status !== 'active') return doc;
    if (Date.now() >= doc.deadline) { await resolveTurn(doc, 'the deadline passed'); await Store.put(id, doc); }
    return doc;
  });
}

/* ---------------- http ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
// a secret word for the organiser's front page; without it the site shows nothing but "Not Found"
const ORGANISER_KEY = (process.env.ORGANISER_KEY || '').trim();
const ROBOTS = { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
function send(res, code, body, type) { res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...ROBOTS }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
function readBody(req) { return new Promise((ok, bad) => { let b = ''; req.on('data', c => { b += c; if (b.length > 2e5) { bad(new Error('too large')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); }); }
function serveFile(res, rel) {
  const f = path.join(__dirname, 'public', rel); if (!f.startsWith(path.join(__dirname, 'public'))) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(f, (err, data) => { if (err) return send(res, 404, 'Not found', 'text/plain'); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300', ...ROBOTS }); res.end(data); });
}
// what a stranger sees: the plainest possible empty server
const notFound = res => send(res, 404, '<!doctype html><title>404 Not Found</title><h1>Not Found</h1><p>The requested URL was not found on this server.</p>', 'text/html; charset=utf-8');
// the front page, with the solo link pointed at the secret address (or removed on the organiser's page)
function serveFront(res, soloHref) {
  fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, html) => {
    if (err) return notFound(res);
    html = soloHref ? html.replace('href="/solo"', `href="${soloHref}"`) : html.replace(/\s*<p><a href="\/solo">[^<]*<\/a><\/p>/, '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...ROBOTS }); res.end(html);
  });
}
function serveSolo(res) { fs.readFile(path.join(__dirname, 'dist', 'the-long-campaign-solo.html'), (err, data) => err ? notFound(res) : (res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...ROBOTS }), res.end(data))); }
const keyOk = k => !ORGANISER_KEY || k === ORGANISER_KEY;
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    if (req.method === 'GET' && p === '/robots.txt') return send(res, 200, 'User-agent: *\nDisallow: /\n', 'text/plain');
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true });
    // the front page and the solo game: open to all only when no organiser key is set
    if (req.method === 'GET' && !ORGANISER_KEY && (p === '/' || p === '/index.html')) return serveFront(res, '/solo');
    if (req.method === 'GET' && !ORGANISER_KEY && (p === '/solo' || p === '/solo/')) return serveSolo(res);
    if (req.method === 'GET' && ORGANISER_KEY && (p === '/' + ORGANISER_KEY || p === '/' + ORGANISER_KEY + '/')) return serveFront(res, '/' + ORGANISER_KEY + '/solo');
    if (req.method === 'GET' && ORGANISER_KEY && p === '/' + ORGANISER_KEY + '/solo') return serveSolo(res);
    // a player's or organiser's page: only for a link that really exists
    let pm = p.match(/^\/(play|admin)\/([\w.-]+)$/);
    if (req.method === 'GET' && pm) {
      const doc = await Store.get(gameIdOf(pm[2])).catch(() => null);
      if (!doc) return notFound(res);
      if (pm[1] === 'play') return doc.tokens.includes(pm[2]) ? serveFile(res, 'play.html') : notFound(res);
      return doc.admin === pm[2] ? serveFront(res, null) : notFound(res);
    }
    if (p === '/cron') { if (CRON_KEY && u.searchParams.get('key') !== CRON_KEY) return send(res, 403, { error: 'bad key' }); const ids = await Store.list(); let n = 0; for (const id of ids) { const before = await Store.get(id); const after = await tickCampaign(id); if (before && after && after.state.turn !== before.state.turn) n++; } return send(res, 200, { checked: ids.length, resolved: n }); }
    // create a campaign
    if (req.method === 'POST' && p === '/api/campaigns') {
      if (!keyOk(req.headers['x-organiser-key'] || '')) return notFound(res);
      const body = await readBody(req); const doc = await createCampaign(body);
      return send(res, 200, { id: doc.id, admin: doc.admin, adminUrl: `${PUBLIC_URL}/admin/${doc.admin}`, links: links(doc) });
    }
    // the organiser's page: invite links, force a turn
    let m = p.match(/^\/api\/admin\/([\w.-]+)(\/resolve)?$/);
    if (m) {
      const id = gameIdOf(m[1]); const doc = await tickCampaign(id); if (!doc || doc.admin !== m[1]) return send(res, 404, { error: 'No such campaign' });
      if (m[2] && req.method === 'POST') { const out = await withLock(id, async () => { const d = await Store.get(id); if (d.status === 'active') { await resolveTurn(d, 'the organiser moved the clock on'); await Store.put(id, d); } return d; }); return send(res, 200, { ok: true, turn: out.state.turn }); }
      return send(res, 200, { id, name: doc.state.name, turn: doc.state.turn, date: E.dateOf(doc.state, doc.state.turn).label, status: doc.status, deadline: doc.deadline, hours: doc.hours, links: links(doc), submitted: doc.state.seats.map(s => s.bot || !!doc.orders[s.seat]) });
    }
    // a player's view, orders and joining
    m = p.match(/^\/api\/play\/([\w.-]+)(\/orders|\/join|\/status)?$/);
    if (m) {
      const id = gameIdOf(m[1]); const doc0 = await tickCampaign(id); if (!doc0) return send(res, 404, { error: 'No such campaign' });
      const seat = seatOf(doc0, m[1]); if (seat < 0) return send(res, 404, { error: 'That link is not part of this campaign' });
      if (m[2] === '/status') return send(res, 200, { turn: doc0.state.turn, deadline: doc0.deadline, status: doc0.status, submitted: doc0.state.seats.map(s => s.bot || !!doc0.orders[s.seat]) });
      if (req.method === 'POST' && m[2] === '/join') {
        const body = await readBody(req);
        const out = await withLock(id, async () => { const d = await Store.get(id); const s = d.state.seats[seat]; s.name = String(body.name || '').trim().slice(0, 32) || s.name || `${E.COLORS[seat].name} Army`; s.joined = true; d.emails[seat] = String(body.email || '').trim().slice(0, 120); await Store.put(id, d); return d; });
        return send(res, 200, view(out, seat));
      }
      if (req.method === 'POST' && m[2] === '/orders') {
        const body = await readBody(req);
        const out = await withLock(id, async () => {
          const d = await Store.get(id); if (d.status !== 'active') return d;
          if (body.turn !== d.state.turn) throw Object.assign(new Error('That turn has already been fought. Reload to see what happened.'), { code: 409 });
          d.orders[seat] = E.cleanOrders(d.state, seat, body.orders);
          d.state.seats[seat].submitted = true;
          const waiting = d.state.seats.filter(s => s.alive && !s.bot && !d.orders[s.seat]);
          if (!waiting.length) await resolveTurn(d, 'every general had sent orders');
          await Store.put(id, d); return d;
        });
        return send(res, 200, view(out, seat));
      }
      return send(res, 200, view(doc0, seat));
    }
    // static files
    if (req.method === 'GET' && /\.(js|css|png|svg|ico)$/.test(p)) return serveFile(res, p.slice(1));
    notFound(res);
  } catch (e) { console.error(e); send(res, e.code === 409 ? 409 : 400, { error: e.message || 'Something went wrong' }); }
});
function view(doc, seat) { const v = E.view(doc.state, seat); v.deadline = doc.deadline; v.hours = doc.hours; v.status = doc.status; v.myOrders = doc.orders[seat] || null; v.submittedSeats = doc.state.seats.map(s => s.bot || !!doc.orders[s.seat]); return v; }
// resolve overdue turns even when nobody visits
setInterval(async () => { try { for (const id of await Store.list()) await tickCampaign(id); } catch (e) { console.warn(e.message); } }, 60e3).unref();
if (require.main === module) server.listen(PORT, () => console.log(`The Long Campaign is listening on ${PORT}`));
module.exports = { server, createCampaign, Store };
