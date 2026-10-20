/* ============================================================================
   THE LONG CAMPAIGN — the player's table
   Designed and built by Claude (Anthropic) with Dave.
   ============================================================================ */
(function () {
'use strict';
const E = window.Engine, U = E.util, { K, P, hdist, nbrs } = U;
const $ = s => document.querySelector(s);
const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'html') e.innerHTML = attrs[k]; else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); } for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- pixel geometry ---------------- */
const HW = 22, HH = 24, DY = 18;            // hex width, height and row step in base pixels
let V = null, api = null, OFF = [0, 0], MAPW = 0, MAPH = 0;
const hexXY = k => { const [q, r] = P(k); return [OFF[0] + q * HW + r * HW / 2, OFF[1] + r * DY]; };
const MASK = (() => { const m = []; for (let y = 0; y < HH; y++) { const row = []; for (let x = 0; x < HW; x++) { const px = x + 0.5 - HW / 2, py = y + 0.5; let hw; if (py < 6) hw = (HW / 2) * py / 6; else if (py <= 18) hw = HW / 2; else hw = (HW / 2) * (24 - py) / 6; row.push(Math.abs(px) <= hw + 0.01); } m.push(row); } return m; })();
function pixToHex(px, py) {
  // nearest hex centre wins
  let best = null, bd = 1e9; const r0 = Math.round((py - OFF[1] - HH / 2) / DY);
  for (let r = r0 - 1; r <= r0 + 1; r++) { const q0 = Math.round((px - OFF[0] - HW / 2 - r * HW / 2) / HW); for (let q = q0 - 1; q <= q0 + 1; q++) { const k = K(q, r); if (!V.hexes[k]) continue; const [x, y] = hexXY(k); const d = (px - x - HW / 2) ** 2 + ((py - y - HH / 2) * 1.1) ** 2; if (d < bd) { bd = d; best = k; } } }
  return bd < 200 ? best : null;
}
/* ---------------- colours ---------------- */
const hex2 = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const SEASON_GRASS = { spring: ['#5a9a38', '#66a640', '#74b04a'], summer: ['#5e9a32', '#6aa63a', '#7ab244'], autumn: ['#8a9440', '#9a9e48', '#aaa654'], winter: ['#c4ccd0', '#d2d8da', '#e2e6e8'] };
const PAL = i => i === E.NEUTRAL ? { c: '#6e6250', C: '#4e4434', l: '#8e8270', h: '#3a3024', H: '#2a2018', t: '#7a6a50', T: '#5e5038', ui: '#8a7a5a', name: 'Militia' } : E.COLORS[i];
const FLAGC = i => i === E.NEUTRAL ? '#e8e0cc' : E.COLORS[i].ui;

/* ---------------- sprites (original pixel art) ---------------- */
const SPR = {
  inf: ['.hhh.g', '.hHHHg', '..ss.m', '.ccc.m', '.cccsm', '.cbc.m', '.ttt..', '.t.t..', '.t.t..', '.k.k..'],
  cav: ['......hhh...', '......hHH...', '......ss....', '.....cccs...', '....aataaa.a', '..aaaaaaaaaA', '.naaaaaaaaaA', 'n..aaaaaaa..', '...a.a..a.a.', '...k.k..k.k.'],
  art: ['..........', '.www......', 'w.w.wBBBBB', 'wwXwwBBBBo', 'w.w.w.....', '.www......'],
  eng: ['.hhh..', '.hHHH.', '..ss..', '.ccc.e', '.cccse', '.cbc.e', '.ttt.E', '.t.t..', '.t.t..', '.k.k..'],
  gen: ['......hhh...', '......HHH...', '......ss....', '.....cyc....', '....aacaaa.a', '..aaaaaaaaaA', '.naaaaaaaaaA', 'n..aaaaaaa..', '...a.a..a.a.', '...k.k..k.k.'],
  tree: ['.ooo.', 'oGLGo', 'oGGdo', '.oTo.'],
  pine: ['..o..', '.oLo.', 'oGGdo', 'ooooo', '..T..']
};
const SPRC = new Map();
function sprite(name, pal) {
  const key = name + JSON.stringify(pal); let c = SPRC.get(key); if (c) return c;
  const g = SPR[name], h = g.length, w = Math.max(...g.map(r => r.length));
  c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2; const x = c.getContext('2d');
  const on = (i, j) => j >= 0 && j < h && i >= 0 && i < g[j].length && g[j][i] !== '.' && pal[g[j][i]];
  x.fillStyle = '#17110a'; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!on(i + di, j + dj)) x.fillRect(i + di + 1, j + dj + 1, 1, 1);
  for (let j = 0; j < h; j++) for (let i = 0; i < g[j].length; i++) { const col = pal[g[j][i]]; if (g[j][i] === '.' || !col) continue; x.fillStyle = col; x.fillRect(i + 1, j + 1, 1, 1); }
  SPRC.set(key, c); return c;
}
const COMMON = { s: '#eab88e', k: '#1d150e', b: '#1d150e', m: '#7c5430', g: '#dcdcdc', n: '#4a3220', a: '#7c4a24', A: '#5a3418', w: '#6e4826', X: '#2e2a26', o: '#0e0c0a', B: '#a8843c', e: '#8a8a8a', E: '#5a4a3a', y: '#e0b440' };
function unitPal(seat) { const p = PAL(seat); return { ...COMMON, c: p.c, C: p.C, l: p.l, h: p.h, H: p.H, t: p.t, T: p.T }; }

/* ---------------- the base map, drawn once per turn ---------------- */
let baseCanvas = null, dynCanvas = null, dyn = null, view = { x: 0, y: 0, z: 2 }, canvas, ctx;
function buildBase() {
  const R = V.R; OFF = [R * HW + HW, 4 - (-R) * DY]; OFF = [Math.round(R * HW * 1.0 + 6), Math.round(R * DY + 6)];
  // centre the board: hex (0,0) at OFF
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const k in V.hexes) { const [q, r] = P(k); const x = q * HW + r * HW / 2, y = r * DY; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  OFF = [-minx + 6, -miny + 14]; MAPW = Math.ceil(maxx - minx + HW + 12); MAPH = Math.ceil(maxy - miny + HH + 20);
  baseCanvas = document.createElement('canvas'); baseCanvas.width = MAPW; baseCanvas.height = MAPH;
  dynCanvas = document.createElement('canvas'); dynCanvas.width = MAPW; dynCanvas.height = MAPH; dyn = dynCanvas.getContext('2d');
  const g = baseCanvas.getContext('2d'), img = g.createImageData(MAPW, MAPH), D = img.data;
  const season = E.dateOf(V, V.turn).season, grass = SEASON_GRASS[season].map(hex2), winter = season === 'winter';
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= MAPW || y >= MAPH) return; const i = (y * MAPW + x) * 4; D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; };
  const sea = hex2('#1e2a1e');
  for (let i = 0; i < MAPW * MAPH; i++) { D[i * 4] = 24; D[i * 4 + 1] = 20; D[i * 4 + 2] = 14; D[i * 4 + 3] = 255; }
  const rnd = (x, y, s) => { const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return n - Math.floor(n); };
  const colorFor = (h, x, y, X, Y) => {
    const r = rnd(X, Y, 1), t = h.t;
    if (t === 'water') { if (h.ford) return r < 0.12 ? hex2('#b8b0a0') : r < 0.3 ? hex2('#8ab8ea') : hex2('#5c92d6'); return r < 0.06 ? hex2('#9ac0f0') : r < 0.5 ? hex2(winter ? '#7090b0' : '#3d6fc0') : hex2(winter ? '#6886a6' : '#3a68b8'); }
    if (t === 'hills') { const shade = y < 9 ? (winter ? '#f0f2f2' : '#a8b860') : y < 15 ? (winter ? '#d8dcdc' : '#8a9a48') : (winter ? '#b8bec0' : '#6e7c38'); return r < 0.05 ? hex2('#5e5a40') : hex2(shade); }
    if (t === 'woods') return r < 0.5 ? hex2(winter ? '#a8b0aa' : '#4a7a30') : hex2(winter ? '#9aa49e' : '#406e2a');
    if (h.farm) { if (h.farm.burned > 0) return r < 0.3 ? hex2('#3a2e24') : hex2('#4a3a2c'); return (Math.floor((X + Y * 2) / 2) % 2) ? hex2(winter ? '#d8d2c4' : '#c8a050') : hex2(winter ? '#c8c0b0' : '#a8803e'); }
    const lev = Math.min(2, Math.floor(r * 3.3)); return r < 0.03 ? hex2(winter ? '#a0a8ac' : '#4e862a') : grass[lev];
  };
  for (const k in V.hexes) {
    const h = V.hexes[k], [x0, y0] = hexXY(k);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (MASK[y][x]) put(Math.round(x0) + x, Math.round(y0) + y, colorFor(h, x, y, Math.round(x0) + x, Math.round(y0) + y));
  }
  g.putImageData(img, 0, 0);
  // roads and railways between neighbouring hexes
  const line = (a, b, col, w) => { const [ax, ay] = hexXY(a), [bx, by] = hexXY(b); pline(g, ax + HW / 2, ay + HH / 2, bx + HW / 2, by + HH / 2, col, w); };
  const drawn = new Set();
  for (const k in V.hexes) { const h = V.hexes[k]; if (!h.road && !h.town) continue; for (const nb of nbrs(k)) { const o = V.hexes[nb]; if (!o || !(o.road || o.town) || !(h.road || o.road)) continue; const id = k < nb ? k + nb : nb + k; if (drawn.has(id)) continue; drawn.add(id); line(k, nb, winter ? '#b8a888' : '#c8a46a', 3); } }
  for (const k in V.hexes) { const h = V.hexes[k]; if (!h.rail) continue; for (const nb of nbrs(k)) { const o = V.hexes[nb]; if (!o || !o.rail) continue; const id = 'r' + (k < nb ? k + nb : nb + k); if (drawn.has(id)) continue; drawn.add(id); const broken = h.railBroken || o.railBroken; const [ax, ay] = hexXY(k), [bx, by] = hexXY(nb); const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L; for (let s = 0; s < L; s += 3) { const px = ax + HW / 2 + ux * s, py = ay + HH / 2 + uy * s; g.fillStyle = broken ? '#7a3a20' : '#3a2a1a'; g.fillRect(Math.round(px - uy * 2), Math.round(py + ux * 2), 1, 1); g.fillRect(Math.round(px + uy * 2), Math.round(py - ux * 2), 1, 1); if (!broken || s % 6) { g.fillStyle = broken ? '#a05030' : '#6a5a4a'; g.fillRect(Math.round(px), Math.round(py), 1, 1); } } } }
  // bridges, trees, hills, towns, farms
  for (const k in V.hexes) {
    const h = V.hexes[k], [x0, y0] = hexXY(k), cx = Math.round(x0 + HW / 2), cy = Math.round(y0 + HH / 2);
    if (h.t === 'water' && h.bridge) { g.fillStyle = '#3a2412'; g.fillRect(cx - 7, cy - 4, 14, 8); g.fillStyle = '#9a6a3a'; g.fillRect(cx - 6, cy - 3, 12, 6); g.fillStyle = '#7a5028'; for (let i = -5; i < 6; i += 2) g.fillRect(cx + i, cy - 3, 1, 6); }
    if (h.t === 'woods') { const pal = winter ? { o: '#1e2a1e', G: '#3a5040', L: '#f4f6f6', d: '#2a382c', T: '#4a3420' } : { o: '#10240a', G: '#2e6a1e', L: '#7cc04a', d: '#1e4a14', T: '#5a3a1e' }; const sp = sprite(winter ? 'pine' : 'tree', pal); for (const [dx, dy] of [[-7, -7], [1, -9], [-3, -2], [4, -3], [-8, 2], [1, 3], [6, 2]]) g.drawImage(sp, cx + dx - 2, cy + dy - 2); }
    if (h.t === 'hills') { g.fillStyle = winter ? '#ffffff' : '#c8d47a'; for (let i = -6; i <= 6; i++) { const yy = cy - 2 - Math.round(Math.sqrt(Math.max(0, 36 - i * i)) * 0.6); g.fillRect(cx + i, yy, 1, 1); } g.fillStyle = winter ? '#9aa0a2' : '#4e5a26'; for (let i = -6; i <= 6; i += 2) { g.fillRect(cx + i, cy + 2 + (i % 4 ? 1 : 0), 1, 2); } }
    if (h.town) drawTown(g, h, cx, cy);
  }
  // board edge
  g.strokeStyle = '#0c0a06'; g.lineWidth = 1;
}
function pline(g, x0, y0, x1, y1, col, w) {
  g.fillStyle = col; const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w); }
}
function drawTown(g, h, cx, cy) {
  const t = h.town, own = t.owner, flag = FLAGC(own);
  const house = (x, y, w, hh, roof) => { g.fillStyle = '#17110a'; g.fillRect(x - 1, y - 1, w + 2, hh + 2); g.fillStyle = roof; g.fillRect(x, y, w, Math.ceil(hh / 2)); g.fillStyle = '#ece2c6'; g.fillRect(x, y + Math.ceil(hh / 2), w, Math.floor(hh / 2)); g.fillStyle = '#2a2e40'; g.fillRect(x + 1, y + hh - 2, 1, 1); if (w > 4) g.fillRect(x + w - 2, y + hh - 2, 1, 1); };
  if (t.kind === 'city') { house(cx - 8, cy - 5, 6, 6, '#a84a2c'); house(cx + 1, cy - 7, 7, 7, '#8a3a24'); house(cx - 5, cy + 2, 6, 5, '#b05a34'); house(cx + 3, cy + 2, 5, 5, '#9a4028'); g.fillStyle = '#e8e2d2'; g.fillRect(cx - 1, cy - 10, 2, 8); g.fillStyle = '#17110a'; g.fillRect(cx - 1, cy - 11, 2, 1); /* dome */ g.fillStyle = '#d8d0c0'; g.fillRect(cx - 2, cy - 9, 4, 2); }
  else if (t.kind === 'hq') { g.fillStyle = '#17110a'; g.fillRect(cx - 8, cy - 5, 16, 11); g.fillStyle = '#8a7a5a'; g.fillRect(cx - 7, cy - 4, 14, 9); g.fillStyle = '#6a5a40'; for (let i = -7; i < 7; i += 2) g.fillRect(cx + i, cy - 5, 1, 1); g.fillStyle = '#ece2c6'; g.fillRect(cx - 3, cy - 2, 6, 5); g.fillStyle = '#a84a2c'; g.fillRect(cx - 3, cy - 3, 6, 2); }
  else { house(cx - 6, cy - 4, 5, 5, '#b05a34'); house(cx + 1, cy - 6, 5, 6, '#8a3a24'); house(cx - 2, cy + 2, 5, 4, '#a84a2c'); }
  // owner's flag
  const fx = cx + 6, fy = cy - 12; g.fillStyle = '#3a2412'; g.fillRect(fx, fy, 1, 9); g.fillStyle = '#17110a'; g.fillRect(fx + 1, fy - 1, 7, 6); g.fillStyle = flag; g.fillRect(fx + 1, fy, 6, 4); if (own === E.NEUTRAL) { g.fillStyle = '#b8b0a0'; g.fillRect(fx + 1, fy + 3, 6, 1); }
  for (let i = 0; i < (t.fort || 0); i++) { g.fillStyle = '#5a5248'; g.fillRect(cx - 9 + i * 3, cy + 7, 2, 2); }
}

/* ---------------- drawing each frame ---------------- */
let sel = null, reachCache = null, mode = null, modeData = null, orders = { units: {}, recruit: [], diplo: null }, hover = null, anim = null, lastFrame = 0, toastT = 0;
function occupancy() { return E.occupancy({ units: V.units }); }
let drawFailed = 0;
function draw(now) {
  requestAnimationFrame(draw);
  if (!V || !baseCanvas) return;
  try { drawFrame(now); } catch (e) { if (drawFailed++ < 3) console.error('map frame failed', e); }
}
function drawFrame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0); lastFrame = now;
  const g = dyn; g.clearRect(0, 0, MAPW, MAPH); g.imageSmoothingEnabled = false;
  g.drawImage(baseCanvas, 0, 0);
  const vis = new Set(V.visible);
  // fog of war
  g.fillStyle = 'rgba(16,12,8,0.42)';
  for (const k in V.hexes) if (!vis.has(k)) { const [x0, y0] = hexXY(k); fillHex(g, x0, y0); }
  // entrenchments
  for (const k in V.hexes) { const h = V.hexes[k]; if (!h.ent) continue; const [x0, y0] = hexXY(k); g.fillStyle = '#5a3e22'; for (let i = 0; i < h.ent; i++) g.fillRect(Math.round(x0 + 4), Math.round(y0 + 18 - i * 2), HW - 8, 1); }
  // weather
  drawWeather(g, now / 1000);
  // reachable hexes for the selected unit
  if (sel && reachCache && !anim && !mode) {
    const occ = occupancy();
    for (const k in reachCache.best) { if (k === sel.at) continue; const [x0, y0] = hexXY(k); const o = occ[k]; g.fillStyle = o && o.seat !== V.me ? 'rgba(220,50,30,0.38)' : 'rgba(255,230,120,0.28)'; fillHex(g, x0, y0); }
  }
  if (mode && modeData && modeData.targets) for (const k of modeData.targets) { const [x0, y0] = hexXY(k); g.fillStyle = mode === 'support' ? 'rgba(80,200,255,0.35)' : mode === 'bombard' ? 'rgba(255,120,40,0.4)' : 'rgba(120,255,160,0.35)'; fillHex(g, x0, y0); }
  // order arrows
  for (const id in orders.units) { const u = V.units[id], o = orders.units[id]; if (!u) continue; drawOrder(g, u, o); }
  // units (or the replay)
  if (anim) drawReplay(g, now / 1000); else for (const id in V.units) drawUnit(g, V.units[id], null, now / 1000);
  // recruits ordered
  for (const r of orders.recruit) { const [x0, y0] = hexXY(r.hex); g.fillStyle = 'rgba(255,240,180,0.9)'; g.fillRect(Math.round(x0 + HW / 2 - 4), Math.round(y0 + 3), 8, 1); g.globalAlpha = 0.6; blitUnit(g, r.type, V.me, x0 + HW / 2, y0 + HH / 2 + 2, false, now / 1000); g.globalAlpha = 1; }
  if (sel) { const [x0, y0] = hexXY(sel.at); outlineHex(g, x0, y0, '#ffd84a'); }
  if (hover) { const [x0, y0] = hexXY(hover); outlineHex(g, x0, y0, 'rgba(255,255,255,0.6)'); }
  // to the screen
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#18140e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const dpr = window.devicePixelRatio || 1, z = view.z * dpr;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(z, 0, 0, z, Math.round(-view.x * z + canvas.width / 2), Math.round(-view.y * z + canvas.height / 2));
  ctx.drawImage(dynCanvas, 0, 0);
  // strength plates in screen resolution
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!anim) for (const id in V.units) { const u = V.units[id]; const [x0, y0] = hexXY(u.at); const [sx, sy] = toScreen(x0 + HW / 2, y0 + HH - 3); plate(sx, sy, u.str, u.seat); if (hungerSet.has(id)) hungerMark(sx + 10, sy - 2); }
  if (anim) { const t = (now / 1000 - anim.t0); for (const f of anim.flashes) if (t >= f.t && t < f.t + 1.4) { const [x0, y0] = hexXY(f.hex); const [sx, sy] = toScreen(x0 + HW / 2, y0 - 2); ctx.font = `bold ${Math.max(11, 4 * view.z)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#17110a'; ctx.strokeText(f.label, sx, sy - (t - f.t) * 10); ctx.fillStyle = f.col; ctx.fillText(f.label, sx, sy - (t - f.t) * 10); } }
  if (view.z >= 3) for (const k in V.hexes) { const h = V.hexes[k]; if (!h.town) continue; const [x0, y0] = hexXY(k); const [sx, sy] = toScreen(x0 + HW / 2, y0 + HH + 1); ctx.font = `${Math.round(view.z * 3.4)}px "IM Fell English", Georgia, serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,8,0.85)'; ctx.strokeText(h.town.name, sx, sy + 6); ctx.fillStyle = h.town.kind === 'city' ? '#ffe9a8' : '#f2e7c9'; ctx.fillText(h.town.name, sx, sy + 6); }
}
function toScreen(x, y) { const dpr = window.devicePixelRatio || 1; return [(x - view.x) * view.z + canvas.width / dpr / 2, (y - view.y) * view.z + canvas.height / dpr / 2]; }
function fromScreen(sx, sy) { const dpr = window.devicePixelRatio || 1; return [(sx - canvas.width / dpr / 2) / view.z + view.x, (sy - canvas.height / dpr / 2) / view.z + view.y]; }
function plate(sx, sy, str, seat) {
  const w = 14, h = 11; ctx.fillStyle = '#17110a'; ctx.fillRect(Math.round(sx - w / 2) - 1, Math.round(sy) - 1, w + 2, h + 2); ctx.fillStyle = FLAGC(seat); ctx.fillRect(Math.round(sx - w / 2), Math.round(sy), w, h);
  ctx.fillStyle = seat === E.NEUTRAL || (E.COLORS[seat] && (E.COLORS[seat].id === 'gold' || E.COLORS[seat].id === 'grey')) ? '#17110a' : '#fff'; ctx.font = 'bold 10px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.max(0, Math.round(str))), Math.round(sx), Math.round(sy + h / 2 + 0.5)); ctx.textBaseline = 'alphabetic';
}
function hungerMark(sx, sy) { ctx.fillStyle = '#17110a'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 9, 13); ctx.fillStyle = '#d8402c'; ctx.fillRect(Math.round(sx), Math.round(sy), 7, 11); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', Math.round(sx + 3.5), Math.round(sy + 6)); ctx.textBaseline = 'alphabetic'; }
function fillHex(g, x0, y0) { x0 = Math.round(x0); y0 = Math.round(y0); for (let y = 0; y < HH; y++) { let a = -1, b = -1; for (let x = 0; x < HW; x++) if (MASK[y][x]) { if (a < 0) a = x; b = x; } if (a >= 0) g.fillRect(x0 + a, y0 + y, b - a + 1, 1); } }
function outlineHex(g, x0, y0, col) { x0 = Math.round(x0); y0 = Math.round(y0); g.fillStyle = col; for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { if (!MASK[y][x]) continue; const edge = y === 0 || y === HH - 1 || x === 0 || x === HW - 1 || !MASK[y - 1][x] || !MASK[y + 1][x] || !MASK[y][x - 1] || !MASK[y][x + 1]; if (edge) g.fillRect(x0 + x, y0 + y, 1, 1); } }
function blitUnit(g, type, seat, cx, cy, flip, t, str) {
  const pal = unitPal(seat), sp = sprite(type, pal);
  const figs = type === 'inf' ? [[-5, 1], [0, -1], [5, 1]] : type === 'eng' ? [[-3, 0], [3, 1]] : type === 'art' ? [[0, 0]] : [[0, 0]];
  for (const [dx, dy] of figs) { const bob = Math.floor(t * 2 + dx) % 2 === 0 ? 0 : 0; g.save(); g.translate(Math.round(cx + dx), Math.round(cy + dy + bob)); if (flip) g.scale(-1, 1); g.drawImage(sp, -Math.floor(sp.width / 2), -sp.height + 4); g.restore(); }
  if (type === 'art') { g.fillStyle = pal.c; g.fillRect(Math.round(cx - 7), Math.round(cy - 4), 2, 3); g.fillStyle = '#eab88e'; g.fillRect(Math.round(cx - 7), Math.round(cy - 5), 2, 1); }
  if (type === 'gen') { g.fillStyle = '#3a2412'; g.fillRect(Math.round(cx + 4), Math.round(cy - 13), 1, 9); g.fillStyle = FLAGC(seat); g.fillRect(Math.round(cx + 5), Math.round(cy - 13), 5, 3); }
}
function drawUnit(g, u, at, t) {
  const [x0, y0] = hexXY(at || u.at); const cx = x0 + HW / 2, cy = y0 + HH / 2 + 3;
  const towardCentre = hexXY(V.center)[0] < x0;
  blitUnit(g, u.type, u.seat, cx, cy, towardCentre, t, u.str);
}
function drawOrder(g, u, o) {
  const [ax, ay] = hexXY(u.at), A = [ax + HW / 2, ay + HH / 2];
  if (o.k === 'move') {
    let prev = A; const occ = occupancy();
    for (const k of o.path) { const [x, y] = hexXY(k), B = [x + HW / 2, y + HH / 2]; pline(g, prev[0], prev[1], B[0], B[1], '#17110a', 3); pline(g, prev[0], prev[1], B[0], B[1], occ[k] && occ[k].seat !== V.me ? '#ff6a4a' : '#ffe9a0', 1); prev = B; }
    g.fillStyle = '#ffe9a0'; g.fillRect(Math.round(prev[0] - 2), Math.round(prev[1] - 2), 4, 4);
    if (o.detach) { g.fillStyle = '#17110a'; g.fillRect(Math.round(A[0] - 9), Math.round(A[1] - 12), 6, 5); g.fillStyle = FLAGC(V.me); g.fillRect(Math.round(A[0] - 8), Math.round(A[1] - 11), 4, 3); }
  } else if ((o.k === 'support' && (o.hex || V.units[o.unit])) || o.k === 'bombard' || o.k === 'bridge' || (o.k === 'merge' && V.units[o.into])) {
    const tgt = o.k === 'merge' ? V.units[o.into].at : o.k === 'support' && o.unit ? V.units[o.unit].at : o.hex;
    const [x, y] = hexXY(tgt), B = [x + HW / 2, y + HH / 2]; const col = o.k === 'support' ? FLAGC(o.unit ? V.units[o.unit].seat : o.for) : o.k === 'bombard' ? '#ff8a30' : o.k === 'merge' ? '#8fe08a' : '#9adcff';
    for (let i = 0; i < 1; i += 0.08) { const px = A[0] + (B[0] - A[0]) * i, py = A[1] + (B[1] - A[1]) * i - Math.sin(i * Math.PI) * 6; g.fillStyle = '#17110a'; g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3); g.fillStyle = col; g.fillRect(Math.round(px), Math.round(py), 1, 1); }
  } else {
    const label = { hold: '', raid: '#c84a2a', dig: '#8a6038', fortify: '#8a8a8a', repair: '#5a8ac8' }[o.k]; if (label) { g.fillStyle = '#17110a'; g.fillRect(Math.round(A[0] + 5), Math.round(A[1] - 11), 5, 5); g.fillStyle = label; g.fillRect(Math.round(A[0] + 6), Math.round(A[1] - 10), 3, 3); }
  }
}
function drawWeather(g, t) {
  const fr = (V.weather && V.weather.fronts) || [];
  if (!fr.length) return;
  for (const k in V.hexes) {
    const w = E.weatherAt(fr, k); if (w === 'clear') continue;
    const [x0, y0] = hexXY(k), X = Math.round(x0), Y = Math.round(y0);
    if (w === 'fog') { g.fillStyle = 'rgba(235,235,230,0.33)'; fillHex(g, x0, y0); }
    else if (w === 'heat') { g.fillStyle = 'rgba(255,170,60,0.13)'; fillHex(g, x0, y0); }
    else if (w === 'rain') { g.fillStyle = 'rgba(40,60,90,0.16)'; fillHex(g, x0, y0); g.fillStyle = 'rgba(190,215,255,0.75)'; for (let i = 0; i < 5; i++) { const px = (X + ((i * 7 + Math.floor(t * 30)) % HW)), py = Y + ((i * 11 + Math.floor(t * 50)) % HH); if (MASK[py - Y] && MASK[py - Y][px - X]) { g.fillRect(px, py, 1, 2); } } }
    else if (w === 'snow') { g.fillStyle = 'rgba(255,255,255,0.18)'; fillHex(g, x0, y0); g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const px = X + ((i * 9 + Math.floor(t * 6)) % HW), py = Y + ((i * 13 + Math.floor(t * 12)) % HH); if (MASK[py - Y] && MASK[py - Y][px - X]) g.fillRect(px, py, 1, 1); } }
  }
  if (showForecast) {
    const f = (V.weather.forecast || [])[forecastIdx] || [];
    for (const fr2 of f) { const [cx, cy] = [OFF[0] + fr2.x / Math.sqrt(3) * HW, OFF[1] + fr2.y / 1.5 * DY]; const rr = fr2.r / Math.sqrt(3) * HW; g.fillStyle = { rain: '#9ac0ff', fog: '#ffffff', heat: '#ffaa40', snow: '#ffffff' }[fr2.kind]; for (let a = 0; a < 6.28; a += 0.08) g.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 1.15), 2, 2); }
  }
}
let showForecast = false, forecastIdx = 0;

/* ---------------- the replay of the last month ---------------- */
function startReplay() {
  const evs = V.events || []; if (!evs.length) return;
  const moves = evs.filter(e => e.k === 'move'), flashes = [];
  let t = moves.length ? 2.2 : 0.2;
  for (const e of evs) {
    if (e.k === 'bombard' && e.dmg) { flashes.push({ t, hex: e.hex, label: '−' + e.dmg, col: '#ffb060', boom: true }); t += 0.35; }
    if (e.k === 'battle') { flashes.push({ t, hex: e.hex, label: e.result === 'held' ? 'Repulsed!' : e.result === 'destroyed' ? 'Destroyed!' : 'Broken!', col: e.result === 'held' ? '#ffffff' : '#ff6a4a', boom: true }); t += 0.6; }
    if (e.k === 'capture' && e.hex) { flashes.push({ t, hex: e.hex, label: 'Taken', col: FLAGC(e.seat) }); t += 0.25; }
    if (e.k === 'merge' && e.hex) { flashes.push({ t, hex: e.hex, label: 'Merged', col: '#8fe08a' }); }
    if (e.k === 'detach' && e.hex) { flashes.push({ t: 0.2, hex: e.hex, label: 'Garrison', col: '#ffe9a0' }); }
    if (e.k === 'recruit' && e.hex) { flashes.push({ t, hex: e.hex, label: 'New ' + E.UNIT[e.type].name.toLowerCase(), col: '#ffe9a0' }); }
  }
  const moving = new Set(moves.map(e => e.u));
  anim = { t0: performance.now() / 1000, moves, flashes, moving, dur: t + 1.2, dead: evs.filter(e => e.k === 'destroyed') };
  setStatus('Replaying ' + E.dateOf(V, V.turn - 1).label + '…');
}
function drawReplay(g, now) {
  const t = Math.max(0, now - anim.t0);
  if (t > anim.dur) { anim = null; setStatus(''); return; }
  for (const id in V.units) if (!anim.moving.has(id)) drawUnit(g, V.units[id], null, now);
  for (const d of anim.dead) { const lastFlash = 2.2; if (t < lastFlash + 0.8 && !anim.moving.has(d.u)) { g.globalAlpha = clamp01(1 - (t - lastFlash) / 0.8); drawUnit(g, d, d.hex, now); g.globalAlpha = 1; } }
  for (const m of anim.moves) {
    if (!m.path || m.path.length < 2) continue;
    const k = Math.min(1, t / 2), seg = (m.path.length - 1) * k, i = Math.min(m.path.length - 2, Math.floor(seg)), f = seg - i;
    const [ax, ay] = hexXY(m.path[i]), [bx, by] = hexXY(m.path[Math.min(m.path.length - 1, i + 1)]);
    const u = V.units[m.u] || { seat: m.seat, type: m.type, at: m.path[m.path.length - 1] };
    const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
    blitUnit(g, u.type, u.seat, x + HW / 2, y + HH / 2 + 3, bx < ax, now);
  }
  for (const f of anim.flashes) if (t >= f.t && t < f.t + 0.6 && f.boom) { const [x0, y0] = hexXY(f.hex), cx = x0 + HW / 2, cy = y0 + HH / 2; const r = 3 + (t - f.t) * 14; g.fillStyle = 'rgba(255,220,120,' + (1 - (t - f.t) / 0.6) + ')'; g.fillRect(Math.round(cx - r / 2), Math.round(cy - 1), Math.round(r), 2); g.fillRect(Math.round(cx - 1), Math.round(cy - r / 2), 2, Math.round(r)); g.fillStyle = 'rgba(240,240,232,' + 0.7 * (1 - (t - f.t) / 0.6) + ')'; g.fillRect(Math.round(cx - r / 3), Math.round(cy - r / 3 - 3), Math.round(r / 1.5), Math.round(r / 2)); }
}
const clamp01 = v => Math.max(0, Math.min(1, v));

/* ---------------- input ---------------- */
const ptrs = new Map(); let drag = null, pinch = null;
function bindInput() {
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, t: performance.now() }; else { drag = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z }; } });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); setZoom(pinch.z * d / pinch.d, true); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 6) drag.moved = true; if (drag.moved) { view.x = drag.vx - dx / view.z; view.y = drag.vy - dy / view.z; clampView(); } }
    const r = canvas.getBoundingClientRect(); const [mx, my] = fromScreen(e.clientX - r.left, e.clientY - r.top); hover = pixToHex(mx, my); showHoverInfo();
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (drag && !drag.moved && ptrs.size === 0) { const r = canvas.getBoundingClientRect(); const [mx, my] = fromScreen(e.clientX - r.left, e.clientY - r.top); const k = pixToHex(mx, my); if (k) tapHex(k); } if (ptrs.size === 0) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(view.z * (e.deltaY < 0 ? 1.25 : 0.8), false); }, { passive: false });
  window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'Escape') { cancelMode(); select(null); } if (e.key === '+' || e.key === '=') setZoom(view.z * 1.25); if (e.key === '-') setZoom(view.z * 0.8); });
}
function setZoom(z, free) { view.z = Math.max(1, Math.min(6, free ? z : Math.round(z * 2) / 2)); clampView(); }
function clampView() { view.x = Math.max(0, Math.min(MAPW, view.x)); view.y = Math.max(0, Math.min(MAPH, view.y)); }
// size the drawing surface from the box it sits in (never from itself), so it can never push the layout wider
function resize() { const dpr = window.devicePixelRatio || 1, box = canvas.parentElement.getBoundingClientRect(); const w = Math.max(1, Math.min(8192, Math.round(box.width * dpr))), h = Math.max(1, Math.min(8192, Math.round(box.height * dpr))); if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h; }

/* ---------------- orders ---------------- */
function myUnit(k) { const u = occupancy()[k]; return u && u.seat === V.me ? u : null; }
function tapHex(k) {
  if (V.over || V.status === 'over') { select(null); return; }
  if (anim) { anim = null; setStatus(''); }
  if (mode) { finishMode(k); return; }
  const mine = myUnit(k), h = V.hexes[k];
  if (sel && reachCache && k !== sel.at && reachCache.best[k] !== undefined && !(mine && mine.id !== sel.id)) {
    const path = E.pathTo(reachCache, sel.at, k); if (path && path.length) { const prev = orders.units[sel.id]; orders.units[sel.id] = { k: 'move', path, ...(prev && prev.k === 'move' && prev.detach ? { detach: prev.detach } : {}) }; changed(); select(null); return; }
  }
  if (mine) { select(mine); return; }
  if (h.town && h.town.owner === V.me && !occupancy()[k]) { select(null); openRecruit(k); return; }
  select(null); describeHex(k);
}
function select(u) {
  sel = u; reachCache = null; closeRecruit();
  if (u) { reachCache = E.reach(V, u, occupancy(), V.weather.fronts); }
  renderUnitPanel();
}
function startMode(m) {
  if (!sel) return; mode = m; const u = sel; const range = m === 'bombard' || (m === 'support' && u.type === 'art') ? 2 : 1;
  const targets = Object.keys(V.hexes).filter(k => { const d = hdist(k, u.at); if (d < 1 || d > range) return false; if (m === 'bridge') return V.hexes[k].t === 'water' && !V.hexes[k].bridge; if (m === 'support') { const o = occupancy()[k]; return !!o && o.id !== u.id && o.seat !== E.NEUTRAL; }
    if (m === 'merge') { const o = occupancy()[k]; return !!o && o.seat === V.me && o.type === u.type && o.id !== u.id && o.str < 10; } return true; });
  modeData = { u, targets: new Set(targets) };
  setStatus(m === 'support' ? 'Tap the unit to back. Yours: you add to its attack wherever it attacks, or to its defence if it is attacked. Another army\'s: the same, for them. Stay next to it (guns: within 2).' : m === 'bombard' ? 'Tap the hex to shell.' : m === 'merge' ? 'Tap the unit to join. This unit stays put and its men go to that one, up to 10. It must still be next to it at the end of the month.' : 'Tap the river hex to bridge.');
}
function cancelMode() { mode = null; modeData = null; setStatus(''); }
function finishMode(k) {
  const m = mode, u = modeData.u; if (!modeData.targets.has(k)) { cancelMode(); return; }
  cancelMode();
  if (m === 'support') { orders.units[u.id] = { k: 'support', unit: occupancy()[k].id }; changed(); select(null); return; }
  if (m === 'merge') { orders.units[u.id] = { k: 'merge', into: occupancy()[k].id }; changed(); select(null); return; }
  orders.units[u.id] = { k: m, hex: k }; changed(); select(null);
}
function chooseSupportFor(u, k) {
  const box = el('div', { class: 'modal' }, el('h3', {}, 'Support whom?'), el('p', {}, 'Your unit will help any attack into, or defence of, this hex by the army you choose. Promises made on WhatsApp are not binding — choose carefully.'));
  const row = el('div', { class: 'row wrap' });
  for (const s of V.seats) if (s.alive) row.append(el('button', { class: 'army', style: `--c:${E.COLORS[s.seat].ui}`, onclick: () => { orders.units[u.id] = { k: 'support', hex: k, for: s.seat }; changed(); closeModal(); select(null); } }, s.seat === V.me ? 'My own army' : (s.name || E.COLORS[s.seat].name)));
  box.append(row, el('button', { class: 'ghost', onclick: closeModal }, 'Cancel'));
  showModal(box);
}
function setOrder(k) { if (!sel) return; if (k === 'clear') delete orders.units[sel.id]; else orders.units[sel.id] = { k }; changed(); select(null); }
function changed() { dirty = true; saveDraft(); renderSide(); }
let dirty = false;
// unsent orders are kept in the browser, one draft per war (the map seed tells two solo wars apart)
const draftKey = () => 'tlc-draft-' + (V.id || 'local') + '-' + V.seed + '-' + V.me + '-' + V.turn;
function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(orders)); } catch (e) { } }
function loadDraft() { try { const d = localStorage.getItem(draftKey()); if (d) return JSON.parse(d); } catch (e) { } return null; }
// keep only orders that make sense on this map, for these units, this month
function sanitize(o) {
  try { const c = E.cleanOrders(V, V.me, o); return { units: c.units, recruit: c.recruit, diplo: o && o.diplo ? c.diplo : null }; }
  catch (e) { console.warn('dropping unreadable orders', e); return { units: {}, recruit: [], diplo: null }; }
}

/* ---------------- panels ---------------- */
function setStatus(t) { $('#status').textContent = t || ''; $('#status').style.display = t ? 'block' : 'none'; }
function renderUnitPanel() {
  const p = $('#unitpanel'); p.innerHTML = '';
  if (!sel) { p.style.display = 'none'; return; }
  p.style.display = 'block';
  const u = sel, T = E.UNIT[u.type], h = V.hexes[u.at], o = orders.units[u.id];
  const terr = h.town ? E.KIND[h.town.kind].name : h.t === 'water' ? (h.bridge ? 'Bridge' : 'Ford') : E.TER[h.t].name;
  const w = E.weatherAt(V.weather.fronts, u.at);
  p.append(el('div', { class: 'uhead' }, el('b', {}, T.name), ` · strength ${u.str}/10 · ${terr}${h.ent ? ` · dug in ${h.ent}` : ''} · ${E.WEATHER[w].name}`),
    el('div', { class: 'small' }, `Moves ${T.mp} · attack ${T.atk} · defence ${T.def}${T.bombard ? ` · shells ${T.bombard} at 2 hexes` : ''}${u.str < 4 ? ' · shaken' : ''}`),
    el('div', { class: 'small hint' }, 'Tap a lit hex to march there; a red hex is an attack.'));
  const row = el('div', { class: 'row wrap' });
  const b = (label, fn, on) => row.append(el('button', { class: on ? 'on' : '', onclick: fn }, label));
  b('Hold', () => setOrder('hold'), o && o.k === 'hold');
  b('Support…', () => startMode('support'), o && o.k === 'support');
  if (u.type === 'art') b('Bombard…', () => startMode('bombard'), o && o.k === 'bombard');
  if (u.type === 'cav') b('Raid', () => setOrder('raid'), o && o.k === 'raid');
  if (u.type === 'eng') { b('Dig in', () => setOrder('dig'), o && o.k === 'dig'); if (h.town && h.town.owner === V.me) b('Fortify (2 supply)', () => setOrder('fortify'), o && o.k === 'fortify'); b('Bridge… (3)', () => startMode('bridge'), o && o.k === 'bridge'); if (h.railBroken || nbrs(u.at).some(x => V.hexes[x] && V.hexes[x].railBroken)) b('Repair rail', () => setOrder('repair'), o && o.k === 'repair'); }
  const partner = u.type !== 'gen' && u.str < 10 && nbrs(u.at).some(x => { const v = occupancy()[x]; return v && v.seat === V.me && v.type === u.type && v.str < 10; });
  if (partner) b('Merge…', () => startMode('merge'), o && o.k === 'merge');
  if (o) b('Clear order', () => setOrder('clear'));
  b('Close', () => select(null));
  p.append(row);
  // leaving a detachment behind on the march
  if (o && o.k === 'move' && u.type !== 'gen' && u.str >= 2) {
    const room = armySize() < capOf() || o.detach;
    const drow = el('div', { class: 'row wrap', style: 'margin-top:6px' }, el('span', { class: 'small' }, 'Leave behind:'));
    for (let n = 0; n <= Math.min(5, u.str - 1); n++) drow.append(el('button', { class: (o.detach || 0) === n ? 'on' : '', disabled: n && !room ? 'disabled' : null, onclick: () => { if (n) o.detach = n; else delete o.detach; changed(); renderUnitPanel(); } }, n ? String(n) : 'None'));
    p.append(drow, el('div', { class: 'small hint' }, room ? 'Those men stay in this hex as a new unit and hold it; the rest march on.' : 'Your army is at its limit, so there is no room for a detachment.'));
  } else if (u.type !== 'gen' && u.str >= 2 && h.town && h.town.owner === V.me && (!o || o.k !== 'move')) p.append(el('div', { class: 'small hint' }, 'To leave a garrison here, give this unit a march, then tap it again to choose how many stay behind.'));
}
function openRecruit(k) {
  const p = $('#recruit'), h = V.hexes[k], me = V.seats[V.me]; p.innerHTML = ''; p.style.display = 'block';
  const queued = orders.recruit.find(r => r.hex === k);
  const spent = orders.recruit.reduce((t, r) => ({ men: t.men + E.UNIT[r.type].men, sup: t.sup + E.UNIT[r.type].sup }), { men: 0, sup: 0 });
  const units = armySize();
  const cap = capOf(); const hasGen = Object.values(V.units).some(u => u.seat === V.me && u.type === 'gen') || orders.recruit.some(r => r.type === 'gen');
  p.append(el('div', { class: 'uhead' }, el('b', {}, h.town.name), ` · ${E.KIND[h.town.kind].name} · raise a new unit`), el('div', { class: 'small' }, `You have ${me.men - spent.men} recruits and ${me.sup - spent.sup} supply after other orders · army ${units}/${cap}`));
  const row = el('div', { class: 'row wrap' });
  for (const t of ['inf', 'cav', 'art', 'eng', 'gen']) {
    const T = E.UNIT[t], townOnly = h.town.kind === 'town' && (t === 'art' || t === 'eng' || t === 'gen'), genBad = t === 'gen' && (hasGen || h.town.kind !== 'hq');
    const afford = me.men - spent.men + (queued ? E.UNIT[queued.type].men : 0) >= T.men && me.sup - spent.sup + (queued ? E.UNIT[queued.type].sup : 0) >= T.sup;
    const ok = !townOnly && !genBad && afford && (t === 'gen' || units - (queued && queued.type !== 'gen' ? 1 : 0) < cap);
    row.append(el('button', { class: queued && queued.type === t ? 'on' : '', disabled: ok ? null : 'disabled', onclick: () => { orders.recruit = orders.recruit.filter(r => r.hex !== k); orders.recruit.push({ hex: k, type: t }); changed(); closeRecruit(); } }, `${T.name} (${T.men} men, ${T.sup} supply)`));
  }
  if (queued) row.append(el('button', { onclick: () => { orders.recruit = orders.recruit.filter(r => r.hex !== k); changed(); closeRecruit(); } }, 'Cancel recruit'));
  row.append(el('button', { onclick: closeRecruit }, 'Close'));
  if (h.town.kind === 'town') p.append(el('div', { class: 'small hint' }, 'Small towns raise infantry and cavalry. Guns and engineers come from headquarters and the Capital.'));
  p.append(row);
}
function closeRecruit() { const p = $('#recruit'); if (p) { p.style.display = 'none'; p.innerHTML = ''; } }
/* ---------------- will the army eat? (a forecast of this month's supply, from the orders as written) ---------------- */
let hungerSet = new Set();
function supplyCheck() {
  const me = V.seats[V.me]; if (!me || me.sup === undefined || V.over) return null;
  const inc = E.incomeOf(V, V.me), occ = occupancy(), fronts = V.weather.fronts;
  let works = 0, upChange = 0; const hungry = [];
  const gifts = ((orders.diplo && orders.diplo.gift) || []).reduce((t, g) => t + (g.sup || 0), 0);
  const recruits = orders.recruit.reduce((t, r) => t + E.UNIT[r.type].sup, 0);
  for (const u of Object.values(V.units)) {
    if (u.seat !== V.me) continue; const o = orders.units[u.id];
    if (o && o.k === 'fortify') { const h = V.hexes[u.at]; if (h.town && h.town.owner === V.me && h.town.fort < 3) works += 2; }
    if (o && o.k === 'bridge') works += 3;
    if (o && o.k === 'merge') { upChange -= E.UNIT[u.type].up; continue; }
    let end = u.at;
    if (o && o.k === 'move') { const p = o.path; end = p[p.length - 1]; if (occ[end] && occ[end].seat !== V.me) end = p.length > 1 ? p[p.length - 2] : u.at; }
    const snow = E.weatherAt(fronts, end) === 'snow';
    if (!E.inSupplyAt(V, V.me, end)) hungry.push({ u, end, loss: snow ? 2 : 1 });
    if (o && o.k === 'move' && o.detach) { upChange += E.UNIT[u.type].up; if (!E.inSupplyAt(V, V.me, u.at)) hungry.push({ u, end: u.at, loss: E.weatherAt(fronts, u.at) === 'snow' ? 2 : 1, detachment: true }); }
  }
  const up = inc.up + upChange;
  const afterUpkeep = me.sup - gifts - works + inc.sup - up;
  return { inc, up, gifts, works, recruits, afterUpkeep, afterRecruits: afterUpkeep - recruits, hungry };
}
function supplyBox(full) {
  const c = supplyCheck(); hungerSet = new Set(c ? c.hungry.filter(h => !h.detachment).map(h => h.u.id) : []);
  if (!c) return null;
  const starving = c.afterUpkeep < 0, short = !starving && c.afterRecruits < 0;
  if (!full && !starving && !short && !c.hungry.length) return null;
  const box = el('div', { class: 'warnbox' + (starving || c.hungry.length ? ' bad' : '') });
  box.append(el('div', {}, el('b', {}, 'Supply this month: '), `+${c.inc.sup} income − ${c.up} upkeep${c.works ? ` − ${c.works} works` : ''}${c.gifts ? ` − ${c.gifts} gifts` : ''} → ${c.afterUpkeep} in hand${c.recruits ? `, ${c.afterRecruits} after recruits` : ''}.`));
  if (starving) box.append(el('div', {}, '⚠ Not enough to feed the army: every unit will lose 1 strength. Order fewer works or gifts, merge units, or take a town.'));
  else if (short) box.append(el('div', {}, '⚠ Not enough left for every recruit you have ordered: some will not be raised.'));
  for (const h of c.hungry) box.append(el('div', { class: 'oline', onclick: () => { select(h.u); centerOn(h.u.at); } }, `⚠ ${h.detachment ? 'The detachment left by ' : ''}${E.UNIT[h.u.type].name} (${h.u.str}) ${h.end === h.u.at ? (V.hexes[h.end].town ? 'at ' : '') : 'marching to '}${hexLabel(h.end)} will be out of supply: −${h.loss}${h.loss > 1 ? ' in the snow' : ''}.`));
  if (c.hungry.length) box.append(el('div', { class: 'small' }, 'In supply means within 4 hexes of a town you hold, or on unbroken railway back to one. Units marked ! on the map.'));
  if (full) box.append(el('div', { class: 'small' }, 'Worked out from your orders and the towns you hold now; a town taken or lost this month changes it.'));
  return box;
}
function armySize() { return Object.values(V.units).filter(u => u.seat === V.me && u.type !== 'gen').length + orders.recruit.filter(r => r.type !== 'gen').length + Object.entries(orders.units).filter(([id, o]) => V.units[id] && o.k === 'move' && o.detach).length; }
function capOf() { let c = 4; for (const k in V.hexes) { const t = V.hexes[k].town; if (t && t.owner === V.me) c += E.KIND[t.kind].cap; } return c; }
function describeHex(k) {
  const h = V.hexes[k], w = E.weatherAt(V.weather.fronts, k), u = occupancy()[k];
  const bits = [h.town ? `${h.town.name} (${E.KIND[h.town.kind].name}, ${h.town.owner === E.NEUTRAL ? 'held by militia' : 'held by ' + seatName(h.town.owner)}${h.town.fort ? ', fort ' + h.town.fort : ''})` : h.t === 'water' ? (h.bridge ? 'Bridge' : h.ford ? 'Ford (impassable in rain)' : 'River') : E.TER[h.t].name];
  if (h.farm) bits.push(h.farm.burned > 0 ? 'burned farm' : 'farm'); if (h.rail) bits.push(h.railBroken ? 'broken railway' : 'railway'); if (h.road) bits.push('road'); if (h.ent) bits.push('earthworks ' + h.ent);
  bits.push(E.WEATHER[w].name.toLowerCase());
  if (u) bits.push(`${seatName(u.seat)} ${E.UNIT[u.type].name.toLowerCase()} (${u.str})`);
  setStatus(bits.join(' · ')); clearTimeout(toastT); toastT = setTimeout(() => setStatus(''), 4000);
}
function showHoverInfo() { }
function seatName(s) { if (s === E.NEUTRAL) return 'Militia'; const x = V.seats[s]; return x.name || E.COLORS[s].name; }

function renderTop() {
  const me = V.seats[V.me], d = E.dateOf(V, V.turn), era = E.eraOf(V, V.me);
  const spent = orders.recruit.reduce((t, r) => ({ men: t.men + E.UNIT[r.type].men, sup: t.sup + E.UNIT[r.type].sup }), { men: 0, sup: 0 });
  const myUnits = Object.values(V.units).filter(u => u.seat === V.me && u.type !== 'gen').length;
  const w = E.weatherAt(V.weather.fronts, me.hq);
  $('#top').innerHTML = '';
  $('#top').append(
    el('div', { class: 'title' }, el('b', {}, V.name), el('span', { class: 'date' }, `${d.label} · turn ${V.turn}/${V.turnLimit} · ${E.ERAS[era].year === d.year ? '' : ''}${E.ERAS[Math.min(3, Math.floor((V.turn - 1) / V.eraTurns))].name}`)),
    el('div', { class: 'res' }, el('span', { title: 'Recruits' }, `👥 ${me.men - spent.men}`), el('span', { title: 'Supply' }, `📦 ${me.sup - spent.sup}`), el('span', { title: 'Army size / limit' }, `⚔ ${myUnits}/${capOf()}`), el('span', { title: 'Victory points' }, `★ ${me.score}`)),
    el('div', { class: 'wx' }, wxChip('Now', w), ...(V.weather.forecast || []).map((f, i) => wxChip(E.dateOf(V, V.turn + 1 + i).label.split(' ')[0].slice(0, 3), dominantAround(f, me.hq), i))),
    el('div', { class: 'clock', id: 'clock' }, ''),
    el('div', { class: 'players' }, ...V.seats.map(s => el('span', { class: 'pdot' + (s.alive ? '' : ' out'), style: `--c:${E.COLORS[s.seat].ui}`, title: `${s.name || E.COLORS[s.seat].name}${s.bot ? ' (computer)' : ''} · ${s.towns} towns · ${s.score} VP${(V.submittedSeats || [])[s.seat] ? ' · orders in' : ''}` }, (V.submittedSeats || [])[s.seat] || s.bot ? '✓' : '·')))
  );
  tickClock();
}
function dominantAround(fronts, k) { const counts = {}; for (const x of Object.keys(V.hexes).filter(x => hdist(x, k) <= 4)) { const w = E.weatherAt(fronts, x); counts[w] = (counts[w] || 0) + 1; } return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; }
function wxChip(label, w, fi) { const icon = { clear: '☀', rain: '🌧', fog: '🌫', heat: '🔥', snow: '❄' }[w]; return el('button', { class: 'wxchip' + (fi !== undefined && showForecast && forecastIdx === fi ? ' on' : ''), title: `${label}: ${E.WEATHER[w].name}. ${E.WEATHER[w].desc}${fi !== undefined ? (fi === 0 ? ' (forecast, usually right)' : ' (forecast, often wrong)') : ''}`, onclick: () => { if (fi === undefined) { showForecast = false; } else { if (showForecast && forecastIdx === fi) showForecast = false; else { showForecast = true; forecastIdx = fi; } } renderTop(); } }, el('small', {}, label), ' ', icon); }
function tickClock() {
  const c = $('#clock'); if (!c) return;
  if (V.status === 'over' || V.over) { c.textContent = 'The war is over'; return; }
  if (!V.deadline) { c.textContent = 'Solo campaign'; return; }
  const ms = V.deadline - Date.now(); if (ms <= 0) { c.textContent = 'Turn resolving…'; return; }
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60; c.textContent = `Orders due in ${h ? h + 'h ' : ''}${m}m`;
}
let tab = 'orders';
function renderSide() {
  renderTop();
  const s = $('#side'); s.innerHTML = '';
  const tabs = el('div', { class: 'tabs' }, ...[['orders', 'Orders'], ['armies', 'Armies'], ['aims', 'War aims'], ['news', 'Dispatches'], ['help', 'Rules']].map(([k, t]) => el('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; renderSide(); } }, t)));
  s.append(tabs);
  const body = el('div', { class: 'tabbody' }); s.append(body);
  const me = V.seats[V.me];
  if (V.over) body.append(renderOver());
  if (tab === 'orders') {
    const mine = Object.values(V.units).filter(u => u.seat === V.me);
    const n = Object.keys(orders.units).filter(id => V.units[id]).length;
    body.append(el('p', { class: 'small' }, `${n} of ${mine.length} units have orders; the rest hold their ground (infantry holding in the open dig a shallow trench). ${orders.recruit.length ? orders.recruit.length + ' new unit' + (orders.recruit.length > 1 ? 's' : '') + ' ordered.' : 'Tap one of your towns to raise troops.'}`));
    const sb = supplyBox(true); if (sb) body.append(sb);
    const list = el('div', { class: 'olist' });
    for (const u of mine.sort((a, b) => a.type.localeCompare(b.type))) { const o = orders.units[u.id]; list.append(el('div', { class: 'oline', onclick: () => { select(u); centerOn(u.at); } }, el('span', { class: 'sw', style: `--c:${E.COLORS[V.me].ui}` }), `${E.UNIT[u.type].name} (${u.str}) ${V.hexes[u.at].town ? 'at ' : ''}${hexLabel(u.at)}: `, el('i', {}, describeOrder(o, u)), hungerSet.has(u.id) ? el('b', { class: 'hungry' }, ' · out of supply') : '')); }
    body.append(list);
    if (!V.over) body.append(el('div', { class: 'submit' },
      el('button', { class: 'primary', onclick: submit }, V.deadline ? (V.myOrders && !dirty ? 'Orders sent ✓ — send again' : 'Send my orders') : 'Fight the month'),
      el('div', { class: 'small' }, V.deadline ? 'You can change your orders until the turn resolves. It resolves at the deadline, or as soon as every general has sent orders.' : 'The computer generals move at the same time as you.')));
  }
  if (tab === 'armies') {
    body.append(el('p', { class: 'small' }, 'Deals are made on WhatsApp. Here you decide what you actually do. Changes take effect when the turn resolves.'));
    const d = orders.diplo || (orders.diplo = { sight: V.rel.sight[V.me].slice(), passage: V.rel.passage[V.me].slice(), gift: [] });
    for (const o of V.seats) {
      if (o.seat === V.me) continue;
      const theyShare = V.rel.sight[o.seat][V.me], theyPass = V.rel.passage[o.seat][V.me];
      const box = el('div', { class: 'army-card', style: `--c:${E.COLORS[o.seat].ui}` },
        el('div', { class: 'ah' }, el('b', {}, o.name || E.COLORS[o.seat].name), o.bot ? ' (computer)' : '', o.alive ? ` · ${o.towns} towns · ${o.score} VP` : ' · out of the war'),
        el('div', { class: 'small' }, `They ${theyShare ? 'share' : 'do not share'} their scouts' reports with you and ${theyPass ? 'grant' : 'do not grant'} you free passage.`));
      if (o.alive) {
        box.append(el('label', { class: 'chk' }, el('input', { type: 'checkbox', ...(d.sight[o.seat] ? { checked: 'checked' } : {}), onchange: e => { d.sight[o.seat] = e.target.checked; changed(); } }), ' Share what my scouts see'),
          el('label', { class: 'chk' }, el('input', { type: 'checkbox', ...(d.passage[o.seat] ? { checked: 'checked' } : {}), onchange: e => { d.passage[o.seat] = e.target.checked; changed(); } }), ' Grant free passage (their troops ignore mine when marching)'));
        const g = d.gift.find(x => x.to === o.seat) || { to: o.seat, men: 0, sup: 0 };
        const inp = (f, max) => el('input', { type: 'number', min: 0, max, value: g[f] || 0, oninput: e => { g[f] = Math.max(0, Math.min(max, e.target.value | 0)); d.gift = d.gift.filter(x => x.to !== o.seat); if (g.men || g.sup) d.gift.push(g); changed(); } });
        box.append(el('div', { class: 'gift' }, 'Send ', inp('men', me.men), ' recruits and ', inp('sup', me.sup), ' supply'));
      }
      body.append(box);
    }
  }
  if (tab === 'aims') {
    const modeText = { points: 'Victory points: towns 1, headquarters 2, the Capital 4. Holding more than half of all towns ends the war at once.', capital: 'Take the Capital: whoever holds it for four months in a row wins. Otherwise victory points decide.', conquest: 'Last army standing. Otherwise victory points decide.' }[V.mode];
    body.append(el('h4', {}, 'How the war is won'), el('p', { class: 'small' }, `${modeText} The war ends after turn ${V.turnLimit} (${E.dateOf(V, V.turnLimit).label}).`));
    if (me.goal) body.append(el('h4', {}, 'Your secret orders'), el('div', { class: 'secret' }, me.goal.text, el('div', { class: 'small' }, `Worth ${me.goal.vp} victory points at the end. Nobody else knows this.`)));
    body.append(el('h4', {}, 'Standings'), el('div', { class: 'olist' }, ...V.seats.slice().sort((a, b) => b.score - a.score).map(s => el('div', { class: 'oline' }, el('span', { class: 'sw', style: `--c:${E.COLORS[s.seat].ui}` }), `${s.name || E.COLORS[s.seat].name}: ${s.score} VP, ${s.towns} towns${s.alive ? '' : ' (out)'}`))));
    if (V.capitalHold && V.capitalHold.seat !== null) body.append(el('p', { class: 'small' }, `${seatName(V.capitalHold.seat)} has held the Capital for ${V.capitalHold.count} month${V.capitalHold.count === 1 ? '' : 's'}.`));
    const nextEra = Math.min(3, Math.floor((V.turn - 1) / V.eraTurns) + 1); if (nextEra > Math.floor((V.turn - 1) / V.eraTurns)) body.append(el('p', { class: 'small' }, `Coming in ${E.ERAS[nextEra].year} (turn ${nextEra * V.eraTurns + 1}): ${E.ERAS[nextEra].name}. ${E.ERAS[nextEra].text} Whoever holds the Capital's foundry gets each improvement early.`));
  }
  if (tab === 'news') {
    const sb = supplyBox(false); if (sb) body.append(el('h4', {}, 'Before you send orders'), sb);
    body.append(el('button', { onclick: startReplay, disabled: (V.events || []).length ? null : 'disabled' }, '▶ Replay last month'));
    const byTurn = {}; for (const l of V.log || []) (byTurn[l.turn] = byTurn[l.turn] || []).push(l.text);
    for (const t of Object.keys(byTurn).sort((a, b) => b - a).slice(0, 8)) body.append(el('h4', {}, +t === 0 ? 'The outbreak' : E.dateOf(V, +t).label), el('ul', { class: 'news' }, ...byTurn[t].map(x => el('li', {}, x))));
  }
  if (tab === 'help') body.append(el('div', { class: 'small rules', html: RULES }));
}
const RULES = `
<p><b>Every month</b> all generals give orders in secret. When the turn resolves, everything happens at once: marches, then shelling, then battles.</p>
<p><b>Marching.</b> Tap a unit, then a lit hex. Roads and railways are fast, woods and hills slow, rivers only cross at bridges and fords. Coming next to an enemy stops a march.</p>
<p><b>Attacking.</b> March into a red hex. Attack and defence add up: <i>woods ×1.3, hills ×1.35, towns ×1.4, headquarters and the Capital ×1.6</i>, plus forts and earthworks. A big enough win drives the defenders back; a surrounded unit is badly hurt.</p>
<p><b>Support.</b> Tap Support…, then tap a unit next to yours (guns: within 2) — your own or another army's. You add to that unit's attack wherever it attacks, or to its defence if it is attacked, as long as you are still next to it when it fights. Being attacked yourself cancels your support. This is how alliances fight together — and how they break: back the defender instead of the ally who asked.</p>
<p><b>Recruits and supply.</b> Towns give recruits and supply; farms and railways add supply. Every unit eats supply each month. Units more than four hexes from your towns, and off your railways, are out of supply and lose men — twice as fast in snow. Units in supply that did not fight regain strength each month (1 supply in a town, 2 in the field). Your army can be no larger than your towns allow: 4, plus 1 per town, 4 for headquarters and 3 for the Capital.</p>
<p><b>Weather</b> drifts across the map in fronts. Rain makes mud, floods fords and keeps guns to the roads. Fog blinds scouts and artillery. Heat wears out long marches. The forecast for next month is usually right; the one after is often wrong.</p>
<p><b>Diplomacy.</b> Share your scouts' reports, grant free passage, or send recruits and supply to another army. Any of it can be withdrawn next month.</p>
<p><b>Cavalry</b> raid railways and farms. <b>Engineers</b> dig earthworks, fortify towns, bridge rivers and mend railways. A <b>general</b> makes the units around him fight 15% better.</p>
<p><b>Merging and garrisons.</b> Two weak units of the same kind standing side by side can merge: tap one, press Merge…, then tap the other (up to strength 10). To leave a garrison, give a unit a march, tap it again and choose how many men stay behind.</p>
<p><b>Hunger.</b> The Orders tab warns before you send orders if your supply will not cover upkeep, or if a unit will end the month out of supply (marked ! on the map).</p>`;
function supportPlan(u, o) {
  const t = V.units[o.unit]; if (!t) return { text: 'back a unit you can no longer see' };
  const range = u.type === 'art' ? 2 : 1, name = `${t.seat === V.me ? 'my' : seatName(t.seat) + '\'s'} ${E.UNIT[t.type].name.toLowerCase()}`;
  const to = orders.units[t.id];
  if (t.seat === V.me && to && to.k === 'move') {
    const p = to.path, goal = p[p.length - 1], occ = occupancy(), attack = occ[goal] && occ[goal].seat !== V.me;
    const fightsFrom = attack ? (p.length > 1 ? p[p.length - 2] : t.at) : goal;
    if (!attack) return { text: `back ${name}, but it is marching, not attacking`, warn: 'only helps if it is attacked where it ends up' + (hdist(u.at, fightsFrom) > range ? ', and it will be too far away' : '') };
    return { text: `add to ${name}'s attack on ${hexLabel(goal)}`, warn: hdist(u.at, fightsFrom) > range ? `too far: it attacks from ${hexLabel(fightsFrom)}, more than ${range} hex${range > 1 ? 'es' : ''} from here` : null };
  }
  if (t.seat === V.me) return { text: `back ${name} ${V.hexes[t.at].town ? 'at ' : ''}${hexLabel(t.at)}`, warn: 'it has no attack ordered, so this only helps if it is attacked' };
  return { text: `back ${name} ${V.hexes[t.at].town ? 'at ' : ''}${hexLabel(t.at)} in any attack it makes, or its defence` };
}
function describeOrder(o, u) { if (!o) return 'hold'; if (o.k === 'support' && o.unit && u) { const s = supportPlan(u, o); return s.text + (s.warn ? ` — ⚠ ${s.warn}` : ''); } if (o.k === 'merge') { const t = V.units[o.into]; return t ? `merge into the ${E.UNIT[t.type].name.toLowerCase()} ${V.hexes[t.at].town ? 'at ' : ''}${hexLabel(t.at)} (${t.str})` : 'merge'; } if (o.k === 'move' && o.detach) return describeOrder({ k: 'move', path: o.path }) + `, leaving ${o.detach} behind`; if (o.k === 'move') { const last = o.path[o.path.length - 1], occ = occupancy()[last], where = hexLabel(last), town = !!V.hexes[last].town; return occ && occ.seat !== V.me ? `attack ${town ? '' : 'the enemy '}${where}` : town ? `march to ${where}` : `march ${where}`; } if (o.k === 'support') return `support ${o.for === V.me ? 'my army' : seatName(o.for)} ${V.hexes[o.hex].town ? 'at ' : ''}${hexLabel(o.hex)}`; if (o.k === 'bombard') return `shell the enemy ${V.hexes[o.hex].town ? 'at ' : ''}${hexLabel(o.hex)}`; if (o.k === 'bridge') return 'build a bridge'; return { hold: 'hold', raid: 'raid', dig: 'dig earthworks', fortify: 'fortify the town', repair: 'repair the railway' }[o.k] || o.k; }
function hexLabel(k) { const h = V.hexes[k]; if (h.town) return h.town.name; let best = null, bd = 99; for (const x in V.hexes) if (V.hexes[x].town) { const d = hdist(x, k); if (d < bd) { bd = d; best = x; } } return `near ${V.hexes[best].town.name}`; }
function centerOn(k) { const [x, y] = hexXY(k); view.x = x + HW / 2; view.y = y + HH / 2; }
function renderOver() {
  const o = V.over, w = V.seats[o.winner];
  return el('div', { class: 'over' }, el('h3', {}, o.winner === V.me ? 'Victory!' : `${w.name || E.COLORS[o.winner].name} wins the war`), el('p', {}, o.why), el('h4', {}, 'Final reckoning and secret orders'),
    el('div', { class: 'olist' }, ...o.scores.slice().sort((a, b) => b.vp - a.vp).map(s => { const g = o.goals.find(x => x.seat === s.seat); return el('div', { class: 'oline' }, el('span', { class: 'sw', style: `--c:${E.COLORS[s.seat].ui}` }), `${V.seats[s.seat].name || E.COLORS[s.seat].name}: ${s.vp} VP. Secret orders: “${g.goal.text}” ${g.met ? '— achieved' : '— failed'}`); })));
}
function showModal(box) { closeModal(); const m = el('div', { class: 'modalwrap', id: 'modal', onclick: e => { if (e.target.id === 'modal') closeModal(); } }, box); document.body.append(m); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); }

/* ---------------- talking to the server (or the local war) ---------------- */
async function submit() {
  try {
    setStatus('Sending orders…');
    const prevTurn = V.turn;
    const nv = await api.submit(orders, V.turn);
    dirty = false;
    applyView(nv);
    if (nv.turn !== prevTurn) { orders = { units: {}, recruit: [], diplo: null }; startReplay(); } else setStatus('Orders received. You can change them until the turn resolves.');
    setTimeout(() => { if (!anim) setStatus(''); }, 3500);
  } catch (e) { setStatus(e.message); }
}
function applyView(nv) {
  const newTurn = !V || V.turn !== nv.turn;
  V = nv;
  if (newTurn || !baseCanvas) { buildBase(); if (!applyView.centered) { centerOn(V.seats[V.me].hq); applyView.centered = true; } }
  if (newTurn) { const draft = loadDraft(); orders = draft || V.myOrders ? sanitize(draft || JSON.parse(JSON.stringify(V.myOrders))) : { units: {}, recruit: [], diplo: null }; }
  // drop orders for units that no longer exist
  for (const id in orders.units) if (!V.units[id]) delete orders.units[id];
  sel = null; reachCache = null;
  renderSide(); renderUnitPanel();
}
async function poll() {
  if (!api.status) return;
  try { const s = await api.status(); if (s.turn !== V.turn) { const nv = await api.load(); applyView(nv); startReplay(); } else if (JSON.stringify(s.submitted) !== JSON.stringify(V.submittedSeats)) { V.submittedSeats = s.submitted; renderTop(); } } catch (e) { }
}
async function boot(backend) {
  api = backend;
  canvas = $('#map'); ctx = canvas.getContext('2d');
  resize(); window.addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement); bindInput();
  let v;
  try { v = await api.load(); } catch (e) { document.body.innerHTML = `<div class="fatal"><h2>That campaign could not be found</h2><p>${esc(e.message)}</p></div>`; return; }
  if (!v.seats[v.me].joined) { await joinDialog(v); v = await api.load(); }
  applyView(v);
  view.z = Math.max(2, Math.min(4, Math.floor(Math.min(canvas.clientWidth / MAPW, canvas.clientHeight / MAPH) * 2) / 2 * 1.6));
  const seen = (() => { try { return +localStorage.getItem('tlc-seen-' + (v.id || 'local') + '-' + v.me) || 0; } catch (e) { return 0; } })();
  if (seen && seen < v.turn) startReplay();
  try { localStorage.setItem('tlc-seen-' + (v.id || 'local') + '-' + v.me, v.turn); } catch (e) { }
  requestAnimationFrame(draw);
  setInterval(tickClock, 15000);
  if (api.status) setInterval(poll, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}
function joinDialog(v) {
  return new Promise(res => {
    const name = el('input', { placeholder: 'Your army\'s name, e.g. Army of the Shenandoah', maxlength: 32 }), email = el('input', { placeholder: 'Email for turn reports (optional)', type: 'email', maxlength: 120 });
    const box = el('div', { class: 'modal' }, el('h3', {}, `You command the ${E.COLORS[v.me].name} army`), el('p', {}, `${v.name}: ${v.n} armies, ${v.turnLimit} months of war.`), name, email,
      el('button', { class: 'primary', onclick: async () => { await api.join(name.value, email.value); closeModal(); res(); } }, 'Take command'));
    showModal(box);
  });
}
window.TLC = { boot, Engine: E };
window.TLC_zoom = f => setZoom(view.z * f);
window.TLC_debug = { screenOf: k => { const [x, y] = hexXY(k); const r = canvas.getBoundingClientRect(); const [sx, sy] = toScreen(x + HW / 2, y + HH / 2); return [sx + r.left, sy + r.top]; }, centerOn: k => centerOn(k), get V() { return V; }, get orders() { return orders; } };
})();
