/* FC 26 Karriere-Helfer – Vanilla-JS, State im localStorage.
   fcdata.js (1,5 MB) wird bewusst NICHT im HTML eingebunden, sondern erst
   nachgeladen, wenn er gebraucht wird – so ist die App sofort bedienbar. */
(function () {
  'use strict';

  // ===================== Storage =====================
  // Jede Karriere hat ihren eigenen Satz Schlüssel: <karriereId>_squad usw.
  // So liegen mehrere Spielstände nebeneinander, ohne dass man JSON hin- und herschiebt.
  const PARTS = ['squad', 'youth', 'settings'];
  const CAREER_LIST = 'fc_careers';
  const CAREER_ACTIVE = 'fc_active';

  const state = {};
  let careers = [], activeCareer = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const storeKey = (k, id) => (id || activeCareer) + '_' + k;

  function loadCareers() {
    try { careers = JSON.parse(localStorage.getItem(CAREER_LIST)) || []; } catch (e) { careers = []; }
    if (!Array.isArray(careers) || !careers.length) {
      const id = 'fc_c' + Date.now().toString(36);
      careers = [{ id: id, name: 'Karriere 1' }];
      // Einzelstand aus der Zeit vor den Karrieren übernehmen, statt ihn liegen zu lassen
      PARTS.forEach(k => {
        const alt = localStorage.getItem('fc_' + k);
        if (alt != null) { localStorage.setItem(id + '_' + k, alt); localStorage.removeItem('fc_' + k); }
      });
      saveCareers();
    }
    activeCareer = localStorage.getItem(CAREER_ACTIVE);
    if (!careers.some(c => c.id === activeCareer)) activeCareer = careers[0].id;
    localStorage.setItem(CAREER_ACTIVE, activeCareer);
  }
  const saveCareers = () => localStorage.setItem(CAREER_LIST, JSON.stringify(careers));

  function load() {
    for (const k of PARTS) {
      const raw = localStorage.getItem(storeKey(k));
      if (raw) { try { state[k] = JSON.parse(raw); continue; } catch (e) { /* fällt durch */ } }
      state[k] = clone(DEFAULT_DATA[k]);
      save(k);
    }
    ensureStructure();
  }
  const save = k => localStorage.setItem(storeKey(k), JSON.stringify(state[k]));
  const saveAll = () => PARTS.forEach(save);

  function ensureStructure() {
    if (!state.squad || typeof state.squad !== 'object') state.squad = clone(DEFAULT_DATA.squad);
    if (!FORMATIONS[state.squad.formation]) state.squad.formation = '4-3-3';
    if (!Array.isArray(state.squad.players)) state.squad.players = [];
    // Potenzial wird als Bereich gehalten (im Spiel sieht man oft nur den Text).
    // Ältere Stände hatten nur eine Zahl "pot" - die wird hier übernommen.
    state.squad.players.forEach(p => {
      if (p.potMax == null) p.potMax = p.pot != null ? p.pot : (p.ovr || 0);
      if (p.potMin == null) p.potMin = p.potMax;
      delete p.pot;
    });
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
  // Potenzial aus einem Dialog lesen: entweder die genaue Zahl (Scout-Bericht) oder
  // der Text aus dem Kadermenü, der in seinen Zahlenbereich übersetzt wird.
  // alt = bisheriger Eintrag; bleibt erhalten, wenn nichts angegeben wurde.
  function potBereich(v, ovr, alt) {
    const zahl = parseInt(v.pot, 10);
    if (!isNaN(zahl) && zahl > 0) { const n = Math.max(zahl, ovr); return [n, n]; }
    if (v.tier) {
      const t = POTENTIAL_TIERS.find(x => x.key === v.tier);
      if (t) return [Math.max(t.min, ovr), Math.max(t.max, ovr)];
    }
    if (alt && alt.potMax != null) return [Math.max(alt.potMin, ovr), Math.max(alt.potMax, ovr)];
    return [ovr, ovr];
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
    $('#teamLoanView').hidden  = v !== 'loan';
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
      // Wachstums-Badge nur bei bekannter Zahl: bei "90+" wäre "+31" (bis 99) irreführend
      const wachs = p.potMin === p.potMax ? p.potMax - p.ovr : 0;
      return '<li class="p-card">' +
        '<div class="p-main">' +
          '<div class="p-name">' + esc(p.name) +
            (p.loan ? ' <span class="promo-badge">📤 verliehen</span>' : '') + '</div>' +
          '<div class="p-meta">' + (p.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
            ' ' + (p.age || '?') + ' J.' + (p.club ? ' · ' + esc(p.club) : '') +
            (p.src === 'youth' ? ' · 🌱 Jugend' : p.src === 'manual' ? ' · ✏️ selbst angelegt' : '') + '</div>' +
        '</div>' +
        '<div class="p-rat-wrap"><div class="p-rat"><span class="p-ovr ' + ratClass(p.ovr) + '">' + p.ovr + '</span>' +
          '<span class="p-arrow">→</span><span class="p-pot">' + potLabel(p) + '</span></div>' +
          (wachs > 0 ? '<span class="p-growth">+' + wachs + '</span>' : '') + '</div>' +
        '<div class="y-actions">' +
          '<button class="mini-btn" data-action="loan-toggle" data-id="' + p.id + '" title="' +
            (p.loan ? 'Rückkehr aus der Leihe eintragen' : 'Verleihen') + '">' + (p.loan ? '📥' : '📤') + '</button>' +
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
    const reserve = all.reduce((s, p) => s + Math.max(0, p.potMax - p.ovr), 0);

    let html = '<div class="stat-grid">' +
      '<div class="stat-box"><div class="s-val ' + ratClass(avg(eleven, p => p.ovr)) + '">' +
        (eleven.length ? avg(eleven, p => p.ovr) : '–') + '</div>' +
        '<div class="s-lbl">Ø Overall Startelf (' + eleven.length + '/11)</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg(all, p => p.ovr) + '</div><div class="s-lbl">Ø Overall Kader</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg1(all, p => p.age || 0) + '</div><div class="s-lbl">Ø Alter</div></div>' +
      '<div class="stat-box"><div class="s-val">' + avg(all, p => p.potMax) + '</div><div class="s-lbl">Ø Potenzial (Obergrenze)</div></div>' +
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
    else if (teamView === 'loan') renderLoan();
    else renderSquadStats();
  }

  // ===================== Leihe / Leih-Glitch =====================
  // Wie gut eignet sich der Spieler? Viel Luft nach oben zählt am meisten,
  // Jugend zusätzlich – beides sind die Kriterien, die die Quellen nennen.
  // Luft nach oben: bei nach oben offenen Bereichen ("90+") zählt die Untergrenze,
  // sonst würde die Liste mit der theoretischen 99 rechnen und Kandidaten hochjubeln.
  const offen = p => p.potMax >= 99 && p.potMin !== p.potMax;
  const luftNachOben = p => (offen(p) ? p.potMin : p.potMax) - p.ovr;
  const loanScore = p => luftNachOben(p) + Math.max(0, 24 - (p.age || 24)) * 2;

  function loanCard(p) {
    const luft = luftNachOben(p);
    const log = p.loans || [];
    const summe = log.reduce((s, x) => s + (x.ovr || 0), 0);
    return '<li class="p-card' + (p.loan ? ' career-active' : '') + '">' +
      '<div class="p-main">' +
        '<div class="p-name">' + esc(p.name) + (p.loan ? ' <span class="promo-badge">📤 verliehen</span>' : '') + '</div>' +
        '<div class="p-meta">' + (p.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
          ' ' + (p.age || '?') + ' J. · ' + (offen(p) ? 'mind. ' : '') + luft + ' Punkte Luft' +
          (log.length ? ' · ' + log.length + (log.length === 1 ? ' Leihe' : ' Leihen') +
                        (summe ? ' (+' + summe + ' GES)' : '') : '') + '</div>' +
      '</div>' +
      '<div class="p-rat-wrap"><div class="p-rat">' +
        '<span class="p-ovr ' + ratClass(p.ovr) + '">' + p.ovr + '</span>' +
        '<span class="p-arrow">→</span><span class="p-pot">' + potLabel(p) + '</span></div></div>' +
      '<div class="y-actions"><button class="mini-btn" data-action="loan-toggle" data-id="' + p.id + '" title="' +
        (p.loan ? 'Rückkehr eintragen' : 'Als verliehen markieren') + '">' + (p.loan ? '📥' : '📤') + '</button></div>' +
      '</li>';
  }

  function renderLoan() {
    const all = state.squad.players;
    const box = $('#loanContent');
    let html = '';

    if (all.length < 25) {
      html += '<div class="warn-box">⚠️ Nur ' + all.length + ' Spieler im Kader. Für Leihangebote brauchst du <b>mindestens 25</b> – ' +
              'sonst bietet niemand. „Verein laden“ füllt den Kader in einem Rutsch.</div>';
    }

    const verliehen = all.filter(p => p.loan);
    if (verliehen.length) {
      html += '<div class="section-divider">Gerade verliehen</div><ul class="card-list">' +
              verliehen.map(loanCard).join('') + '</ul>';
    }

    const kandidaten = all.filter(p => !p.loan && luftNachOben(p) > 0)
                          .sort((a, b) => loanScore(b) - loanScore(a));
    html += '<div class="section-divider">Beste Kandidaten</div>';
    html += kandidaten.length
      ? '<p class="hint">Sortiert nach Luft nach oben (Potenzial − Overall) und Alter. 📤 markiert den Spieler als verliehen, 📥 trägt die Rückkehr ein.</p>' +
        '<ul class="card-list">' + kandidaten.slice(0, 12).map(loanCard).join('') + '</ul>' +
        (kandidaten.length > 12 ? '<p class="hint">… und ' + (kandidaten.length - 12) + ' weitere im Kader.</p>' : '')
      : '<p class="hint">Kein Spieler im Kader hat noch Luft nach oben – oder der Kader ist leer.</p>';

    html += '<div class="section-divider">So läuft der Leih-Glitch</div><ol class="step-list">' +
            LOAN_STEPS.map(s => '<li>' + s + '</li>').join('') + '</ol>';
    html += '<div class="section-divider">Wichtig dazu</div><ul class="note-list">' +
            LOAN_NOTES.map(s => '<li>' + s + '</li>').join('') + '</ul>';
    box.innerHTML = html;
  }

  function loanToggle(id) {
    const p = findSquad(id);
    if (!p) return;

    if (!p.loan) {                       // rausgehen: Ausgangswerte merken
      p.loan = { ovr: p.ovr, potMax: p.potMax };
      save('squad'); renderTeam();
      return;
    }

    openPrompt('Rückkehr aus der Leihe – ' + p.name, [
      { k: 'ovrPlus', label: 'Overall gestiegen um', type: 'number', value: '',
        hint: 'Was nach Rückkehr bzw. Abbruch dazugekommen ist. 0 = nichts passiert.' },
      { k: 'potPlus', label: 'Potenzial gestiegen um (optional)', type: 'number', value: '',
        hint: 'Darf negativ sein – eine Leihe kann das Potenzial auch senken.' }
    ], v => {
      const grenze = n => Math.max(1, Math.min(99, n));
      const dOvr = parseInt(v.ovrPlus, 10) || 0;
      const dPot = parseInt(v.potPlus, 10) || 0;

      p.ovr = grenze(p.ovr + dOvr);
      if (dPot) { p.potMin = grenze(p.potMin + dPot); p.potMax = grenze(p.potMax + dPot); }
      if (p.potMax < p.ovr) p.potMax = p.ovr;      // Potenzial kann nie unter dem Istwert liegen
      if (p.potMin < p.ovr) p.potMin = p.ovr;

      p.loans = (p.loans || []).concat([{ ovr: dOvr, pot: dPot }]);
      delete p.loan;

      // Kam der Spieler aus der Jugend, dort die neuen Werte mitführen
      const y = p.youthId ? findYouth(p.youthId) : null;
      if (y) { y.ovr = p.ovr; y.potMin = p.potMin; y.potMax = p.potMax; save('youth'); renderYouth(); }

      save('squad'); renderTeam();
    });
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
    potMin: FC_PLAYERS[i][F.POT], potMax: FC_PLAYERS[i][F.POT], age: FC_PLAYERS[i][F.AGE], club: pClub(i), src: 'db'
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
        potMin: FC_PLAYERS[i][F.POT], potMax: FC_PLAYERS[i][F.POT], age: FC_PLAYERS[i][F.AGE], club: FC_CLUBS[ci], src: 'db'
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

  // Bearbeiten (id gesetzt) oder neu anlegen (id null) – Letzteres für Spieler,
  // die es zum Karrierestart nicht gab und die deshalb in keiner Datenbank stehen.
  function squadEdit(id) {
    const p = id ? findSquad(id) : null;
    if (id && !p) return;
    openPrompt(p ? 'Spieler bearbeiten' : 'Neuen Spieler erstellen', [
      { k: 'name', label: 'Name', value: p ? p.name : '',
        hint: p ? '' : 'Für Regens, Newgens und andere Spieler, die es zum Karrierestart noch nicht gab.' },
      { k: 'pos',  label: 'Positionen (Komma-getrennt, z. B. ST, LW)', value: p ? (p.pos || []).join(', ') : '' },
      { k: 'age',  label: 'Alter', type: 'number', value: p ? p.age : '' },
      { k: 'ovr',  label: 'Overall', type: 'number', value: p ? p.ovr : '' },
      { k: 'pot',  label: 'Potenzial als Zahl (z. B. aus dem Scout-Bericht)', type: 'number',
        value: p && p.potMin === p.potMax ? p.potMax : '',
        hint: 'Leer lassen, wenn du unten den Text aus dem Kadermenü wählst.' },
      { k: 'tier', label: 'oder: Text aus dem Kadermenü', type: 'select', value: '',
        options: [{ v: '', t: '– kein Text gewählt –' }].concat(
          POTENTIAL_TIERS.map(t => ({ v: t.key, t: t.en + '  (' + rangeLabel(t) + ')' }))) },
      { k: 'club', label: 'Verein (optional)', value: p ? p.club || '' : '' }
    ], v => {
      if (!v.name) return;
      const ovr = parseInt(v.ovr, 10) || 0;
      const bereich = potBereich(v, ovr, p);
      const data = {
        name: v.name,
        pos: parsePositions(v.pos),
        age: parseInt(v.age, 10) || 0,
        ovr: ovr,
        potMin: bereich[0],
        potMax: bereich[1],
        club: v.club
      };
      if (p) Object.assign(p, data);
      else state.squad.players.push(Object.assign({ id: uid(), src: 'manual' }, data));
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
  // "87" bei bekannter Zahl, "85–89" bei einem Textbereich, "90+" wenn er nach oben offen ist
  function potLabel(o) {
    if (o.potMin === o.potMax) return String(o.potMax);
    if (o.potMax >= 99) return o.potMin + '+';
    return o.potMin + '–' + o.potMax;
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
      const jung = zuJung(y);

      return '<li class="y-card">' +
        '<div class="y-head">' +
          '<div class="p-main"><div class="p-name">' + esc(y.name) +
            (hoch ? ' <span class="promo-badge">⬆️ Senioren</span>' : '') +
            (!hoch && jung ? ' <span class="wait-badge">⏳ ab ' + HOCHZIEH_ALTER + '</span>' : '') + '</div>' +
            '<div class="p-meta">' + (y.pos || []).map(x => '<span class="pos-tag">' + x + '</span>').join('') +
            ' ' + (y.age || '?') + ' J.</div></div>' +
          '<div class="p-rat"><span class="p-ovr ' + ratClass(y.ovr) + '">' + y.ovr + '</span>' +
            '<span class="p-arrow">→</span><span class="p-pot">' + potLabel(y) + '</span></div>' +
        '</div>' +
        '<div class="growth-bar"><i style="width:' + startPct + '%"></i>' +
          '<u style="left:' + Math.min(startPct, minPct) + '%;width:' + Math.max(0, potPct - Math.min(startPct, minPct)) + '%"></u></div>' +
        '<div class="growth-lbl"><span>' + y.ovr + ' jetzt</span><span>' +
          (y.potMax >= 99 && y.potMin !== y.potMax
            ? 'noch mindestens ' + Math.max(0, y.potMin - y.ovr) + ' möglich'
            : 'noch ' + Math.max(0, y.potMax - y.ovr) + ' möglich') + '</span></div>' +
        '<div class="tier-row ' + t.farbe + '" style="margin-top:10px">' +
          '<div class="tier-en">' + esc(t.en) + '</div><div class="tier-de">' + esc(t.de) + '</div>' +
          (y.ovr < 60 ? '<span class="tier-unsure">Unter 60 Overall zeigt das Spiel noch keinen Potenzial-Text an.</span>' : '') +
        '</div>' +
        (y.note ? '<p class="hint" style="margin:8px 0 0">' + esc(y.note) + '</p>' : '') +
        sHtml +
        '<div class="y-actions" style="margin-top:10px">' +
          '<button class="mini-btn" data-action="youth-season" data-id="' + y.id + '" title="Saison eintragen">➕</button>' +
          '<button class="mini-btn" data-action="youth-compare" data-id="' + y.id + '" title="Mit Datenbank vergleichen">⚖️</button>' +
          (hoch ? '' : '<button class="mini-btn' + (jung ? ' dim' : '') + '" data-action="youth-promote" data-id="' + y.id + '"' +
                       ' title="' + (jung ? 'Erst ab ' + HOCHZIEH_ALTER + ' Jahren möglich' : 'In die Senioren hochziehen') + '">⬆️</button>') +
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
      { k: 'age',  label: 'Alter', type: 'number', value: src.age || '',
        hint: 'Ab ' + HOCHZIEH_ALTER + ' Jahren kannst du ihn in die Senioren hochziehen.' },
      { k: 'ovr',  label: 'Overall', type: 'number', value: src.ovr || '' },
      { k: 'pot',  label: 'Potenzial (genaue Zahl, falls bekannt)', type: 'number', value: (src.potMin && src.potMin === src.potMax) ? src.potMin : '' },
      { k: 'tier', label: 'oder: Text aus dem Scout-Bericht', type: 'select',
        options: [{ v: '', t: '– kein Text gewählt –' }].concat(POTENTIAL_TIERS.map(t => ({ v: t.key, t: t.en + '  (' + t.min + '–' + t.max + ')' }))),
        value: '', hint: 'Nur nötig, wenn du die genaue Zahl noch nicht siehst.' },
      { k: 'note', label: 'Notiz', type: 'textarea', value: src.note || '' }
    ], v => {
      if (!v.name) return;
      const ovr = parseInt(v.ovr, 10) || 0;
      const bereich = potBereich(v, ovr, y);
      const data = { name: v.name, pos: parsePositions(v.pos), age: parseInt(v.age, 10) || 0, ovr: ovr,
                     potMin: bereich[0], potMax: bereich[1], note: v.note };
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

  // FC 26 lässt einen Jugendspieler frühestens mit 16 in die Senioren.
  // Ohne eingetragenes Alter lässt sich das nicht beurteilen -> nicht blockieren.
  const HOCHZIEH_ALTER = 16;
  const zuJung = y => y.age > 0 && y.age < HOCHZIEH_ALTER;

  function youthPromote(id) {
    const y = findYouth(id);
    if (!y) return;
    if (promotedOf(id)) { alert(y.name + ' steht schon im Seniorenkader.'); return; }
    if (zuJung(y)) {
      alert(y.name + ' ist erst ' + y.age + ' Jahre alt.\n\nIn FC 26 kannst du einen Jugendspieler frühestens mit ' +
            HOCHZIEH_ALTER + ' in die Senioren hochziehen – also in ' + (HOCHZIEH_ALTER - y.age) +
            (HOCHZIEH_ALTER - y.age === 1 ? ' Jahr.' : ' Jahren.') +
            '\n\nTrage über ➕ eine Saison mit dem neuen Alter ein, sobald es so weit ist.');
      return;
    }
    state.squad.players.push({
      id: uid(), youthId: y.id, name: y.name, pos: y.pos, ovr: y.ovr,
      potMin: y.potMin, potMax: y.potMax, age: y.age, club: 'aus der Jugend', note: y.note, src: 'youth'
    });
    save('squad'); renderYouth(); renderTeam();
    alert(y.name + ' ist jetzt im Seniorenkader.\n\nÄnderst du hier seine Werte oder trägst eine Saison ein, wird der Eintrag im Team-Tab automatisch mitgezogen.');
  }

  // Werte aus der Jugend in den verknüpften Kadereintrag übernehmen
  function syncPromoted(y) {
    const p = promotedOf(y.id);
    if (!p) return;
    p.name = y.name; p.pos = y.pos; p.age = y.age; p.ovr = y.ovr;
    p.potMin = y.potMin; p.potMax = y.potMax; p.note = y.note;
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

  // ===================== Karriere-Stände =====================
  const careerOf = id => careers.find(c => c.id === id);

  function renderCareerName() {
    const c = careerOf(activeCareer);
    $('#careerName').textContent = c ? c.name : 'Karriere';
    syncHeaderHeight();
  }

  // Kurzinfo direkt aus dem Speicher der jeweiligen Karriere
  function careerInfo(id) {
    let squad = null, youth = null;
    try { squad = JSON.parse(localStorage.getItem(storeKey('squad', id))); } catch (e) { /* egal */ }
    try { youth = JSON.parse(localStorage.getItem(storeKey('youth', id))); } catch (e) { /* egal */ }
    const n = squad && Array.isArray(squad.players) ? squad.players.length : 0;
    const j = Array.isArray(youth) ? youth.length : 0;
    return (squad && squad.club ? esc(squad.club) + ' · ' : '') + n + ' Spieler · ' + j + ' Talente';
  }

  function openCareers() {
    const html = '<h3>Karrieren</h3>' +
      '<p class="hint">Jeder Stand hat eigenen Kader, eigene Aufstellung und eigene Talente. Umschalten geht jederzeit – gespeichert wird automatisch.</p>' +
      '<ul class="card-list">' + careers.map(c => {
        const aktiv = c.id === activeCareer;
        return '<li class="p-card' + (aktiv ? ' career-active' : '') + '">' +
          '<button class="career-pick" data-action="career-switch" data-cid="' + c.id + '">' +
            '<div class="p-name">' + esc(c.name) + (aktiv ? ' <span class="promo-badge">aktiv</span>' : '') + '</div>' +
            '<div class="p-meta">' + careerInfo(c.id) + '</div>' +
          '</button>' +
          '<div class="y-actions">' +
            '<button class="mini-btn" data-action="career-rename" data-cid="' + c.id + '" title="Umbenennen">✏️</button>' +
            '<button class="mini-btn" data-action="career-copy" data-cid="' + c.id + '" title="Kopieren">⧉</button>' +
            (careers.length > 1 ? '<button class="mini-btn" data-action="career-del" data-cid="' + c.id + '" title="Löschen">🗑️</button>' : '') +
          '</div></li>';
      }).join('') + '</ul>' +
      '<div class="md-actions"><button class="primary-btn" data-action="career-new">+ Neue Karriere</button></div>';
    openModal(html);
  }

  function careerSwitch(id) {
    if (!careerOf(id) || id === activeCareer) { closeModal(); return; }
    saveAll();                       // aktuellen Stand sichern, bevor umgeschaltet wird
    activeCareer = id;
    localStorage.setItem(CAREER_ACTIVE, id);
    load();
    renderCareerName(); renderAll(); closeModal();
  }

  function careerNew() {
    openPrompt('Neue Karriere', [
      { k: 'name', label: 'Name', value: 'Karriere ' + (careers.length + 1),
        hint: 'z. B. „Dortmund 2. Saison“ oder „Rebuild Milan“.' }
    ], v => {
      const id = 'fc_c' + Date.now().toString(36);
      careers.push({ id: id, name: v.name || 'Karriere ' + (careers.length + 1) });
      saveCareers();
      saveAll();
      activeCareer = id;
      localStorage.setItem(CAREER_ACTIVE, id);
      PARTS.forEach(k => { state[k] = clone(DEFAULT_DATA[k]); });
      ensureStructure(); saveAll();
      renderCareerName(); renderAll(); closeModal();
    });
  }

  function careerRename(id) {
    const c = careerOf(id);
    if (!c) return;
    openPrompt('Karriere umbenennen', [{ k: 'name', label: 'Name', value: c.name }], v => {
      if (!v.name) return;
      c.name = v.name; saveCareers(); renderCareerName(); openCareers();
    });
  }

  function careerCopy(id) {
    const c = careerOf(id);
    if (!c) return;
    if (id === activeCareer) saveAll();     // damit die Kopie den aktuellen Stand trifft
    const neu = 'fc_c' + Date.now().toString(36);
    PARTS.forEach(k => {
      const raw = localStorage.getItem(storeKey(k, id));
      if (raw != null) localStorage.setItem(storeKey(k, neu), raw);
    });
    careers.push({ id: neu, name: c.name + ' (Kopie)' });
    saveCareers(); openCareers();
  }

  function careerDel(id) {
    const c = careerOf(id);
    if (!c || careers.length < 2) return;
    if (!confirm('Karriere „' + c.name + '“ mit Kader und allen Talenten endgültig löschen?')) return;
    PARTS.forEach(k => localStorage.removeItem(storeKey(k, id)));
    careers = careers.filter(x => x.id !== id);
    saveCareers();
    if (id === activeCareer) {
      activeCareer = careers[0].id;
      localStorage.setItem(CAREER_ACTIVE, activeCareer);
      load(); renderCareerName(); renderAll();
    }
    openCareers();
  }

  // ===================== Export / Import / Reset =====================
  // Exportiert die AKTIVE Karriere. Schlüssel bleiben "fc_squad" usw.,
  // damit ältere Backups weiterhin eingelesen werden können.
  function exportData() {
    const c = careerOf(activeCareer);
    const dump = { _meta: { app: 'fc26-karriere', version: 2, karriere: c ? c.name : '', exported: new Date().toISOString() } };
    PARTS.forEach(k => dump['fc_' + k] = state[k]);
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (c ? c.name : 'karriere').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = 'fc26-' + (name || 'karriere') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      let d;
      try { d = JSON.parse(r.result); }
      catch (e) { alert('Import fehlgeschlagen: Datei ist kein gültiges JSON.'); return; }
      if (!PARTS.some(k => d['fc_' + k] != null)) { alert('Import fehlgeschlagen: keine bekannten Daten in der Datei.'); return; }

      const herkunft = d._meta && d._meta.karriere ? d._meta.karriere : '';
      openPrompt('Backup einlesen', [
        { k: 'ziel', label: 'Wohin?', type: 'select', value: 'new',
          options: [
            { v: 'new', t: 'als neue Karriere anlegen' },
            { v: 'cur', t: 'aktuelle Karriere überschreiben' }
          ],
          hint: herkunft ? 'Backup stammt aus „' + herkunft + '“.' : '' },
        { k: 'name', label: 'Name der neuen Karriere', value: herkunft || 'Import' }
      ], v => {
        if (v.ziel === 'cur') {
          if (!confirm('Die aktuelle Karriere wird überschrieben. Das kann nicht rückgängig gemacht werden. Fortfahren?')) return;
        } else {
          const id = 'fc_c' + Date.now().toString(36);
          careers.push({ id: id, name: v.name || 'Import' });
          saveCareers();
          saveAll();                 // bisherigen Stand sichern
          activeCareer = id;
          localStorage.setItem(CAREER_ACTIVE, id);
          PARTS.forEach(k => { state[k] = clone(DEFAULT_DATA[k]); });
        }
        PARTS.forEach(k => { if (d['fc_' + k] != null) state[k] = d['fc_' + k]; });
        ensureStructure(); saveAll(); renderCareerName(); renderAll();
        alert('Import erfolgreich.');
      });
    };
    r.readAsText(file);
  }

  function resetAll() {
    const c = careerOf(activeCareer);
    if (!confirm('Kader, Aufstellung und alle Jugendspieler der Karriere „' + (c ? c.name : '') + '“ löschen und zurücksetzen?')) return;
    if (!confirm('Wirklich sicher? Tipp: vorher exportieren. Endgültig zurücksetzen?')) return;
    PARTS.forEach(k => { state[k] = clone(DEFAULT_DATA[k]); });
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
    const cid = btn.dataset.cid;
    const slot = btn.dataset.slot != null ? +btn.dataset.slot : null;

    switch (a) {
      case 'careers':        openCareers(); break;
      case 'career-switch':  careerSwitch(cid); break;
      case 'career-new':     careerNew(); break;
      case 'career-rename':  careerRename(cid); break;
      case 'career-copy':    careerCopy(cid); break;
      case 'career-del':     careerDel(cid); break;

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
      case 'squad-new':     squadEdit(null); break;
      case 'loan-toggle':   loanToggle(id); break;
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
  loadCareers();
  load();
  syncHeaderHeight();
  renderCareerName();
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
