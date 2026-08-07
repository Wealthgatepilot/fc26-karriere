/* FC 26 Karriere-Helfer – Vanilla-JS, State im localStorage.
   fcdata.js (1,5 MB) wird bewusst NICHT im HTML eingebunden, sondern erst
   nachgeladen, wenn er gebraucht wird – so ist die App sofort bedienbar. */
(function () {
  'use strict';

  // ===================== Storage =====================
  const KEYS = {
    squad:    'fc_squad',
    youth:    'fc_youth',
    settings: 'fc_settings',
  };

  const state = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function load() {
    for (const k in KEYS) {
      const raw = localStorage.getItem(KEYS[k]);
      if (raw) { try { state[k] = JSON.parse(raw); continue; } catch (e) { /* fällt durch */ } }
      state[k] = clone(DEFAULT_DATA[k]);
      save(k);
    }
    ensureStructure();
  }
  const save = k => localStorage.setItem(KEYS[k], JSON.stringify(state[k]));
  const saveAll = () => { for (const k in KEYS) save(k); };

  function ensureStructure() {
    if (!state.squad || typeof state.squad !== 'object') state.squad = clone(DEFAULT_DATA.squad);
    if (!FORMATIONS[state.squad.formation]) state.squad.formation = '4-3-3';
    if (!Array.isArray(state.squad.players)) state.squad.players = [];
    if (!state.squad.lineup || typeof state.squad.lineup !== 'object') state.squad.lineup = {};
    if (!Array.isArray(state.youth)) state.youth = [];
    state.youth.forEach(y => { if (!Array.isArray(y.seasons)) y.seasons = []; });
    if (!state.settings || typeof state.settings !== 'object') state.settings = clone(DEFAULT_DATA.settings);
  }

  // ===================== Helfer =====================
  const $ = sel => document.querySelector(sel);
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Akzentunempfindlich: "mbappe" soll Mbappé finden
  const norm = s => (s == null ? '' : String(s))
    .toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function fmtMoney(v) {
    if (!v) return '–';
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' Mio. €';
    if (v >= 1e3) return Math.round(v / 1e3) + ' Tsd. €';
    return v + ' €';
  }
  const ratClass = v => v >= 90 ? 'rat-90' : v >= 80 ? 'rat-80' : v >= 70 ? 'rat-70' : 'rat-lo';
  const debounce = (fn, ms) => { let t; return function () { clearTimeout(t); t = setTimeout(() => fn.apply(null, arguments), ms); }; };

  // ===================== Datenbank nachladen =====================
  const DB = { ready: false, loading: false, failed: false, index: null };
  const dbWaiting = [];

  function loadDb(cb) {
    if (DB.ready) { if (cb) cb(); return; }
    if (cb) dbWaiting.push(cb);
    if (DB.loading || DB.failed) return;
    DB.loading = true;
    setStatus('Datenbank lädt …', '');
    const s = document.createElement('script');
    s.src = 'fcdata.js';
    s.onload = () => {
      DB.loading = false;
      if (typeof FC_PLAYERS === 'undefined') { dbError(); return; }
      buildIndex();
      DB.ready = true;
      setStatus(FC_PLAYERS.length.toLocaleString('de-DE') + ' Spieler · ' + (FC_META ? FC_META.stand : ''), 'ready');
      fillClubList();
      fillFilterSelects();
      while (dbWaiting.length) dbWaiting.shift()();
    };
    s.onerror = dbError;
    document.head.appendChild(s);
  }
  function dbError() {
    DB.loading = false; DB.failed = true;
    setStatus('Datenbank nicht geladen', 'error');
    dbWaiting.length = 0;
  }
  function setStatus(txt, cls) {
    const el = $('#dbStatus');
    el.textContent = txt;
    el.className = 'db-status' + (cls ? ' ' + cls : '');
  }
  function buildIndex() {
    DB.index = new Array(FC_PLAYERS.length);
    for (let i = 0; i < FC_PLAYERS.length; i++) {
      const p = FC_PLAYERS[i];
      DB.index[i] = norm(p[1] ? p[0] + ' ' + p[1] : p[0]);
    }
  }

  // Feldzugriffe auf einen DB-Spieler (Array-Format, siehe Kopf von fcdata.js)
  const F = { SHORT: 0, LONG: 1, POS: 2, OVR: 3, POT: 4, AGE: 5, CLUB: 6, LEAGUE: 7, NAT: 8, VALUE: 9, WAGE: 10, FOOT: 11, WEAK: 12, SKILLS: 13, REP: 14 };
  const pPos    = i => FC_PLAYERS[i][F.POS].map(x => FC_POS[x]);
  const pClub   = i => FC_PLAYERS[i][F.CLUB]   >= 0 ? FC_CLUBS[FC_PLAYERS[i][F.CLUB]]         : 'vereinslos';
  const pLeague = i => FC_PLAYERS[i][F.LEAGUE] >= 0 ? FC_LEAGUES[FC_PLAYERS[i][F.LEAGUE]][0]  : '–';
  const pNation = i => FC_PLAYERS[i][F.NAT]    >= 0 ? FC_NATIONS[FC_PLAYERS[i][F.NAT]]        : '–';

  // ===================== Potenzial-Einordnung =====================
  function tierFor(pot) {
    for (const t of POTENTIAL_TIERS) if (pot >= t.min && pot <= t.max) return t;
    return POTENTIAL_TIERS[POTENTIAL_TIERS.length - 1];
  }
  // "90+" / "unter 80" statt "90–99" / "0–79"
  function rangeLabel(t) {
    if (t.min <= 0) return 'unter ' + (t.max + 1);
    if (t.max >= 99) return t.min + '+';
    return t.min + '–' + t.max;
  }
  // Liegt der Wert auf einer der unsicheren Grenzen?
  function tierGrenzfall(pot) {
    return POTENTIAL_TIERS.some(t => t.unsicher && (pot === t.min || pot === t.max));
  }

  // ===================== Spielerkarte (gemeinsame Darstellung) =====================
  function cardHtml(i, action) {
    const p = FC_PLAYERS[i], ovr = p[F.OVR], pot = p[F.POT], wachs = pot - ovr;
    return '<li><button class="p-card" data-action="' + (action || 'open-player') + '" data-i="' + i + '">' +
      '<div class="p-main">' +
        '<div class="p-name">' + esc(p[F.SHORT]) + '</div>' +
        '<div class="p-meta">' + pPos(i).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
          ' ' + p[F.AGE] + ' J. · ' + esc(pClub(i)) + '</div>' +
      '</div>' +
      '<div class="p-rat-wrap"><div class="p-rat">' +
        '<span class="p-ovr ' + ratClass(ovr) + '">' + ovr + '</span>' +
        '<span class="p-arrow">→</span>' +
        '<span class="p-pot">' + pot + '</span>' +
      '</div>' +
      (wachs > 0 ? '<span class="p-growth">+' + wachs + ' möglich</span>' : '') +
      '</div></button></li>';
  }

  function renderList(ul, list, shown, action) {
    ul.innerHTML = list.slice(0, shown).map(i => cardHtml(i, action)).join('') ||
      '<li class="hint">Keine Treffer.</li>';
  }

  // Namenssuche über den Suchindex – von mehreren Stellen genutzt
  function findPlayers(q) {
    const hits = [];
    for (let i = 0; i < DB.index.length; i++) {
      const s = DB.index[i];
      const pos = s.indexOf(q);
      if (pos < 0) continue;
      // Treffer am Wortanfang zuerst, danach nach Overall
      const rang = pos === 0 ? 0 : (s[pos - 1] === ' ' ? 1 : 2);
      hits.push([rang, -FC_PLAYERS[i][F.OVR], i]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return hits.map(h => h[2]);
  }

  // ===================== Tab: Suche =====================
  let searchHits = [], searchShown = 0;
  const PAGE = 40;

  function runSearch() {
    const q = norm($('#playerSearch').value);
    const info = $('#searchInfo'), ul = $('#searchResults');
    if (q.length < 2) {
      searchHits = []; searchShown = 0;
      ul.innerHTML = ''; $('#searchMore').hidden = true;
      info.textContent = DB.ready ? 'Mindestens 2 Zeichen eingeben.' : '';
      $('#dlPlayers').innerHTML = '';
      return;
    }
    if (!DB.ready) { info.textContent = 'Datenbank lädt …'; loadDb(runSearch); return; }

    searchHits = findPlayers(q);
    searchShown = Math.min(PAGE, searchHits.length);

    info.textContent = searchHits.length
      ? searchHits.length.toLocaleString('de-DE') + ' Treffer'
      : 'Keine Treffer – anderen Namensteil probieren.';
    renderList(ul, searchHits, searchShown);
    $('#searchMore').hidden = searchShown >= searchHits.length;

    // Namenserkennung: Vorschlagsliste mit den besten Treffern füttern
    $('#dlPlayers').innerHTML = searchHits.slice(0, 12)
      .map(i => '<option value="' + esc(FC_PLAYERS[i][F.SHORT]) + '">').join('');
  }

  // ===================== Tab: Datenbank =====================
  let dbHits = [], dbShown = 0;

  function filterValues() {
    const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
    return {
      pos:   $('#fPos').value,
      ageMin: num('#fAgeMin'), ageMax: num('#fAgeMax'),
      ovrMin: num('#fOvrMin'), ovrMax: num('#fOvrMax'),
      potMin: num('#fPotMin'), potMax: num('#fPotMax'),
      league: $('#fLeague').value,
      nation: $('#fNation').value,
      club:   norm($('#fClub').value),
      foot:   $('#fFoot').value,
      weak:   num('#fWeak'), skills: num('#fSkills'),
      valMax: num('#fValMax'), wageMax: num('#fWageMax'),
      sort:   $('#fSort').value
    };
  }

  function runDbFilter() {
    if (!DB.ready) { $('#dbInfo').textContent = 'Datenbank lädt …'; loadDb(runDbFilter); return; }
    const f = filterValues();
    const posIdx = f.pos === '' ? -1 : FC_POS.indexOf(f.pos);
    const hits = [];

    for (let i = 0; i < FC_PLAYERS.length; i++) {
      const p = FC_PLAYERS[i];
      if (posIdx >= 0 && p[F.POS].indexOf(posIdx) < 0) continue;
      if (f.ageMin != null && p[F.AGE] < f.ageMin) continue;
      if (f.ageMax != null && p[F.AGE] > f.ageMax) continue;
      if (f.ovrMin != null && p[F.OVR] < f.ovrMin) continue;
      if (f.ovrMax != null && p[F.OVR] > f.ovrMax) continue;
      if (f.potMin != null && p[F.POT] < f.potMin) continue;
      if (f.potMax != null && p[F.POT] > f.potMax) continue;
      if (f.league !== '' && String(p[F.LEAGUE]) !== f.league) continue;
      if (f.nation !== '' && String(p[F.NAT]) !== f.nation) continue;
      if (f.club && (p[F.CLUB] < 0 || norm(FC_CLUBS[p[F.CLUB]]).indexOf(f.club) < 0)) continue;
      if (f.foot !== '' && String(p[F.FOOT]) !== f.foot) continue;
      if (f.weak != null && p[F.WEAK] < f.weak) continue;
      if (f.skills != null && p[F.SKILLS] < f.skills) continue;
      if (f.valMax != null && p[F.VALUE] > f.valMax * 1e6) continue;
      if (f.wageMax != null && p[F.WAGE] > f.wageMax) continue;
      hits.push(i);
    }

    const key = {
      pot:    i => -FC_PLAYERS[i][F.POT],
      ovr:    i => -FC_PLAYERS[i][F.OVR],
      growth: i => -(FC_PLAYERS[i][F.POT] - FC_PLAYERS[i][F.OVR]),
      age:    i =>  FC_PLAYERS[i][F.AGE],
      value:  i => -FC_PLAYERS[i][F.VALUE],
      wage:   i =>  FC_PLAYERS[i][F.WAGE]
    }[f.sort] || (i => -FC_PLAYERS[i][F.POT]);
    hits.sort((a, b) => key(a) - key(b) || FC_PLAYERS[b][F.OVR] - FC_PLAYERS[a][F.OVR]);

    dbHits = hits;
    dbShown = Math.min(PAGE, hits.length);
    $('#dbInfo').textContent = hits.length.toLocaleString('de-DE') + ' Spieler gefunden';
    renderList($('#dbResults'), dbHits, dbShown);
    $('#dbMore').hidden = dbShown >= dbHits.length;
  }

  function fillFilterSelects() {
    $('#fPos').innerHTML = '<option value="">alle</option>' +
      FC_POS.map(p => '<option value="' + p + '">' + p + '</option>').join('');
    $('#fLeague').innerHTML = '<option value="">alle</option>' +
      FC_LEAGUES.map((l, i) => ({ i: i, name: l[0], lvl: l[1] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .map(l => '<option value="' + l.i + '">' + esc(l.name) + (l.lvl > 1 ? ' (Liga ' + l.lvl + ')' : '') + '</option>').join('');
    $('#fNation').innerHTML = '<option value="">alle</option>' +
      FC_NATIONS.map((n, i) => ({ i: i, name: n }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .map(n => '<option value="' + n.i + '">' + esc(n.name) + '</option>').join('');
  }
  function fillClubList() {
    $('#dlClubs').innerHTML = FC_CLUBS.slice().sort((a, b) => a.localeCompare(b, 'de'))
      .map(c => '<option value="' + esc(c) + '">').join('');
  }

  function resetFilter() {
    ['#fAgeMin', '#fAgeMax', '#fOvrMin', '#fOvrMax', '#fPotMin', '#fPotMax', '#fClub', '#fValMax', '#fWageMax']
      .forEach(id => $(id).value = '');
    ['#fPos', '#fLeague', '#fNation', '#fFoot', '#fWeak', '#fSkills'].forEach(id => $(id).value = '');
    $('#fSort').value = 'pot';
    runDbFilter();
  }

  // ===================== Spieler-Detail =====================
  function openPlayer(i) {
    const p = FC_PLAYERS[i], pot = p[F.POT], t = tierFor(pot);
    const html =
      '<div class="md-head"><div class="p-rat">' +
        '<span class="p-ovr ' + ratClass(p[F.OVR]) + '">' + p[F.OVR] + '</span>' +
        '<span class="p-arrow">→</span><span class="p-pot">' + pot + '</span></div>' +
        '<div><div class="md-name">' + esc(p[F.SHORT]) + '</div>' +
        '<div class="md-sub">' + esc(p[F.LONG] || p[F.SHORT]) + '</div></div></div>' +
      '<div class="md-grid">' +
        '<div>' + pPos(i).map(x => '<span class="pos-tag">' + x + '</span>').join('') + '<span class="s-lbl">Positionen</span></div>' +
        '<div><b>' + p[F.AGE] + ' Jahre</b><span class="s-lbl">Alter</span></div>' +
        '<div><b>' + esc(pClub(i)) + '</b><span class="s-lbl">' + esc(pLeague(i)) + '</span></div>' +
        '<div><b>' + esc(pNation(i)) + '</b><span class="s-lbl">Nation</span></div>' +
        '<div><b>' + fmtMoney(p[F.VALUE]) + '</b><span class="s-lbl">Marktwert</span></div>' +
        '<div><b>' + fmtMoney(p[F.WAGE]) + '</b><span class="s-lbl">Gehalt / Woche</span></div>' +
        '<div><b>' + (p[F.FOOT] ? 'rechts' : 'links') + '</b><span class="s-lbl">starker Fuß</span></div>' +
        '<div><b>' + p[F.SKILLS] + '★ / ' + p[F.WEAK] + '★</b><span class="s-lbl">Skills / schwacher Fuß</span></div>' +
      '</div>' +
      '<div class="tier-row ' + t.farbe + '">' +
        '<span class="tier-range">' + rangeLabel(t) + '</span>' +
        '<div class="tier-en">' + esc(t.en) + '</div>' +
        '<div class="tier-de">' + esc(t.de) + '</div>' +
        (p[F.OVR] < 60 ? '<span class="tier-unsure">Overall unter 60 – im Spiel steht bei ihm noch gar kein Potenzial-Text.</span>' : '') +
        (tierGrenzfall(pot) ? '<span class="tier-unsure">' + esc(pot) + ' liegt auf einer unsicheren Grenze – siehe Potenzial-Tab.</span>' : '') +
      '</div>' +
      '<div class="md-actions">' +
        '<button class="primary-btn" data-action="to-squad" data-i="' + i + '">⚽ In den Kader</button>' +
        '<button class="tool-btn" data-action="to-youth" data-i="' + i + '">🌱 Als Talent beobachten</button>' +
      '</div>';
    openModal(html);
  }

  function openModal(html) { $('#modalContent').innerHTML = html; $('#modalOverlay').hidden = false; }
  function closeModal() { $('#modalOverlay').hidden = true; }

  // ===================== Tab: Team =====================
  let teamView = 'pitch';

  function switchTeamView(v) {
    teamView = v;
    document.querySelectorAll('#tab-team .subtab').forEach(b => b.classList.toggle('active', b.dataset.subtab === v));
    $('#teamPitchView').hidden = v !== 'pitch';
    $('#teamSquadView').hidden = v !== 'squad';
    $('#teamStatsView').hidden = v !== 'stats';
    renderTeam();
  }

  const findSquad = id => state.squad.players.find(p => p.id === id);

  // Wie gut passt der Spieler auf die Slot-Position?
  function fitOf(player, slotPos) {
    const pos = player.pos || [];
    if (pos.indexOf(slotPos) >= 0) return 'fit-main';
    const verwandt = POS_VERWANDT[slotPos] || [];
    if (pos.some(p => verwandt.indexOf(p) >= 0)) return 'fit-alt';
    return 'fit-off';
  }

  function renderPitch() {
    const sel = $('#formationSel');
    if (!sel.options.length) {
      sel.innerHTML = Object.keys(FORMATIONS).map(f => '<option value="' + f + '">' + f + '</option>').join('');
    }
    sel.value = state.squad.formation;

    const slots = FORMATIONS[state.squad.formation];
    $('#pitch').innerHTML = slots.map((s, idx) => {
      const pid = state.squad.lineup[idx];
      const pl = pid ? findSquad(pid) : null;
      const cls = pl ? fitOf(pl, s.p) : 'empty';
      return '<button class="slot ' + cls + '" data-action="slot" data-slot="' + idx + '"' +
        ' style="left:' + s.x + '%;bottom:' + s.y + '%">' +
        '<span class="s-pos">' + s.p + '</span>' +
        (pl ? '<span class="s-name">' + esc(pl.name) + '</span><span class="s-ovr">' + pl.ovr + '</span>'
            : '<span class="s-name">frei</span>') +
        '</button>';
    }).join('');
  }

  function renderSquadList() {
    const list = state.squad.players.slice().sort((a, b) => b.ovr - a.ovr);
    $('#squadInfo').textContent = state.squad.players.length
      ? state.squad.players.length + ' Spieler im Kader'
      : 'Noch kein Spieler im Kader – über Suche, Datenbank oder Jugend hinzufügen.';
    $('#squadList').innerHTML = list.map(p => {
      const wachs = p.pot - p.ovr;
      return '<li class="p-card">' +
        '<div class="p-main">' +
          '<div class="p-name">' + esc(p.name) + '</div>' +
          '<div class="p-meta">' + (p.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
            ' ' + (p.age || '?') + ' J.' + (p.club ? ' · ' + esc(p.club) : '') +
            (p.src === 'youth' ? ' · 🌱 Jugend' : '') + '</div>' +
        '</div>' +
        '<div class="p-rat-wrap"><div class="p-rat"><span class="p-ovr ' + ratClass(p.ovr) + '">' + p.ovr + '</span>' +
          '<span class="p-arrow">→</span><span class="p-pot">' + p.pot + '</span></div>' +
          (wachs > 0 ? '<span class="p-growth">+' + wachs + '</span>' : '') + '</div>' +
        '<div class="y-actions">' +
          '<button class="mini-btn" data-action="squad-edit" data-id="' + p.id + '" title="Bearbeiten">✏️</button>' +
          '<button class="mini-btn" data-action="squad-del" data-id="' + p.id + '" title="Entfernen">🗑️</button>' +
        '</div></li>';
    }).join('');
  }

  function mainGroupOf(pos) {
    const p = (pos && pos[0]) || 'CM';
    for (const g in POS_GRUPPEN) if (POS_GRUPPEN[g].indexOf(p) >= 0) return g;
    return 'Mittelfeld';
  }

  function renderSquadStats() {
    const all = state.squad.players;
    const box = $('#squadStats');
    if (!all.length) { box.innerHTML = '<p class="hint">Noch keine Spieler im Kader.</p>'; return; }

    const slots = FORMATIONS[state.squad.formation];
    const eleven = [];
    for (let i = 0; i < slots.length; i++) {
      const pid = state.squad.lineup[i];
      const pl = pid ? findSquad(pid) : null;
      if (pl) eleven.push(pl);
    }
    const avg = (arr, f) => arr.length ? Math.round(arr.reduce((s, x) => s + f(x), 0) / arr.length) : 0;
    const avg1 = (arr, f) => arr.length ? (arr.reduce((s, x) => s + f(x), 0) / arr.length).toFixed(1).replace('.', ',') : '–';
    const reserve = all.reduce((s, p) => s + Math.max(0, p.pot - p.ovr), 0);

    let html = '<div class="stat-grid">' +
      '<div class="stat-box"><div class="s-val ' + ratClass(avg(eleven, p => p.ovr)) + '">' +
        (eleven.length ? avg(eleven, p => p.ovr) : '–') + '</div>' +
        '<div class="s-lbl">Ø Overall Startelf (' + eleven.length + '/11)</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg(all, p => p.ovr) + '</div><div class="s-lbl">Ø Overall Kader</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg1(all, p => p.age || 0) + '</div><div class="s-lbl">Ø Alter</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg(all, p => p.pot) + '</div><div class="s-lbl">Ø Potenzial</div></div>' +
      '<div class="stat-box"><div class="s-val" style="color:var(--accent-2)">+' + reserve + '</div>' +
        '<div class="s-lbl">Wachstumsreserve gesamt</div></div>' +
      '<div class="stat-box"><div class="s-val">' + all.filter(p => (p.age || 99) <= 21).length + '</div>' +
        '<div class="s-lbl">Spieler bis 21 Jahre</div></div>' +
    '</div>';

    html += '<div class="section-divider">Mannschaftsteile</div>';
    const fehlend = [];
    for (const g in POS_GRUPPEN) {
      const grp = all.filter(p => mainGroupOf(p.pos) === g);
      const a = avg(grp, p => p.ovr);
      if (!grp.length) fehlend.push(g);
      html += '<div class="part-row"><span class="p-lbl">' + g + '</span>' +
        '<span class="p-bar"><i style="width:' + (a ? Math.max(4, Math.min(100, (a - 40) / 0.55)) : 0) + '%"></i></span>' +
        '<span class="p-num">' + (a || '–') + ' <small>(' + grp.length + ')</small></span></div>';
    }

    const soll = {};
    slots.forEach(s => { const g = mainGroupOf([s.p]); soll[g] = (soll[g] || 0) + 1; });
    const knapp = [];
    for (const g in soll) {
      const da = all.filter(p => mainGroupOf(p.pos) === g).length;
      if (da < soll[g]) knapp.push(g + ' (' + da + ' von ' + soll[g] + ' gebraucht)');
    }
    if (fehlend.length || knapp.length) {
      html += '<div class="warn-box">⚠️ Unterbesetzt für ' + esc(state.squad.formation) + ': ' +
        esc((knapp.length ? knapp : fehlend).join(', ')) + '</div>';
    }
    box.innerHTML = html;
  }

  function renderTeam() {
    const besetzt = Object.keys(state.squad.lineup).length;
    $('#clubInfo').textContent = state.squad.players.length
      ? (state.squad.club ? state.squad.club + ' · ' : '') +
        state.squad.players.length + ' Spieler · Startelf ' + besetzt + '/11'
      : 'Noch kein Kader – „Verein laden“ holt eine komplette Mannschaft aus der Datenbank.';
    if (teamView === 'pitch') renderPitch();
    else if (teamView === 'squad') renderSquadList();
    else renderSquadStats();
  }

  function openSlot(idx) {
    const slot = FORMATIONS[state.squad.formation][idx];
    const belegt = {};
    Object.keys(state.squad.lineup).forEach(k => { if (+k !== idx) belegt[state.squad.lineup[k]] = +k + 1; });

    const list = state.squad.players.slice().sort((a, b) => {
      const fa = fitOf(a, slot.p), fb = fitOf(b, slot.p);
      const r = { 'fit-main': 0, 'fit-alt': 1, 'fit-off': 2 };
      return r[fa] - r[fb] || b.ovr - a.ovr;
    });

    const html = '<h3>Position ' + slot.p + ' besetzen</h3>' +
      (list.length ? '<ul class="card-list">' + list.map(p => {
        const fit = fitOf(p, slot.p);
        const lbl = fit === 'fit-main' ? 'Hauptposition' : fit === 'fit-alt' ? 'Nebenposition' : 'ungewohnt';
        return '<li><button class="p-card" data-action="slot-set" data-slot="' + idx + '" data-id="' + p.id + '">' +
          '<span class="fit-dot ' + fit + '"></span>' +
          '<div class="p-main"><div class="p-name">' + esc(p.name) + '</div>' +
          '<div class="p-meta">' + (p.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
          ' ' + lbl + (belegt[p.id] ? ' · steht schon auf Platz ' + belegt[p.id] : '') + '</div></div>' +
          '<div class="p-rat"><span class="p-ovr ' + ratClass(p.ovr) + '">' + p.ovr + '</span></div>' +
          '</button></li>';
      }).join('') + '</ul>'
      : '<p class="hint">Der Kader ist leer. Füge zuerst Spieler über Suche, Datenbank oder Jugend hinzu.</p>') +
      '<div class="md-actions"><button class="tool-btn" data-action="slot-clear" data-slot="' + idx + '">Platz freimachen</button></div>';
    openModal(html);
  }

  function setSlot(idx, id) {
    // Spieler kann nur einmal in der Elf stehen
    Object.keys(state.squad.lineup).forEach(k => { if (state.squad.lineup[k] === id) delete state.squad.lineup[k]; });
    state.squad.lineup[idx] = id;
    save('squad'); closeModal(); renderTeam();
  }

  function addToSquad(obj, still) {
    if (state.squad.players.some(p => p.name === obj.name && p.ovr === obj.ovr)) {
      if (!still) alert(obj.name + ' ist schon im Kader.');
      return false;
    }
    state.squad.players.push(Object.assign({ id: uid() }, obj));
    save('squad');
    if (!still) alert(obj.name + ' wurde in den Kader übernommen.');
    return true;
  }

  const dbPlayerObj = i => ({
    name: FC_PLAYERS[i][F.SHORT], pos: pPos(i), ovr: FC_PLAYERS[i][F.OVR],
    pot: FC_PLAYERS[i][F.POT], age: FC_PLAYERS[i][F.AGE], club: pClub(i), src: 'db'
  });

  function squadFromDb(i) {
    addToSquad(dbPlayerObj(i));
    closeModal();
  }

  // ---- Einzelne Spieler per Suche in den Kader holen ----
  function openSquadSearch() {
    if (!DB.ready) { setStatus('Datenbank lädt …', ''); loadDb(openSquadSearch); return; }
    openModal('<h3>Spieler in den Kader holen</h3>' +
      '<input id="squadSearch" class="search-box" type="search" placeholder="🔍 Name eintippen …" autocomplete="off">' +
      '<p id="squadSearchInfo" class="result-info">Mindestens 2 Zeichen – Akzente sind egal, Nachname genügt.</p>' +
      '<ul id="squadSearchResults" class="card-list"></ul>');
    setTimeout(() => { const el = $('#squadSearch'); if (el) el.focus(); }, 60);
  }

  function runSquadSearch() {
    const el = $('#squadSearch');
    if (!el) return;
    const q = norm(el.value), info = $('#squadSearchInfo'), ul = $('#squadSearchResults');
    if (q.length < 2) { ul.innerHTML = ''; info.textContent = 'Mindestens 2 Zeichen – Akzente sind egal, Nachname genügt.'; return; }
    const hits = findPlayers(q);
    info.textContent = hits.length ? hits.length.toLocaleString('de-DE') + ' Treffer – zum Hinzufügen antippen' : 'Keine Treffer.';
    renderList(ul, hits, 25, 'squad-add-db');
  }

  function squadAddFromSearch(i) {
    const obj = dbPlayerObj(i);
    const neu = addToSquad(obj, true);
    $('#squadSearchInfo').textContent = neu
      ? '✅ ' + obj.name + ' hinzugefügt – Kader: ' + state.squad.players.length + ' Spieler'
      : 'ℹ️ ' + obj.name + ' ist schon im Kader.';
    renderTeam();
  }

  // ---- Kompletten Vereinskader aus der Datenbank übernehmen ----
  function loadClub() {
    if (!DB.ready) { setStatus('Datenbank lädt …', ''); loadDb(loadClub); return; }
    openPrompt('Verein laden', [
      { k: 'club', label: 'Verein', value: state.squad.club || '', list: 'dlClubs',
        hint: 'Tippen und aus der Vorschlagsliste wählen – ' + FC_CLUBS.length + ' Vereine.' },
      { k: 'mode', label: 'Vorhandener Kader', type: 'select', value: 'replace',
        options: [{ v: 'replace', t: 'ersetzen' }, { v: 'add', t: 'behalten und ergänzen' }] }
    ], v => {
      if (!v.club) return;
      const q = norm(v.club);
      let ci = FC_CLUBS.findIndex(c => norm(c) === q);
      if (ci < 0) {
        const treffer = FC_CLUBS.map((c, i) => [c, i]).filter(x => norm(x[0]).indexOf(q) >= 0);
        if (treffer.length === 1) ci = treffer[0][1];
        else if (!treffer.length) { alert('Kein Verein gefunden für „' + v.club + '“.'); return; }
        else { alert('Mehrere Vereine passen auf „' + v.club + '“:\n\n' +
                     treffer.slice(0, 10).map(x => '· ' + x[0]).join('\n') +
                     (treffer.length > 10 ? '\n… und ' + (treffer.length - 10) + ' weitere' : '') +
                     '\n\nBitte genauer eingeben.'); return; }
      }

      const idx = [];
      for (let i = 0; i < FC_PLAYERS.length; i++) if (FC_PLAYERS[i][F.CLUB] === ci) idx.push(i);
      idx.sort((a, b) => FC_PLAYERS[b][F.OVR] - FC_PLAYERS[a][F.OVR]);

      const neu = idx.map(i => ({
        id: uid(), name: FC_PLAYERS[i][F.SHORT], pos: pPos(i), ovr: FC_PLAYERS[i][F.OVR],
        pot: FC_PLAYERS[i][F.POT], age: FC_PLAYERS[i][F.AGE], club: FC_CLUBS[ci], src: 'db'
      }));

      if (v.mode === 'replace') {
        if (state.squad.players.length &&
            !confirm('Der bisherige Kader (' + state.squad.players.length + ' Spieler) und die Aufstellung werden ersetzt. Fortfahren?')) return;
        state.squad.players = neu;
        state.squad.lineup = {};
      } else {
        const da = new Set(state.squad.players.map(p => p.name + '|' + p.ovr));
        neu.forEach(p => { if (!da.has(p.name + '|' + p.ovr)) state.squad.players.push(p); });
      }
      state.squad.club = FC_CLUBS[ci];
      save('squad');
      renderTeam();
      alert(neu.length + ' Spieler von ' + FC_CLUBS[ci] + ' übernommen.' +
            (v.mode === 'replace' ? '\n\nTipp: „🪄 Elf aufstellen“ besetzt die Startelf automatisch.' : ''));
    });
  }

  // ---- Startelf automatisch besetzen: erst Hauptpositionen, dann Neben, dann Rest ----
  function autoLineup() {
    if (!state.squad.players.length) { alert('Der Kader ist leer.'); return; }
    const slots = FORMATIONS[state.squad.formation];
    // Alle Platz-Spieler-Paare bewerten und global nach Punktzahl vergeben.
    // Slot für Slot durchzugehen wäre schlechter: dann schnappt der frühe LB-Platz
    // einen Mittelfeldspieler weg und im Zentrum bleibt nur ein Reservist übrig.
    // Punkte = Overall + Bonus für die erstgenannte (echte) Position − Abzug fürs Aushelfen.
    const abzug = { 'fit-main': 0, 'fit-alt': 12, 'fit-off': 30 };
    const paare = [];
    slots.forEach((s, i) => {
      state.squad.players.forEach(p => {
        const primaer = (p.pos && p.pos[0]) === s.p ? 3 : 0;
        paare.push({ i: i, id: p.id, score: p.ovr + primaer - abzug[fitOf(p, s.p)] });
      });
    });
    paare.sort((a, b) => b.score - a.score);

    const lineup = {}, belegt = {};
    paare.forEach(x => {
      if (lineup[x.i] == null && !belegt[x.id]) { lineup[x.i] = x.id; belegt[x.id] = true; }
    });
    state.squad.lineup = lineup;
    save('squad');
    if (teamView !== 'pitch') switchTeamView('pitch'); else renderTeam();
  }

  // Nur Bearbeiten – neue Spieler kommen aus der Datenbank oder aus dem Jugend-Tab
  function squadEdit(id) {
    const p = findSquad(id);
    if (!p) return;
    openPrompt('Spieler bearbeiten', [
      { k: 'name', label: 'Name', value: p.name },
      { k: 'pos',  label: 'Positionen (Komma-getrennt, z. B. ST, LW)', value: (p.pos || []).join(', ') },
      { k: 'age',  label: 'Alter', type: 'number', value: p.age },
      { k: 'ovr',  label: 'Overall', type: 'number', value: p.ovr },
      { k: 'pot',  label: 'Potenzial', type: 'number', value: p.pot },
      { k: 'club', label: 'Verein (optional)', value: p.club || '' }
    ], v => {
      if (!v.name) return;
      const ovr = parseInt(v.ovr, 10) || 0;
      Object.assign(p, {
        name: v.name,
        pos: parsePositions(v.pos),
        age: parseInt(v.age, 10) || 0,
        ovr: ovr,
        pot: Math.max(parseInt(v.pot, 10) || 0, ovr),
        club: v.club
      });
      save('squad'); renderTeam();
    });
  }

  function parsePositions(s) {
    return (s || '').split(',').map(x => x.trim().toUpperCase())
      .filter(x => FC_POS.indexOf(x) >= 0);
  }

  function squadDel(id) {
    const p = findSquad(id);
    if (!p || !confirm(p.name + ' aus dem Kader entfernen?')) return;
    state.squad.players = state.squad.players.filter(x => x.id !== id);
    Object.keys(state.squad.lineup).forEach(k => { if (state.squad.lineup[k] === id) delete state.squad.lineup[k]; });
    save('squad'); renderTeam();
    if (p.youthId) renderYouth();   // Hochzieh-Knopf im Jugend-Tab wieder anbieten
  }

  // ===================== Tab: Jugend =====================
  function potLabel(y) {
    return y.potMin === y.potMax ? String(y.potMin) : y.potMin + '–' + y.potMax;
  }

  function renderYouth() {
    const ul = $('#youthList');
    if (!state.youth.length) {
      ul.innerHTML = '<li class="hint">Noch keine Jugendspieler angelegt.</li>';
      return;
    }
    ul.innerHTML = state.youth.map(y => {
      const t = tierFor(y.potMax);
      const spanne = 99 - 40;
      const startPct = Math.max(0, (y.ovr - 40) / spanne * 100);
      const potPct   = Math.max(0, (y.potMax - 40) / spanne * 100);
      const minPct   = Math.max(0, (y.potMin - 40) / spanne * 100);
      const seasons = y.seasons.slice().sort((a, b) => a.season - b.season);

      let sHtml = '';
      if (seasons.length) {
        sHtml = '<ul class="season-list">' + seasons.map((s, i) => {
          const prev = i > 0 ? seasons[i - 1].ovr : null;
          const d = prev == null ? null : s.ovr - prev;
          const cls = d == null ? '' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
          return '<li><span>Saison ' + s.season + '</span><span>' + (s.age ? s.age + ' J.' : '') + '</span>' +
            '<span style="flex:1"></span><span>' + s.ovr + ' OVR</span>' +
            '<span class="s-delta ' + cls + '">' + (d == null ? '–' : (d > 0 ? '+' + d : d)) + '</span></li>';
        }).join('') + '</ul>';
      }

      const hoch = !!promotedOf(y.id);

      return '<li class="y-card">' +
        '<div class="y-head">' +
          '<div class="p-main"><div class="p-name">' + esc(y.name) +
            (hoch ? ' <span class="promo-badge">⬆️ Senioren</span>' : '') + '</div>' +
            '<div class="p-meta">' + (y.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
            ' ' + (y.age || '?') + ' J.</div></div>' +
          '<div class="p-rat"><span class="p-ovr ' + ratClass(y.ovr) + '">' + y.ovr + '</span>' +
            '<span class="p-arrow">→</span><span class="p-pot">' + potLabel(y) + '</span></div>' +
        '</div>' +
        '<div class="growth-bar"><i style="width:' + startPct + '%"></i>' +
          '<u style="left:' + Math.min(startPct, minPct) + '%;width:' + Math.max(0, potPct - Math.min(startPct, minPct)) + '%"></u></div>' +
        '<div class="growth-lbl"><span>' + y.ovr + ' jetzt</span>' +
          '<span>noch ' + Math.max(0, y.potMax - y.ovr) + ' möglich</span></div>' +
        '<div class="tier-row ' + t.farbe + '" style="margin-top:10px">' +
          '<div class="tier-en">' + esc(t.en) + '</div><div class="tier-de">' + esc(t.de) + '</div>' +
          (y.ovr < 60 ? '<span class="tier-unsure">Unter 60 Overall zeigt das Spiel noch keinen Potenzial-Text an.</span>' : '') +
        '</div>' +
        (y.note ? '<p class="hint" style="margin:8px 0 0">' + esc(y.note) + '</p>' : '') +
        sHtml +
        '<div class="y-actions" style="margin-top:10px">' +
          '<button class="mini-btn" data-action="youth-season" data-id="' + y.id + '" title="Saison eintragen">➕</button>' +
          '<button class="mini-btn" data-action="youth-compare" data-id="' + y.id + '" title="Mit Datenbank vergleichen">⚖️</button>' +
          (hoch ? '' : '<button class="mini-btn" data-action="youth-promote" data-id="' + y.id + '" title="In die Senioren hochziehen">⬆️</button>') +
          '<button class="mini-btn" data-action="youth-edit" data-id="' + y.id + '" title="Bearbeiten">✏️</button>' +
          '<button class="mini-btn" data-action="youth-del" data-id="' + y.id + '" title="Löschen">🗑️</button>' +
        '</div></li>';
    }).join('');
  }

  const findYouth = id => state.youth.find(y => y.id === id);

  function youthEdit(id, preset) {
    const y = id ? findYouth(id) : null;
    const src = y || preset || {};
    openPrompt(y ? 'Jugendspieler bearbeiten' : 'Jugendspieler anlegen', [
      { k: 'name', label: 'Name', value: src.name || '' },
      { k: 'pos',  label: 'Positionen (Komma-getrennt, z. B. CAM, CM)', value: (src.pos || []).join(', ') },
      { k: 'age',  label: 'Alter', type: 'number', value: src.age || '' },
      { k: 'ovr',  label: 'Overall', type: 'number', value: src.ovr || '' },
      { k: 'pot',  label: 'Potenzial (genaue Zahl, falls bekannt)', type: 'number', value: (src.potMin && src.potMin === src.potMax) ? src.potMin : '' },
      { k: 'tier', label: 'oder: Text aus dem Scout-Bericht', type: 'select',
        options: [{ v: '', t: '– kein Text gewählt –' }].concat(POTENTIAL_TIERS.map(t => ({ v: t.key, t: t.en + '  (' + t.min + '–' + t.max + ')' }))),
        value: '', hint: 'Nur nötig, wenn du die genaue Zahl noch nicht siehst.' },
      { k: 'note', label: 'Notiz', type: 'textarea', value: src.note || '' }
    ], v => {
      if (!v.name) return;
      const ovr = parseInt(v.ovr, 10) || 0;
      let potMin, potMax;
      const exact = parseInt(v.pot, 10);
      if (!isNaN(exact) && exact > 0) { potMin = potMax = Math.max(exact, ovr); }
      else if (v.tier) {
        const t = POTENTIAL_TIERS.find(x => x.key === v.tier);
        potMin = Math.max(t.min, ovr); potMax = t.max;
      } else if (y) { potMin = y.potMin; potMax = y.potMax; }
      else { potMin = potMax = ovr; }

      const data = { name: v.name, pos: parsePositions(v.pos), age: parseInt(v.age, 10) || 0, ovr: ovr, potMin: potMin, potMax: potMax, note: v.note };
      if (y) { Object.assign(y, data); syncPromoted(y); }
      else state.youth.push(Object.assign({ id: uid(), seasons: [] }, data));
      save('youth'); renderYouth();
    });
  }

  function youthSeason(id) {
    const y = findYouth(id);
    if (!y) return;
    const next = y.seasons.length ? Math.max.apply(null, y.seasons.map(s => s.season)) + 1 : (state.settings.saison || 1);
    openPrompt('Saison eintragen – ' + y.name, [
      { k: 'season', label: 'Saison', type: 'number', value: next },
      { k: 'age',    label: 'Alter', type: 'number', value: y.age || '' },
      { k: 'ovr',    label: 'Overall am Saisonende', type: 'number', value: y.ovr }
    ], v => {
      const s = parseInt(v.season, 10), o = parseInt(v.ovr, 10);
      if (!s || !o) return;
      y.seasons = y.seasons.filter(x => x.season !== s);
      y.seasons.push({ season: s, age: parseInt(v.age, 10) || 0, ovr: o });
      // Der jüngste Eintrag ist der aktuelle Stand
      const last = y.seasons.slice().sort((a, b) => b.season - a.season)[0];
      y.ovr = last.ovr;
      if (last.age) y.age = last.age;
      if (y.potMax < y.ovr) y.potMax = y.ovr;
      if (y.potMin < y.ovr) y.potMin = y.ovr;
      syncPromoted(y);
      save('youth'); renderYouth();
    });
  }

  function youthCompare(id) {
    const y = findYouth(id);
    if (!y) return;
    if (!DB.ready) { openModal('<h3>Vergleich</h3><p class="hint">Datenbank lädt – gleich nochmal probieren.</p>'); loadDb(() => youthCompare(id)); return; }

    const pos = (y.pos && y.pos[0]) || null;
    const posIdx = pos ? FC_POS.indexOf(pos) : -1;
    const gleiche = [];
    // Ohne eingetragenes Alter wird nicht nach Alter gefiltert, sonst bliebe die Liste leer
    const altersFilter = y.age > 0;
    for (let i = 0; i < FC_PLAYERS.length; i++) {
      const p = FC_PLAYERS[i];
      if (altersFilter && Math.abs(p[F.AGE] - y.age) > 1) continue;
      if (posIdx >= 0 && p[F.POS].indexOf(posIdx) < 0) continue;
      gleiche.push(i);
    }
    gleiche.sort((a, b) => FC_PLAYERS[b][F.OVR] - FC_PLAYERS[a][F.OVR]);

    const schlechter = gleiche.filter(i => FC_PLAYERS[i][F.OVR] < y.ovr).length;
    const pct = gleiche.length ? Math.round(schlechter / gleiche.length * 100) : 0;
    const potBesser = gleiche.filter(i => FC_PLAYERS[i][F.POT] > y.potMax).length;

    const html = '<h3>' + esc(y.name) + ' im Vergleich</h3>' +
      '<p class="hint">Verglichen mit ' + gleiche.length.toLocaleString('de-DE') + ' Spielern der Datenbank ' +
        (pos ? 'auf ' + pos + ' ' : '') +
        (altersFilter ? 'im Alter ' + Math.max(0, y.age - 1) + '–' + (y.age + 1) : '(alle Altersstufen – kein Alter eingetragen)') + '.</p>' +
      '<div class="stat-grid">' +
        '<div class="stat-box"><div class="s-val">' + pct + '&nbsp;%</div><div class="s-lbl">besser als … dieser Altersgruppe (Overall)</div></div>' +
        '<div class="stat-box"><div class="s-val">' + potBesser + '</div><div class="s-lbl">haben mehr Potenzial als ' + potLabel(y) + '</div></div>' +
      '</div>' +
      (gleiche.length ? '<div class="section-divider">Stärkste der Altersgruppe</div><ul class="card-list">' +
        gleiche.slice(0, 8).map(cardHtml).join('') + '</ul>' : '');
    openModal(html);
  }

  // ---- Jugendspieler in die Senioren hochziehen ----
  const promotedOf = id => state.squad.players.find(p => p.youthId === id);

  function youthPromote(id) {
    const y = findYouth(id);
    if (!y) return;
    if (promotedOf(id)) { alert(y.name + ' steht schon im Seniorenkader.'); return; }
    state.squad.players.push({
      id: uid(), youthId: y.id, name: y.name, pos: y.pos, ovr: y.ovr, pot: y.potMax,
      age: y.age, club: 'aus der Jugend', note: y.note, src: 'youth'
    });
    save('squad'); renderYouth(); renderTeam();
    alert(y.name + ' ist jetzt im Seniorenkader.\n\nÄnderst du hier seine Werte oder trägst eine Saison ein, wird der Eintrag im Team-Tab automatisch mitgezogen.');
  }

  // Werte aus der Jugend in den verknüpften Kadereintrag übernehmen
  function syncPromoted(y) {
    const p = promotedOf(y.id);
    if (!p) return;
    p.name = y.name; p.pos = y.pos; p.age = y.age; p.ovr = y.ovr; p.pot = y.potMax; p.note = y.note;
    save('squad');
  }

  function youthFromDb(i) {
    const p = FC_PLAYERS[i];
    closeModal();
    youthEdit(null, { name: p[F.SHORT], pos: pPos(i), age: p[F.AGE], ovr: p[F.OVR], potMin: p[F.POT], potMax: p[F.POT] });
  }

  // ===================== Tab: Potenzial =====================
  function renderPotential() {
    let html = POTENTIAL_TIERS.map(t =>
      '<div class="tier-row ' + t.farbe + '">' +
        '<span class="tier-range">' + rangeLabel(t) + '</span>' +
        '<div class="tier-en">' + esc(t.en) + '</div>' +
        '<div class="tier-de">' + esc(t.de) + '</div>' +
        (t.unsicher ? '<span class="tier-unsure">⚠ ' + esc(t.unsicher) + '</span>' : '') +
      '</div>').join('');
    html += '<div class="tier-row tier-achieved">' +
      '<span class="tier-range">90+</span>' +
      '<div class="tier-en">' + esc(POTENTIAL_ACHIEVED.en) + '</div>' +
      '<div class="tier-de">' + esc(POTENTIAL_ACHIEVED.de) + '</div>' +
      '<span class="tier-unsure">' + esc(POTENTIAL_ACHIEVED.hinweis) + '</span></div>';
    $('#tierTable').innerHTML = html;

    $('#calcTier').innerHTML = POTENTIAL_TIERS.map(t => '<option value="' + t.key + '">' + esc(t.en) + '</option>').join('');
    $('#potNotes').innerHTML = POTENTIAL_HINWEISE.map(h => '<li>' + h + '</li>').join('');
    calcTier(); calcNum();
  }

  function calcTier() {
    const t = POTENTIAL_TIERS.find(x => x.key === $('#calcTier').value);
    if (!t) return;
    let html = '<b>' + rangeLabel(t) + '</b> Potenzial &nbsp;·&nbsp; „' + esc(t.de) + '“';
    if (t.unsicher) html += '<div class="tier-unsure">⚠ ' + esc(t.unsicher) + '</div>';
    if (DB.ready) {
      let n = 0, beispiele = [];
      for (let i = 0; i < FC_PLAYERS.length; i++) {
        const pot = FC_PLAYERS[i][F.POT];
        if (pot >= t.min && pot <= t.max) { n++; if (FC_PLAYERS[i][F.AGE] <= 21) beispiele.push(i); }
      }
      beispiele.sort((a, b) => FC_PLAYERS[b][F.POT] - FC_PLAYERS[a][F.POT]);
      html += '<div class="hint" style="margin-top:8px">' + n.toLocaleString('de-DE') +
        ' Spieler der Datenbank liegen in diesem Bereich.</div>';
      if (beispiele.length) {
        html += '<div class="hint">Beispiele bis 21 Jahre:</div><ul class="card-list">' +
          beispiele.slice(0, 5).map(cardHtml).join('') + '</ul>';
      }
    } else {
      loadDb(calcTier);
    }
    $('#calcTierOut').innerHTML = html;
  }

  function calcNum() {
    const v = parseInt($('#calcNum').value, 10);
    const out = $('#calcNumOut');
    if (isNaN(v)) { out.innerHTML = '<span class="hint">Zahl eingeben, um den Text zu sehen.</span>'; return; }
    const t = tierFor(v);
    let html = 'Im Spiel steht: <b>' + esc(t.en) + '</b><div class="tier-de">' + esc(t.de) + '</div>';
    if (tierGrenzfall(v)) html += '<div class="tier-unsure">⚠ ' + v + ' liegt auf einer unsicheren Grenze – ' + esc(t.unsicher || '') + '</div>';
    if (v < 60) html += '<div class="tier-unsure">Bei so niedrigem Potenzial liegt der Overall zwangsläufig unter 60 – dann zeigt das Spiel ohnehin keinen Potenzial-Text an.</div>';
    out.innerHTML = html;
  }

  // ===================== Eingabe-Dialog =====================
  let promptCb = null;
  function openPrompt(title, fields, cb) {
    $('#promptTitle').textContent = title;
    $('#promptFields').innerHTML = fields.map(f => {
      const v = f.value == null ? '' : f.value;
      let input;
      if (f.type === 'select') {
        input = '<select data-pk="' + f.k + '">' + f.options.map(o =>
          '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') + '</select>';
      } else if (f.type === 'textarea') {
        input = '<textarea data-pk="' + f.k + '" rows="2">' + esc(v) + '</textarea>';
      } else {
        input = '<input data-pk="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' +
                (f.list ? ' list="' + f.list + '" autocomplete="off"' : '') + '>';
      }
      return '<div class="pf"><label>' + esc(f.label) + '</label>' + input +
        (f.hint ? '<div class="pf-hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }).join('');
    promptCb = cb;
    $('#promptOverlay').hidden = false;
  }
  function closePrompt() { $('#promptOverlay').hidden = true; promptCb = null; }
  function submitPrompt() {
    const vals = {};
    $('#promptFields').querySelectorAll('[data-pk]').forEach(el => vals[el.dataset.pk] = el.value.trim());
    const cb = promptCb; closePrompt(); if (cb) cb(vals);
  }

  // ===================== Navigation =====================
  const ui = { tab: 'search' };

  function syncHeaderHeight() {
    document.documentElement.style.setProperty('--header-h', $('#appHeader').offsetHeight + 'px');
  }

  function switchTab(tab) {
    ui.tab = tab;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === tab));
    syncHeaderHeight();
    if (tab === 'db')       { loadDb(runDbFilter); if (DB.ready && !dbHits.length) runDbFilter(); }
    if (tab === 'team')     renderTeam();
    if (tab === 'youth')    renderYouth();
    if (tab === 'potential') renderPotential();
  }

  // ===================== Export / Import / Reset =====================
  function exportData() {
    const dump = { _meta: { app: 'fc26-karriere', version: 1, exported: new Date().toISOString() } };
    for (const k in KEYS) dump[KEYS[k]] = state[k];
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fc26-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      let d;
      try { d = JSON.parse(r.result); }
      catch (e) { alert('Import fehlgeschlagen: Datei ist kein gültiges JSON.'); return; }
      const present = Object.values(KEYS).filter(k => d[k] != null);
      if (!present.length) { alert('Import fehlgeschlagen: keine bekannten Daten in der Datei.'); return; }
      if (!confirm('Aktuelle Daten mit diesem Backup überschreiben? Das kann nicht rückgängig gemacht werden.')) return;
      for (const k in KEYS) { if (d[KEYS[k]] != null) state[k] = d[KEYS[k]]; }
      ensureStructure(); saveAll(); renderAll();
      alert('Import erfolgreich.');
    };
    r.readAsText(file);
  }

  function resetAll() {
    if (!confirm('Kader, Aufstellung und alle Jugendspieler löschen und zurücksetzen?')) return;
    if (!confirm('Wirklich sicher? Tipp: vorher exportieren. Endgültig zurücksetzen?')) return;
    for (const k in KEYS) state[k] = clone(DEFAULT_DATA[k]);
    saveAll(); renderAll(); switchTab('search');
  }

  function renderAll() {
    renderTeam(); renderYouth(); renderPotential();
  }

  // ===================== Events =====================
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    const nav = e.target.closest('[data-nav]');
    const sub = e.target.closest('[data-subtab]');

    if (nav) { switchTab(nav.dataset.nav); return; }
    if (sub) { switchTeamView(sub.dataset.subtab); return; }
    if (!btn) {
      if (e.target.id === 'modalOverlay') closeModal();
      if (e.target.id === 'promptOverlay') closePrompt();
      return;
    }

    const a = btn.dataset.action;
    const i = btn.dataset.i != null ? +btn.dataset.i : null;
    const id = btn.dataset.id;
    const slot = btn.dataset.slot != null ? +btn.dataset.slot : null;

    switch (a) {
      case 'open-player':  openPlayer(i); break;
      case 'to-squad':     squadFromDb(i); break;
      case 'to-youth':     youthFromDb(i); break;

      case 'more-search':  searchShown += PAGE; renderList($('#searchResults'), searchHits, searchShown);
                           $('#searchMore').hidden = searchShown >= searchHits.length; break;
      case 'more-db':      dbShown += PAGE; renderList($('#dbResults'), dbHits, dbShown);
                           $('#dbMore').hidden = dbShown >= dbHits.length; break;

      case 'toggle-filter':      $('#filterBox').hidden = !$('#filterBox').hidden; break;
      case 'filter-reset':       resetFilter(); break;
      case 'preset-wonderkids':  resetFilter(); $('#filterBox').hidden = false;
                                 $('#fAgeMax').value = 21; $('#fPotMin').value = 85;
                                 $('#fSort').value = 'pot'; runDbFilter(); break;

      case 'slot':        openSlot(slot); break;
      case 'slot-set':    setSlot(slot, id); break;
      case 'slot-clear':  delete state.squad.lineup[slot]; save('squad'); closeModal(); renderTeam(); break;
      case 'load-club':     loadClub(); break;
      case 'auto-lineup':   autoLineup(); break;
      case 'squad-search':  openSquadSearch(); break;
      case 'squad-add-db':  squadAddFromSearch(i); break;
      case 'squad-edit':    squadEdit(id); break;
      case 'squad-del':     squadDel(id); break;

      case 'youth-add':      youthEdit(null); break;
      case 'youth-edit':     youthEdit(id); break;
      case 'youth-season':   youthSeason(id); break;
      case 'youth-compare':  youthCompare(id); break;
      case 'youth-promote':  youthPromote(id); break;
      case 'youth-del':      { const y = findYouth(id);
                               if (y && confirm(y.name + ' löschen?')) { state.youth = state.youth.filter(x => x.id !== id); save('youth'); renderYouth(); }
                               break; }

      case 'export':      exportData(); break;
      case 'import':      $('#importFile').click(); break;
      case 'reset':       resetAll(); break;
      case 'modal-close': closeModal(); break;
      case 'prompt-ok':     submitPrompt(); break;
      case 'prompt-cancel': closePrompt(); break;
    }
  });

  $('#playerSearch').addEventListener('input', debounce(runSearch, 160));
  // Suchfeld im Kader-Dialog entsteht erst beim Öffnen -> delegiert lauschen
  document.addEventListener('input', debounce(e => {
    if (e.target && e.target.id === 'squadSearch') runSquadSearch();
  }, 160));
  $('#importFile').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
  $('#formationSel').addEventListener('change', e => {
    state.squad.formation = e.target.value; save('squad'); renderTeam();
  });
  $('#filterBox').addEventListener('change', debounce(runDbFilter, 60));
  $('#filterBox').addEventListener('input', debounce(runDbFilter, 300));
  $('#calcTier').addEventListener('change', calcTier);
  $('#calcNum').addEventListener('input', debounce(calcNum, 150));
  window.addEventListener('resize', syncHeaderHeight);

  // ===================== Start =====================
  load();
  syncHeaderHeight();
  renderAll();
  switchTab('search');
  loadDb();   // im Hintergrund, die App ist währenddessen bedienbar

  // Service Worker nur im echten Betrieb registrieren. Lokal ist er cache-first und
  // liefert hartnäckig alte Dateien aus - beim Entwickeln stört das mehr, als es hilft.
  const lokal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) >= 0;
  if ('serviceWorker' in navigator && !lokal) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
