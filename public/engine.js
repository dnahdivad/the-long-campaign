/* ============================================================================
   THE LONG CAMPAIGN — rules engine (shared by the server and the browser)
   Designed and built by Claude (Anthropic) with Dave.
   ============================================================================ */
(function (root) {
'use strict';
const E = {};

/* ---------------- utilities ---------------- */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const K = (q, r) => q + ',' + r;
const P = k => { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const hdist = (a, b) => { const [aq, ar] = typeof a === 'string' ? P(a) : a, [bq, br] = typeof b === 'string' ? P(b) : b; return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(aq + ar - bq - br)) / 2; };
const nbrs = k => { const [q, r] = P(k); return DIRS.map(([dq, dr]) => K(q + dq, r + dr)); };
const toXY = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];
function fromXY(x, y) {
  let q = (Math.sqrt(3) / 3 * x - y / 3) / 1, r = (2 / 3 * y);
  let s = -q - r, rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
E.util = { rng, clamp, K, P, DIRS, hdist, nbrs, toXY, fromXY };

/* ---------------- the rules in numbers ---------------- */
const UNIT = {
  inf: { name: 'Infantry', men: 3, sup: 3, mp: 3, atk: 4, def: 5, sight: 2, up: 1 },
  cav: { name: 'Cavalry', men: 3, sup: 5, mp: 5, atk: 4, def: 3, sight: 3, up: 2 },
  art: { name: 'Artillery', men: 2, sup: 6, mp: 2, atk: 1.5, def: 2, sight: 2, up: 2, bombard: 5, range: 2 },
  eng: { name: 'Engineers', men: 2, sup: 4, mp: 3, atk: 1, def: 3, sight: 2, up: 1 },
  gen: { name: 'General', men: 2, sup: 4, mp: 4, atk: 1, def: 2, sight: 3, up: 0 }
};
const TER = {
  clear: { name: 'Open ground', cost: 1, def: 1 },
  woods: { name: 'Woods', cost: 2, def: 1.3 },
  hills: { name: 'Hills', cost: 2, def: 1.35 },
  water: { name: 'River', cost: 99, def: 1 },
  town: { name: 'Town', cost: 1, def: 1.4 }
};
const KIND = { town: { name: 'Town', men: 1, sup: 1, def: 1.4, vp: 1, cap: 1 }, hq: { name: 'Headquarters', men: 3, sup: 5, def: 1.6, vp: 2, cap: 4 }, city: { name: 'Capital', men: 3, sup: 4, def: 1.6, vp: 4, cap: 3 } };
const COLORS = [
  { id: 'blue', name: 'Blue', c: '#30478f', C: '#23356c', l: '#4f68b8', h: '#22305f', H: '#141c3a', t: '#86a0d6', T: '#6680b8', ui: '#3a5cc0' },
  { id: 'grey', name: 'Grey', c: '#8f908a', C: '#6f7069', l: '#b9bab0', h: '#6e6f68', H: '#4e4f48', t: '#a88b58', T: '#8a7044', ui: '#7d7e78' },
  { id: 'crimson', name: 'Crimson', c: '#a8332a', C: '#7e2219', l: '#d0584c', h: '#3a2214', H: '#24140a', t: '#d8d0c0', T: '#b0a898', ui: '#c0392b' },
  { id: 'green', name: 'Green', c: '#3e7a34', C: '#2b5a24', l: '#62a24e', h: '#24401c', H: '#162a10', t: '#8a7a5a', T: '#6a5c40', ui: '#3e8a34' },
  { id: 'gold', name: 'Butternut', c: '#b48a3c', C: '#8e6a28', l: '#d8b060', h: '#6a4a20', H: '#4a3214', t: '#7a6a50', T: '#5e5038', ui: '#c8962a' },
  { id: 'purple', name: 'Purple', c: '#6a3a8a', C: '#4e2868', l: '#9058b4', h: '#2e1a3e', H: '#1e1028', t: '#c0b8c8', T: '#9890a4', ui: '#7c46a8' }
];
const NEUTRAL = 99;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASON_OF = m => (m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter');
const WEATHER = {
  clear: { name: 'Clear', desc: 'Good marching weather.' },
  rain: { name: 'Rain', desc: 'Mud off the roads (+1 to move), guns stuck to roads, fords flooded, powder damp (attacks weaker).' },
  fog: { name: 'Fog', desc: 'Units see only the next hex. No long-range bombardment.' },
  heat: { name: 'Heat', desc: 'Units marching three hexes or more may lose men to the heat.' },
  snow: { name: 'Snow', desc: 'Hard going (+½ to move). Units out of supply lose men twice as fast.' }
};
const ERAS = [
  { year: 1861, name: 'Muskets and smoothbores', text: '' },
  { year: 1862, name: 'Rifled guns', text: 'Artillery bombardment is 25% stronger.' },
  { year: 1863, name: 'Repeating carbines', text: 'Cavalry attacks are 25% stronger.' },
  { year: 1864, name: 'Trench warfare', text: 'Earthworks can be dug three deep and protect better.' }
];
const GOALS = {
  capital: { text: 'Hold the Capital at the end of the war.', vp: 5 },
  towns: { text: 'Hold at least {n} towns at the end of the war.', vp: 4 },
  kills: { text: 'Destroy {n} enemy units during the war.', vp: 4 },
  hq: { text: 'Never let your headquarters fall.', vp: 3 },
  raider: { text: 'Break {n} enemy railway hexes with cavalry raids.', vp: 3 },
  enemyhq: { text: 'Hold another army\'s headquarters at the end.', vp: 5 },
  army: { text: 'Field the largest army at the end of the war.', vp: 3 },
  far: { text: 'Hold a town on the far side of the map at the end.', vp: 3 }
};
const TOWER = { cost: 3, max: 4, sight: 3, fogSight: 2, woodsSpot: 2 };
const DEAL = { fee: 1, maxMonths: 6, maxOffers: 3 };
E.TOWER = TOWER; E.DEAL = DEAL;
E.UNIT = UNIT; E.TER = TER; E.KIND = KIND; E.COLORS = COLORS; E.NEUTRAL = NEUTRAL; E.WEATHER = WEATHER; E.ERAS = ERAS; E.GOALS = GOALS; E.MONTHS = MONTHS; E.SEASON_OF = SEASON_OF;

/* ---------------- symmetry groups for fair maps ---------------- */
const rot60 = ([q, r]) => [-r, q + r];
const refl = ([q, r]) => [q, -q - r];
function groupFor(n) {
  const rot = k => p => { for (let i = 0; i < k; i++) p = rot60(p); return p; };
  if (n === 2) return [rot(0), rot(3)];
  if (n === 3) return [rot(0), rot(2), rot(4)];
  if (n === 4) return [rot(0), rot(3), p => refl(p), p => refl(rot(3)(p))];
  return [0, 1, 2, 3, 4, 5].map(rot);
}
function seatAngle(n) { return n === 4 ? 15 : 0; }

/* ---------------- names ---------------- */
const TOWNS = ['Millersburg', 'New Hope', 'Oak Grove', 'Salem', 'Harmony', 'Cedar Run', 'Pine Bluff', 'Mount Zion', 'Goshen', 'Bethel', 'Fairview', 'Cross Keys', 'Liberty', 'Shady Grove', 'Spring Hill', 'Rock Creek', 'Ashland', 'Brandon', 'Clayton', 'Dover', 'Elkton', 'Franklin', 'Glenville', 'Hanover', 'Irvington', 'Jasper', 'Kingston', 'Lebanon', 'Marion', 'Newbern', 'Oxford', 'Paris', 'Quincy', 'Ripley', 'Sparta', 'Troy', 'Union Mills', 'Vernon', 'Warrenton', 'Yorktown', 'Zanesville', 'Albion', 'Berea', 'Canton', 'Danville', 'Edgefield', 'Florence', 'Gainesboro', 'Hillsboro', 'Jonesboro', 'Kent', 'Lancaster', 'Mechanicsville', 'Nashboro', 'Orange', 'Petersville', 'Richland', 'Stanton', 'Tazewell', 'Upton', 'Verona', 'Wilmot'];
const CAPITALS = ['Columbia', 'Fairhaven', 'Meridian', 'Concord', 'Providence', 'Charleston', 'Lexington', 'Jefferson'];
const HQ_NAMES = ['Fort Ashby', 'Camp Douglas', 'Fort Hale', 'Camp Lee', 'Fort Mercer', 'Camp Brandt'];

/* ---------------- map generation ---------------- */
// Two ways to lay out the board:
//  'matched' (the default): every army's slice has the same ingredients (the same number of hills, woods, river,
//    towns at the same distances, farms, a railway) but each is laid out differently, so your own corner tells
//    you nothing about anyone else's. Many candidate maps are drawn and the fairest one is kept.
//  'mirror': every slice is an exact copy of the first, turned to face the centre.
const smoothField = list => k => { const [x, y] = toXY(...P(k)); let v = 0; for (const b of list) { const d = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r); v += b.h * Math.exp(-d); } return v; };
function boardHexes(Rad) { const hexes = {}; for (let q = -Rad; q <= Rad; q++) for (let r = -Rad; r <= Rad; r++) if (Math.abs(q + r) <= Rad) hexes[K(q, r)] = { q, r, t: 'clear' }; return hexes; }
function astarOn(hexes, a, b) {
  const pathCost = k => { const h = hexes[k]; return !h ? 99 : h.t === 'water' ? 6 : h.t === 'hills' ? 3 : h.t === 'woods' ? 2.5 : h.road ? 0.6 : 1; };
  const open = [[0, a]], g = { [a]: 0 }, from = {};
  while (open.length) {
    open.sort((x, y) => x[0] - y[0]); const [, cur] = open.shift(); if (cur === b) break;
    for (const nb of nbrs(cur)) { if (!hexes[nb]) continue; const ng = g[cur] + pathCost(nb); if (g[nb] === undefined || ng < g[nb]) { g[nb] = ng; from[nb] = cur; open.push([ng + hdist(nb, b), nb]); } }
  }
  const out = []; let c = b; while (c && c !== a) { out.push(c); c = from[c]; } out.push(a); return out.reverse();
}
// marching cost (infantry, fair weather, no troops in the way) from one hex to every other
function marchCosts(hexes, from) {
  const st = { hexes }, best = { [from]: 0 }, open = [from];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (best[open[i]] < best[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    for (const nb of nbrs(cur)) { if (!hexes[nb]) continue; const c = E.stepCost(st, 'inf', cur, nb, []); if (!isFinite(c)) continue; const g = best[cur] + c; if (best[nb] === undefined || g < best[nb]) { best[nb] = g; open.push(nb); } }
  }
  return best;
}
function bridgeToCapital(hexes, hqAll, center, orbit) {
  for (const hq of hqAll) {
    const seen = new Set([hq]), q = [hq];
    while (q.length) { const c = q.shift(); for (const nb of nbrs(c)) { const h = hexes[nb]; if (!h || seen.has(nb) || (h.t === 'water' && !h.bridge && !h.ford)) continue; seen.add(nb); q.push(nb); } }
    if (!seen.has(center)) for (const k of astarOn(hexes, hq, center)) for (const o of (orbit ? orbit(k) : [k])) if (hexes[o] && hexes[o].t === 'water') hexes[o].bridge = true;
  }
}

function mirrorMap(c, R) {
  const { n, Rad, G, hqAll, center, density, opts } = c;
  const rf = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rf(a, b + 1)), pick = a => a[Math.floor(R() * a.length)];
  const hexes = boardHexes(Rad), keys = Object.keys(hexes), garrison = {};
  const orbit = k => { const p = P(k), s = new Set(); for (const g of G) { const [a, b] = g(p); s.add(K(a, b)); } return [...s]; };
  const bumps = (count, rad) => Array.from({ length: count }, () => ({ x: rf(-1.7, 1.7) * Rad, y: rf(-1.5, 1.5) * Rad, r: rf(0.6, 1.4) * rad, h: rf(0.5, 1) }));
  const symField = f => { const out = {}; for (const k of keys) { if (out[k] !== undefined) continue; const o = orbit(k).filter(x => hexes[x]); const v = Math.max(...o.map(f)); for (const x of o) out[x] = v; } return out; };
  const nb = Math.max(2, Math.round(Rad * 0.45 / Math.max(1, G.length / 2)));
  const hill = symField(smoothField(bumps(Math.round(nb * 0.8), 3.6)));
  const wood = symField(smoothField(bumps(Math.round(nb * 1.3 * density), 4.2)));
  const thr = (fld, frac) => { const v = keys.map(k => fld[k]).sort((a, b) => b - a); return v[Math.floor(v.length * frac)]; };
  const hT = thr(hill, 0.12 * Math.sqrt(density)), wT = thr(wood, 0.22 * density);
  for (const k of keys) { if (hill[k] > hT && hdist(k, '0,0') > 1) hexes[k].t = 'hills'; else if (wood[k] > wT) hexes[k].t = 'woods'; }
  const protect = new Set([center, ...hqAll]);
  for (const h of hqAll) for (const x of nbrs(h)) protect.add(x);
  const rivers = new Set(), nRiv = opts.rivers === undefined ? 1 : opts.rivers;
  for (let i = 0; i < nRiv; i++) {
    let cur = K(...fromXY(rf(-0.3, 0.3) * Rad, rf(-0.3, 0.3) * Rad)), dir = ri(0, 5), steps = 0;
    while (hexes[cur] && steps++ < Rad * 1.4) {
      if (!protect.has(cur) && hdist(cur, center) > 2) rivers.add(cur);
      if (R() < 0.35) dir = (dir + (R() < 0.5 ? 1 : 5)) % 6;
      const [q, r] = P(cur); cur = K(q + DIRS[dir][0], r + DIRS[dir][1]);
    }
  }
  for (const k of [...rivers]) for (const o of orbit(k)) if (hexes[o] && !protect.has(o)) hexes[o].t = 'water';
  const towns = [], usedNames = new Set(), tname = () => { let s; do s = pick(TOWNS); while (usedNames.has(s)); usedNames.add(s); return s; };
  const setTown = (k, kind, name, owner) => { const h = hexes[k]; h.t = 'town'; h.town = { name, kind, owner, fort: kind === 'town' ? 0 : 1 }; towns.push(k); };
  setTown(center, 'city', pick(CAPITALS), NEUTRAL);
  hqAll.forEach((k, i) => setTown(k, 'hq', HQ_NAMES[i], i < n ? i : NEUTRAL));
  if (n === 5) { const k = hqAll[5]; hexes[k].town.kind = 'town'; hexes[k].town.name = tname(); hexes[k].town.fort = 1; }
  const perSeat = Math.round(Rad * 0.55 * (opts.towns === 'many' ? 1.4 : opts.towns === 'few' ? 0.7 : 1));
  let tries = 0, placed = 0;
  while (placed < perSeat * G.length && tries++ < 3000) {
    const k = pick(keys); if (hexes[k].t === 'water' || hexes[k].town) continue;
    const o = orbit(k).filter(x => hexes[x]);
    if (o.some(x => hexes[x].t === 'water' || towns.some(t => hdist(t, x) < 3))) continue;
    if (o.length > 1 && o.some((a, i) => o.some((b, j) => i < j && hdist(a, b) < 3))) continue;
    const str = 4 + Math.floor(R() * 2);
    for (const x of o) { setTown(x, 'town', tname(), NEUTRAL); garrison[x] = str; placed++; }
  }
  const farmBase = new Set(), doneT = new Set();
  for (const t of towns) { if (doneT.has(t)) continue; for (const o of orbit(t)) doneT.add(o); const cand = nbrs(t).filter(x => hexes[x] && hexes[x].t === 'clear' && !hexes[x].town); for (let i = 0; i < (hexes[t].town.kind === 'town' ? 1 : 2) && cand.length; i++) farmBase.add(cand.splice(Math.floor(R() * cand.length), 1)[0]); }
  for (const k of keys) if (hexes[k].t === 'clear' && R() < 0.04 / G.length * 2) farmBase.add(k);
  for (const k of [...farmBase]) for (const o of orbit(k)) if (hexes[o] && hexes[o].t === 'clear' && !hexes[o].town) hexes[o].farm = { town: null, burned: 0 };
  for (const k of keys) if (hexes[k].farm) {
    const ds = towns.map(t => hdist(k, t)), m = Math.min(...ds);
    if (ds.filter(d => d === m).length > 1) { for (const o of orbit(k)) if (hexes[o]) delete hexes[o].farm; continue; }
    hexes[k].farm.town = towns[ds.indexOf(m)];
  }
  const mark = (path, f) => { for (const k of path) for (const o of orbit(k)) if (hexes[o]) hexes[o][f] = true; };
  for (const t of towns.filter(t => hexes[t].town.kind === 'town')) { const near = towns.filter(x => x !== t).sort((a, b) => hdist(a, t) - hdist(b, t)).slice(0, 2); for (const x of near) mark(astarOn(hexes, t, x), 'road'); }
  mark(astarOn(hexes, hqAll[0], center), 'rail');
  for (const k of keys) { const h = hexes[k]; if (h.t === 'water' && (h.road || h.rail)) h.bridge = true; }
  for (const k of keys) { const h = hexes[k]; if (h.t === 'water' && !h.bridge && R() < 0.12) for (const o of orbit(k)) if (hexes[o] && hexes[o].t === 'water' && !hexes[o].bridge) hexes[o].ford = true; }
  bridgeToCapital(hexes, hqAll, center, orbit);
  return { hexes, towns, garrison };
}

function matchedMap(c, R) {
  const { n, Rad, G, slots, hqAll, center, density, opts } = c;
  const rf = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
  const hexes = boardHexes(Rad), keys = Object.keys(hexes), garrison = {};
  const orbit = k => { const p = P(k), s = new Set(); for (const g of G) { const [a, b] = g(p); s.add(K(a, b)); } return [...s].filter(x => hexes[x]); };
  // each hex belongs to the slice of the nearest headquarters; hexes equally near two, or close to the Capital, belong to nobody
  const slice = {}, members = Array.from({ length: slots }, () => []);
  for (const k of keys) {
    const ds = hqAll.map(h => hdist(k, h)), m = Math.min(...ds);
    if (hdist(k, center) <= 2 || ds.filter(d => d === m).length > 1) { slice[k] = -1; continue; }
    slice[k] = ds.indexOf(m); members[slice[k]].push(k);
  }
  const sz = members[0].length;
  const protect = new Set([center, ...hqAll]);
  for (const h of hqAll) for (const x of nbrs(h)) protect.add(x);
  // 1. rivers: each slice gets its own winding river, then all are cut to the same length
  const nRiv = opts.rivers === undefined ? 1 : opts.rivers, want = Math.round(Rad * 0.95);
  const riverIn = members.map(() => []);
  const step = (k, d) => { const [q, r] = P(k); return K(q + DIRS[d][0], r + DIRS[d][1]); };
  const walk = (i, taken) => {
    const starts = members[i].filter(k => !protect.has(k) && !taken.has(k) && hdist(k, center) >= 3 && hdist(k, center) <= Math.max(4, Math.round(Rad * 0.35)));
    if (!starts.length) return [];
    let cur = pick(starts); const out = [], mine = new Set();
    const outward = [0, 1, 2, 3, 4, 5].filter(d => hdist(step(cur, d), center) > hdist(cur, center));
    let dir = pick(outward.length ? outward : [0, 1, 2, 3, 4, 5]), steps = 0;
    while (steps++ < want * 3 && out.length < want) {
      if (slice[cur] === i && !protect.has(cur) && !taken.has(cur) && !mine.has(cur)) { mine.add(cur); out.push(cur); }
      if (R() < 0.35) dir = (dir + (R() < 0.5 ? 1 : 5)) % 6;
      let nx = step(cur, dir), t = 0;
      while ((!hexes[nx] || slice[nx] !== i || mine.has(nx) || taken.has(nx)) && t++ < 6) { dir = (dir + (R() < 0.5 ? 1 : 5)) % 6; nx = step(cur, dir); }
      if (!hexes[nx] || slice[nx] !== i || mine.has(nx)) break;
      cur = nx;
    }
    return out;
  };
  for (let i = 0; i < slots; i++) {
    const taken = new Set();
    for (let rv = 0; rv < nRiv; rv++) {
      // try a few courses and keep the longest, so no slice is left with a stub of a river
      let best = []; for (let t = 0; t < 10 && best.length < want; t++) { const w = walk(i, taken); if (w.length > best.length) best = w; }
      for (const k of best) { hexes[k].t = 'water'; riverIn[i].push(k); taken.add(k); }
    }
  }
  const rivLen = Math.min(...riverIn.map(a => a.length));
  for (let i = 0; i < slots; i++) { for (const k of riverIn[i].slice(rivLen)) hexes[k].t = 'clear'; riverIn[i] = riverIn[i].slice(0, rivLen); }
  // 2. towns: the first slice's towns are drawn freely; every other slice gets towns at the same distances
  //    from its headquarters and from the Capital, but in different places, with the same militia in them
  const towns = [], usedNames = new Set(), tname = () => { let s; do s = pick(TOWNS); while (usedNames.has(s)); usedNames.add(s); return s; };
  const setTown = (k, kind, name, owner) => { const h = hexes[k]; h.t = 'town'; h.town = { name, kind, owner, fort: kind === 'town' ? 0 : 1 }; towns.push(k); };
  setTown(center, 'city', pick(CAPITALS), NEUTRAL);
  hqAll.forEach((k, i) => setTown(k, 'hq', HQ_NAMES[i], i < n ? i : NEUTRAL));
  if (n === 5) { const k = hqAll[5]; hexes[k].town.kind = 'town'; hexes[k].town.name = tname(); hexes[k].town.fort = 1; }
  const perSeat = Math.round(Rad * 0.55 * (opts.towns === 'many' ? 1.4 : opts.towns === 'few' ? 0.7 : 1));
  const okSpot = k => hexes[k] && hexes[k].t !== 'water' && !hexes[k].town && !protect.has(k) && towns.every(t => hdist(t, k) >= 3) && nbrs(k).filter(x => hexes[x] && hexes[x].t !== 'water').length >= 2;
  // which slice is drawn freely is itself left to chance, so no seat is always the one the others are fitted to
  const ti = Math.floor(R() * slots);
  const tmpl = []; let tries = 0;
  while (tmpl.length < perSeat && tries++ < 3000) { const k = pick(members[ti]); if (!okSpot(k)) continue; setTown(k, 'town', tname(), NEUTRAL); const str = 4 + Math.floor(R() * 2); garrison[k] = str; tmpl.push({ dH: hdist(k, hqAll[ti]), dC: hdist(k, center), str }); }
  for (let i = 0; i < slots; i++) if (i !== ti) for (const t of tmpl) {
    let done = false;
    for (const [a, b] of [[0, 0], [0, 1], [1, 1], [1, 2]]) {
      const cand = members[i].filter(k => okSpot(k) && Math.abs(hdist(k, hqAll[i]) - t.dH) <= a && Math.abs(hdist(k, center) - t.dC) <= b);
      if (cand.length) { const k = pick(cand); setTown(k, 'town', tname(), NEUTRAL); garrison[k] = t.str; done = true; break; }
    }
    if (!done) return null;
  }
  // 3. farms: one beside every town, two beside headquarters and the Capital, and a few more in the country
  const nearestTownOf = k => { let best = null, bd = 1e9, ties = 0; for (const t of towns) { const d = hdist(t, k); if (d < bd) { bd = d; best = t; ties = 0; } else if (d === bd) ties++; } return ties ? null : best; };
  for (const t of towns) {
    const cand = nbrs(t).filter(x => hexes[x] && hexes[x].t === 'clear' && !hexes[x].town && !hexes[x].farm && nearestTownOf(x) === t && (t === center || slice[x] === slice[t]));
    for (let i = 0; i < (hexes[t].town.kind === 'town' ? 1 : 2) && cand.length; i++) { const x = cand.splice(Math.floor(R() * cand.length), 1)[0]; hexes[x].farm = { town: t, burned: 0 }; }
  }
  const extra = Math.max(1, Math.round(sz * 0.022));
  for (let i = 0; i < slots; i++) { let got = 0, t = 0; while (got < extra && t++ < 400) { const k = pick(members[i]); const h = hexes[k]; if (h.t !== 'clear' || h.town || h.farm || protect.has(k)) continue; const owner = nearestTownOf(k); if (!owner || (owner !== center && slice[owner] !== i)) continue; h.farm = { town: owner, burned: 0 }; got++; } }
  const farmsOf = i => keys.filter(k => hexes[k].farm && slice[hexes[k].farm.town] === i).length;
  const fTarget = Math.max(...members.map((_, i) => farmsOf(i)));
  for (let i = 0; i < slots; i++) { let t = 0; while (farmsOf(i) < fTarget && t++ < 400) { const k = pick(members[i]); const h = hexes[k]; if (h.t !== 'clear' || h.town || h.farm || protect.has(k)) continue; const owner = nearestTownOf(k); if (!owner || slice[owner] !== i) continue; h.farm = { town: owner, burned: 0 }; } }
  // 4. hills and woods: each slice gets its own patches of high ground and forest, in exactly the same amounts
  const nbH = Math.max(1, Math.round(Math.max(2, Math.round(Rad * 0.45 / Math.max(1, G.length / 2))) * 0.8 * 0.7 + 0.5));
  const nbW = Math.max(1, Math.round(Math.max(2, Math.round(Rad * 0.45 / Math.max(1, G.length / 2))) * 1.3 * density * 0.7 + 0.5));
  const bumpsIn = (i, count, rad) => Array.from({ length: count }, () => { const [x, y] = toXY(...P(pick(members[i]))); return { x, y, r: rf(0.6, 1.4) * rad, h: rf(0.5, 1) }; });
  const allH = [], allW = [];
  for (let i = 0; i < slots; i++) { allH.push(...bumpsIn(i, nbH, 3.6)); allW.push(...bumpsIn(i, nbW, 4.2)); }
  const fH = smoothField(allH), fW = smoothField(allW), vH = {}, vW = {};
  for (const k of keys) { vH[k] = fH(k); vW[k] = fW(k); }
  const free = k => hexes[k].t === 'clear' && !hexes[k].town && !hexes[k].farm;
  const nH = Math.round(sz * 0.12 * Math.sqrt(density)), nW = Math.round(sz * 0.22 * density);
  let thH = 0, thW = 0;
  for (let i = 0; i < slots; i++) {
    const byH = members[i].filter(free).sort((a, b) => vH[b] - vH[a]);
    for (const k of byH.slice(0, nH)) hexes[k].t = 'hills'; thH += (vH[byH[Math.min(nH, byH.length) - 1]] || 0) / slots;
    const byW = members[i].filter(free).sort((a, b) => vW[b] - vW[a]);
    for (const k of byW.slice(0, nW)) hexes[k].t = 'woods'; thW += (vW[byW[Math.min(nW, byW.length) - 1]] || 0) / slots;
  }
  // the seams between slices are shared ground, drawn from the same patches
  for (const k of keys) if (slice[k] === -1 && hdist(k, center) > 2 && free(k)) { if (vH[k] >= thH) hexes[k].t = 'hills'; else if (vW[k] >= thW) hexes[k].t = 'woods'; }
  // the ground round the Capital is the same on every approach
  const doneO = new Set();
  for (const k of keys) {
    if (k === center || hdist(k, center) > 2 || doneO.has(k)) continue;
    const o = orbit(k); for (const x of o) doneO.add(x);
    const r = R(), t = hdist(k, center) > 1 && r < 0.12 ? 'hills' : r < 0.3 ? 'woods' : 'clear';
    for (const x of o) if (free(x) && hexes[x].t === 'clear') hexes[x].t = t;
  }
  // 5. roads between neighbouring towns, and a railway from every headquarters to the Capital
  const mark = (path, f) => { for (const k of path) if (hexes[k]) hexes[k][f] = true; };
  for (const t of towns.filter(t => hexes[t].town.kind === 'town')) { const near = towns.filter(x => x !== t).sort((a, b) => hdist(a, t) - hdist(b, t)).slice(0, 2); for (const x of near) mark(astarOn(hexes, t, x), 'road'); }
  // the railway runs as straight as the hexes allow, so every headquarters is the same distance from the Capital by rail
  const straight = (a, b) => { const out = [a]; let cur = a; while (cur !== b) { const opts2 = nbrs(cur).filter(x => hexes[x] && hdist(x, b) < hdist(cur, b)); const pref = opts2.filter(x => !hexes[x].town || x === b); const nx = pick(pref.length ? pref : opts2); out.push(nx); cur = nx; } return out; };
  const railOf = hqAll.map(hq => { const p = straight(hq, center); mark(p, 'rail'); return new Set(p); });
  // every slice gets the same number of towns on its railway: short branch lines make up the difference
  const railTownsOf = i => towns.filter(t => slice[t] === i && t !== hqAll[i] && railOf[i].has(t)).length;
  const target = Math.max(...hqAll.map((_, i) => railTownsOf(i)));
  for (let i = 0; i < slots; i++) {
    let guard = 0;
    while (railTownsOf(i) < target && guard++ < 5) {
      const off = towns.filter(t => slice[t] === i && t !== hqAll[i] && !railOf[i].has(t));
      if (!off.length) break;
      const dTo = t => Math.min(...[...railOf[i]].filter(x => x !== center).map(x => hdist(x, t)));
      const t = off.sort((a, b) => dTo(a) - dTo(b))[0];
      const join = [...railOf[i]].filter(x => x !== center).sort((a, b) => hdist(a, t) - hdist(b, t))[0];
      const p = astarOn(hexes, t, join); mark(p, 'rail'); for (const x of p) railOf[i].add(x);
    }
  }
  for (const k of keys) { const h = hexes[k]; if (h.t === 'water' && (h.road || h.rail)) h.bridge = true; }
  // fords: the same number on every slice's river
  const fords = Math.round(rivLen * 0.12);
  for (let i = 0; i < slots; i++) { const cand = riverIn[i].filter(k => !hexes[k].bridge); for (let j = 0; j < fords && cand.length; j++) hexes[cand.splice(Math.floor(R() * cand.length), 1)[0]].ford = true; }
  bridgeToCapital(hexes, hqAll, center, null);
  return { hexes, towns, garrison, slice, members };
}
// how unfair is a matched map? 0 means every army starts equally placed, within tolerance
function mapUnfairness(M, c) {
  const { hexes, towns, slice } = M, { hqAll, center, n, slots } = c;
  const per = [];
  for (let i = 0; i < slots; i++) {
    const hq = hqAll[i], cost = marchCosts(hexes, hq);
    const mine = towns.filter(t => slice[t] === i && t !== hq);
    const toCap = cost[center] === undefined ? 99 : cost[center];
    const toTowns = mine.reduce((s, t) => s + (cost[t] === undefined ? 30 : cost[t]), 0);
    const farms = Object.keys(hexes).filter(k => hexes[k].farm && hexes[k].farm.town && (slice[hexes[k].farm.town] === i)).length;
    // towns joined to this headquarters by its own railway (each is worth +1 supply a month)
    const seen = new Set([hq]), q = [hq]; let railTowns = 0;
    while (q.length) { const x = q.shift(); for (const nb of nbrs(x)) { const h = hexes[nb]; if (h && h.rail && !seen.has(nb) && hdist(nb, hq) < hdist(center, hq) + 3) { seen.add(nb); q.push(nb); if (h.town && slice[nb] === i) railTowns++; } } }
    per.push({ toCap, toTowns, farms, railTowns, towns: mine.length });
  }
  const seats = per.slice(0, n === 5 ? 6 : n);
  const spread = f => { const v = seats.map(f); const mx = Math.max(...v), mn = Math.min(...v), avg = v.reduce((a, b) => a + b, 0) / v.length; return { rel: avg ? (mx - mn) / avg : 0, abs: mx - mn }; };
  let bad = 0;
  bad += Math.max(0, spread(p => p.toCap).rel - 0.12) * 10;
  bad += Math.max(0, spread(p => p.toTowns).rel - 0.2) * 10;
  bad += spread(p => p.farms).abs + spread(p => p.railTowns).abs * 2 + spread(p => p.towns).abs * 5;
  return { bad, per };
}

E.newGame = function (opts) {
  const n = clamp(opts.seats | 0, 2, 6);
  const seed = (opts.seed >>> 0) || ((Math.random() * 4294967295) >>> 0);
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)];
  const size = opts.mapSize || 'normal';
  const Rad = ({ 2: 10, 3: 11, 4: 12, 5: 14, 6: 14 }[n]) + (size === 'large' ? 3 : size === 'small' ? -2 : 0);
  const G = groupFor(n), slots = n === 5 ? 6 : n;
  const density = { light: 0.7, normal: 1, heavy: 1.35 }[opts.terrain || 'normal'];
  // headquarters always stand the same distance from the Capital, evenly round the board
  const ang = seatAngle(n) * Math.PI / 180, dist0 = Rad * 0.74;
  const h0 = fromXY(Math.cos(ang) * dist0 * Math.sqrt(3), Math.sin(ang) * dist0 * 1.5);
  const hqAll = G.map(g => K(...g(h0)));
  const center = K(0, 0);
  const layout = opts.layout === 'mirror' ? 'mirror' : 'matched';
  const ctx = { n, Rad, G, slots, hqAll, center, density, opts };
  let M;
  if (layout === 'mirror') M = mirrorMap(ctx, R);
  else {
    let best = null;
    for (let a = 0; a < 40; a++) {
      const m = matchedMap(ctx, rng((seed + a * 0x9e3779b1) >>> 0)); if (!m) continue;
      const f = mapUnfairness(m, ctx);
      if (!best || f.bad < best.f.bad) best = { m, f, a };
      if (f.bad <= 0) break;
    }
    if (best) E._lastMapInfo = { attempts: best.a + 1, bad: best.f.bad, per: best.f.per };
    M = best ? best.m : mirrorMap(ctx, R);
  }
  const { hexes, towns, garrison } = M;
  const humans = opts.humans === undefined ? n : opts.humans;
  const seats = [];
  for (let i = 0; i < n; i++) seats.push({ seat: i, color: COLORS[i].id, name: (opts.names && opts.names[i]) || (i < humans ? '' : `General ${['Ashby', 'Bragg', 'Custis', 'Doyle', 'Ewing', 'Foote'][i]}`), bot: i >= humans, hq: hqAll[i], alive: true, men: 6, sup: 10, goal: null, stats: { kills: 0, raids: 0, hqLost: false }, submitted: false, joined: i >= humans });
  const state = {
    v: 2, id: opts.id || null, name: opts.name || 'The Long Campaign', seed, R: Rad, n, layout, hexes, seats, units: {}, nextId: 1, turn: 1,
    startMonth: opts.startMonth === undefined ? 3 : opts.startMonth, startYear: 1861, mode: opts.mode || 'points', turnLimit: opts.turnLimit || 30, eraTurns: opts.eraTurns || 8,
    center, rel: { sight: seats.map(() => seats.map(() => false)), passage: seats.map(() => seats.map(() => false)) },
    deals: [], locks: [], nextDeal: 1,
    weather: { fronts: [] }, capitalHold: { seat: null, count: 0 }, lastEvents: [], log: [], over: null, created: Date.now(), rngState: seed ^ 0x9e3779b9
  };
  // armies: each starts at its headquarters, with its other five units on the ring round it nearest the Capital
  const place = (seat, type, k, str) => { const id = 'u' + state.nextId++; state.units[id] = { id, seat, type, at: k, str: str || 10 }; return id; };
  for (let i = 0; i < n; i++) {
    const ring = nbrs(hqAll[i]).filter(x => hexes[x] && hexes[x].t !== 'water' && !hexes[x].town).sort((a, b) => hdist(a, center) - hdist(b, center) || (a < b ? -1 : 1));
    place(i, 'inf', hqAll[i]);
    ['inf', 'cav', 'art', 'eng', 'gen'].forEach((t, j) => { if (ring[j]) place(i, t, ring[j]); });
  }
  // neutral garrisons hold every unclaimed town
  for (const t of towns) {
    const tw = hexes[t].town; if (tw.owner !== NEUTRAL) continue;
    // with five armies the empty sixth slice is held by strong garrisons, so its neighbours gain no free land
    const inEmpty = n === 5 && hdist(t, hqAll[5]) < Math.min(...hqAll.slice(0, 5).map(h => hdist(t, h)));
    place(NEUTRAL, 'inf', t, tw.kind === 'city' || inEmpty ? 10 : garrison[t] || 4); if (tw.kind === 'city' || inEmpty) hexes[t].ent = inEmpty ? 2 : 1;
  }
  // secret goals
  const gl = Object.keys(GOALS); for (let i = gl.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [gl[i], gl[j]] = [gl[j], gl[i]]; }
  const allTowns = towns.length;
  seats.forEach((s, i) => { const id = gl[i % gl.length]; const nn = id === 'towns' ? Math.max(4, Math.round(allTowns / n * 1.3)) : id === 'kills' ? 6 : id === 'raider' ? 5 : 0; s.goal = { id, n: nn, text: GOALS[id].text.replace('{n}', nn), vp: GOALS[id].vp }; });
  advanceWeather(state, true); advanceWeather(state, true); advanceWeather(state, true);
  makeForecast(state);
  state.log.push({ turn: 0, text: `War is declared. ${n} armies take the field.` });
  return state;
};
E._mapgen = { matchedMap, mirrorMap, mapUnfairness, groupFor };

/* ---------------- calendar, weather and eras ---------------- */
E.dateOf = (state, turn) => { const m = (state.startMonth + (turn - 1)) % 12, y = state.startYear + Math.floor((state.startMonth + turn - 1) / 12); return { month: m, year: y, label: `${MONTHS[m]} ${y}`, season: SEASON_OF(m) }; };
function srand(state) { const r = rng(state.rngState); const v = r(); state.rngState = (state.rngState * 1103515245 + 12345 + Math.floor(v * 1e6)) >>> 0; return v; }
function frontsCopy(f) { return f.map(x => ({ ...x })); }
function stepFronts(state, list, season, R) {
  const out = [];
  for (const f of list) { const g = { ...f, x: f.x + f.vx, y: f.y + f.vy, life: f.life - 1 }; if (g.life > 0 && Math.abs(g.x) < state.R * 2.6 && Math.abs(g.y) < state.R * 2.2) out.push(g); }
  const P0 = { spring: { rain: 0.5, fog: 0.25 }, summer: { heat: 0.45, rain: 0.25 }, autumn: { fog: 0.3, rain: 0.25 }, winter: { snow: 0.55, fog: 0.2 } }[season];
  for (const kind in P0) if (R() < P0[kind] && out.length < 4) {
    // fronts come in from any side and cross the whole board, so no corner of the map is always wetter
    const side = Math.floor(R() * 4), span = state.R * 2.2, sp = 3 + R() * 1.6, off = (R() * 2 - 1) * state.R * 1.1;
    const [x, y, vx, vy] = side === 0 ? [-span, off, sp, (R() - 0.5)] : side === 1 ? [span, off, -sp, (R() - 0.5)] : side === 2 ? [off, -span * 0.9, (R() - 0.5), sp] : [off, span * 0.9, (R() - 0.5), -sp];
    out.push({ kind, x, y, vx, vy, r: 4 + R() * 3 + state.R * 0.18, life: Math.ceil(span * 2 / sp) + 1 });
  }
  return out;
}
function advanceWeather(state, init) {
  // the board always knows the real weather two months ahead; forecasts are drawn from it with errors
  const W = state.weather, R = () => srand(state);
  if (!W.future) W.future = [];
  const lastF = W.future.length ? W.future[W.future.length - 1] : W.fronts;
  const t = state.turn + (init ? W.future.length : W.future.length + 1);
  W.future.push(stepFronts(state, lastF, E.dateOf(state, t).season, R));
  if (W.future.length > 2) W.fronts = W.future.shift();
}
function makeForecast(state) {
  const W = state.weather, R = () => srand(state);
  W.forecast = W.future.map((fr, i) => fr.filter(() => R() < (i === 0 ? 0.92 : 0.75)).map(f => {
    const ok = R() < (i === 0 ? 0.8 : 0.5);
    if (ok) return { ...f };
    const kinds = ['rain', 'fog', 'heat', 'snow', 'clear'];
    return { ...f, x: f.x + (R() - 0.5) * 8, y: f.y + (R() - 0.5) * 8, kind: R() < 0.5 ? f.kind : kinds[Math.floor(R() * kinds.length)] };
  }).filter(f => f.kind !== 'clear'));
}
E.weatherAt = function (fronts, k) {
  const [x, y] = toXY(...P(k));
  let best = 'clear', bd = 1e9;
  for (const f of fronts || []) { const d = Math.hypot(x - f.x, y - f.y); if (d < f.r && d < bd) { bd = d; best = f.kind; } }
  return best;
};
E.eraOf = (state, seat) => { const base = Math.min(3, Math.floor((state.turn - 1) / state.eraTurns)); const c = state.hexes[state.center]; return Math.min(3, base + (c.town.owner === seat ? 1 : 0)); };

/* ---------------- movement ---------------- */
E.relFriendly = function (state, mover, occupantSeat) { return mover === occupantSeat || (occupantSeat !== NEUTRAL && mover !== NEUTRAL && state.rel.passage[occupantSeat] && state.rel.passage[occupantSeat][mover]); };
E.stepCost = function (state, type, a, b, fronts) {
  const ha = state.hexes[a], hb = state.hexes[b]; if (!ha || !hb) return Infinity;
  const w = E.weatherAt(fronts, b);
  if (hb.t === 'water' && !hb.bridge && !(hb.ford && w !== 'rain')) return Infinity;
  const roadish = (ha.road || (ha.rail && !ha.railBroken) || ha.town) && (hb.road || (hb.rail && !hb.railBroken) || hb.town);
  let c = roadish ? 0.5 : hb.t === 'water' ? (hb.bridge ? 1 : 2) : TER[hb.t].cost;
  if (!roadish) { if (w === 'rain') { if (type === 'art') return Infinity; c += 1; } if (w === 'snow') c += 0.5; }
  return c;
};
// every hex a unit can reach this turn, with the cheapest path (zone of control stops a march)
E.reach = function (state, u, occupied, fronts, rnd) {
  const mp = UNIT[u.type].mp, best = { [u.at]: 0 }, from = {}, open = [u.at], stopAt = new Set();
  const hostileAdj = k => nbrs(k).some(x => { const o = occupied[x]; return o && !E.relFriendly(state, u.seat, o.seat); });
  while (open.length) {
    open.sort((a, b) => best[a] - best[b]); const cur = open.shift();
    if (cur !== u.at && (stopAt.has(cur))) continue;
    const nn = nbrs(cur); if (rnd) { const o = Math.floor(rnd() * 6); nn.push(...nn.splice(0, o)); if (rnd() < 0.5) nn.reverse(); }
    for (const nb of nn) {
      const o = occupied[nb];
      const c = E.stepCost(state, u.type, cur, nb, fronts); if (!isFinite(c)) continue;
      const ng = best[cur] + c; if (ng > mp + 1e-9) continue;
      if (o && !E.relFriendly(state, u.seat, o.seat)) { if (best[nb] === undefined || ng < best[nb]) { best[nb] = ng; from[nb] = cur; } continue; } // can attack it, not pass
      if (best[nb] === undefined || ng < best[nb]) { best[nb] = ng; from[nb] = cur; open.push(nb); if (hostileAdj(nb)) stopAt.add(nb); }
    }
  }
  return { best, from };
};
E.pathTo = function (reach, start, goal) { const out = []; let c = goal; while (c && c !== start) { out.push(c); c = reach.from[c]; } if (c !== start) return null; return out.reverse(); };

/* ---------------- visibility ---------------- */
E.visibleSet = function (state, seat, fronts) {
  const vis = new Set(), viewers = [seat];
  for (let s = 0; s < state.n; s++) if (s !== seat && state.rel.sight[s][seat] && state.seats[s].alive) viewers.push(s);
  const add = (k, rng) => { const [q0, r0] = P(k); for (let dq = -rng; dq <= rng; dq++) for (let dr = -rng; dr <= rng; dr++) { if (Math.abs(dq + dr) > rng) continue; const x = K(q0 + dq, r0 + dr); if (state.hexes[x]) vis.add(x); } };
  for (const id in state.units) { const u = state.units[id]; if (!viewers.includes(u.seat)) continue; let s = UNIT[u.type].sight + (state.hexes[u.at].t === 'hills' ? 1 : 0); if (E.weatherAt(fronts, u.at) === 'fog') s = 1; add(u.at, s); }
  for (const k in state.hexes) { const h = state.hexes[k], t = h.town; if (t && viewers.includes(t.owner)) add(k, E.weatherAt(fronts, k) === 'fog' ? 1 : t.kind === 'town' ? 1 : 2); if (h.tower && viewers.includes(h.tower.seat)) add(k, E.towerSight(state, k, fronts)); }
  return vis;
};
E.towerSight = (state, k, fronts) => E.weatherAt(fronts, k) === 'fog' ? TOWER.fogSight : TOWER.sight + (state.hexes[k].t === 'hills' ? 1 : 0);
E.towersOf = (state, seat) => Object.keys(state.hexes).filter(k => state.hexes[k].tower && state.hexes[k].tower.seat === seat);
E.canSeeUnit = function (state, seat, u, vis) {
  if (u.seat === seat || (u.seat !== NEUTRAL && state.rel.sight[u.seat][seat])) return true;
  if (!vis.has(u.at)) return false;
  if (state.hexes[u.at].t === 'woods') { // woods hide troops from all but the closest look
    for (const id in state.units) { const v = state.units[id]; if ((v.seat === seat || (v.seat !== NEUTRAL && state.rel.sight[v.seat][seat])) && hdist(v.at, u.at) <= 1) return true; }
    // a watchtower looks down into the trees from a little further off
    for (const k in state.hexes) { const tw = state.hexes[k].tower; if (tw && (tw.seat === seat || state.rel.sight[tw.seat][seat]) && hdist(k, u.at) <= TOWER.woodsSpot) return true; }
    return false;
  }
  return true;
};

/* ---------------- what each player is allowed to see ---------------- */
E.view = function (state, seat) {
  const vis = E.visibleSet(state, seat, state.weather.fronts);
  const units = {};
  for (const id in state.units) { const u = state.units[id]; if (E.canSeeUnit(state, seat, u, vis)) units[id] = u; }
  const seats = state.seats.map(s => ({ seat: s.seat, color: s.color, name: s.name, bot: s.bot, alive: s.alive, submitted: s.submitted, joined: s.joined, hq: s.hq, score: E.score(state, s.seat).vp, towns: E.townCount(state, s.seat), ...(s.seat === seat || state.over ? { men: s.men, sup: s.sup, goal: s.goal, stats: s.stats } : {}) }));
  const ev = (state.lastEvents || []).filter(e => e.vis === undefined || e.vis.includes(seat) || state.over);
  return {
    v: state.v, id: state.id, name: state.name, R: state.R, n: state.n, seed: state.seed, turn: state.turn, mode: state.mode, turnLimit: state.turnLimit, eraTurns: state.eraTurns, startMonth: state.startMonth, startYear: state.startYear,
    center: state.center, hexes: state.hexes, units, seats, me: seat, rel: state.rel, visible: [...vis], weather: { fronts: state.weather.fronts, forecast: state.weather.forecast }, capitalHold: state.capitalHold,
    deals: (state.deals || []).filter(d => d.from === seat || d.to === seat || state.over).map(d => ({ ...d })), locks: (state.locks || []).filter(l => l.from === seat || l.to === seat).map(l => ({ ...l })),
    events: ev.map(e => { const c = { ...e }; delete c.vis; return c; }), log: state.log.filter(l => !l.vis || l.vis.includes(seat) || state.over).slice(-60).map(l => ({ turn: l.turn, text: l.text })), over: state.over, deadline: state.deadline, myOrders: state.orders && state.orders[seat] || null
  };
};

/* ---------------- scoring ---------------- */
E.townCount = (state, seat) => { let n = 0; for (const k in state.hexes) { const t = state.hexes[k].town; if (t && t.owner === seat) n++; } return n; };
E.score = function (state, seat, final) {
  let vp = 0; for (const k in state.hexes) { const t = state.hexes[k].town; if (t && t.owner === seat) vp += KIND[t.kind].vp; }
  const goalMet = final ? E.goalMet(state, seat) : false;
  return { vp: vp + (goalMet ? state.seats[seat].goal.vp : 0), goalMet };
};
E.goalMet = function (state, seat) {
  const s = state.seats[seat], g = s.goal; if (!g || !s.alive) return false;
  const H = state.hexes, mine = k => H[k].town && H[k].town.owner === seat;
  const army = sid => Object.values(state.units).filter(u => u.seat === sid && u.type !== 'gen').length;
  switch (g.id) {
    case 'capital': return mine(state.center);
    case 'towns': return E.townCount(state, seat) >= g.n;
    case 'kills': return s.stats.kills >= g.n;
    case 'hq': return !s.stats.hqLost && mine(s.hq);
    case 'raider': return s.stats.raids >= g.n;
    case 'enemyhq': return state.seats.some(o => o.seat !== seat && mine(o.hq));
    case 'army': { const me = army(seat); return state.seats.every(o => o.seat === seat || army(o.seat) < me); }
    case 'far': return Object.keys(H).some(k => mine(k) && hdist(k, s.hq) >= state.R * 1.5);
  }
  return false;
};
E.unitCap = (state, seat) => { let c = 4; for (const k in state.hexes) { const t = state.hexes[k].town; if (t && t.owner === seat) c += KIND[t.kind].cap; } return c; };
// a month's income from towns, farms and rail, and the upkeep of the army as it stands
E.incomeOf = function (state, seat) {
  const H = state.hexes; let men = 0, sup = 0;
  for (const k in H) { const h = H[k]; if (h.town && h.town.owner === seat) { men += KIND[h.town.kind].men; sup += KIND[h.town.kind].sup; } if (h.farm && h.farm.burned <= 0 && H[h.farm.town] && H[h.farm.town].town.owner === seat) sup += 1; }
  const hq = state.seats[seat].hq;
  if (H[hq].town.owner === seat) { const seen = new Set([hq]), q = [hq]; while (q.length) { const c = q.shift(); for (const nb of nbrs(c)) { const x = H[nb]; if (x && x.rail && !x.railBroken && !seen.has(nb)) { seen.add(nb); q.push(nb); if (x.town && x.town.owner === seat) sup += 1; } } } }
  const up = Object.values(state.units).filter(u => u.seat === seat).reduce((t, u) => t + UNIT[u.type].up, 0);
  return { men, sup, up };
};
E.inSupply = function (state, u) { return u.seat === NEUTRAL || E.inSupplyAt(state, u.seat, u.at); };
E.inSupplyAt = function (state, seat, at) {
  for (const k in state.hexes) { const t = state.hexes[k].town; if (t && t.owner === seat && hdist(k, at) <= 4) return true; }
  // railheads: an unbroken line back to an owned town
  const h = state.hexes[at]; if (!h.rail || h.railBroken) return false;
  const seen = new Set([at]), q = [at];
  while (q.length) { const c = q.shift(); const t = state.hexes[c].town; if (t && t.owner === seat) return true; for (const nb of nbrs(c)) { const x = state.hexes[nb]; if (x && x.rail && !x.railBroken && !seen.has(nb)) { seen.add(nb); q.push(nb); } } }
  return false;
};

/* ---------------- orders ---------------- */
// orders = { units: {id: {k:'move', path:[...]} | {k:'hold'} | {k:'support', unit} (back that unit: add to its attack, or to its defence) | {k:'support', hex, for} (older form: a battle in a hex) | {k:'bombard', hex} | {k:'raid'} | {k:'dig'} | {k:'fortify'} | {k:'bridge', hex} | {k:'repair'} | {k:'merge', into} }, a move may carry detach: n, recruit: [{hex, type}], diplo: {sight:[], passage:[], gift: [{to, men, sup}]} }
E.cleanOrders = function (state, seat, o) {
  const out = { units: {}, recruit: [], diplo: { sight: state.rel.sight[seat].slice(), passage: state.rel.passage[seat].slice(), gift: [], offer: [], accept: [], decline: [], withdraw: [] } };
  if (!o || typeof o !== 'object') { E.applyLocks(state, seat, out.diplo, state.turn + 1); return out; }
  const occ = E.occupancy(state), detaches = [];
  for (const id in (o.units || {})) {
    const u = state.units[id], ord = o.units[id]; if (!u || u.seat !== seat || !ord) continue;
    const k = ord.k;
    if (k === 'move' && Array.isArray(ord.path) && ord.path.length) {
      let cur = u.at, cost = 0; const path = [];
      for (const x of ord.path.slice(0, 12)) { if (typeof x !== 'string' || !state.hexes[x] || hdist(cur, x) !== 1) break; const c = E.stepCost(state, u.type, cur, x, state.weather.fronts); if (!isFinite(c) || cost + c > UNIT[u.type].mp + 1e-9) break; cost += c; path.push(x); cur = x; }
      if (path.length) { out.units[id] = { k: 'move', path }; const det = ord.detach | 0; if (det >= 1 && det < u.str && u.type !== 'gen') detaches.push([id, det]); }
    } else if (k === 'support' && typeof ord.unit === 'string') { const t = state.units[ord.unit]; if (t && t !== u && t.seat !== NEUTRAL && hdist(t.at, u.at) <= (u.type === 'art' ? 2 : 1)) out.units[id] = { k: 'support', unit: t.id }; }
    else if (k === 'support' && state.hexes[ord.hex] && hdist(u.at, ord.hex) <= (u.type === 'art' ? 2 : 1) && hdist(u.at, ord.hex) >= 1 && Number.isInteger(ord.for) && ord.for >= 0 && ord.for < state.n) out.units[id] = { k: 'support', hex: ord.hex, for: ord.for };
    else if (k === 'bombard' && u.type === 'art' && state.hexes[ord.hex] && hdist(u.at, ord.hex) >= 1 && hdist(u.at, ord.hex) <= 2) out.units[id] = { k: 'bombard', hex: ord.hex };
    else if (k === 'raid' && u.type === 'cav') out.units[id] = { k: 'raid' };
    else if ((k === 'dig' || k === 'fortify' || k === 'repair') && u.type === 'eng') out.units[id] = { k };
    else if (k === 'tower' && u.type === 'eng') { const h = state.hexes[u.at]; const planned = Object.values(out.units).filter(x => x.k === 'tower').length; if (!h.town && h.t !== 'water' && !h.tower && E.towersOf(state, seat).length + planned < TOWER.max) out.units[id] = { k: 'tower' }; }
    else if (k === 'bridge' && u.type === 'eng' && state.hexes[ord.hex] && hdist(u.at, ord.hex) === 1 && state.hexes[ord.hex].t === 'water') out.units[id] = { k: 'bridge', hex: ord.hex };
    else if (k === 'merge' && u.type !== 'gen') { const t = state.units[ord.into]; if (t && t !== u && t.seat === seat && t.type === u.type && t.str < 10 && u.str < 10 && hdist(t.at, u.at) === 1) out.units[id] = { k: 'merge', into: t.id }; }
    else if (k === 'hold') out.units[id] = { k: 'hold' };
  }
  const s = state.seats[seat];
  let men = s.men, sup = s.sup, count = Object.values(state.units).filter(u => u.seat === seat && u.type !== 'gen').length; const cap = E.unitCap(state, seat);
  // a detachment left behind is a new unit, so it needs room in the army
  for (const [id, det] of detaches) if (count < cap) { out.units[id].detach = det; count++; }
  const hasGen = Object.values(state.units).some(u => u.seat === seat && u.type === 'gen');
  const used = new Set();
  for (const r of (o.recruit || []).slice(0, 8)) {
    const h = state.hexes[r.hex], T = UNIT[r.type]; if (!h || !h.town || h.town.owner !== seat || !T || used.has(r.hex)) continue;
    if (h.town.kind === 'town' && (r.type === 'art' || r.type === 'eng' || r.type === 'gen')) continue;
    if (r.type === 'gen' && (hasGen || h.town.kind !== 'hq')) continue;
    if (occ[r.hex] && occ[r.hex].seat !== seat) continue;
    if (men < T.men || sup < T.sup || (r.type !== 'gen' && count >= cap)) continue;
    men -= T.men; sup -= T.sup; if (r.type !== 'gen') count++; used.add(r.hex); out.recruit.push({ hex: r.hex, type: r.type });
  }
  const d = o.diplo || {};
  for (let i = 0; i < state.n; i++) if (i !== seat) { if (Array.isArray(d.sight) && typeof d.sight[i] === 'boolean') out.diplo.sight[i] = d.sight[i]; if (Array.isArray(d.passage) && typeof d.passage[i] === 'boolean') out.diplo.passage[i] = d.passage[i]; }
  let gm = men, gs = sup;
  for (const g of (d.gift || []).slice(0, 5)) { const to = g.to | 0, m = clamp(g.men | 0, 0, gm), su = clamp(g.sup | 0, 0, gs); if (to === seat || to < 0 || to >= state.n || (!m && !su)) continue; gm -= m; gs -= su; out.diplo.gift.push({ to, men: m, sup: su }); }
  // binding deals: new offers, and answers to offers already on the table
  const terms = x => ({ men: clamp((x && x.men) | 0, 0, 99), sup: clamp((x && x.sup) | 0, 0, 99), sight: clamp((x && x.sight) | 0, 0, DEAL.maxMonths), passage: clamp((x && x.passage) | 0, 0, DEAL.maxMonths) });
  const empty = t => !t.men && !t.sup && !t.sight && !t.passage;
  for (const f of (Array.isArray(d.offer) ? d.offer : []).slice(0, DEAL.maxOffers)) { const to = f && Number.isInteger(f.to) ? f.to : -1; if (to === seat || to < 0 || to >= state.n || !state.seats[to].alive) continue; const give = terms(f.give), get = terms(f.get); if (empty(give) && empty(get)) continue; out.diplo.offer.push({ to, give, get }); }
  const open = (state.deals || []).filter(x => x.status === 'open');
  for (const f of ['accept', 'decline']) for (const id of (Array.isArray(d[f]) ? d[f] : [])) { const x = open.find(y => y.id === id); if (x && x.to === seat && !out.diplo.accept.includes(id) && !out.diplo.decline.includes(id)) out.diplo[f].push(id); }
  for (const id of (Array.isArray(d.withdraw) ? d.withdraw : [])) { const x = open.find(y => y.id === id); if (x && x.from === seat) out.diplo.withdraw.push(id); }
  E.applyLocks(state, seat, out.diplo, state.turn + 1);
  return out;
};
function dealText(x) { const b = []; if (x.men) b.push(`${x.men} recruit${x.men > 1 ? 's' : ''}`); if (x.sup) b.push(`${x.sup} supply`); if (x.sight) b.push(`scouts' reports for ${x.sight} month${x.sight > 1 ? 's' : ''}`); if (x.passage) b.push(`free passage for ${x.passage} month${x.passage > 1 ? 's' : ''}`); return b.length ? b.join(', ') : 'nothing'; }
E.dealText = dealText;
// terms sealed in a binding deal cannot be withdrawn until they run out
E.lockFor = (state, kind, from, to, turn) => (state.locks || []).find(l => l.kind === kind && l.from === from && l.to === to && l.until >= turn);
E.applyLocks = function (state, seat, diplo, turn) { for (const l of state.locks || []) if (l.from === seat && l.until >= turn && diplo[l.kind]) diplo[l.kind][l.to] = true; };
E.occupancy = function (state) { const o = {}; for (const id in state.units) { const u = state.units[id]; o[u.at] = u; } return o; };

/* ---------------- combat ---------------- */
function power(state, u, role, hexK, extra) {
  const T = UNIT[u.type], h = state.hexes[hexK], era = u.seat === NEUTRAL ? 0 : E.eraOf(state, u.seat);
  let p = (role === 'att' ? T.atk : T.def) * (u.str / 10) * (u.str < 4 ? 0.8 : 1);
  if (role === 'def') {
    p *= h.town ? KIND[h.town.kind].def : h.t === 'water' ? 0.9 : TER[h.t].def;
    p *= 1 + (h.town ? h.town.fort * 0.25 : 0) + (h.ent || 0) * (era >= 3 ? 0.25 : 0.2);
  }
  if (role === 'att' && u.type === 'cav' && era >= 2) p *= 1.25;
  const g = Object.values(state.units).find(v => v.seat === u.seat && v.type === 'gen' && v.id !== u.id && hdist(v.at, u.at) <= 1);
  if (g) p *= 1.15;
  if (role === 'att' && E.weatherAt(state.weather.fronts, u.at) === 'rain') p *= 0.85;
  return p * (extra || 1);
}
function supportPower(state, s, role) { const T = UNIT[s.type]; if (s.type === 'art') return T.bombard * 0.5 * (s.str / 10) * (E.eraOf(state, s.seat) >= 1 ? 1.25 : 1); return (role === 'att' ? T.atk : T.def) * 0.5 * (s.str / 10); }

/* ---------------- the turn ---------------- */
E.resolve = function (state, ordersBySeat) {
  const H = state.hexes, R = () => srand(state), ev = [], log = [], date = E.dateOf(state, state.turn);
  const fronts = state.weather.fronts;
  const say = (text, hexes, seats) => { log.push({ turn: state.turn, text }); };
  const visBefore = state.seats.map(s => E.visibleSet(state, s.seat, fronts));
  const O = {};
  for (let s = 0; s < state.n; s++) O[s] = E.cleanOrders(state, s, (ordersBySeat || {})[s] || (state.seats[s].bot ? E.botOrders(state, s) : null));
  const unitOrder = id => { const u = state.units[id]; if (!u || u.seat === NEUTRAL) return { k: 'hold' }; return (O[u.seat].units[id]) || { k: 'hold' }; };
  // 1. binding deals, then diplomacy changes and gifts
  if (!state.deals) state.deals = []; if (!state.locks) state.locks = []; if (!state.nextDeal) state.nextDeal = 1;
  for (const x of state.deals.filter(x => x.status === 'open')) {
    const by = O[x.from].diplo, them = O[x.to].diplo, A = state.seats[x.from], B = state.seats[x.to];
    if (!A.alive || !B.alive) { x.status = 'void'; continue; }
    if (by.withdraw.includes(x.id)) { x.status = 'withdrawn'; ev.push({ k: 'deal', text: `${nameOf(state, x.from)} withdraws its offer to ${nameOf(state, x.to)}.`, vis: [x.from, x.to] }); continue; }
    if (them.decline.includes(x.id)) { x.status = 'refused'; ev.push({ k: 'deal', text: `${nameOf(state, x.to)} turns down the deal offered by ${nameOf(state, x.from)}.`, vis: [x.from, x.to] }); continue; }
    if (!them.accept.includes(x.id)) { if (state.turn > x.made + 1) { x.status = 'expired'; ev.push({ k: 'deal', text: `The deal ${nameOf(state, x.from)} offered ${nameOf(state, x.to)} lapses unanswered.`, vis: [x.from, x.to] }); } continue; }
    const short = []; if (A.men < x.give.men || A.sup < x.give.sup + DEAL.fee) short.push(nameOf(state, x.from)); if (B.men < x.get.men || B.sup < x.get.sup + DEAL.fee) short.push(nameOf(state, x.to));
    if (short.length) { x.status = 'failed'; ev.push({ k: 'deal', text: `The deal between ${nameOf(state, x.from)} and ${nameOf(state, x.to)} falls through: ${short.join(' and ')} cannot pay. Nobody pays the mediator.`, vis: [x.from, x.to] }); continue; }
    A.men -= x.give.men; A.sup -= x.give.sup + DEAL.fee; B.men += x.give.men; B.sup += x.give.sup;
    B.men -= x.get.men; B.sup -= x.get.sup + DEAL.fee; A.men += x.get.men; A.sup += x.get.sup;
    for (const [from, to, t] of [[x.from, x.to, x.give], [x.to, x.from, x.get]]) for (const kind of ['sight', 'passage']) if (t[kind]) { const until = state.turn + t[kind]; const old = E.lockFor(state, kind, from, to, state.turn); if (old) old.until = Math.max(old.until, until); else state.locks.push({ kind, from, to, until, deal: x.id }); }
    x.status = 'sealed'; x.sealed = state.turn;
    ev.push({ k: 'deal', text: `${nameOf(state, x.from)} and ${nameOf(state, x.to)} seal a binding deal: ${nameOf(state, x.from)} gives ${dealText(x.give)}; ${nameOf(state, x.to)} gives ${dealText(x.get)}. Each pays the mediator ${DEAL.fee} supply.`, vis: [x.from, x.to] });
  }
  for (let s = 0; s < state.n; s++) if (state.seats[s].alive) for (const f of O[s].diplo.offer) {
    const x = { id: 'd' + state.nextDeal++, from: s, to: f.to, give: f.give, get: f.get, made: state.turn, status: 'open' };
    state.deals.push(x);
    ev.push({ k: 'deal', text: `${nameOf(state, s)} offers ${nameOf(state, f.to)} a binding deal: ${dealText(f.give)} for ${dealText(f.get)}. It stands for one month.`, vis: [s, f.to] });
  }
  for (let s = 0; s < state.n; s++) E.applyLocks(state, s, O[s].diplo, state.turn + 1);
  for (let s = 0; s < state.n; s++) {
    if (!state.seats[s].alive) continue;
    const d = O[s].diplo;
    for (let t = 0; t < state.n; t++) if (t !== s) {
      if (state.rel.sight[s][t] !== d.sight[t]) ev.push({ k: 'diplo', text: `${nameOf(state, s)} ${d.sight[t] ? 'now shares its scouts\' reports with' : 'stops sharing scouts\' reports with'} ${nameOf(state, t)}.`, vis: [s, t] });
      if (state.rel.passage[s][t] !== d.passage[t]) ev.push({ k: 'diplo', text: `${nameOf(state, s)} ${d.passage[t] ? 'grants free passage to' : 'withdraws free passage from'} ${nameOf(state, t)}.`, vis: [s, t] });
      state.rel.sight[s][t] = d.sight[t]; state.rel.passage[s][t] = d.passage[t];
    }
    for (const g of d.gift) { const a = state.seats[s], b = state.seats[g.to]; if (!b.alive) continue; const m = Math.min(g.men, a.men), su = Math.min(g.sup, a.sup); a.men -= m; a.sup -= su; b.men += m; b.sup += su; ev.push({ k: 'diplo', text: `${nameOf(state, s)} sends ${m} recruits and ${su} supply to ${nameOf(state, g.to)}.`, vis: [s, g.to] }); }
  }
  // 2. movement, one step at a time for everyone at once
  // detachments: a marching unit leaves some of its men behind where it stands
  const detached = [];
  for (const id of Object.keys(state.units)) { const u = state.units[id], o = unitOrder(id); if (o.k !== 'move' || !o.detach || u.str <= o.detach) continue; const nid = 'u' + state.nextId++; state.units[nid] = { id: nid, seat: u.seat, type: u.type, at: u.at, str: o.detach }; u.str -= o.detach; detached.push([id, nid]); ev.push({ k: 'detach', hex: u.at, seat: u.seat, text: `${uname(state, u)} leaves ${o.detach} behind ${atName(state, u.at)} and marches on.` }); }
  const paths = {};
  for (const id in state.units) { const o = unitOrder(id); if (o.k === 'move') paths[id] = o.path.slice(); }
  const moved = {}, startAt = {}, contact = new Set();
  for (const id in state.units) startAt[id] = state.units[id].at;
  const hostile = (a, b) => !E.relFriendly(state, a.seat, b.seat);
  for (let tick = 0; tick < 12; tick++) {
    const occ = E.occupancy(state);
    let want = {};
    for (const id in paths) { const p = paths[id]; if (p && p.length) want[id] = p[0]; }
    if (!Object.keys(want).length) break;
    let ok = new Set(Object.keys(want)), changed = true;
    // a hostile unit in the way means contact: the march stops here (an attack follows later)
    for (const id of [...ok]) { const o = occ[want[id]]; if (o && hostile(state.units[id], o)) { ok.delete(id); paths[id] = null; contact.add(id); } }
    while (changed) {
      changed = false;
      const into = {};
      for (const id of ok) (into[want[id]] = into[want[id]] || []).push(id);
      for (const hx in into) {
        const L = into[hx];
        if (L.length > 1) {
          const seats = new Set(L.map(i => state.units[i].seat));
          if (seats.size > 1 && L.some(a => L.some(b => hostile(state.units[a], state.units[b])))) { for (const i of L) { ok.delete(i); paths[i] = null; contact.add(i); } ev.push({ k: 'clash', hex: hx, units: L.slice(), vis: null }); changed = true; continue; }
          L.sort((a, b) => (paths[a].length - paths[b].length) || (a < b ? -1 : 1)); for (const i of L.slice(1)) { ok.delete(i); changed = true; }
        }
        const occu = occ[hx];
        if (occu && !(ok.has(occu.id) && want[occu.id] !== occu.at)) {
          // the hex is held by a unit that is not leaving: friends may march through it, but not stop in it
          for (const i of (into[hx] || [])) if (ok.has(i) && (paths[i].length === 1 || !E.relFriendly(state, state.units[i].seat, occu.seat))) { ok.delete(i); changed = true; }
        }
      }
      // head-on swaps
      for (const a of [...ok]) for (const b of [...ok]) if (a < b && want[a] === state.units[b].at && want[b] === state.units[a].at) { ok.delete(a); ok.delete(b); changed = true; if (hostile(state.units[a], state.units[b])) { contact.add(a); contact.add(b); paths[a] = null; paths[b] = null; } }
    }
    for (const id of shuffle(Object.keys(want), R)) {
      const u = state.units[id];
      if (ok.has(id)) {
        (moved[id] = moved[id] || [u.at]).push(want[id]); u.at = want[id]; paths[id].shift();
        // zone of control
        if (paths[id].length) { const occ2 = E.occupancy(state); const adj = nbrs(u.at).some(x => occ2[x] && hostile(u, occ2[x]) && x !== paths[id][paths[id].length - 1]); if (adj) { contact.add(id); paths[id] = [paths[id][paths[id].length - 1]].filter(x => occ2[x] && hostile(u, occ2[x]) && nbrs(u.at).includes(x)); } }
      } else if (paths[id] && !contact.has(id)) paths[id] = null; // blocked by friends: stop
    }
  }
  // nobody ends the march stacked on another unit: the later arrival steps back along its route
  for (let pass = 0; pass < 8; pass++) {
    const at = {}; let fixed = false;
    for (const id in state.units) (at[state.units[id].at] = at[state.units[id].at] || []).push(id);
    for (const hx in at) {
      if (at[hx].length < 2) continue;
      const stay = at[hx].find(id => !moved[id]) || at[hx][Math.floor(R() * at[hx].length)];
      for (const id of at[hx]) { if (id === stay || !moved[id] || moved[id].length < 2) continue; moved[id].pop(); state.units[id].at = moved[id][moved[id].length - 1]; if (moved[id].length < 2) delete moved[id]; fixed = true; }
    }
    if (!fixed) break;
  }
  // a column that could not get away at all takes its detachment back
  for (const [id, nid] of detached) { const u = state.units[id], d = state.units[nid]; if (u && d && u.at === d.at) { u.str += d.str; delete state.units[nid]; ev.push({ k: 'note', hex: u.at, seat: u.seat, text: `${uname(state, u)} cannot get away and keeps its detachment.` }); } }
  for (const id in moved) ev.push({ k: 'move', u: id, seat: state.units[id].seat, type: state.units[id].type, path: moved[id] });
  // heat: long marches cost men
  for (const id in moved) { const u = state.units[id]; if (moved[id].length >= 4 && E.weatherAt(fronts, u.at) === 'heat' && R() < 0.5) { u.str -= 1; ev.push({ k: 'attrition', hex: u.at, u: id, text: `${uname(state, u)} loses men to the heat.` }); } }
  // 3. bombardment (in random order, so no army always fires first)
  for (const id of shuffle(Object.keys(state.units), R)) {
    if (!state.units[id]) continue;
    const u = state.units[id], o = unitOrder(id); if (o.k !== 'bombard' || u.str <= 0) continue;
    if (E.weatherAt(fronts, u.at) === 'fog' || E.weatherAt(fronts, o.hex) === 'fog') { ev.push({ k: 'note', hex: u.at, text: `${uname(state, u)} cannot see to fire in the fog.`, seat: u.seat }); continue; }
    const occ = E.occupancy(state), t = occ[o.hex];
    const h = H[o.hex];
    if (h.ent) h.ent = Math.max(0, h.ent - 1);
    if (h.town && h.town.fort && R() < 0.4) h.town.fort--;
    if (h.tower && h.tower.seat !== u.seat) { ev.push({ k: 'towerdown', hex: o.hex, seat: h.tower.seat, text: `${uname(state, u)} shells the ${nameOf(state, h.tower.seat)} watchtower ${hexName(state, o.hex)} to splinters.` }); delete h.tower; }
    if (!t || t.seat === u.seat) { ev.push({ k: 'bombard', from: u.at, hex: o.hex, dmg: 0 }); continue; }
    const terr = h.town ? KIND[h.town.kind].def : TER[h.t] ? TER[h.t].def : 1;
    const dmg = Math.max(1, Math.round(UNIT.art.bombard * (u.str / 10) * (E.eraOf(state, u.seat) >= 1 ? 1.25 : 1) * (0.35 + R() * 0.4) / terr));
    t.str -= dmg; ev.push({ k: 'bombard', from: u.at, hex: o.hex, dmg, text: `${uname(state, u)} shells ${uname(state, t)} (−${dmg}).` });
    if (t.str <= 0) kill(state, t, u.seat, ev);
  }
  // 4. battles: every march that ended against a hostile unit is an attack; supports join in
  const occ = E.occupancy(state);
  const attacks = {};
  for (const id in state.units) {
    const u = state.units[id], o = unitOrder(id); if (o.k !== 'move' || u.str <= 0) continue;
    const goal = o.path[o.path.length - 1]; if (u.at === goal) continue;
    const t = occ[goal]; if (!t || !hostile(u, t) || hdist(u.at, goal) !== 1) continue;
    (attacks[goal] = attacks[goal] || []).push(id);
  }
  const attackedHexes = new Set(Object.keys(attacks));
  const supports = [];
  for (const id in state.units) {
    const u = state.units[id], o = unitOrder(id); if (o.k !== 'support' || u.str <= 0) continue;
    if (o.unit) supports.push({ id, unit: o.unit, cut: attackedHexes.has(u.at) });
    else if (hdist(u.at, o.hex) <= (u.type === 'art' ? 2 : 1)) supports.push({ id, hex: o.hex, for: o.for, cut: attackedHexes.has(u.at) && !(attacks[u.at] || []).some(a => state.units[a].at === o.hex) });
  }
  for (const s of supports) if (s.cut) ev.push({ k: 'note', hex: state.units[s.id].at, text: `${uname(state, state.units[s.id])} is attacked and cannot give its support.`, seat: state.units[s.id].seat });
  const fought = new Set();
  const battleOrder = shuffle(Object.keys(attacks), R);
  for (const hx of battleOrder) {
    const def = Object.values(state.units).find(v => v.at === hx); if (!def || def.str <= 0) continue;
    // attackers grouped by army: the strongest army goes first
    const bySeat = {};
    for (const id of attacks[hx]) { const a = state.units[id]; if (!a || a.str <= 0 || hdist(a.at, hx) !== 1 || a.seat === def.seat) continue; (bySeat[a.seat] = bySeat[a.seat] || []).push(a); }
    const groups = shuffle(Object.entries(bySeat), R).sort((x, y) => y[1].reduce((t, a) => t + a.str, 0) - x[1].reduce((t, a) => t + a.str, 0));
    for (const [aseat, atts] of groups) {
      const d = Object.values(state.units).find(v => v.at === hx); if (!d || d.str <= 0) break;
      if (!hostile(atts[0], d)) break;
      let A = 0;
      for (const a of atts) { const cross = H[a.at].t === 'water' || H[hx].t === 'water' ? 0.75 : 1; const vsArt = a.type === 'cav' && (d.type === 'art' || d.str < 4) ? 1.4 : 1; A += power(state, a, 'att', hx, cross * vsArt); }
      let D = power(state, d, 'def', hx);
      const sa = [], sd = [];
      for (const s of supports) {
        if (s.cut) continue; const su = state.units[s.id]; if (!su || su.str <= 0) continue;
        if (s.unit) { // backing a unit: it must be close enough where that unit fights
          const tu = state.units[s.unit]; if (!tu) continue; const near = hdist(su.at, tu.at) <= (su.type === 'art' ? 2 : 1);
          if (atts.includes(tu) && su.seat !== d.seat) { if (near) { A += supportPower(state, su, 'att'); sa.push(s.id); } else ev.push({ k: 'note', hex: su.at, seat: su.seat, text: `${uname(state, su)} is too far from the attack it was to back.` }); }
          else if (tu === d && su.seat !== +aseat) { if (near) { D += supportPower(state, su, 'def'); sd.push(s.id); } }
          continue;
        }
        if (s.hex !== hx) continue; if (s.for === +aseat && su.seat !== d.seat) { A += supportPower(state, su, 'att'); sa.push(s.id); } else if (s.for === d.seat && su.seat !== +aseat) { D += supportPower(state, su, 'def'); sd.push(s.id); } }
      const r = A / Math.max(0.1, D);
      const dmgD = Math.max(0, Math.round(clamp(3 * r, 0.5, 8) * (0.8 + R() * 0.4)));
      const dmgA = Math.max(0, Math.round(clamp(2.4 / r, 0, 7) * (0.8 + R() * 0.4)));
      d.str -= dmgD;
      const lead = atts.slice().sort((x, y) => y.str - x.str)[0];
      // the leading regiment takes most of the losses
      let rem = dmgA; for (const a of [lead, ...atts.filter(x => x !== lead)]) { const take = a === lead ? Math.ceil(rem * 0.7) : Math.ceil(rem / atts.length); a.str -= take; rem -= take; if (rem <= 0) break; }
      fought.add(d.id); for (const a of atts) fought.add(a.id);
      const b = { k: 'battle', hex: hx, att: atts.map(a => a.id), def: d.id, aseat: +aseat, dseat: d.seat, A: +A.toFixed(1), D: +D.toFixed(1), dmgA, dmgD, sa, sd, result: '' };
      if (d.str <= 0) { b.result = 'destroyed'; kill(state, d, +aseat, ev); }
      else if (r >= 1.3) {
        const away = nbrs(hx).filter(x => H[x] && isFinite(E.stepCost(state, d.type, hx, x, fronts)) && !Object.values(state.units).some(v => v.at === x) && !atts.some(a => hdist(a.at, x) <= 1)).map(x => [x, -Math.min(...atts.map(a => hdist(a.at, x))) * 10 + (d.seat === NEUTRAL ? 0 : hdist(x, state.seats[d.seat].hq)) + R() * 0.5]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
        if (away.length) { b.result = 'retreat'; b.to = away[0]; d.at = away[0]; if (d.str < 4) d.str -= 1; }
        else { b.result = 'surrounded'; d.str -= 2; if (d.str <= 0) { b.result = 'destroyed'; kill(state, d, +aseat, ev); } }
      } else b.result = 'held';
      for (const a of atts) if (a.str <= 0) kill(state, a, d.seat, ev);
      if (b.result === 'destroyed' || b.result === 'retreat') { const adv = atts.filter(a => a.str > 0 && a.type !== 'art' && a.type !== 'gen').sort((x, y) => y.str - x.str)[0]; if (adv && !Object.values(state.units).some(v => v.at === hx && v.str > 0)) { b.adv = adv.id; b.advFrom = adv.at; adv.at = hx; } }
      b.text = `${uname(state, lead)}${atts.length > 1 ? ` and ${atts.length - 1} more` : ''}${sa.length ? ` (with ${sa.length} in support)` : ''} attack ${uname(state, d)} at ${hexName(state, hx)}: ${b.result === 'held' ? 'the attack is beaten off' : b.result === 'retreat' ? 'the defenders fall back' : b.result === 'surrounded' ? 'the defenders are cut off and badly hurt' : 'the defenders are wiped out'}.`;
      ev.push(b);
    }
  }
  // marches into hexes left empty by the fighting
  for (const id of shuffle(Object.keys(state.units), R)) { const u = state.units[id]; if (!u) continue; const o = unitOrder(id); if (o.k !== 'move' || u.str <= 0) continue; const goal = o.path[o.path.length - 1]; if (u.at !== goal && hdist(u.at, goal) === 1 && !Object.values(state.units).some(v => v.at === goal) && isFinite(E.stepCost(state, u.type, u.at, goal, fronts))) { ev.push({ k: 'move', u: id, seat: u.seat, type: u.type, path: [u.at, goal] }); u.at = goal; } }
  // 5. raids, engineering and digging in
  for (const id in state.units) {
    const u = state.units[id], o = unitOrder(id), h = H[u.at]; if (u.str <= 0) continue;
    if (o.k === 'raid') {
      let did = false;
      if (h.rail && !h.railBroken) { h.railBroken = true; did = true; state.seats[u.seat].stats.raids++; }
      if (h.farm && h.farm.burned <= 0) { const ft = H[h.farm.town]; if (ft && ft.town && ft.town.owner !== u.seat) { h.farm.burned = 3; did = true; } }
      ev.push({ k: 'raid', hex: u.at, u: id, text: did ? `${uname(state, u)} tears up the railway and burns the farms at ${hexName(state, u.at)}.` : `${uname(state, u)} finds nothing to raid.` });
    } else if (o.k === 'merge') {
      const t = state.units[o.into];
      if (t && t.str > 0 && t.seat === u.seat && hdist(t.at, u.at) === 1) { const lost = Math.max(0, t.str + u.str - 10); t.str = Math.min(10, t.str + u.str); fought.add(t.id); delete state.units[id]; ev.push({ k: 'merge', hex: t.at, seat: t.seat, text: `${uname(state, t)} ${atName(state, t.at)} takes in the men from ${atName(state, u.at)} (now ${t.str})${lost ? `; ${lost} more than it can hold go home` : ''}.` }); }
      else ev.push({ k: 'note', hex: u.at, seat: u.seat, text: `${uname(state, u)} could not reach the unit it was to join.` });
    } else if (o.k === 'dig') { const max = E.eraOf(state, u.seat) >= 3 ? 3 : 2; if ((h.ent || 0) < max) { h.ent = (h.ent || 0) + 1; ev.push({ k: 'dig', hex: u.at, text: `${uname(state, u)} digs earthworks (${h.ent}).` }); } }
    else if (o.k === 'fortify' && h.town && h.town.owner === u.seat && h.town.fort < 3 && state.seats[u.seat].sup >= 2) { state.seats[u.seat].sup -= 2; h.town.fort++; ev.push({ k: 'dig', hex: u.at, text: `${uname(state, u)} fortifies ${h.town.name} (level ${h.town.fort}).` }); }
    else if (o.k === 'bridge' && state.seats[u.seat].sup >= 3) { const b = H[o.hex]; if (b && b.t === 'water' && !b.bridge) { state.seats[u.seat].sup -= 3; b.bridge = true; ev.push({ k: 'dig', hex: o.hex, text: `${uname(state, u)} throws a bridge across the river.` }); } }
    else if (o.k === 'tower' && !h.town && h.t !== 'water' && !h.tower && E.towersOf(state, u.seat).length < TOWER.max && state.seats[u.seat].sup >= TOWER.cost) { state.seats[u.seat].sup -= TOWER.cost; h.tower = { seat: u.seat, built: state.turn }; ev.push({ k: 'tower', hex: u.at, seat: u.seat, text: `${uname(state, u)} raise a watchtower ${hexName(state, u.at)}.` }); }
    else if (o.k === 'repair') { for (const x of [u.at, ...nbrs(u.at)]) if (H[x] && H[x].railBroken) H[x].railBroken = false; ev.push({ k: 'dig', hex: u.at, text: `${uname(state, u)} repairs the railway.` }); }
    else if (o.k === 'hold' && u.type === 'inf' && !moved[id] && (h.ent || 0) < 1 && !h.town) { h.ent = 1; }
  }
  // 6. watchtowers are burned by any other army ending its month on them (unless the owner grants it free passage), and towns change hands
  for (const id in state.units) { const u = state.units[id], h = H[u.at]; if (!h.tower || u.seat === NEUTRAL || u.seat === h.tower.seat || state.rel.passage[h.tower.seat][u.seat]) continue; ev.push({ k: 'towerdown', hex: u.at, seat: h.tower.seat, text: `${uname(state, u)} burn${u.type === 'inf' || u.type === 'eng' ? '' : 's'} the ${nameOf(state, h.tower.seat)} watchtower ${hexName(state, u.at)}.` }); delete h.tower; }
  for (const id in state.units) {
    const u = state.units[id], h = H[u.at]; if (!h.town || u.seat === NEUTRAL || u.type === 'gen' || h.town.owner === u.seat) continue;
    const prev = h.town.owner; h.town.owner = u.seat;
    if (prev !== NEUTRAL && h.town.kind === 'hq' && state.seats[prev] && state.seats[prev].hq === u.at) state.seats[prev].stats.hqLost = true;
    ev.push({ k: 'capture', hex: u.at, seat: u.seat, from: prev, text: `${nameOf(state, u.seat)} take${h.town.kind === 'city' ? 's the Capital,' : 's'} ${h.town.name}${prev === NEUTRAL ? '' : ' from ' + nameOf(state, prev)}.` });
  }
  // 7. supply, income and recruits
  for (const k in H) if (H[k].farm && H[k].farm.burned > 0) H[k].farm.burned--;
  for (const s of state.seats) {
    if (!s.alive) continue;
    const { men, sup, up } = E.incomeOf(state, s.seat);
    const mine = Object.values(state.units).filter(u => u.seat === s.seat);
    s.men += men; s.sup += sup - up;
    s.income = { men, sup, up };
    if (s.sup < 0) { s.sup = 0; for (const u of mine) u.str -= 1; ev.push({ k: 'note', text: `${s.name || COLORS[s.seat].name} cannot feed its army: every unit loses men.`, seat: s.seat }); }
    for (const u of mine) {
      const w = E.weatherAt(fronts, u.at);
      if (!E.inSupply(state, u)) { u.str -= w === 'snow' ? 2 : 1; ev.push({ k: 'attrition', hex: u.at, u: u.id, text: `${uname(state, u)} is out of supply${w === 'snow' ? ' in the snow' : ''} and loses men.` }); }
      else if (u.str < 10 && !fought.has(u.id)) { const inTown = H[u.at].town && H[u.at].town.owner === s.seat, cost = inTown ? 1 : 2; if (s.sup >= cost && (inTown || !moved[u.id])) { u.str += 1; s.sup -= cost; } }
    }
  }
  for (const id in state.units) if (state.units[id].str <= 0) kill(state, state.units[id], null, ev);
  for (let s = 0; s < state.n; s++) {
    if (!state.seats[s].alive) continue;
    for (const r of O[s].recruit) {
      const h = H[r.hex], T = UNIT[r.type], st = state.seats[s];
      if (!h.town || h.town.owner !== s || Object.values(state.units).some(v => v.at === r.hex) || st.men < T.men || st.sup < T.sup) continue;
      st.men -= T.men; st.sup -= T.sup; const id = 'u' + state.nextId++; state.units[id] = { id, seat: s, type: r.type, at: r.hex, str: r.type === 'gen' ? 10 : 8 };
      ev.push({ k: 'recruit', hex: r.hex, seat: s, type: r.type, text: `${nameOf(state, s)} raise new ${UNIT[r.type].name.toLowerCase()} at ${h.town.name}.` });
    }
  }
  // 8. eliminations
  for (const s of state.seats) {
    if (!s.alive) continue;
    if (E.townCount(state, s.seat) === 0) { s.alive = false; for (const k in H) if (H[k].tower && H[k].tower.seat === s.seat) delete H[k].tower; state.locks = (state.locks || []).filter(l => l.from !== s.seat && l.to !== s.seat); for (const u of Object.values(state.units)) if (u.seat === s.seat) { u.seat = NEUTRAL; if (u.type === 'gen') delete state.units[u.id]; } ev.push({ k: 'out', seat: s.seat, text: `${nameOf(state, s.seat)} has lost every town and is out of the war. Its remaining regiments go their own way.` }); }
  }
  // 9. the capital, the calendar, eras and the end of the war
  const cap = H[state.center].town.owner;
  if (cap !== NEUTRAL && cap === state.capitalHold.seat) state.capitalHold.count++; else state.capitalHold = { seat: cap === NEUTRAL ? null : cap, count: cap === NEUTRAL ? 0 : 1 };
  const eraBefore = Math.min(3, Math.floor((state.turn - 1) / state.eraTurns));
  state.turn++;
  const eraAfter = Math.min(3, Math.floor((state.turn - 1) / state.eraTurns));
  if (eraAfter > eraBefore) ev.push({ k: 'era', text: `${ERAS[eraAfter].year}: ${ERAS[eraAfter].name}. ${ERAS[eraAfter].text}` });
  advanceWeather(state, false); makeForecast(state);
  const alive = state.seats.filter(s => s.alive);
  let winner = null, why = '';
  if (state.mode === 'capital' && state.capitalHold.seat !== null && state.capitalHold.count >= 4) { winner = state.capitalHold.seat; why = `${nameOf(state, winner)} held the Capital for four months.`; }
  if (state.mode === 'conquest' && alive.length === 1) { winner = alive[0].seat; why = `${nameOf(state, winner)} is the last army standing.`; }
  if (alive.length === 1 && winner === null) { winner = alive[0].seat; why = 'Every other army has been destroyed.'; }
  if (state.mode === 'points' && winner === null) { const all = Object.values(H).filter(h => h.town).length; for (const s of alive) if (E.townCount(state, s.seat) >= Math.ceil(all * 0.55)) { winner = s.seat; why = `${nameOf(state, s.seat)} controls more than half the country.`; } }
  if (winner === null && state.turn > state.turnLimit) why = 'The war ends in exhaustion. Victory goes to the strongest position.';
  if (winner !== null || state.turn > state.turnLimit) {
    const scores = state.seats.map(s => ({ seat: s.seat, ...E.score(state, s.seat, true) }));
    if (winner === null) winner = scores.filter(x => state.seats[x.seat].alive).sort((a, b) => b.vp - a.vp)[0].seat;
    state.over = { winner, why, scores, goals: state.seats.map(s => ({ seat: s.seat, goal: s.goal, met: E.goalMet(state, s.seat) })) };
    ev.push({ k: 'end', text: why });
  }
  // who saw what
  const fronts2 = state.weather.fronts;
  const visAfter = state.seats.map(s => E.visibleSet(state, s.seat, fronts2));
  // watchtowers send word when troops come into view that were not seen last month
  for (const s of state.seats) {
    if (!s.alive) continue; let told = 0;
    const towers = E.towersOf(state, s.seat); if (!towers.length) continue;
    for (const id in state.units) {
      const u = state.units[id]; if (u.seat === s.seat || u.seat === NEUTRAL || state.rel.sight[u.seat][s.seat] || told >= 6) continue;
      const tw = towers.find(k => hdist(k, u.at) <= E.towerSight(state, k, fronts2)); if (!tw || !E.canSeeUnit(state, s.seat, u, visAfter[s.seat])) continue;
      if (startAt[id] && visBefore[s.seat].has(startAt[id])) continue;
      told++; ev.push({ k: 'sighting', hex: u.at, seat: s.seat, vis: [s.seat], text: `From the watchtower ${hexName(state, tw)}: ${nameOf(state, u.seat)} ${UNIT[u.type].name.toLowerCase()} seen ${hexName(state, u.at)}.` });
    }
  }
  // locks that have run out
  state.locks = (state.locks || []).filter(l => l.until >= state.turn);
  for (const e of ev) {
    if (e.vis !== undefined && e.vis !== null) continue;
    const hx = [e.hex, e.from, e.to, e.advFrom, ...(e.path || [])].filter(Boolean);
    if (!hx.length && e.k === 'note' && e.seat !== undefined) { e.vis = [e.seat]; continue; } // private news, e.g. your own army going hungry
    if (!hx.length || e.k === 'era' || e.k === 'end' || e.k === 'out' || e.k === 'capture') { e.vis = state.seats.map(s => s.seat); continue; }
    e.vis = state.seats.filter(s => (e.seat === s.seat) || hx.some(x => visBefore[s.seat].has(x) || visAfter[s.seat].has(x))).map(s => s.seat);
  }
  state.lastEvents = ev;
  for (const e of ev) if (e.text) log.push({ turn: state.turn - 1, text: e.text, vis: e.vis });
  state.log = state.log.concat(log.map(l => ({ ...l, vis: l.vis || state.seats.map(s => s.seat) }))).slice(-400);
  for (const s of state.seats) s.submitted = false;
  state.orders = {};
  return ev;
};
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function kill(state, u, by, ev) {
  if (!state.units[u.id]) return;
  delete state.units[u.id];
  if (by !== null && by !== undefined && by !== NEUTRAL && state.seats[by] && u.seat !== by) state.seats[by].stats.kills++;
  ev.push({ k: 'destroyed', hex: u.at, u: u.id, seat: u.seat, type: u.type, text: `${uname(state, u)} is destroyed.` });
}
function nameOf(state, s) { if (s === NEUTRAL || s === null || s === undefined) return 'Local militia'; const st = state.seats[s]; return st.name || `the ${COLORS[s].name} army`; }
function uname(state, u) { return `${u.seat === NEUTRAL ? 'Militia' : (state.seats[u.seat].name || COLORS[u.seat].name)} ${UNIT[u.type].name.toLowerCase()}`; }
function atName(state, k) { return state.hexes[k].town ? 'at ' + state.hexes[k].town.name : hexName(state, k); }
function hexName(state, k) { const h = state.hexes[k]; if (h.town) return h.town.name; const near = Object.keys(state.hexes).filter(x => state.hexes[x].town).sort((a, b) => hdist(a, k) - hdist(b, k))[0]; return `near ${state.hexes[near].town.name}`; }
E.nameOf = nameOf; E.uname = uname; E.hexName = hexName;

/* ---------------- the computer generals ---------------- */
E.botOrders = function (state, seat) {
  const H = state.hexes, s = state.seats[seat], R = rng((state.seed + state.turn * 7919 + seat * 104729) >>> 0);
  const units = Object.values(state.units).filter(u => u.seat === seat);
  const occ = E.occupancy(state), fronts = state.weather.fronts;
  // computer generals share nothing of their own accord; whatever they sold in a deal stays on until it runs out
  const out = { units: {}, recruit: [], diplo: { sight: state.seats.map(() => false), passage: state.seats.map(() => false), gift: [], offer: [], accept: [], decline: [], withdraw: [] } };
  // binding deals offered to us: take the ones that pay, after the mediator's fee and a little caution
  for (const x of (state.deals || []).filter(x => x.status === 'open' && x.to === seat)) {
    const gain = x.give.men * 1.2 + x.give.sup + x.give.sight * 0.4 + x.give.passage * 0.3;
    const cost = x.get.men * 1.3 + x.get.sup + x.get.sight * 0.5 + x.get.passage * 1.5 + DEAL.fee;
    const afford = s.men >= x.get.men && s.sup >= x.get.sup + DEAL.fee + 3;
    out.diplo[gain - cost >= 0.5 && afford ? 'accept' : 'decline'].push(x.id);
  }
  const myTowns = Object.keys(H).filter(k => H[k].town && H[k].town.owner === seat);
  const myTowers = E.towersOf(state, seat); let towersPlanned = 0;
  const enemyTowers = Object.keys(H).filter(k => H[k].tower && H[k].tower.seat !== seat && !state.rel.passage[H[k].tower.seat][seat] && !occ[k]);
  const targets = Object.keys(H).filter(k => H[k].town && H[k].town.owner !== seat);
  const claimed = new Set();
  const enemies = Object.values(state.units).filter(u => u.seat !== seat);
  const threat = k => enemies.filter(e => hdist(e.at, k) <= 2).reduce((t, e) => t + e.str * UNIT[e.type].atk, 0);
  const hq = s.hq;
  // keep a garrison at headquarters if enemies are close
  const hqThreat = threat(hq);
  for (const u of units.map(u => [u, hdist(u.at, hq) + R() * 0.5]).sort((a, b) => a[1] - b[1]).map(x => x[0])) {
    if (u.type === 'gen') continue;
    const rc = E.reach(state, u, occ, fronts, R);
    // artillery shells the nearest enemy in range
    if (u.type === 'art') {
      const t = enemies.filter(e => hdist(e.at, u.at) <= 2 && hdist(e.at, u.at) >= 1).sort((a, b) => a.str - b.str + (R() - 0.5) * 0.1)[0];
      if (t) { out.units[u.id] = { k: 'bombard', hex: t.at }; continue; }
    }
    // a weak enemy next door is worth attacking
    const adjE = enemies.filter(e => hdist(e.at, u.at) === 1 && isFinite(E.stepCost(state, u.type, u.at, e.at, fronts)));
    const best = adjE.map(e => ({ e, r: power(state, u, 'att', e.at) / power(state, e, 'def', e.at) + R() * 0.01 })).sort((a, b) => b.r - a.r)[0];
    if (best && (best.r > 0.9 || (best.e.seat === NEUTRAL && best.r > 0.6)) && u.type !== 'eng' && u.str >= 4) { out.units[u.id] = { k: 'move', path: [best.e.at] }; claimed.add(best.e.at); continue; }
    if (u.at === hq && hqThreat > 10 && u.type === 'inf') { out.units[u.id] = { k: 'hold' }; continue; }
    if (u.str <= 3 && myTowns.length) { const home = myTowns.map(t => [t, hdist(t, u.at) + R() * 0.5]).sort((a, b) => a[1] - b[1])[0][0]; const p = E.pathTo(rc, u.at, nearestReach(rc, home)); if (p && p.length) { out.units[u.id] = { k: 'move', path: p }; continue; } }
    if (u.type === 'eng') { if (H[u.at].town && H[u.at].town.owner === seat && H[u.at].town.fort < 2 && s.sup > 8) { out.units[u.id] = { k: 'fortify' }; continue; } if (H[u.at].railBroken || nbrs(u.at).some(x => H[x] && H[x].railBroken)) { out.units[u.id] = { k: 'repair' }; continue; } }
    if (u.type === 'eng' && !H[u.at].town && H[u.at].t !== 'water' && !H[u.at].tower && myTowers.length + towersPlanned < 2 && s.sup >= 10 && hdist(u.at, hq) >= 2 && hdist(u.at, hq) <= 6 && !myTowers.some(k => hdist(k, u.at) < 5) && (H[u.at].t === 'hills' || R() < 0.3)) { out.units[u.id] = { k: 'tower' }; towersPlanned++; continue; }
    // cavalry ride out to burn an enemy watchtower within reach
    if (u.type === 'cav') { const tw = enemyTowers.filter(k => rc.best[k] !== undefined && !claimed.has(k)).sort((a, b) => rc.best[a] - rc.best[b])[0]; if (tw && R() < 0.7) { const p = E.pathTo(rc, u.at, tw); if (p && p.length) { out.units[u.id] = { k: 'move', path: p }; claimed.add(tw); continue; } } }
    if (u.type === 'cav' && H[u.at].rail && !H[u.at].railBroken && !myTowns.includes(nearestTown(state, u.at))) { out.units[u.id] = { k: 'raid' }; continue; }
    // otherwise march on the nearest town that is not ours
    const jit = {}; for (const t of targets) jit[t] = R() * 0.5;
    const sc = t => hdist(t, u.at) + (H[t].town.kind === 'city' ? -2 : 0) + (occ[t] && occ[t].str > u.str ? 3 : 0) + jit[t];
    const goal = targets.filter(t => !claimed.has(t)).sort((a, b) => sc(a) - sc(b))[0];
    if (goal) {
      claimed.add(goal);
      const dest = nearestReach(rc, goal, false, R);
      if (dest && dest !== u.at) { const p = E.pathTo(rc, u.at, dest); if (p && p.length) { const last = p[p.length - 1]; if (occ[last] && E.relFriendly(state, seat, occ[last].seat)) p.pop(); if (p.length) { out.units[u.id] = { k: 'move', path: p }; continue; } } }
    }
    out.units[u.id] = { k: u.type === 'eng' && !H[u.at].town ? 'dig' : 'hold' };
  }
  // the general rides with the biggest group
  const g = units.find(u => u.type === 'gen');
  if (g) { const others = units.filter(u => u.type !== 'gen'); if (others.length) { const c = others.sort((a, b) => hdist(a.at, g.at) - hdist(b.at, g.at))[Math.floor(others.length / 2)]; const rc = E.reach(state, g, occ, fronts, R); const dest = nearestReach(rc, c.at, true); const p = dest && E.pathTo(rc, g.at, dest); if (p && p.length) out.units[g.id] = { k: 'move', path: p }; } }
  // supports: idle units next to an attacked hex help
  for (const u of units) { if (out.units[u.id] && out.units[u.id].k !== 'hold') continue; const atk = Object.entries(out.units).find(([aid, o]) => aid !== u.id && o.k === 'move' && o.path.length === 1 && occ[o.path[0]] && occ[o.path[0]].seat !== seat && hdist(state.units[aid].at, u.at) <= (u.type === 'art' ? 2 : 1)); if (atk) out.units[u.id] = { k: 'support', unit: atk[0] }; }
  // recruitment
  const count = units.filter(u => u.type !== 'gen').length, cap = E.unitCap(state, seat);
  let men = s.men, sup = s.sup, n = count;
  // headquarters first, then the towns nearest the front (the Capital), with a little chance mixed in
  const rq = {}; for (const t of myTowns) rq[t] = (H[t].town.kind === 'hq' ? -100 : 0) + hdist(t, state.center) + R() * 0.9;
  for (const t of myTowns.slice().sort((a, b) => rq[a] - rq[b])) {
    if (occ[t] || n >= cap) continue;
    const kind = H[t].town.kind;
    const want = !g && kind === 'hq' ? 'gen' : (R() < 0.18 && kind !== 'town' ? 'art' : R() < 0.25 ? 'cav' : 'inf');
    const T = UNIT[want]; if (men >= T.men && sup >= T.sup + 3) { out.recruit.push({ hex: t, type: want }); men -= T.men; sup -= T.sup; if (want !== 'gen') n++; }
  }
  return out;
};
function nearestReach(rc, goal, allowOcc, R) { let best = null, bd = 1e9; for (const k in rc.best) { const d = hdist(k, goal) * 10 + rc.best[k] + (R ? R() * 0.3 : 0); if (d < bd) { bd = d; best = k; } } return best; }
function nearestTown(state, k) { let best = null, bd = 1e9; for (const x in state.hexes) if (state.hexes[x].town) { const d = hdist(x, k) + hdist(x, state.center) * 0.01; if (d < bd) { bd = d; best = x; } } return best; }

if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
