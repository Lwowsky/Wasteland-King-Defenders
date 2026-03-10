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

    const compact = s
      .replace(/[–—−]/g, '-')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (
      /^(both|all|any|both shifts?|all shifts?)$/.test(compact) ||
      /(both|all shifts?|обе|обидв|обидві|оба|две|дві|any shift|будь-як|будь яка|обидва)/.test(compact) ||
      /(^|\s)(1\s*[/,+;&-]\s*2|2\s*[/,+;&-]\s*1)(\s|$)/.test(compact)
    ) return 'both';

    if (
      /^(1|s1|shift ?1|1st|first|перша|перший|перша зміна|зміна 1|змiна 1|смена 1|1 зміна|1 смена)$/.test(compact) ||
      /(^|\s)(shift|зміна|змiна|смена)\s*[-: ]*1(\s|$)/.test(compact) ||
      /(^|\s)1(st)?\s*(shift|зміна|змiна|смена)?(\s|$)/.test(compact) ||
      /(first|перш|перша|перший)/.test(compact)
    ) return 'shift1';

    if (
      /^(2|s2|shift ?2|2nd|second|друга|другий|друга зміна|зміна 2|змiна 2|смена 2|2 зміна|2 смена)$/.test(compact) ||
      /(^|\s)(shift|зміна|змiна|смена)\s*[-: ]*2(\s|$)/.test(compact) ||
      /(^|\s)2(nd)?\s*(shift|зміна|змiна|смена)?(\s|$)/.test(compact) ||
      /(second|друг|втор)/.test(compact)
    ) return 'shift2';

    if (compact === 'shift1' || compact === 'shift2' || compact === 'both') return compact;
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
  function ensureTowerCalcShiftUi() {
    const root = document.getElementById('towerCalcShiftBalance');
    if (!root) return false;

    const cards = root.querySelector('.tower-calc-shift-cards');
    if (cards) cards.style.display = 'none';

    const head = root.querySelector('.tower-calc-shift-balance-head');
    const line = root.querySelector('#towerCalcShiftCountsLine');
    if (head && line) {
      head.style.display = 'block';
      line.style.marginTop = '4px';
      line.style.fontWeight = '600';
    }

    const left = root.querySelector('.tower-calc-shift-controls-left');
    if (!left) return true;

    const restore = root.querySelector('#towerCalcRestoreImportShiftsBtn') || document.getElementById('towerCalcRestoreImportShiftsBtn');
    if (restore && restore.parentNode !== left) left.appendChild(restore);

    try { syncTowerCalcShiftLimitUi(); } catch {}
    return true;
  }


  // ===== Shift breakdown + manual split helpers =====

  function getRawRegisteredShiftText(player) {
    if (!player || typeof player !== 'object') return '';
    const direct = String(player.registeredShiftRaw || '').trim();
    if (direct) return direct;

    const mappedKey = state?.importData?.mapping?.shift_availability;
    if (mappedKey && player.raw && String(player.raw[mappedKey] || '').trim()) {
      return String(player.raw[mappedKey] || '').trim();
    }

    const raw = player.raw;
    if (raw && typeof raw === 'object') {
      const keys = Object.keys(raw);
      const hit = keys.find((k) => /(shift|availability|зміна|змiна|смена|черга|очеред)/i.test(String(k || '')) && String(raw[k] || '').trim());
      if (hit) return String(raw[hit] || '').trim();
    }

    const rows = Array.isArray(state?.importData?.rows) ? state.importData.rows : [];
    const mapping = state?.importData?.mapping || {};
    const nameKey = mapping.player_name;
    const shiftKey = mapping.shift_availability;
    const playerName = String(player.name || '').trim().toLowerCase();
    if (rows.length && nameKey && shiftKey && playerName) {
      const row = rows.find((r) => String(r?.[nameKey] || '').trim().toLowerCase() === playerName);
      const fromRow = row ? String(row?.[shiftKey] || '').trim() : '';
      if (fromRow) return fromRow;
    }

    return '';
  }

  function getRegisteredShiftForPlayer(player) {
    const raw = getRawRegisteredShiftText(player);
    if (raw) {
      const normRaw = normalizeShiftValue(raw);
      const low = String(raw || '').trim().toLowerCase();
      const looksKnown = /(both|all|1\s*[,/;+&-]\s*2|2\s*[,/;+&-]\s*1|две|обе|обидв|оба|any shift|будь-як|shift\s*1|shift\s*2|зміна\s*1|зміна\s*2|змiна\s*1|змiна\s*2|смена\s*1|смена\s*2|1st\s*shift|2nd\s*shift|first|second|перш|перша|перв|друг|втор)/i.test(low);
      if (looksKnown || normRaw !== 'both') return normRaw;
      return 'unknown';
    }

    const reg = String(player?.registeredShift || player?.registeredShiftLabel || '').trim();
    if (reg) {
      const normReg = normalizeShiftValue(reg);
      const low = reg.toLowerCase();
      const looksKnown = /(both|shift\s*1|shift\s*2|1st\s*shift|2nd\s*shift|first|second|перш|перша|перв|друг|втор)/i.test(low);
      if (looksKnown || normReg !== 'both') return normReg;
      return 'unknown';
    }

    return 'unknown';
  }

  function restorePlayerShiftsFromImport(players) {
    const list = Array.isArray(players) ? players : (Array.isArray(state.players) ? state.players : []);
    if (!list.length) return { shift1: 0, shift2: 0, both: 0, unknown: 0, total: 0 };
    list.forEach((p) => {
      const reg = getRegisteredShiftForPlayer(p);
      const safe = reg === 'shift1' || reg === 'shift2' || reg === 'both' ? reg : 'both';
      setPlayerShift(p, safe);
    });
    return getRegisteredShiftCounts(list);
  }

  function getRegisteredShiftCounts(players) {
    const list = Array.isArray(players) ? players : (Array.isArray(state.players) ? state.players : []);
    const out = { shift1: 0, shift2: 0, both: 0, unknown: 0, total: 0 };
    if (!list.length) return out;
    for (const p of list) {
      const s = getRegisteredShiftForPlayer(p);
      if (s === 'shift1') out.shift1++;
      else if (s === 'shift2') out.shift2++;
      else if (s === 'both') out.both++;
      else out.unknown++;
    }
    out.total = out.shift1 + out.shift2 + out.both + out.unknown;
    return out;
  }

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


  function clampShiftLimitValue(v, fallback = 100) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
  }

  function getTowerCalcShiftLimits() {
    const tc = (state.towerCalc && typeof state.towerCalc === 'object') ? state.towerCalc : (state.towerCalc = {});
    const saved1 = tc.shiftPlayerLimit1;
    const saved2 = tc.shiftPlayerLimit2;
    const ui1 = document.getElementById('shiftLimitS1');
    const ui2 = document.getElementById('shiftLimitS2');
    const limit1 = clampShiftLimitValue(ui1?.value ?? saved1, 100);
    const limit2 = clampShiftLimitValue(ui2?.value ?? saved2, 100);
    tc.shiftPlayerLimit1 = limit1;
    tc.shiftPlayerLimit2 = limit2;
    return { shift1: limit1, shift2: limit2 };
  }

  function syncTowerCalcShiftLimitUi() {
    const limits = getTowerCalcShiftLimits();
    const a = document.getElementById('shiftLimitS1');
    const b = document.getElementById('shiftLimitS2');
    if (a) a.value = String(limits.shift1);
    if (b) b.value = String(limits.shift2);
    return limits;
  }

  function updateShiftBreakdownUI() {
    const c = getShiftCounts(state.players);
    const limits = syncTowerCalcShiftLimitUi();
    const text = `${c.shift1} / ${c.shift2} / ${c.both}`;
    const elMain = document.getElementById('shiftBreakdownText');
    if (elMain) elMain.textContent = text;
    const elInline = document.getElementById('shiftBreakdownInline');
    if (elInline) elInline.textContent = `${text}  (усього ${c.total})`;

    const a1 = document.getElementById('shiftAddS1');
    const a2 = document.getElementById('shiftAddS2');
    if (a1 && !a1.placeholder) a1.placeholder = '+ Shift 1';
    if (a2 && !a2.placeholder) a2.placeholder = '+ Shift 2';
    const l1 = document.getElementById('shiftLimitS1');
    const l2 = document.getElementById('shiftLimitS2');
    if (l1) {
      l1.min = '0';
      l1.max = '100';
      l1.title = 'Максимум 100 гравців у Shift 1';
    }
    if (l2) {
      l2.min = '0';
      l2.max = '100';
      l2.title = 'Максимум 100 гравців у Shift 2';
    }
    const note = document.getElementById('towerCalcShiftLimitNote');
    if (note) {
      const warn = [];
      if (c.shift1 > limits.shift1) warn.push(`Shift 1 переповнений на ${c.shift1 - limits.shift1}`);
      if (c.shift2 > limits.shift2) warn.push(`Shift 2 переповнений на ${c.shift2 - limits.shift2}`);
      note.textContent = warn.length ? warn.join(' · ') : `Ліміти зміщень: Shift 1 — ${limits.shift1}, Shift 2 — ${limits.shift2} (макс. 100).`;
    }
  }


  function refreshTowerCalcAfterShiftChange() {
    try { syncTowerCalcShiftLimitUi(); } catch {}
    try { updateShiftBreakdownUI(); } catch {}

    const modal = document.getElementById('towerCalcModal');

    try { window.calcUpdateShiftStatsUI?.(modal); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
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

  function movePlayerToShiftWithLimits(playerOrId, targetShift) {
    const target = normalizeShiftValue(targetShift);
    const player = (typeof playerOrId === 'object' && playerOrId) ? playerOrId : state.playerById?.get?.(String(playerOrId || ''));
    if (!player) return { ok: false, reason: 'not-found' };
    const current = normalizeShiftValue(player.shift || player.shiftLabel || 'both');
    if (current === target) return { ok: true, reason: 'same' };
    const limits = getTowerCalcShiftLimits();
    const counts = getShiftCounts(state.players);
    if (target === 'shift1' && current !== 'shift1' && counts.shift1 >= limits.shift1) return { ok: false, reason: 'limit-shift1', counts, limits };
    if (target === 'shift2' && current !== 'shift2' && counts.shift2 >= limits.shift2) return { ok: false, reason: 'limit-shift2', counts, limits };
    setPlayerShift(player, target);
    return { ok: true, reason: 'moved', counts: getShiftCounts(state.players), limits };
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
    const limits = {
      shift1: clampShiftLimitValue(opts.maxShift1, getTowerCalcShiftLimits().shift1),
      shift2: clampShiftLimitValue(opts.maxShift2, getTowerCalcShiftLimits().shift2),
    };

    list.forEach((p) => { p.shift = normalizeShiftValue(p.shift || p.shiftLabel || 'both'); });

    if (force) {
      list.forEach((p) => setPlayerShift(p, 'both'));
    }

    const counts = getShiftCounts(list);
    let cur1 = counts.shift1;
    let cur2 = counts.shift2;

    const pool = list.filter((p) => normalizeShiftValue(p.shift || 'both') === 'both');

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
      const can1 = add1 > 0 && cur1 < limits.shift1;
      const can2 = add2 > 0 && cur2 < limits.shift2;
      if (!can1 && !can2) break;

      const takeShift = (can1 && (!can2 || add1 >= add2)) ? 'shift1' : 'shift2';
      const p = pool[i++];
      setPlayerShift(p, takeShift);
      if (takeShift === 'shift1') { add1--; added1++; cur1++; }
      else { add2--; added2++; cur2++; }
    }

    return { added1, added2, counts: getShiftCounts(list), limits, remaining: { shift1: add1, shift2: add2 } };
  }

  PNS.getShiftCounts = getShiftCounts;
  PNS.getRegisteredShiftCounts = getRegisteredShiftCounts;
  PNS.getRegisteredShiftForPlayer = getRegisteredShiftForPlayer;
  PNS.restorePlayerShiftsFromImport = restorePlayerShiftsFromImport;
  PNS.updateShiftBreakdownUI = updateShiftBreakdownUI;
  PNS.ensureTowerCalcShiftUi = ensureTowerCalcShiftUi;
  PNS.addPlayersToShifts = addPlayersToShifts;
  PNS.setPlayerShift = setPlayerShift;
  PNS.movePlayerToShiftWithLimits = movePlayerToShiftWithLimits;
  PNS.getTowerCalcShiftLimits = getTowerCalcShiftLimits;
  PNS.syncTowerCalcShiftLimitUi = syncTowerCalcShiftLimitUi;

  // initial run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensurePlayersLinked();
      try { ensureTowerCalcShiftUi(); } catch {}
      try { syncTowerCalcShiftLimitUi(); } catch {}
      try { refreshTowerCalcAfterShiftChange(); } catch {}
    });
  } else {
    ensurePlayersLinked();
    try { ensureTowerCalcShiftUi(); } catch {}
    try { syncTowerCalcShiftLimitUi(); } catch {}
    try { updateShiftBreakdownUI(); } catch {}
  }

  // keep breakdown in sync
  document.addEventListener('players-table-rendered', () => {
    try { ensureTowerCalcShiftUi(); } catch {}
    try { syncTowerCalcShiftLimitUi(); } catch {}
    try { updateShiftBreakdownUI(); } catch {}
  });

  // after partial swaps (from ns.js)
  document.addEventListener('pns:dom:refreshed', () => {
    ensurePlayersLinked();
    try { ensureTowerCalcShiftUi(); } catch {}
    try { syncTowerCalcShiftLimitUi(); } catch {}
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
      const limits = getTowerCalcShiftLimits();

      const res = addPlayersToShifts(state.players, { shift1Add: add1, shift2Add: add2, force, maxShift1: limits.shift1, maxShift2: limits.shift2 });

      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.applyPlayerTableFilters?.(); } catch {}
      try { refreshTowerCalcAfterShiftChange(); } catch {}

      // nice feedback if import status exists
      try {
        PNS.setImportStatus?.(
          `Оновлено shifts: +${res.added1} у Shift 1, +${res.added2} у Shift 2. Зараз ${res.counts.shift1}/${res.counts.shift2}/${res.counts.both}.${(res.remaining?.shift1 || res.remaining?.shift2) ? ` Не вистачило місця по ліміту: S1 ${res.remaining.shift1 || 0}, S2 ${res.remaining.shift2 || 0}.` : ''}`,
          (res.remaining?.shift1 || res.remaining?.shift2) ? 'warn' : 'good'
        );
      } catch {}
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#split5050Btn');
      if (!btn) return;
      e.preventDefault();
      const force = !!document.getElementById('shiftSplitForceChk')?.checked;
      const mode = force ? 'force' : 'respect';
      const limits = getTowerCalcShiftLimits();
      try { autoBalanceTwoShifts(state.players, { mode, maxShift1: limits.shift1, maxShift2: limits.shift2 }); } catch {}
      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.applyPlayerTableFilters?.(); } catch {}
      try { refreshTowerCalcAfterShiftChange(); } catch {}
    });


    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#towerCalcRestoreImportShiftsBtn,#restoreShiftImportBtn');
      if (!btn) return;
      e.preventDefault();
      const s1 = document.getElementById('shiftAddS1');
      const s2 = document.getElementById('shiftAddS2');
      const force = document.getElementById('shiftSplitForceChk');
      if (s1) s1.value = 0;
      if (s2) s2.value = 0;
      if (force) force.checked = false;
      const counts = restorePlayerShiftsFromImport(state.players);
      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.applyPlayerTableFilters?.(); } catch {}
      try { refreshTowerCalcAfterShiftChange(); } catch {}
      try {
        PNS.setImportStatus?.(
          `Shifts відновлено з імпорту. Shift 1: ${counts.shift1}, Shift 2: ${counts.shift2}, Both: ${counts.both}${counts.unknown ? `, Невідомо: ${counts.unknown}` : ''}.`,
          counts.unknown ? 'warn' : 'good'
        );
      } catch {}
    });

    document.addEventListener('change', (e) => {
      const inp = e.target.closest('#shiftLimitS1,#shiftLimitS2');
      if (!inp) return;
      const limits = syncTowerCalcShiftLimitUi();
      try { refreshTowerCalcAfterShiftChange(); } catch {}
      try {
        PNS.setImportStatus?.(`Оновлено ліміти shifts: Shift 1 — ${limits.shift1}, Shift 2 — ${limits.shift2}.`, 'good');
      } catch {}
    });


    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#resetShiftAddS1Btn,#resetShiftAddS2Btn,#resetShiftInputsBtn');
      if (!btn) return;
      e.preventDefault();
      const s1 = document.getElementById('shiftAddS1');
      const s2 = document.getElementById('shiftAddS2');
      const force = document.getElementById('shiftSplitForceChk');
      if (btn.id === 'resetShiftAddS1Btn' || btn.id === 'resetShiftInputsBtn') { if (s1) s1.value = 0; }
      if (btn.id === 'resetShiftAddS2Btn' || btn.id === 'resetShiftInputsBtn') { if (s2) s2.value = 0; }
      if (btn.id === 'resetShiftInputsBtn' && force) force.checked = false;
      try { updateShiftBreakdownUI(); } catch {}
    });
  }

})();