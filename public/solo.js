/* The Long Campaign — solo war in the browser against computer generals.
   Designed and built by Claude (Anthropic) with Dave. */
(function () {
  const E = window.Engine, KEY = 'tlc-solo-v1';
  let state = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } };
  const load = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const view = () => { const v = E.view(state, 0); v.deadline = null; v.status = state.over ? 'over' : 'active'; v.submittedSeats = state.seats.map(s => s.bot); return v; };
  function setup(onDone) {
    const prev = load();
    const pick = { seats: 4, mapSize: 'normal', terrain: 'normal', mode: 'points', turnLimit: 30 };
    const wrap = document.createElement('div'); wrap.className = 'modalwrap'; wrap.id = 'modal';
    const box = document.createElement('div'); box.className = 'modal'; wrap.append(box);
    const seg = (label, k, opts) => { const row = document.createElement('div'); row.className = 'field'; row.innerHTML = `<span>${label}</span>`; const s = document.createElement('div'); s.className = 'seg'; const draw = () => { s.innerHTML = ''; for (const [v, t] of opts) { const b = document.createElement('button'); b.textContent = t; if (pick[k] === v) b.className = 'on'; b.onclick = () => { pick[k] = v; draw(); }; s.append(b); } }; draw(); row.append(s); return row; };
    box.innerHTML = `<h3>The Long Campaign</h3><p>A Civil War campaign against computer generals. Every month you give secret orders; then everyone moves at once.</p>`;
    const name = document.createElement('input'); name.placeholder = 'Name your army, e.g. Army of the Potomac'; name.maxLength = 32;
    box.append(name, seg('Armies', 'seats', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]), seg('Map', 'mapSize', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']]), seg('Woods & hills', 'terrain', [['light', 'Light'], ['normal', 'Normal'], ['heavy', 'Heavy']]), seg('Victory', 'mode', [['points', 'Points'], ['capital', 'Capital'], ['conquest', 'Conquest']]), seg('Length', 'turnLimit', [[20, '20 months'], [30, '30'], [40, '40']]));
    const go = document.createElement('button'); go.className = 'primary'; go.textContent = 'Declare war';
    go.onclick = () => { state = E.newGame({ seats: pick.seats, humans: 1, mapSize: pick.mapSize, terrain: pick.terrain, mode: pick.mode, turnLimit: pick.turnLimit, name: 'The Long Campaign' }); state.seats[0].name = name.value.trim() || 'Army of the Potomac'; state.seats[0].joined = true; save(); wrap.remove(); onDone(); };
    box.append(go);
    if (prev && !prev.over) { const cont = document.createElement('button'); cont.className = 'ghost'; cont.style.marginTop = '8px'; cont.style.width = '100%'; cont.textContent = `Continue the war (${E.dateOf(prev, prev.turn).label})`; cont.onclick = () => { state = prev; wrap.remove(); onDone(); }; box.append(cont); }
    box.append(Object.assign(document.createElement('p'), { className: 'small', textContent: 'Designed and built by Claude (Anthropic) with Dave. The online version lets two to six friends play together, a turn or two a day.' }));
    document.body.append(wrap);
  }
  window.TLC_solo = function () {
    setup(() => {
      TLC.boot({
        load: async () => view(),
        join: async () => { },
        submit: async (orders) => { const o = { 0: E.cleanOrders(state, 0, orders) }; E.resolve(state, o); save(); return view(); }
      });
      const b = document.createElement('button'); b.textContent = 'New war'; b.style.cssText = 'position:absolute;left:10px;top:30px;z-index:2;padding:4px 9px;font-size:13px'; b.onclick = () => { if (confirm('Abandon this war and start a new one?')) { try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); } };
      document.getElementById('mapwrap').append(b);
    });
  };
})();
