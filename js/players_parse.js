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
        // якщо в DOM нема таблиці — нічого не робимо
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

  // initial run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePlayersLinked);
  } else {
    ensurePlayersLinked();
  }

  // after partial swaps (from ns.js)
  document.addEventListener('pns:dom:refreshed', () => {
    ensurePlayersLinked();
  });

})();