(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $$ } = PNS;

  const ROLE_KEYS = ['Shooter', 'Fighter', 'Rider'];

  function normalizeRole(text) {
    const raw = String(text || '').trim();
    if (!raw) return 'Unknown';
    if (/(shoot|стрел|стріл|стріле|shooter|marksman|tirador|射手|弓兵|狙撃|狙击|사수)/i.test(raw)) return 'Shooter';
    if (/(fight|infantry|боец|боєц|fighter|пехот|піхот|战士|步兵|歩兵|전투)/i.test(raw)) return 'Fighter';
    if (/(ride|rider|наезд|наїзд|cavalry|кавал|骑|骑兵|騎兵|기병|ライダー)/i.test(raw)) return 'Rider';
    return raw;
  }

  function normalizeTierText(v) {
    const raw = String(v || '').trim();
    if (!raw) return '';
    const m = raw.toUpperCase().match(/T\s*([0-9]{1,2})/);
    if (m) return `T${m[1]}`;
    const d = raw.match(/\b([0-9]{1,2})\b/);
    if (d) return `T${d[1]}`;
    return raw.toUpperCase();
  }

  function tierRank(tier) {
    const n = parseInt(String(tier).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeYesNo(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    if (['yes','y','1','true','да','так','готов','ready'].some(x => s === x || s.includes(x))) return true;
    if (['no','n','0','false','нет','ні','не'].some(x => s === x || s.includes(x))) return false;
    return /yes|да|так|ready/.test(s);
  }

  function normalizeShiftValue(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return 'both';
    if (/both|all|1\s*[,/;+&]\s*2|2\s*[,/;+&]\s*1|две|обе|обидві/.test(s)) return 'both';
    if (/shift\s*1|^1$|перв|перша|first/.test(s)) return 'shift1';
    if (/shift\s*2|^2$|втор|друга|second/.test(s)) return 'shift2';
    if (s === 'shift1' || s === 'shift2' || s === 'both') return s;
    return 'both';
  }

  function normalizeShiftLabel(v) {
    const n = normalizeShiftValue(v);
    return n === 'shift1' ? 'Shift 1' : n === 'shift2' ? 'Shift 2' : 'Both';
  }

  function formatShiftLabelForCell(shift) {
    return shift === 'shift1' ? 'Shift 1' : shift === 'shift2' ? 'Shift 2' : 'Both';
  }

  function getPlayerRows() {
    const table = PNS.controls?.playersDataTable || document.querySelector('#playersDataTable');
    const tbody = table ? table.querySelector('tbody') : null;
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr'));
  }

  /**
   * Прив'язує DOM-рядки до існуючих state.players (після htmx swap).
   * Не змінює дані гравців, тільки rowEl/actionCellEl + dataset.
   */
  function relinkPlayersToDOM() {
    const rows = getPlayerRows();
    if (!rows.length) return false;

    // Якщо в DOM є data-player-id — юзаємо його.
    const byId = new Map();
    rows.forEach((tr) => {
      const pid = tr.dataset.playerId;
      if (pid) byId.set(pid, tr);
    });

    // Якщо нема data-player-id — пробуємо по порядку (index) як fallback.
    const hasIds = byId.size > 0;

    if (!Array.isArray(state.players) || !state.players.length) return false;

    state.players.forEach((p, idx) => {
      const tr = hasIds ? byId.get(p.id) : rows[idx];
      if (!tr) return;

      p.rowEl = tr;
      p.actionCellEl =
        tr.querySelector('td[data-field="actions"]') ||
        tr.querySelector('td[data-col-key="actions"]') ||
        tr.querySelector('td:last-child');

      // оновлюємо dataset, щоб фільтри/shift працювали
      tr.dataset.playerId = p.id;
      tr.dataset.shift = p.shift || tr.dataset.shift || 'both';
    });

    // rebuild lookup map safely
    state.playerById = new Map(state.players.map(p => [p.id, p]));
    return true;
  }

  /**
   * Парсить демо-таблицю в state.players (як раніше).
   * Використовуй лише коли state.players пустий.
   */
  function parsePlayersFromTable() {
    const rows = getPlayerRows();
    if (!rows.length) return;

    state.players = [];
    state.playerById = new Map();

    rows.forEach((tr, idx) => {
      const tds = Array.from(tr.querySelectorAll('td'));

      const byField = (f) => tr.querySelector(`td[data-field="${f}"]`)?.textContent?.trim() || '';
      const byColKey = (k) => tr.querySelector(`td[data-col-key="${k}"]`)?.textContent?.trim() || '';

      const roleText =
        byField('role') ||
        byField('focus_troop') ||
        tds[2]?.textContent?.trim() ||
        '';

      const tierText =
        byField('tier') ||
        tds[3]?.textContent?.trim() ||
        '';

      const marchText =
        byField('march') ||
        tds[4]?.textContent?.trim() ||
        '';

      const rallyText =
        byField('rally') ||
        byColKey('rally_size') ||
        '';

      const capText =
        byField('captainReady') ||
        tds[6]?.textContent?.trim() ||
        '';

      const shiftText =
        byField('shiftLabel') ||
        tds[7]?.textContent?.trim() ||
        tr.dataset.shift ||
        'Both';

      const player = {
        id: `p${idx + 1}`,
        name: byField('name') || tds[0]?.textContent?.trim() || '',
        alliance: byField('alliance') || byColKey('alliance') || tds[1]?.textContent?.trim() || '',
        role: normalizeRole(roleText),
        tier: normalizeTierText(tierText),
        tierRank: tierRank(tierText),
        march: PNS.parseNumber(marchText),
        rally: PNS.parseNumber(rallyText),
        captainReady: normalizeYesNo(capText),
        shift: normalizeShiftValue(shiftText),
        shiftLabel: normalizeShiftLabel(shiftText),
        lairLevel: byField('lair') || byColKey('lair_level') || '',
        secondaryRole: normalizeRole(byField('secondary_role') || byColKey('secondary_role') || ''),
        secondaryTier: normalizeTierText(byField('secondary_tier') || byColKey('secondary_tier') || ''),
        troop200k: byField('troop_200k') || byColKey('troop_200k') || '',
        notes: byField('notes') || byColKey('notes') || '',
        raw: {},
        rowEl: tr,
        actionCellEl:
          tr.querySelector('td[data-field="actions"]') ||
          tr.querySelector('td[data-col-key="actions"]') ||
          tds.at(-1),
        assignment: null,
      };

      tr.dataset.playerId = player.id;
      tr.dataset.shift = player.shift;

      state.players.push(player);
      state.playerById.set(player.id, player);
    });
  }

  /**
   * Smart init:
   * - якщо є state.players (імпорт) → просто relink DOM
   * - якщо нема → парсимо демо таблицю
   */
  function ensurePlayersLinked() {
    const hasPlayers = Array.isArray(state.players) && state.players.length > 0;
    if (hasPlayers) {
      const ok = relinkPlayersToDOM();
      if (!ok) {
        // Після HTMX/partials таблиця часто приходить з порожнім <tbody>.
        // У такому випадку потрібно не тільки relink, а ПЕРЕМАЛЮВАТИ rows зі state.
        const table = PNS.controls?.playersDataTable || document.querySelector('#playersDataTable');
        const tbody = table?.querySelector('tbody');
        const hasTableShell = !!table;
        const hasRenderedRows = !!tbody && tbody.querySelectorAll('tr').length > 0;

        if (hasTableShell && !hasRenderedRows && typeof PNS.renderPlayersTableFromState === 'function') {
          try {
            PNS.renderPlayersTableFromState();
            relinkPlayersToDOM();
          } catch (e) {
            console.warn('[players_parse] failed to re-render players table from state', e);
          }
        }
        // якщо таблиці ще нема в DOM — нічого не робимо (пізніший retry спрацює)
      }
      return;
    }
    parsePlayersFromTable();
  }

  // expose
  PNS.ROLE_KEYS = ROLE_KEYS;
  PNS.normalizeRole = normalizeRole;
  PNS.normalizeTierText = normalizeTierText;
  PNS.tierRank = tierRank;
  PNS.normalizeYesNo = normalizeYesNo;
  PNS.normalizeShiftValue = normalizeShiftValue;
  PNS.normalizeShiftLabel = normalizeShiftLabel;
  PNS.formatShiftLabelForCell = formatShiftLabelForCell;

  PNS.parsePlayersFromTable = parsePlayersFromTable;
  PNS.relinkPlayersToDOM = relinkPlayersToDOM;
  PNS.ensurePlayersLinked = ensurePlayersLinked;

  /**
   * Автоматично розподіляє гравців між Shift 1 / Shift 2 (приблизно 50/50).
   *
   * За замовчуванням режим "respect":
   * - shift1/shift2 лишає як є
   * - only 'both'/порожні перерозподіляє для балансу
   *
   * Режим "force":
   * - ігнорує поточний shift у всіх та робить чистий 50/50 розподіл.
   */
  function autoBalanceTwoShifts(players, opts = {}) {
    const list = Array.isArray(players)
      ? players
      : (Array.isArray(state.players) ? state.players : []);

    if (!list.length) return { shift1: 0, shift2: 0 };

    const mode = (opts.mode === 'force') ? 'force' : 'respect';
    const total = list.length;
    const max1 = Number.isFinite(opts.maxShift1)
      ? Math.max(0, Math.floor(opts.maxShift1))
      : Math.ceil(total / 2);
    const max2 = Number.isFinite(opts.maxShift2)
      ? Math.max(0, Math.floor(opts.maxShift2))
      : (total - max1);

    // нормалізуємо shift
    list.forEach((p) => {
      p.shift = normalizeShiftValue(p.shift || p.shiftLabel || 'both');
    });

    if (mode === 'force') {
      // спочатку всіх робимо "both", щоб не було впливу старих значень
      list.forEach((p) => {
        p.shift = 'both';
        p.shiftLabel = formatShiftLabelForCell('both');
        if (p.rowEl) p.rowEl.dataset.shift = 'both';
      });
    }

    let c1 = list.filter((p) => p.shift === 'shift1').length;
    let c2 = list.filter((p) => p.shift === 'shift2').length;

    // пул для розподілу
    const pool = (mode === 'force')
      ? list.slice()
      : list.filter((p) => !p.shift || p.shift === 'both');

    // трохи стабільніший баланс: сортуємо по ролі та march (desc)
    const roleOrder = { Fighter: 0, Rider: 1, Shooter: 2, Unknown: 3 };
    pool.sort((a, b) => {
      const ra = roleOrder[normalizeRole(a.role)] ?? 99;
      const rb = roleOrder[normalizeRole(b.role)] ?? 99;
      if (ra !== rb) return ra - rb;
      const ma = Number(a.march || 0);
      const mb = Number(b.march || 0);
      if (mb !== ma) return mb - ma;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    for (const p of pool) {
      // якщо це режим respect і гравець вже має shift1/shift2 — пропускаємо
      if (mode !== 'force' && (p.shift === 'shift1' || p.shift === 'shift2')) continue;

      let target = null;
      if (c1 >= max1) target = 'shift2';
      else if (c2 >= max2) target = 'shift1';
      else target = (c1 <= c2) ? 'shift1' : 'shift2';

      p.shift = target;
      p.shiftLabel = formatShiftLabelForCell(target);
      if (p.rowEl) {
        p.rowEl.dataset.shift = target;
        const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
        if (cell) cell.textContent = p.shiftLabel;
      }

      if (target === 'shift1') c1++; else c2++;
    }

    return { shift1: c1, shift2: c2 };
  }

  PNS.autoBalanceTwoShifts = autoBalanceTwoShifts;

  // ===== Shift breakdown + manual split helpers =====
  function getShiftCounts(players) {
    const list = Array.isArray(players) ? players : (Array.isArray(state.players) ? state.players : []);
    const out = { shift1: 0, shift2: 0, both: 0, total: 0 };
    if (!list.length) return out;
    for (const p of list) {
      const s = normalizeShiftValue(p?.shift || p?.shiftLabel || 'both');
      if (s === 'shift1') out.shift1++;
      else if (s === 'shift2') out.shift2++;
      else out.both++;
    }
    out.total = out.shift1 + out.shift2 + out.both;
    return out;
  }

  function updateShiftBreakdownUI() {
    const c = getShiftCounts(state.players);
    const text = `${c.shift1} / ${c.shift2} / ${c.both}`;
    const elMain = document.getElementById('shiftBreakdownText');
    if (elMain) elMain.textContent = text;
    const elInline = document.getElementById('shiftBreakdownInline');
    if (elInline) elInline.textContent = `${text}  (total ${c.total})`;

    // helpful placeholders
    const a1 = document.getElementById('shiftAddS1');
    const a2 = document.getElementById('shiftAddS2');
    if (a1 && !a1.placeholder) a1.placeholder = '+S1';
    if (a2 && !a2.placeholder) a2.placeholder = '+S2';
  }

  function setPlayerShift(p, shift) {
    const s = normalizeShiftValue(shift);
    p.shift = s;
    p.shiftLabel = formatShiftLabelForCell(s);
    if (p.rowEl) {
      p.rowEl.dataset.shift = s;
      const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
      if (cell) cell.textContent = p.shiftLabel;
    }
  }

  /**
   * Додає N гравців у Shift 1 / Shift 2 (беручи з Both).
   *
   * opts.force=true:
   *   - спочатку всіх робить Both
   *   - потім кладе рівно shift1Add / shift2Add (якщо вистачає людей)
   */
  function addPlayersToShifts(players, opts = {}) {
    const list = Array.isArray(players)
      ? players
      : (Array.isArray(state.players) ? state.players : []);
    if (!list.length) return { added1: 0, added2: 0, counts: getShiftCounts(list) };

    const force = !!opts.force;
    let add1 = Math.max(0, Math.floor(Number(opts.shift1Add || 0)));
    let add2 = Math.max(0, Math.floor(Number(opts.shift2Add || 0)));

    // нормалізуємо shift
    list.forEach((p) => { p.shift = normalizeShiftValue(p.shift || p.shiftLabel || 'both'); });

    if (force) {
      list.forEach((p) => setPlayerShift(p, 'both'));
    }

    // кандидати — only Both
    const pool = list.filter((p) => normalizeShiftValue(p.shift || 'both') === 'both');

    // стабільний/передбачуваний відбір: роль + march (desc) + name
    const roleOrder = { Fighter: 0, Rider: 1, Shooter: 2, Unknown: 3 };
    pool.sort((a, b) => {
      const ra = roleOrder[normalizeRole(a.role)] ?? 99;
      const rb = roleOrder[normalizeRole(b.role)] ?? 99;
      if (ra !== rb) return ra - rb;
      const ma = Number(a.march || 0);
      const mb = Number(b.march || 0);
      if (mb !== ma) return mb - ma;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    let i = 0;
    let added1 = 0;
    let added2 = 0;
    while (i < pool.length && (add1 > 0 || add2 > 0)) {
      // беремо в ту зміну, де більше "потрібно" зараз
      const takeShift = (add1 > 0 && (add1 >= add2 || add2 <= 0)) ? 'shift1' : 'shift2';
      const p = pool[i++];
      setPlayerShift(p, takeShift);
      if (takeShift === 'shift1') { add1--; added1++; }
      else { add2--; added2++; }
    }

    return { added1, added2, counts: getShiftCounts(list) };
  }

  PNS.getShiftCounts = getShiftCounts;
  PNS.updateShiftBreakdownUI = updateShiftBreakdownUI;
  PNS.addPlayersToShifts = addPlayersToShifts;

  // initial run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensurePlayersLinked();
      try { updateShiftBreakdownUI(); } catch {}
    });
  } else {
    ensurePlayersLinked();
    try { updateShiftBreakdownUI(); } catch {}
  }

  // keep breakdown in sync
  document.addEventListener('players-table-rendered', () => {
    try { updateShiftBreakdownUI(); } catch {}
  });

  // after partial swaps (from ns.js)
  document.addEventListener('pns:dom:refreshed', () => {
    ensurePlayersLinked();
    try { updateShiftBreakdownUI(); } catch {}
  });

  // UI handlers (delegated) — safe across HTMX swaps
  if (!state._shiftSplitUiBound) {
    state._shiftSplitUiBound = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#applyShiftAddBtn');
      if (!btn) return;
      e.preventDefault();

      const add1 = Number(document.getElementById('shiftAddS1')?.value || 0);
      const add2 = Number(document.getElementById('shiftAddS2')?.value || 0);
      const force = !!document.getElementById('shiftSplitForceChk')?.checked;

      const res = addPlayersToShifts(state.players, { shift1Add: add1, shift2Add: add2, force });

      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.applyPlayerTableFilters?.(); } catch {}
      try { updateShiftBreakdownUI(); } catch {}

      // nice feedback if import status exists
      try {
        PNS.setImportStatus?.(
          `Shift updated: +${res.added1} to Shift 1, +${res.added2} to Shift 2. Now ${res.counts.shift1}/${res.counts.shift2}/${res.counts.both}.`,
          'good'
        );
      } catch {}
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#split5050Btn');
      if (!btn) return;
      e.preventDefault();
      const force = !!document.getElementById('shiftSplitForceChk')?.checked;
      const mode = force ? 'force' : 'respect';
      try { autoBalanceTwoShifts(state.players, { mode }); } catch {}
      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.applyPlayerTableFilters?.(); } catch {}
      try { updateShiftBreakdownUI(); } catch {}
    });
  }

})();