window.WKD = window.WKD || {};

(function () {
  const LOCAL_KEY = 'wkd.clean.tower.plan.v1';
  const DEBUG_KEY = 'wkd.tower.localDebug.v1';
  const REGION_DRAFT_PREFIX = 'wkd.clean.tower.regionDraft.v1';
  const SHIFT_BACKUP_KEY = 'wkd.clean.tower.shiftBackup.v1';
  const TOWERS = [
    { id: 'hub', uk: 'Техно-Центр', en: 'Tech Hub', icon: 'img/tower_hub.webp' },
    { id: 'north', uk: 'Північна турель', en: 'North Turret', icon: 'img/tower_turret.webp' },
    { id: 'west', uk: 'Західна турель', en: 'West Turret', icon: 'img/tower_turret.webp' },
    { id: 'east', uk: 'Східна турель', en: 'East Turret', icon: 'img/tower_turret.webp' },
    { id: 'south', uk: 'Південна турель', en: 'South Turret', icon: 'img/tower_turret.webp' }
  ];
  const SHIFT_ORDER = ['shift1', 'shift2', 'shift3', 'shift4'];
  const TIER_DEFAULTS = { T14: 300000, T13: 250000, T12: 200000, T11: 150000, T10: 100000, T9: 80000, T8: 60000, T7: 40000 };
  const MAX_HELPERS_PER_TOWER = 29;
  const MAX_PLAYERS_PER_TOWER = MAX_HELPERS_PER_TOWER + 1;
  const MIN_HELPER_MARCH = 1000;
  const FINAL_LANG_KEY = 'wkd.clean.finalPlan.langs.v1';
  const FALLBACK_LANGS = [
    { id: 'en', code: 'EN', name: 'English', icon: 'img/lang/lang-en.svg' },
    { id: 'uk', code: 'UK', name: 'Українська', icon: 'img/lang/lang-uk.svg' },
    { id: 'ru', code: 'RU', name: 'Русский', icon: 'img/lang/lang-ru.svg' },
    { id: 'pl', code: 'PL', name: 'Polski', icon: 'img/lang/lang-pl.svg' },
    { id: 'de', code: 'DE', name: 'Deutsch', icon: 'img/lang/lang-de.svg' },
    { id: 'ja', code: 'JA', name: '日本語', icon: 'img/lang/lang-ja.svg' },
    { id: 'zh', code: 'ZH', name: '中文', icon: 'img/lang/lang-zh.svg' },
    { id: 'ko', code: 'KO', name: '한국어', icon: 'img/lang/lang-ko.svg' },
    { id: 'vi', code: 'VI', name: 'Tiếng Việt', icon: 'img/lang/lang-vi.svg' },
    { id: 'ar', code: 'AR', name: 'العربية', icon: 'img/lang/lang-ar.svg' }
  ];
  const TOWER_WORDS = {
    hub: { en: 'Tech Hub', uk: 'Техно-Центр', ru: 'Техно-Центр', pl: 'Centrum Techno', de: 'Tech-Zentrum', ja: 'テックハブ', zh: '科技中心', ko: '테크 허브', vi: 'Trung tâm Tech', ar: 'المركز التقني' },
    north: { en: 'North Turret', uk: 'Північна турель', ru: 'Северная турель', pl: 'Północna wieża', de: 'Nord-Turm', ja: '北タレット', zh: '北部炮塔', ko: '북쪽 포탑', vi: 'Tháp Bắc', ar: 'البرج الشمالي' },
    west: { en: 'West Turret', uk: 'Західна турель', ru: 'Западная турель', pl: 'Zachodnia wieża', de: 'West-Turm', ja: '西タレット', zh: '西部炮塔', ko: '서쪽 포탑', vi: 'Tháp Tây', ar: 'البرج الغربي' },
    east: { en: 'East Turret', uk: 'Східна турель', ru: 'Восточная турель', pl: 'Wschodnia wieża', de: 'Ost-Turm', ja: '東タレット', zh: '东部炮塔', ko: '동쪽 포탑', vi: 'Tháp Đông', ar: 'البرج الشرقي' },
    south: { en: 'South Turret', uk: 'Південна турель', ru: 'Южная турель', pl: 'Południowa wieża', de: 'Süd-Turm', ja: '南タレット', zh: '南部炮塔', ko: '남쪽 포탑', vi: 'Tháp Nam', ar: 'البرج الجنوبي' }
  };
  const FINAL_TEXT = {
    firstHalf: { en: 'First half', uk: 'Перша половина', ru: 'Первая половина', pl: 'Pierwsza połowa', de: 'Erste Hälfte', ja: '前半', zh: '上半场', ko: '전반', vi: 'Nửa đầu', ar: 'النصف الأول' },
    secondHalf: { en: 'Second half', uk: 'Друга половина', ru: 'Вторая половина', pl: 'Druga połowa', de: 'Zweite Hälfte', ja: '後半', zh: '下半场', ko: '후반', vi: 'Nửa sau', ar: 'النصف الثاني' },
    shift: { en: 'Shift', uk: 'Зміна', ru: 'Смена', pl: 'Zmiana', de: 'Schicht', ja: 'シフト', zh: '班次', ko: '교대', vi: 'Ca', ar: 'المناوبة' },
    typeByCaptain: { en: 'Turret type is defined by the captain', uk: 'Тип турелі визначається капітаном', ru: 'Тип турели определяется капитаном', pl: 'Typ wieży określa kapitan', de: 'Turmtyp wird vom Kapitän bestimmt', ja: 'タレットタイプはキャプテンで決まります', zh: '炮塔类型由队长决定', ko: '포탑 유형은 캡틴이 결정합니다', vi: 'Loại tháp do đội trưởng quyết định', ar: 'نوع البرج يحدده القائد' },
    unknownTroop: { en: 'Troop type is not set', uk: 'Тип військ не заданий', ru: 'Тип войск не задан', pl: 'Typ wojska nie jest ustawiony', de: 'Truppentyp ist nicht festgelegt', ja: '兵種が未設定です', zh: '兵种未设置', ko: '병과가 설정되지 않음', vi: 'Chưa đặt loại quân', ar: 'نوع القوات غير محدد' },
    noAssigned: { en: 'No assigned players', uk: 'Немає призначених гравців', ru: 'Нет назначенных игроков', pl: 'Brak przypisanych graczy', de: 'Keine zugewiesenen Spieler', ja: '割り当てられたプレイヤーはいません', zh: '没有分配的玩家', ko: '배정된 플레이어 없음', vi: 'Chưa có người chơi được chỉ định', ar: 'لا يوجد لاعبون معينون' },
    shooterPlural: { en: 'Shooters', uk: 'Стрільці', ru: 'Стрелки', pl: 'Strzelcy', de: 'Schützen', ja: 'シューター', zh: '射手', ko: '슈터', vi: 'Xạ thủ', ar: 'الرماة' },
    fighterPlural: { en: 'Fighters', uk: 'Бійці', ru: 'Бойцы', pl: 'Wojownicy', de: 'Kämpfer', ja: 'ファイター', zh: '战士', ko: '파이터', vi: 'Chiến binh', ar: 'المقاتلون' },
    riderPlural: { en: 'Riders', uk: 'Наїзники', ru: 'Наездники', pl: 'Jeźdźcy', de: 'Reiter', ja: 'ライダー', zh: '骑兵', ko: '라이더', vi: 'Kỵ binh', ar: 'الفرسان' },
    captain: { en: 'CAP', uk: 'КАП', ru: 'КАП', pl: 'KAP', de: 'CAP', ja: 'CAP', zh: '队长', ko: 'CAP', vi: 'CAP', ar: 'قائد' },
    helper: { en: 'HELP', uk: 'ПОМ', ru: 'ПОМ', pl: 'POM', de: 'HELP', ja: 'HELP', zh: '协助', ko: 'HELP', vi: 'HELP', ar: 'مساعد' }
  };
  let initialized = false;
  let loading = false;
  let activeTab = 'setup';
  let activeShift = 'shift1';
  let activeTowerId = 'hub';
  let activeFinalShift = 'shift1';
  let statusFilter = 'all';
  let finalLangs = loadFinalLangs();
  let lastTrigger = null;
  let plan = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => WKD.escapeHtml ? WKD.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const fmt = value => WKD.formatNumber ? WKD.formatNumber(value) : (Number(value) ? new Intl.NumberFormat('en-US').format(Number(value)) : '—');
  const clean = value => WKD.clean ? WKD.clean(value) : String(value ?? '').trim();
  function interpolateText(text = '', params = {}) {
    return String(text ?? '').replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? '');
  }
  const tr = (key, fallback = '', params = {}) => {
    const fb = fallback || key;
    if (!window.WKD_t) return interpolateText(fb, params);
    const value = window.WKD_t(key);
    return interpolateText((!value || value === key) ? fb : value, params);
  };
  function recordLocalPlannerAction(action = 'local') {
    try {
      const now = Date.now();
      const raw = JSON.parse(localStorage.getItem(DEBUG_KEY) || '{}') || {};
      const day = new Date(now).toISOString().slice(0, 10);
      const next = raw.day === day ? raw : { day, actions: {}, localActions: 0, expectedRemote: 0 };
      next.localActions = Number(next.localActions || 0) + 1;
      next.actions[action] = Number(next.actions?.[action] || 0) + 1;
      next.updatedAtMs = now;
      localStorage.setItem(DEBUG_KEY, JSON.stringify(next));
      window.WKD.towerPlannerDebug = next;
    } catch (_error) {}
  }


  function languages() {
    const list = Array.isArray(window.WKD_LANGUAGES) && window.WKD_LANGUAGES.length ? window.WKD_LANGUAGES : FALLBACK_LANGS;
    const seen = new Set();
    return list.concat(FALLBACK_LANGS).filter(lang => {
      const id = String(lang.id || '').toLowerCase();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  function siteLang() {
    return String(localStorage.getItem('wkd.lang') || window.WKD_CURRENT_LANG || 'uk').toLowerCase();
  }
  function normalizeFinalLangs(raw) {
    const known = new Set(languages().map(lang => lang.id));
    const input = Array.isArray(raw) ? raw : [];
    const out = [];
    const add = value => {
      const id = String(value || '').toLowerCase();
      if (known.has(id) && !out.includes(id)) out.push(id);
    };
    add('en');
    input.forEach(add);
    if (out.length < 2) add(siteLang());
    if (out.length < 2) add('uk');
    return out;
  }
  function loadFinalLangs() {
    try { return normalizeFinalLangs(JSON.parse(localStorage.getItem(FINAL_LANG_KEY) || 'null')); }
    catch (_error) { return normalizeFinalLangs(['en', siteLang()]); }
  }
  function saveFinalLangs() {
    try { localStorage.setItem(FINAL_LANG_KEY, JSON.stringify(finalLangs)); } catch (_error) {}
  }
  function langMeta(id) { return languages().find(lang => lang.id === id) || { id, code: id.toUpperCase(), name: id.toUpperCase(), icon: `img/lang/lang-${id}.svg` }; }
  function finalLangSummary() { return finalLangs.map(id => langMeta(id).name).join(' + '); }
  function finalPhrase(key, lang) { return FINAL_TEXT[key]?.[lang] || FINAL_TEXT[key]?.en || key; }
  function combinedText(getter) {
    const values = finalLangs.map(lang => clean(getter(lang))).filter(Boolean);
    return values.filter((value, index) => values.indexOf(value) === index).join(' ✦ ');
  }
  function shiftFinalLabel(shift, lang) {
    const n = (String(shift).match(/\d+/) || ['1'])[0];
    const half = n === '1' ? finalPhrase('firstHalf', lang) : n === '2' ? finalPhrase('secondHalf', lang) : '';
    return `${finalPhrase('shift', lang)} ${n}${half ? ` • ${half}` : ''}`;
  }
  function towerLangName(tower, lang) { return TOWER_WORDS[tower.id]?.[lang] || (lang === 'uk' ? tower.uk : tower.en); }
  function towerName(towerOrId = '') {
    const tower = typeof towerOrId === 'object'
      ? towerOrId
      : TOWERS.find(item => item.id === clean(towerOrId).toLowerCase());
    return tower ? towerLangName(tower, siteLang()) : '';
  }

  plan = normalizePlan(null);

  function emptyAssignments() {
    return Object.fromEntries(SHIFT_ORDER.map(shift => [shift, Object.fromEntries(TOWERS.map(tower => [tower.id, { captain: '', captainLocked: false, helpers: [], helperMarches: {} }]))]));
  }
  function normalizePlan(raw) {
    const base = {
      version: 1,
      settings: {
        fillMode: 'mid',
        onlyCaptains: true,
        matchShift: true,
        sameRole: true,
        useBoth: false,
        useTierLimits: false,
        tierLimits: { ...TIER_DEFAULTS },
        manualShiftEdit: false,
        shiftLimits: { shift1: 100, shift2: 100 }
      },
      assignments: emptyAssignments(),
      shiftOverrides: {},
      updatedAtMs: 0
    };
    const input = raw && typeof raw === 'object' ? raw : {};
    const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
    const assignments = emptyAssignments();
    SHIFT_ORDER.forEach(shift => {
      TOWERS.forEach(tower => {
        const item = input.assignments?.[shift]?.[tower.id] || input.shifts?.[shift]?.assignments?.[tower.id] || {};
        const helpers = Array.isArray(item.helpers) ? item.helpers.map(clean).filter(Boolean) : (Array.isArray(item.helperIds) ? item.helperIds.map(clean).filter(Boolean) : []);
        const rawMarches = item.helperMarches || item.helperMarch || item.assignedMarches || {};
        const helperMarches = {};
        if (rawMarches && typeof rawMarches === 'object') {
          Object.entries(rawMarches).forEach(([id, value]) => {
            const key = clean(id);
            const number = Math.max(0, Number(value) || 0);
            if (key && number > 0) helperMarches[key] = number;
          });
        }
        const towerTierLimits = {};
        const rawTowerTierLimits = item.tierLimits || item.tierMinMarch || item.rule?.tierMinMarch || {};
        Object.keys(TIER_DEFAULTS).forEach(tier => {
          towerTierLimits[tier] = Math.max(0, Number(rawTowerTierLimits?.[tier] || 0) || 0);
        });
        const captainId = clean(item.captain || item.captainId || '');
        const hasCaptainLockFlag = Object.prototype.hasOwnProperty.call(item, 'captainLocked')
          || Object.prototype.hasOwnProperty.call(item, 'manualCaptain')
          || Object.prototype.hasOwnProperty.call(item, 'lockedCaptain')
          || Object.prototype.hasOwnProperty.call(item, 'captainLock');
        assignments[shift][tower.id] = {
          captain: captainId,
          captainLocked: Boolean(captainId && (hasCaptainLockFlag ? (item.captainLocked || item.manualCaptain || item.lockedCaptain || item.captainLock) : true)),
          helpers,
          helperMarches,
          tierLimits: towerTierLimits
        };
      });
    });
    const shiftOverrides = {};
    const rawShiftOverrides = input.shiftOverrides && typeof input.shiftOverrides === 'object' ? input.shiftOverrides : {};
    Object.entries(rawShiftOverrides).forEach(([id, value]) => {
      const key = clean(id);
      const shift = normalizeShift(value);
      if (key && (SHIFT_ORDER.includes(shift) || shift === 'both')) shiftOverrides[key] = shift;
    });
    return {
      ...base,
      shiftOverrides,
      settings: {
        ...base.settings,
        ...settings,
        tierLimits: { ...TIER_DEFAULTS, ...(settings.tierLimits || {}) },
        manualShiftEdit: Boolean(settings.manualShiftEdit),
        useTierLimits: Boolean(settings.useTierLimits),
        shiftLimits: {
          shift1: Math.max(0, Math.min(100, Number(settings.shiftLimits?.shift1 ?? settings.shift1Limit ?? 100) || 100)),
          shift2: Math.max(0, Math.min(100, Number(settings.shiftLimits?.shift2 ?? settings.shift2Limit ?? 100) || 100))
        }
      },
      assignments,
      updatedAtMs: Number(input.updatedAtMs) || 0
    };
  }
  function modal() { return document.getElementById('towerPlannerModal'); }
  function finalModal() { return document.getElementById('finalPlanOnlyModal'); }
  function players() { return Array.isArray(WKD.state?.players) ? WKD.state.players : []; }
  let playerEntryCache = null;
  function invalidatePlayerEntryCache() { playerEntryCache = null; }
  function playerId(player = {}, index = 0) {
    if (!player._rowId) player._rowId = String(player.id || player.uid || `local-${index + 1}`);
    return String(player._rowId);
  }
  function baseShiftForPlayer(player = {}) {
    return strictBaseShiftForPlayer(player) || normalizeShift(rawShiftValue(player));
  }
  function sanitizeShiftOverridesForCurrentPlayers() {
    if (!plan || !plan.shiftOverrides || typeof plan.shiftOverrides !== 'object') return false;
    const rows = players();
    if (!rows.length) {
      if (Object.keys(plan.shiftOverrides).length) { plan.shiftOverrides = {}; return true; }
      return false;
    }
    const valid = new Map();
    rows.forEach((player, index) => {
      const id = playerId(player, index);
      if (id) valid.set(String(id), strictBaseShiftForPlayer(player) || 'both');
    });
    let changed = false;
    Object.entries({ ...(plan.shiftOverrides || {}) }).forEach(([id, value]) => {
      const key = String(id || '');
      const target = normalizeShiftStrict(value);
      const base = valid.get(key);
      // Manual shift overrides are only for players imported as “both shifts”.
      // Never let a saved/corrupted draft turn real shift 1/2 players back into “both”.
      const allowed = Boolean(base && base === 'both' && SHIFT_ORDER.includes(target));
      if (!allowed || target === base) {
        delete plan.shiftOverrides[key];
        changed = true;
      }
    });
    return changed;
  }
  function shiftOverrideForId(id = '') {
    const key = String(id || '');
    const value = plan?.shiftOverrides?.[key];
    const shift = normalizeShift(value);
    return (SHIFT_ORDER.includes(shift) || shift === 'both') ? shift : '';
  }
  function playerEntries() {
    const rows = players();
    sanitizeShiftOverridesForCurrentPlayers();
    const overridesKey = JSON.stringify(plan?.shiftOverrides || {});
    if (playerEntryCache && playerEntryCache.rows === rows && playerEntryCache.length === rows.length && playerEntryCache.overridesKey === overridesKey) {
      return playerEntryCache.entries;
    }
    const entries = rows.map((player, index) => {
      const id = playerId(player, index);
      const stablePlayer = playerWithStableShift(player);
      const baseShift = strictBaseShiftForPlayer(stablePlayer);
      const overrideShift = shiftOverrideForId(id);
      if (!overrideShift || baseShift !== 'both' || !SHIFT_ORDER.includes(overrideShift)) return { player: stablePlayer, id, index };
      return {
        player: { ...stablePlayer, shift: overrideShift, shiftLabel: shiftLabel(overrideShift), _shiftOverridden: true },
        id,
        index
      };
    });
    playerEntryCache = { rows, length: rows.length, overridesKey, entries, map: new Map(entries.map(entry => [String(entry.id || ''), entry.player])) };
    return entries;
  }
  function playerById(id) {
    const key = String(id || '');
    const entries = playerEntries();
    return playerEntryCache?.map?.get(key) || entries.find(entry => entry.id === key)?.player || null;
  }
  function currentPlayerIdSet() {
    return new Set(playerEntries().map(entry => String(entry.id || '')).filter(Boolean));
  }
  function prunePlanToCurrentPlayers() {
    if (!plan || !plan.assignments) return false;
    const valid = currentPlayerIdSet();
    let changed = false;
    SHIFT_ORDER.forEach(shift => {
      TOWERS.forEach(tower => {
        const slot = plan.assignments?.[shift]?.[tower.id];
        if (!slot) return;
        ensureSlotShape(slot);
        if (slot.captain && !valid.has(String(slot.captain))) {
          slot.captain = '';
          slot.captainLocked = false;
          changed = true;
        }
        const before = slot.helpers.length;
        slot.helpers = slot.helpers.filter(id => valid.has(String(id)));
        if (slot.helpers.length !== before) changed = true;
        Object.keys(slot.helperMarches || {}).forEach(id => {
          if (!slot.helpers.includes(id)) {
            delete slot.helperMarches[id];
            changed = true;
          }
        });
      });
    });
    return changed;
  }
  function normalizeShiftStrict(value) {
    const text = clean(value).toLowerCase();
    if (!text) return '';
    if (/both|all|всі|все|обидві|обе|оба|both shifts|both shift/.test(text)) return 'both';
    if (/4/.test(text)) return 'shift4';
    if (/3/.test(text)) return 'shift3';
    if (/2/.test(text)) return 'shift2';
    if (/1/.test(text)) return 'shift1';
    return '';
  }
  function normalizeShift(value) {
    return normalizeShiftStrict(value) || 'both';
  }
  function rawShiftValue(player = {}) {
    return player._sourceShift ?? player.sourceShift ?? player.originalShift ?? player.importShift ?? player.baseShift
      ?? player.registeredShift ?? player.availabilityShift ?? player.rawShift
      ?? player.wastelandProfile?.shift ?? player.wastelandProfile?.shiftLabel
      ?? player.raw?.shift ?? player.raw?.shiftLabel ?? player.raw?.registeredShift
      ?? player['Зміна'] ?? player['зміна'] ?? player['Shift'] ?? player['shift']
      ?? player.shift ?? player.shiftLabel ?? '';
  }
  function strictBaseShiftForPlayer(player = {}) {
    return normalizeShiftStrict(rawShiftValue(player));
  }
  function playerWithStableShift(player = {}) {
    const base = strictBaseShiftForPlayer(player);
    if (!base) return player;
    const current = normalizeShiftStrict(player.shift || player.shiftLabel || '');
    if (current === base) return player;
    return { ...player, shift: base, shiftLabel: shiftLabel(base), _shiftRecoveredFromSource: true };
  }
  function sourceRowsHaveBrokenShifts(rows = players()) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length < 5) return false;
    const strict = list.map(row => strictBaseShiftForPlayer(row));
    const real = strict.filter(shift => SHIFT_ORDER.includes(shift)).length;
    const both = strict.filter(shift => shift === 'both').length;
    return real === 0 && both === list.length;
  }
  async function ensureRegionPlayersFreshForTower(force = false) {
    const info = sourceInfo();
    if (info.mode !== 'region') return false;
    const broken = sourceRowsHaveBrokenShifts();
    if (!force && !broken) return false;
    if (typeof WKD.reloadRegionPlayersForTower !== 'function') return false;
    const key = `wkd.tower.regionRowsRefresh.${clean(info.region || '')}`;
    const last = Number(sessionStorage.getItem(key) || 0) || 0;
    if (!force && last && Date.now() - last < 15000) return false;
    try {
      sessionStorage.setItem(key, String(Date.now()));
      const rows = await WKD.reloadRegionPlayersForTower(info.region || '', { force: Boolean(force || broken), d1Only: true });
      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      console.warn('[WKD] tower region rows refresh skipped:', error);
      return false;
    }
  }
  function shiftLabel(shift) {
    return ({ shift1: tr('shift.shift1', 'Зміна 1'), shift2: tr('shift.shift2', 'Зміна 2'), shift3: tr('shift.shift3', 'Зміна 3'), shift4: tr('shift.shift4', 'Зміна 4'), both: tr('shift.both', 'Обидві') })[shift] || tr('common.shift', 'Зміна');
  }
  function normalizeTowerId(value) {
    const id = clean(value || '').toLowerCase();
    return TOWERS.some(tower => tower.id === id) ? id : '';
  }
  function isAccountRoleText(value = '') {
    const text = clean(value).toLowerCase();
    return /^(admin|administrator|owner|moderator|consul|officer|player|guest|адмін|администратор|модератор|консул|офіцер|офицер|гравець|игрок|гість|гость)$/.test(text);
  }

  function troopTextFromPlayer(player = {}) {
    if (!player || typeof player !== 'object') return isAccountRoleText(player) ? '' : clean(player);
    const fields = [
      player.troopType, player.troopLabel, player.mainTroopType, player.primaryTroopType,
      player.wastelandProfile?.troopType, player.wastelandProfile?.troopLabel,
      player.raw?.troopType, player.raw?.troopLabel,
      player['Тип військ'], player['тип військ'], player['Troop type'],
      player.role
    ];
    return clean(fields.find(value => clean(value) && !isAccountRoleText(value)) || '');
  }
  function roleKey(value = '', fallback = '') {
    const text = (typeof value === 'object' ? troopTextFromPlayer(value) : clean(value)).toLowerCase();
    if (!text || isAccountRoleText(text) || text === '—' || text === '-') return fallback;
    if (/fighter|fighters|infantry|бійц|боєц|боец|бойц|воїн|воин|піхот|пехот|wojownik|wojown|kämpfer|kaempfer|ファイター|战士|戰士|전사|đấu sĩ|dau si|مقاتل|المقاتل/.test(text)) return 'Fighter';
    if (/rider|riders|cavalry|наїз|наезд|ездник|кавал|jeźdź|jezdz|reiter|ライダー|骑兵|騎兵|기병|kỵ sĩ|ky si|فارس|فرسان|الفرسان/.test(text)) return 'Rider';
    if (/shooter|shooters|стріл|стрел|shoot|marksman|strzel|schütz|schuetz|シューター|射手|사수|xạ thủ|xa thu|رامي|الرماة/.test(text)) return 'Shooter';
    return fallback;
  }
  function roleLabel(role = '') {
    const key = roleKey(role);
    if (!key) return '—';
    return key === 'Fighter' ? tr('troop.fighter', 'Бійці') : key === 'Rider' ? tr('troop.rider', 'Наїзники') : tr('troop.shooter', 'Стрільці');
  }
  function uniqueAlliances() {
    const seen = new Map();
    playerEntries().forEach(({ player }) => {
      const label = clean(player.alliance || player.allianceTag || '');
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }
  function visibleTierOptions() {
    const allowed = Array.isArray(WKD.allTiers) && WKD.allTiers.length ? WKD.allTiers : Object.keys(TIER_DEFAULTS);
    const stateTiers = Array.isArray(WKD.state?.visibleTiers) ? WKD.state.visibleTiers : [];
    const savedTiers = WKD.loadJson && WKD.storageKeys?.visibleTiers ? WKD.loadJson(WKD.storageKeys.visibleTiers, []) : [];
    const source = stateTiers.length ? stateTiers : savedTiers;
    const tiers = source
      .map(tier => clean(tier).toUpperCase().replace(/\s+/g, ''))
      .filter(tier => /^T\d{1,2}$/.test(tier) && allowed.includes(tier));
    const unique = [...new Set(tiers)];
    const fallback = Array.isArray(WKD.defaultVisibleTiers) && WKD.defaultVisibleTiers.length ? WKD.defaultVisibleTiers : Object.keys(TIER_DEFAULTS);
    return (unique.length ? unique : fallback.slice()).sort((a, b) => tierRankValue(b) - tierRankValue(a));
  }
  function towerManualRole(towerId) {
    const slot = plan.assignments?.[activeShift]?.[towerId];
    const captain = playerById(slot?.captain);
    if (captain) return roleKey(captain);
    const firstHelper = (slot?.helpers || []).map(id => playerById(id)).find(Boolean);
    return firstHelper ? roleKey(firstHelper) : 'Shooter';
  }
  function roleSelectOptions(selected = 'Shooter') {
    const current = roleKey(selected, 'Shooter');
    return ['Fighter', 'Rider', 'Shooter'].map(role => `<option value="${role}" ${role === current ? 'selected' : ''}>${esc(roleLabel(role))}</option>`).join('');
  }
  function allianceDatalist(id) {
    const items = uniqueAlliances();
    return `<datalist id="${esc(id)}">${items.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>`;
  }
  function tierDatalist(id) {
    const items = visibleTierOptions();
    return `<datalist id="${esc(id)}">${items.map(tier => `<option value="${esc(tier)}"></option>`).join('')}</datalist>`;
  }
  function tierSelectOptions(selected = '') {
    const current = clean(selected).toUpperCase().replace(/\s+/g, '') || visibleTierOptions()[0] || 'T14';
    return visibleTierOptions().map(tier => `<option value="${esc(tier)}" ${tier === current ? 'selected' : ''}>${esc(tier)}</option>`).join('');
  }
  function tierRankValue(playerOrTier) {
    const raw = typeof playerOrTier === 'object' ? (playerOrTier?.tierRank || playerOrTier?.tier) : playerOrTier;
    const parsed = String(raw || '').toUpperCase().match(/(\d{1,2})/);
    return Math.max(0, Math.min(14, Number(parsed?.[1] || 0) || 0));
  }
  function registrationTime(player = {}) {
    const raw = player.registeredAt || player.createdAt || player.date || player.registrationDate || player.raw?.registeredAt || player.raw?.date || '';
    if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 20000 && raw < 100000 ? Date.UTC(1899, 11, 30) + raw * 86400000 : raw;
    const parsed = Date.parse(String(raw || '').trim());
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  function compareAutoCandidates(left, right) {
    const a = left?.player || left || {};
    const b = right?.player || right || {};
    return tierRankValue(b) - tierRankValue(a)
      || Number(b.march || 0) - Number(a.march || 0)
      || registrationTime(a) - registrationTime(b)
      || String(a.name || '').localeCompare(String(b.name || ''))
      || String(left?.id || a.id || '').localeCompare(String(right?.id || b.id || ''));
  }
  function nickKey(player = {}) {
    return clean(player.name || '').toLowerCase().replace(/\s+/g, ' ');
  }
  function availableShifts() {
    const seen = new Set(['shift1', 'shift2']);
    playerEntries().forEach(({ player }) => {
      const shift = normalizeShift(player.shift || player.shiftLabel);
      if (SHIFT_ORDER.includes(shift)) seen.add(shift);
    });
    SHIFT_ORDER.forEach(shift => {
      if (Object.values(plan.assignments?.[shift] || {}).some(slot => slot.captain || slot.helpers?.length)) seen.add(shift);
    });
    return SHIFT_ORDER.filter(shift => seen.has(shift));
  }
  function sourceInfo() {
    return WKD.getPlayersSourceInfo?.() || { mode: 'local', label: tr('playerManager.localList', 'локального списку'), canUpdate: true, region: '' };
  }
  function canEditPlan() {
    const info = sourceInfo();
    return info.mode !== 'region' || Boolean(info.canPlan ?? info.canUpdate);
  }
  function localLoadPlan() { return normalizePlan(WKD.loadJson ? WKD.loadJson(LOCAL_KEY, null) : JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null')); }
  function localSavePlan(nextPlan) { WKD.saveJson ? WKD.saveJson(LOCAL_KEY, nextPlan) : localStorage.setItem(LOCAL_KEY, JSON.stringify(nextPlan)); }
  function regionDraftKey(region = '') {
    const safe = clean(region).replace(/[^0-9]/g, '') || 'unknown';
    return `${REGION_DRAFT_PREFIX}.${safe}`;
  }
  function readRegionDraft(region = '') {
    try {
      const raw = localStorage.getItem(regionDraftKey(region));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return {
        ...data,
        plan: normalizePlan(data.plan || null),
        savedAtMs: Number(data.savedAtMs || 0) || 0,
        publishedAtMs: Number(data.publishedAtMs || 0) || 0,
        sourceUpdatedAtMs: Number(data.sourceUpdatedAtMs || 0) || 0,
        dirty: data.dirty !== false
      };
    } catch (_error) {
      return null;
    }
  }
  function writeRegionDraft(region = '', nextPlan = {}, meta = {}) {
    const safeRegion = clean(region).replace(/[^0-9]/g, '');
    if (!safeRegion) return null;
    const previous = readRegionDraft(safeRegion) || {};
    const now = Date.now();
    const payload = {
      region: safeRegion,
      plan: normalizePlan(nextPlan),
      savedAtMs: Number(meta.savedAtMs || now) || now,
      publishedAtMs: Number(meta.publishedAtMs ?? previous.publishedAtMs ?? 0) || 0,
      sourceUpdatedAtMs: Number(meta.sourceUpdatedAtMs ?? previous.sourceUpdatedAtMs ?? 0) || 0,
      dirty: meta.dirty !== false
    };
    try { localStorage.setItem(regionDraftKey(safeRegion), JSON.stringify(payload)); } catch (_error) {}
    return payload;
  }
  function removeRegionDraft(region = '') {
    try { localStorage.removeItem(regionDraftKey(region)); } catch (_error) {}
  }
  function regionDraftStatus(region = '') {
    const info = sourceInfo();
    const safeRegion = clean(region || info.region || '').replace(/[^0-9]/g, '');
    return safeRegion ? readRegionDraft(safeRegion) : null;
  }
  function regionHasUnpublishedDraft(region = '') {
    const draft = regionDraftStatus(region);
    return Boolean(draft?.dirty && draft?.savedAtMs);
  }
  function formatDateTimeMs(ms = 0) {
    const number = Number(ms) || 0;
    if (!number) return '';
    try { return new Intl.DateTimeFormat(siteLang() || 'uk', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(number)); } catch (_error) { return new Date(number).toLocaleString(); }
  }
  async function loadPlan() {
    if (loading) return plan;
    loading = true;
    try {
      const info = sourceInfo();
      if (info.mode === 'region' && typeof WKD.loadTowerPlanFromActiveSource === 'function') {
        const loaded = await WKD.loadTowerPlanFromActiveSource();
        const published = normalizePlan(loaded?.plan || loaded || null);
        const sourceUpdatedAtMs = Number(loaded?.updatedAtMs || loaded?.updatedAt?.toMillis?.() || 0) || 0;
        const draft = canEditPlan() ? readRegionDraft(info.region || loaded?.region || '') : null;
        if (draft?.plan && draft.dirty) {
          plan = draft.plan;
        } else {
          plan = published;
          if (canEditPlan() && (loaded?.plan || loaded?.handled)) {
            writeRegionDraft(info.region || loaded?.region || '', plan, { dirty: false, publishedAtMs: sourceUpdatedAtMs || Date.now(), sourceUpdatedAtMs });
          }
        }
        if (sourceRowsHaveBrokenShifts()) await ensureRegionPlayersFreshForTower(false);
        sanitizeShiftOverridesForCurrentPlayers();
        prunePlanToCurrentPlayers();
      } else {
        plan = localLoadPlan();
        sanitizeShiftOverridesForCurrentPlayers();
      }
    } catch (error) {
      console.error(error);
      const info = sourceInfo();
      const draft = info.mode === 'region' ? readRegionDraft(info.region || '') : null;
      plan = draft?.plan || localLoadPlan();
      WKD.showNotice?.(tr('tower.planLoadFailed', 'Не вдалося завантажити план регіону. Показую локальний план.'));
    } finally {
      loading = false;
    }
    return plan;
  }
  async function savePlan(show = true) {
    plan.updatedAtMs = Date.now();
    const info = sourceInfo();
    if (info.mode === 'region') {
      if (!canEditPlan()) {
        WKD.showNotice?.(tr('tower.regionPlanEditDenied', 'Для регіону редагувати план можуть консул або офіцер свого регіону.'));
        return false;
      }
      writeRegionDraft(info.region || '', plan, { dirty: true });
      if (show) WKD.showNotice?.(tr('tower.planSavedDraft', 'Чернетку плану збережено локально. Опублікуй її, коли план готовий.'));
      updateAccessUi();
      return true;
    }
    localSavePlan(plan);
    if (show) WKD.showNotice?.(tr('tower.planSavedLocal', 'Локальний план збережено в цьому браузері.'));
    return true;
  }
  async function publishPlan(showConfirm = true) {
    const info = sourceInfo();
    if (info.mode !== 'region') return savePlan(true);
    if (typeof WKD.saveTowerPlanToActiveSource !== 'function') return false;
    if (!canEditPlan()) {
      WKD.showNotice?.(tr('tower.regionPlanEditDenied', 'Для регіону редагувати план можуть консул або офіцер свого регіону.'));
      return false;
    }
    const region = clean(info.region || '').replace(/[^0-9]/g, '');
    const ok = !showConfirm || await (WKD.confirmDialog?.({
      title: tr('tower.publishConfirmTitle', 'Опублікувати фінальний план?'),
      message: tr('tower.publishConfirmMessage', 'Поточна локальна чернетка стане видимою для регіону {region}. Після публікації гравці побачать цей план.', { region: region ? `R${region}` : info.label || '' }),
      acceptText: tr('tower.publishPlan', 'Опублікувати в регіон'),
      cancelText: tr('common.cancel', 'Скасувати')
    }) ?? Promise.resolve(window.confirm(tr('tower.publishConfirmTitle', 'Опублікувати фінальний план?'))));
    if (!ok) return false;
    plan.updatedAtMs = Date.now();
    await WKD.saveTowerPlanToActiveSource(plan);
    writeRegionDraft(region, plan, { dirty: false, publishedAtMs: Date.now(), sourceUpdatedAtMs: Date.now() });
    updateAccessUi();
    render();
    WKD.showNotice?.(tr('tower.planPublishedRegion', 'Фінальний план опубліковано в регіоні {region}.', { region: info.label || (region ? `R${region}` : '') }));
    document.dispatchEvent(new CustomEvent('wkd:tower-plan-published', { detail: { region, plan } }));
    return true;
  }
  async function reloadPublishedPlan() {
    const info = sourceInfo();
    if (info.mode !== 'region' || typeof WKD.loadTowerPlanFromActiveSource !== 'function') return false;
    const region = clean(info.region || '').replace(/[^0-9]/g, '');
    const ok = await (WKD.confirmDialog?.({
      title: tr('tower.discardDraftTitle', 'Повернути опублікований план?'),
      message: tr('tower.discardDraftMessage', 'Локальна чернетка для {region} буде відкинута, а буде відкрито останній опублікований план.', { region: info.label || (region ? `R${region}` : '') }),
      acceptText: tr('tower.loadPublishedPlan', 'Повернути опублікований'),
      cancelText: tr('common.cancel', 'Скасувати')
    }) ?? Promise.resolve(window.confirm(tr('tower.discardDraftTitle', 'Завантажити опублікований план?'))));
    if (!ok) return false;
    removeRegionDraft(region);
    const loaded = await WKD.loadTowerPlanFromActiveSource();
    plan = normalizePlan(loaded?.plan || loaded || null);
    prunePlanToCurrentPlayers();
    writeRegionDraft(region, plan, { dirty: false, publishedAtMs: Date.now(), sourceUpdatedAtMs: Number(loaded?.updatedAtMs || 0) || Date.now() });
    render();
    WKD.showNotice?.(tr('tower.publishedPlanLoaded', 'Опублікований план повернено.')); 
    return true;
  }
  async function disableTierLimitsForFreshData(source = '') {
    const text = String(source || '').toLowerCase();
    if (!/(import-excel|source-region|region-to-local|registration|local-import)/.test(text)) return;
    await loadPlan();
    const changed = Boolean(plan.settings.useTierLimits) || plan.settings.fillMode !== 'mid';
    plan.settings.useTierLimits = false;
    plan.settings.fillMode = 'mid';
    if (!changed) return;
    const info = sourceInfo();
    if (info.mode === 'region') {
      if (canEditPlan()) await savePlan(false);
    } else {
      localSavePlan(plan);
    }
    if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) render();
  }

  function setFormValues() {
    const s = plan.settings;
    const set = (id, value, checked = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(checked ? value : value);
      else el.value = value;
    };
    set('towerFillMode', s.fillMode || 'mid');
    set('towerOnlyCaptains', s.onlyCaptains, true);
    set('towerMatchShift', s.matchShift, true);
    set('towerSameRole', s.sameRole, true);
    set('towerUseBoth', s.useBoth, true);
    set('towerUseTierLimits', s.useTierLimits, true);
    set('towerManualShiftEdit', s.manualShiftEdit, true);
    set('towerShiftLimit1', s.shiftLimits?.shift1 ?? 100);
    set('towerShiftLimit2', s.shiftLimits?.shift2 ?? 100);
  }
  function readFormValues() {
    const s = plan.settings;
    s.fillMode = $('#towerFillMode')?.value || s.fillMode || 'mid';
    s.onlyCaptains = Boolean($('#towerOnlyCaptains')?.checked);
    s.matchShift = Boolean($('#towerMatchShift')?.checked);
    s.sameRole = Boolean($('#towerSameRole')?.checked);
    s.useBoth = Boolean($('#towerUseBoth')?.checked);
    s.useTierLimits = Boolean($('#towerUseTierLimits')?.checked);
    s.manualShiftEdit = Boolean($('#towerManualShiftEdit')?.checked);
    s.shiftLimits = s.shiftLimits && typeof s.shiftLimits === 'object' ? s.shiftLimits : { shift1: 100, shift2: 100 };
    s.shiftLimits.shift1 = Math.max(0, Math.min(100, Number($('#towerShiftLimit1')?.value ?? s.shiftLimits.shift1 ?? 100) || 0));
    s.shiftLimits.shift2 = Math.max(0, Math.min(100, Number($('#towerShiftLimit2')?.value ?? s.shiftLimits.shift2 ?? 100) || 0));
    $$('#towerTierLimits [data-tier-limit]').forEach(input => {
      s.tierLimits[input.dataset.tierLimit] = Math.max(0, Number(input.value) || 0);
    });
  }
  function updateAccessUi() {
    const root = modal();
    const editable = canEditPlan();
    root?.classList.toggle('tower-readonly', !editable);
    $$('[data-edit-only]', root || document).forEach(el => { el.disabled = !editable; });

    const info = sourceInfo();
    const badge = $('#towerPlannerScopeBadge');
    if (badge) {
      let signedIn = false;
      try {
        const auth = typeof window.firebase?.auth === 'function' ? window.firebase.auth() : window.firebase?.auth;
        signedIn = Boolean(auth?.currentUser);
      } catch (_error) {}
      const text = info.mode === 'region' ? tr('tower.regionalMode', 'Регіонально') : signedIn ? tr('tower.localMode', 'Локально') : '';
      badge.textContent = text;
      badge.hidden = !text;
      badge.classList.toggle('is-region', info.mode === 'region');
      badge.classList.toggle('is-local', Boolean(text) && info.mode !== 'region');
    }

    renderPlannerScopeTrigger();

    const note = $('#towerPlannerAccessNote');
    if (note) {
      const draft = info.mode === 'region' ? regionDraftStatus(info.region || '') : null;
      if (info.mode === 'region' && editable) {
        const publishedText = draft?.publishedAtMs ? ` ${tr('tower.lastPublishedAt', 'Остання публікація')}: ${formatDateTimeMs(draft.publishedAtMs)}.` : '';
        note.textContent = draft?.dirty
          ? `${tr('tower.draftUnpublished', 'Є неопубліковані локальні зміни. Вони не витрачають ліміти, поки ти не натиснеш “Опублікувати в регіон”.')}${publishedText}`
          : `${tr('tower.draftClean', 'Редагування працює локально. Публікуй план тільки коли він готовий.')}${publishedText}`;
        note.hidden = false;
      } else {
        note.textContent = '';
        note.hidden = true;
      }
      note.classList.toggle('is-locked', !editable);
    }
    $$('[data-tower-publish]').forEach(el => {
      el.hidden = !(info.mode === 'region' && editable);
      el.disabled = !(info.mode === 'region' && editable);
    });
    $$('[data-tower-load-published]').forEach(el => {
      el.hidden = !(info.mode === 'region' && editable && regionHasUnpublishedDraft(info.region || ''));
      el.disabled = !(info.mode === 'region' && editable && regionHasUnpublishedDraft(info.region || ''));
    });
  }
  function renderTierLimits() {
    const host = $('#towerTierLimits');
    if (!host) return;
    host.classList.toggle('is-disabled-by-auto', !plan.settings.useTierLimits);
    host.innerHTML = Object.keys(TIER_DEFAULTS).map(tier => `<label><span>${tier}</span><input data-edit-only data-tier-limit="${tier}" type="number" min="0" step="1000" value="${Number(plan.settings.tierLimits?.[tier] || 0)}"></label>`).join('');
  }
  function countRoles(list) {
    const res = { Fighter: 0, Rider: 0, Shooter: 0 };
    list.forEach(({ player }) => { const key = roleKey(player); if (key && Object.prototype.hasOwnProperty.call(res, key)) res[key] += 1; });
    return res;
  }
  function entriesForShift(shift, includeBoth = true) {
    return playerEntries().filter(({ player }) => {
      const s = normalizeShift(player.shift || player.shiftLabel);
      return s === shift || (includeBoth && s === 'both');
    });
  }
  function roleIcon(role) {
    const key = roleKey(role, 'Shooter').toLowerCase();
    return key === 'fighter' ? 'img/fighter.webp' : key === 'rider' ? 'img/rider.webp' : 'img/shooter.webp';
  }
  function roleIconSummary(roles) {
    const items = [
      ['Fighter', roles.Fighter || 0],
      ['Rider', roles.Rider || 0],
      ['Shooter', roles.Shooter || 0]
    ];
    return `<div class="tower-role-icons">${items.map(([role, count]) => `<span><img src="${esc(roleIcon(role))}" alt="${esc(roleLabel(role))}"><b>${Number(count) || 0}</b></span>`).join('')}</div>`;
  }
  function renderSetupCard(title, count, note, roles = null, extra = '') {
    return `<div class="tower-summary-card tower-summary-card--old"><strong>${esc(title)}</strong><b>${Number(count) || 0}</b><small>${esc(note || '')}</small>${roles ? roleIconSummary(roles) : ''}${extra ? `<small>${esc(extra)}</small>` : ''}</div>`;
  }
  function renderManualShiftControls() {
    const host = $('#towerManualShiftControls');
    if (!host) return;
    const both = entriesForExactShift('both').sort(compareAutoCandidates);
    const editable = canEditPlan();
    const disabled = editable ? '' : 'disabled';
    const manualDisabled = editable && plan.settings.manualShiftEdit ? '' : 'disabled';
    host.innerHTML = `<section class="tower-shift-balance-card">
      <div class="tower-shift-balance-title"><strong>${esc(tr('tower.manualShiftTitle', 'Обидві зміни і ліміти гравців в альянсі'))}</strong><span>${esc(tr('tower.playersCountShort', '{count} гравців', { count: both.length }))}</span></div>
      <label class="tower-check tower-manual-toggle"><input id="towerManualShiftEdit" type="checkbox" ${plan.settings.manualShiftEdit ? 'checked' : ''} ${disabled}><span>${esc(tr('tower.editLimitsManually', 'Редагувати ліміти вручну'))}</span></label>
      <div class="tower-shift-balance-grid tower-shift-limits-grid">
        <label class="tower-limit-row"><span>${esc(tr('tower.limit', 'Ліміт'))}<br>${esc(tr('shift.shift1', 'Зміна 1').toLowerCase())}</span><input id="towerShiftLimit1" type="number" min="0" max="100" value="${Number(plan.settings.shiftLimits?.shift1 ?? 100)}" ${manualDisabled}></label>
        <label class="tower-limit-row"><span>${esc(tr('tower.limit', 'Ліміт'))}<br>${esc(tr('shift.shift2', 'Зміна 2').toLowerCase())}</span><input id="towerShiftLimit2" type="number" min="0" max="100" value="${Number(plan.settings.shiftLimits?.shift2 ?? 100)}" ${manualDisabled}></label>
        <label class="tower-limit-row"><span>${esc(tr('tower.addTo', 'Додати в'))}<br>${esc(tr('shift.shift1', 'Зміна 1').toLowerCase())}</span><input id="towerShiftAdd1" type="number" min="0" max="${both.length}" value="0" ${disabled}></label>
        <label class="tower-limit-row"><span>${esc(tr('tower.addTo', 'Додати в'))}<br>${esc(tr('shift.shift2', 'Зміна 2').toLowerCase())}</span><input id="towerShiftAdd2" type="number" min="0" max="${both.length}" value="0" ${disabled}></label>
      </div>
      <div class="tower-shift-balance-actions"><button class="btn" type="button" id="towerApplyShiftAddBtn" ${disabled}>${esc(tr('tower.apply', 'Застосувати'))}</button><button class="btn" type="button" id="towerRestoreImportShiftBtn" ${disabled}>${esc(tr('tower.restoreFromImport', 'Відновити з імпорту'))}</button></div>
    </section>`;
  }
  function entriesForExactShift(shift) {
    return playerEntries().filter(({ player }) => normalizeShift(player.shift || player.shiftLabel) === shift);
  }
  function renderSetup() {
    const host = $('#towerSetupSummary');
    if (!host) return;
    const shift1 = entriesForExactShift('shift1');
    const shift2 = entriesForExactShift('shift2');
    const both = entriesForExactShift('both');
    const all = playerEntries();
    const used1 = usedIdsForShift('shift1');
    const used2 = usedIdsForShift('shift2');
    const usedAll = usedIdsAll();
    const usedShift1 = [...used1].filter(id => shift1.some(e => e.id === id)).length;
    const usedShift2 = [...used2].filter(id => shift2.some(e => e.id === id)).length;
    host.innerHTML = [
      renderSetupCard(tr('shift.shift1', 'Зміна 1'), shift1.length, tr('tower.inReserveLine', 'У турелях {inCount} · Резерв {reserve}', { inCount: usedShift1, reserve: Math.max(0, shift1.length - usedShift1) }), countRoles(shift1)),
      renderSetupCard(tr('shift.shift2', 'Зміна 2'), shift2.length, tr('tower.inReserveLine', 'У турелях {inCount} · Резерв {reserve}', { inCount: usedShift2, reserve: Math.max(0, shift2.length - usedShift2) }), countRoles(shift2)),
      renderSetupCard(tr('tower.bothShifts', 'Обидві зміни'), both.length, tr('tower.separateMainPlan', 'Окремо від основного плану'), countRoles(both)),
      renderSetupCard(tr('tower.total', 'Усього'), all.length, tr('tower.inReserveLine', 'У турелях {inCount} · Резерв {reserve}', { inCount: usedAll.size, reserve: Math.max(0, all.length - usedAll.size) }), countRoles(all))
    ].join('');
    renderManualShiftControls();
  }
  function usedIdsForShift(shift) {
    const set = new Set();
    Object.values(plan.assignments?.[shift] || {}).forEach(slot => {
      if (slot.captain) set.add(slot.captain);
      (slot.helpers || []).forEach(id => set.add(id));
    });
    return set;
  }
  function usedIdsAll() {
    const set = new Set();
    SHIFT_ORDER.forEach(shift => usedIdsForShift(shift).forEach(id => set.add(id)));
    return set;
  }
  function assignmentOf(id, shift = '') {
    const shifts = shift ? [shift] : SHIFT_ORDER;
    for (const s of shifts) {
      for (const tower of TOWERS) {
        const slot = plan.assignments?.[s]?.[tower.id];
        if (!slot) continue;
        if (slot.captain === id) return { shift: s, tower, kind: 'Капітан' };
        if ((slot.helpers || []).includes(id)) return { shift: s, tower, kind: 'Помічник' };
      }
    }
    return null;
  }
  function publicAssignmentOf(id, shift = '') {
    const found = assignmentOf(String(id || ''), shift);
    if (!found) return null;
    return {
      shift: found.shift,
      towerId: found.tower.id,
      towerName: found.tower.uk,
      towerNameEn: found.tower.en,
      role: found.kind === 'Капітан' ? 'captain' : 'helper',
      roleLabel: found.kind
    };
  }
  function clearSlotCaptain(slot) {
    const normalized = ensureSlotShape(slot || {});
    normalized.captain = '';
    normalized.captainLocked = false;
    return normalized;
  }
  function setSlotCaptain(slot, id, options = {}) {
    const normalized = ensureSlotShape(slot || {});
    const playerId = clean(id || '');
    if (!playerId) return clearSlotCaptain(normalized);
    if (options.promotePrevious !== false && normalized.captain && normalized.captain !== playerId && !normalized.helpers.includes(normalized.captain)) {
      normalized.helpers.unshift(normalized.captain);
    }
    normalized.helpers = (normalized.helpers || []).filter(helperId => helperId !== playerId);
    if (normalized.helperMarches) delete normalized.helperMarches[playerId];
    normalized.captain = playerId;
    normalized.captainLocked = options.locked !== false;
    return ensureSlotShape(normalized);
  }
  function isLockedCaptain(slot, id) {
    return Boolean(slot && clean(slot.captain || '') === clean(id || '') && slot.captainLocked);
  }

  async function assignPlayerFromEditor(id, options = {}) {
    const playerId = String(id || '');
    if (!playerId) return false;
    await loadPlan();
    if (!canEditPlan()) throw new Error('region-plan-access-denied');
    const shift = SHIFT_ORDER.includes(normalizeShift(options.shift)) ? normalizeShift(options.shift) : 'shift1';
    const towerId = normalizeTowerId(options.towerId || options.tower || options.placement);
    const placementRole = options.role === 'captain' ? 'captain' : 'helper';
    removePlayer(playerId, '', { forceCaptain: true });

    if (towerId) {
      const slot = ensureSlotShape(plan.assignments[shift][towerId] || { captain: '', helpers: [], helperMarches: {} });
      slot.helpers = (slot.helpers || []).filter(helperId => helperId !== playerId);
      if (slot.helperMarches) delete slot.helperMarches[playerId];
      if (placementRole === 'captain') {
        setSlotCaptain(slot, playerId, { locked: true });
      } else {
        if (slot.captain === playerId) clearSlotCaptain(slot);
        if (!slot.helpers.includes(playerId)) {
          const room = towerRoom(slot);
          slot.helpers.push(playerId);
          if (room > 0) setHelperAssignedMarch(slot, playerId, Math.min(baseHelperMarch(playerById(playerId)), room));
        }
      }
      plan.assignments[shift][towerId] = slot;
    }

    await savePlan(false);
    if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) render();
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:tower-plan-updated', { detail: { playerId, shift, towerId, role: placementRole } }));
    return true;
  }
  function removePlayer(id, onlyShift = '', options = {}) {
    const playerId = clean(id || '');
    if (!playerId) return;
    let shiftScope = onlyShift;
    let removeOptions = options || {};
    if (typeof onlyShift === 'object' && onlyShift !== null) {
      removeOptions = onlyShift;
      shiftScope = '';
    }
    const shifts = shiftScope ? [shiftScope] : SHIFT_ORDER;
    const forceCaptain = Boolean(removeOptions.forceCaptain || removeOptions.clearCaptain || removeOptions.explicit);
    const helpersOnly = Boolean(removeOptions.helpersOnly);
    shifts.forEach(shift => TOWERS.forEach(tower => {
      const slot = ensureSlotShape(plan.assignments?.[shift]?.[tower.id] || { captain: '', captainLocked: false, helpers: [], helperMarches: {} });
      if (!helpersOnly && slot.captain === playerId) {
        if (forceCaptain || !isLockedCaptain(slot, playerId)) clearSlotCaptain(slot);
      }
      slot.helpers = (slot.helpers || []).filter(helperId => helperId !== playerId);
      if (slot.helperMarches) delete slot.helperMarches[playerId];
      if (plan.assignments?.[shift]) plan.assignments[shift][tower.id] = slot;
    }));
  }
  function optionPlayers({ shift, towerId, selected = '', captainOnly = false, excludeUsed = false, ignoreRole = false }) {
    const used = usedIdsForShift(shift);
    const slot = plan.assignments[shift]?.[towerId] || { captain: '', helpers: [], helperMarches: {} };
    const captain = playerById(slot.captain);
    const captainRole = roleKey(captain);
    let list = playerEntries().filter(({ player, id }) => {
      if (excludeUsed && used.has(id) && id !== selected) return false;
      if (captainOnly && plan.settings.onlyCaptains && !player.captain) return false;
      if (plan.settings.matchShift) {
        const s = normalizeShift(player.shift || player.shiftLabel);
        const allowBothForCaptain = captainOnly && s === 'both';
        if (s !== shift && !(plan.settings.useBoth && s === 'both') && !allowBothForCaptain) return false;
      }
      if (!captainOnly && !ignoreRole && plan.settings.sameRole && captainRole) { const playerRole = roleKey(player); if (playerRole && playerRole !== captainRole) return false; }
      return true;
    });
    list = list.sort((a, b) => Number(b.player.captain) - Number(a.player.captain) || Number(b.player.rally || 0) - Number(a.player.rally || 0) || Number(b.player.march || 0) - Number(a.player.march || 0));
    return `<option value="">—</option>` + list.map(({ player, id }) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(player.name)} · ${esc(player.alliance || '—')} · ${esc(roleLabel(player))} ${esc(player.tier || '')}</option>`).join('');
  }
  function renderShiftTabs() {
    const host = $('#towerShiftTabs');
    if (!host) return;
    const shifts = availableShifts();
    if (!shifts.includes(activeShift)) activeShift = shifts[0] || 'shift1';
    host.innerHTML = shifts.map(shift => `<button class="btn btn-sm ${shift === activeShift ? 'is-active' : ''}" type="button" data-tower-shift="${shift}">${shiftLabel(shift)}</button>`).join('');
  }
  function renderTowerCards() {
    const host = $('#towerCardsGrid');
    if (!host) return;
    renderShiftTabs();
    if (!TOWERS.some(tower => tower.id === activeTowerId)) activeTowerId = TOWERS[0].id;
    const activeTower = TOWERS.find(tower => tower.id === activeTowerId) || TOWERS[0];
    host.innerHTML = `<div class="tower-picker-layout">
      <aside class="tower-picker-list" aria-label="${esc(tr('tower.towerList', 'Список турелей'))}">
        ${TOWERS.map(tower => towerPickerItem(tower)).join('')}
      </aside>
      <section class="tower-picker-detail-card">
        ${towerPickerDetail(activeTower)}
      </section>
    </div>`;
  }
  function towerPickerItem(tower) {
    const slot = plan.assignments?.[activeShift]?.[tower.id] || { captain: '', helpers: [], helperMarches: {} };
    const captain = playerById(slot.captain);
    const count = (slot.captain ? 1 : 0) + (slot.helpers || []).length;
    const ready = count > 0;
    const countClass = ready ? 'is-filled' : 'is-empty';
    return `<button class="tower-picker-item ${tower.id === activeTowerId ? 'is-active' : ''}" type="button" data-tower-select="${esc(tower.id)}">
      <img class="tower-picker-item-icon" src="${esc(tower.icon)}" alt="">
      <span class="tower-picker-item-text">
        <b>${esc(towerName(tower.id) || tower.uk)}</b>
        <small class="tower-picker-captain">${captain ? esc(captain.name) : esc(tr('tower.noCaptain', 'Без капітана'))}</small>
        <em class="${countClass}">${esc(tr('tower.playersCount', 'гравців: {count}', { count }))}</em>
      </span>
      ${ready ? '<span class="tower-picker-ok">✓</span>' : '<span class="tower-picker-warn">!</span>'}
    </button>`;
  }
  function towerPickerDetail(tower) {
    const editableAttr = canEditPlan() ? 'data-edit-only' : 'disabled';
    const disabledAttr = canEditPlan() ? '' : 'disabled';
    const slot = plan.assignments?.[activeShift]?.[tower.id] || { captain: '', helpers: [], helperMarches: {} };
    const captain = playerById(slot.captain);
    ensureSlotShape(slot);
    const helpers = (slot.helpers || []).map(id => ({ id, player: playerById(id) })).filter(item => item.player);
    const ids = [slot.captain, ...(slot.helpers || [])].filter(Boolean);
    const captainMarch = Number(captain?.march || 0);
    const rally = Number(captain?.rally || 0);
    const helperTotal = helpers.reduce((sum, item) => sum + helperAssignedMarch(item.id, slot, item.player), 0);
    const total = captainMarch + helperTotal;
    const free = rally ? Math.max(0, rally - helperTotal) : 0;
    return `<div class="tower-picker-detail">
      <div class="tower-picker-detail-head tower-picker-detail-head--clean">
        <div class="tower-card-title"><img class="tower-icon" src="${esc(tower.icon)}" alt=""><div><h3>${esc(towerName(tower.id) || tower.uk)}</h3></div></div>
        <span class="tower-role-pill">${captain ? roleLabel(captain) : esc(tr('tower.noCaptain', 'Без капітана'))}</span>
      </div>
      <div class="tower-picker-flags tower-picker-flags--single-row">
        <label><input data-tower-setting="onlyCaptains" type="checkbox" ${plan.settings.onlyCaptains ? 'checked' : ''} ${disabledAttr}><span>${esc(tr('tower.onlyCaptains', 'Тільки капітани'))}</span></label>
        <label><input data-tower-setting="matchShift" type="checkbox" ${plan.settings.matchShift ? 'checked' : ''} ${disabledAttr}><span>${esc(tr('tower.matchShiftShort', 'Зміна гравця'))}</span></label>
        <label><input data-tower-setting="sameRole" type="checkbox" ${plan.settings.sameRole ? 'checked' : ''} ${disabledAttr}><span>${esc(tr('tower.sameRoleShort', 'Той самий тип'))}</span></label>
        <label><input data-tower-setting="useBoth" type="checkbox" ${plan.settings.useBoth ? 'checked' : ''} ${disabledAttr}><span>${esc(tr('tower.useBothShort', 'Обидві'))}</span></label>
      </div>
      <div class="tower-picker-topline tower-picker-topline--captain">
        <label class="tower-field"><span>${esc(tr('tower.captain', 'Капітан'))}</span><select ${editableAttr} data-tower-captain-pick="${esc(tower.id)}">${optionPlayers({ shift: activeShift, towerId: tower.id, selected: slot.captain, captainOnly: true, excludeUsed: false })}</select></label>
        <button class="btn" ${editableAttr} type="button" data-tower-set-captain="${esc(tower.id)}">${esc(tr('tower.placeCaptain', 'Поставити капітана'))}</button>
        <button class="btn" ${editableAttr} type="button" data-tower-autofill-one="${esc(tower.id)}">${esc(tr('tower.autofill', 'Автозаповнення'))}</button>
        <button class="btn" ${editableAttr} type="button" data-tower-clear="${esc(tower.id)}">${esc(tr('tower.clearTurret', 'Очистити турель'))}</button>
      </div>
      <div class="tower-picker-metrics">
        <div><span>${esc(tr('tower.captainMarch', 'Марш капітана'))}</span><strong>${fmt(captainMarch)}</strong></div>
        <div><span>${esc(tr('tower.rallySize', 'Розмір ралі'))}</span><strong>${fmt(rally)}</strong></div>
        <div><span>${esc(tr('tower.sum', 'Разом'))}</span><strong>${fmt(total)}</strong></div>
        <div><span>${esc(tr('tower.freeSpace', 'Вільне місце'))}</span><strong>${fmt(free)}</strong></div>
      </div>
      <details class="tower-collapsible tower-inline-section tower-tier-editor" id="towerPickerLimitsBlock-${esc(tower.id)}">
        <summary>${esc(tr('tower.tierSettings', 'Налаштування турелі · ліміти маршу по тірах'))}</summary>
        <div class="tower-collapsible-inner">
          <div class="tower-tier-toolbar">
            <label class="tower-field tower-max-players-field"><span>${esc(tr('tower.maxPlayers', 'Макс. гравців'))}</span><input data-edit-only type="number" min="1" max="${MAX_HELPERS_PER_TOWER}" value="${MAX_HELPERS_PER_TOWER}" disabled></label>
            <button class="btn" ${editableAttr} type="button" data-tower-save-tier="${esc(tower.id)}">${esc(tr('tower.saveLimits', 'Зберегти ліміти'))}</button>
            <button class="btn" ${editableAttr} type="button" data-tower-recalc-tier="${esc(tower.id)}">${esc(tr('tower.recalculateSquad', 'Перерахувати склад'))}</button>
            <button class="btn" ${editableAttr} type="button" data-tower-reset-tier="${esc(tower.id)}">${esc(tr('tower.resetLimits', 'Скинути ліміти'))}</button>
          </div>
          <div class="tower-tier-grid tower-tier-grid-compact">${Object.keys(TIER_DEFAULTS).map(tier => `<label><span>${tier}</span><input data-edit-only data-tower-tier-limit="${tier}" data-tower-tier-scope="${esc(tower.id)}" type="number" min="0" step="1000" value="${Number(slot.tierLimits?.[tier] || 0)}"></label>`).join('')}</div>
          <p class="tower-help-text">${esc(tr('tower.towerTierHelp', '0 = не рухати цей тір. Вкажи число тільки для тіру, який хочеш перерахувати в цій турелі.'))}</p>
        </div>
      </details>
      <details class="tower-collapsible tower-inline-section tower-manual-add-section" id="towerPickerManualBlock-${esc(tower.id)}">
        <summary>${esc(tr('tower.addManualPlayer', 'Додати гравця вручну'))}</summary>
        <div class="tower-collapsible-inner">
        ${allianceDatalist(`towerAllianceOptions-${tower.id}`)}
        <div class="tower-manual-grid tower-manual-grid--top">
          <label class="tower-field"><span>${esc(tr('tower.searchPlayerFromList', 'Пошук гравця (зі списку)'))}</span><select ${editableAttr} data-tower-helper-pick="${esc(tower.id)}">${optionPlayers({ shift: activeShift, towerId: tower.id, selected: '', captainOnly: false, excludeUsed: false, ignoreRole: true })}</select></label>
          <label class="tower-field"><span>${esc(tr('tower.manualNickname', 'Нік (можна свій, не зі списку)'))}</span><input ${editableAttr} data-manual-name="${esc(tower.id)}" type="text" placeholder="${esc(tr('tower.name', 'Нік'))}"></label>
          <label class="tower-field"><span>${esc(tr('account.alliance', 'Альянс'))}</span><input ${editableAttr} list="towerAllianceOptions-${esc(tower.id)}" data-manual-alliance="${esc(tower.id)}" type="text" placeholder="${esc(tr('tower.chooseOrEnterAlliance', 'Вибери або введи новий'))}"></label>
          <label class="tower-field"><span>${esc(tr('playerEdit.troopType', 'Тип військ'))}</span><select ${editableAttr} data-manual-role="${esc(tower.id)}">${roleSelectOptions(towerManualRole(tower.id))}</select></label>
        </div>
        <div class="tower-manual-grid tower-manual-grid--bottom">
          <label class="tower-field"><span>${esc(tr('playerEdit.tier', 'Тір'))}</span><select ${editableAttr} data-manual-tier="${esc(tower.id)}">${tierSelectOptions(visibleTierOptions()[0] || 'T14')}</select></label>
          <label class="tower-field"><span>${esc(tr('tower.march', 'Марш'))}</span><input ${editableAttr} data-manual-march="${esc(tower.id)}" type="number" min="0" step="1000" placeholder="${esc(tr('tower.march', 'Марш'))}"></label>
          <label class="tower-field"><span>${esc(tr('tower.rallySize', 'Розмір ралі'))}</span><input ${editableAttr} data-manual-rally="${esc(tower.id)}" type="number" min="0" step="1000" placeholder="${esc(tr('tower.rallySize', 'Ралі'))}"></label>
          <button class="btn" ${editableAttr} type="button" data-tower-add-manual-captain="${esc(tower.id)}">${esc(tr('tower.placeCaptain', 'Поставити капітана'))}</button>
          <button class="btn" ${editableAttr} type="button" data-tower-add-helper="${esc(tower.id)}">${esc(tr('tower.manualAdd', 'Додати гравця вручну'))}</button>
        </div>
        </div>
      </details>
      <div class="tower-assignment-table">
        <div class="tower-assignment-table-title">${esc(tr('tower.playersInTurret', 'Гравці в турелі'))} <small>${esc(tr('tower.captainAndPlayers', 'Капітан і гравці'))}</small></div>
        <div class="tower-assignment-table-head"><span>${esc(tr('tower.status.player', 'Гравець'))}</span><span>${esc(tr('account.alliance', 'Альянс'))}</span><span>${esc(tr('tower.role', 'Роль'))}</span><span>${esc(tr('playerEdit.tier', 'Тір'))}</span><span>${esc(tr('tower.march', 'Марш'))}</span><span>✎</span></div>
        <div class="tower-assignment-table-body">
          ${ids.length ? `${slot.captain ? assignmentRow(slot.captain, captain, 'captain', slot) : ''}${helpers.map(item => assignmentRow(item.id, item.player, 'helper', slot)).join('')}` : `<div class="tower-empty-note">${esc(tr('tower.noPlayersAssigned', 'Немає призначених гравців'))}</div>`}
        </div>
      </div>
    </div>`;
  }
  function assignmentRow(id, player, kind, slot = null) {
    if (!player) return '';
    const isCaptainKind = kind === 'captain';
    const kindLabel = isCaptainKind ? tr('tower.captain', 'Капітан') : tr('tower.helper', 'Помічник');
    const shownMarch = isCaptainKind ? Number(player.march || 0) : helperAssignedMarch(id, slot, player);
    return `<div class="tower-assignment-row ${isCaptainKind ? 'is-captain' : ''}">
      <span><b>${esc(player.name)}</b><small>${esc(kindLabel)}</small></span>
      <span>${esc(player.alliance || '—')}</span>
      <span>${esc(roleLabel(player))}</span>
      <span>${esc(player.tier || '—')}</span>
      <span>${fmt(shownMarch)}</span>
      <button class="btn btn-sm tower-assignment-edit-btn" type="button" data-tower-edit-player="${esc(id)}">✎</button>
    </div>`;
  }
  function manualField(towerId, name) {
    const selector = `[data-manual-${name}="${CSS.escape(String(towerId || ''))}"]`;
    return $(selector);
  }
  function manualFields(towerId) {
    return {
      name: clean(manualField(towerId, 'name')?.value || ''),
      alliance: clean(manualField(towerId, 'alliance')?.value || ''),
      role: manualField(towerId, 'role')?.value || 'Shooter',
      tier: clean(manualField(towerId, 'tier')?.value || 'T10').toUpperCase().replace(/^([^T])/, 'T$1'),
      march: Math.max(0, Number(manualField(towerId, 'march')?.value || 0) || 0),
      rally: Math.max(0, Number(manualField(towerId, 'rally')?.value || 0) || 0)
    };
  }
  function fillManualFieldsFromEntry(towerId, entry) {
    if (!entry?.player) return;
    const data = {
      name: entry.player.name || '',
      alliance: entry.player.alliance || '',
      role: roleKey(entry.player) || '',
      tier: visibleTierOptions().includes(clean(entry.player.tier || '').toUpperCase().replace(/\s+/g, '')) ? clean(entry.player.tier || '').toUpperCase().replace(/\s+/g, '') : (visibleTierOptions()[0] || 'T14'),
      march: Number(entry.player.march || 0) || '',
      rally: Number(entry.player.rally || 0) || ''
    };
    Object.entries(data).forEach(([key, value]) => {
      const el = manualField(towerId, key);
      if (el) el.value = value;
    });
  }
  function manualEntryOrSelected(towerId, selectSelector) {
    const select = $(selectSelector || `[data-tower-helper-pick="${CSS.escape(String(towerId || ''))}"]`);
    const selectedId = clean(select?.value || '');
    if (selectedId) {
      const entry = playerEntries().find(item => item.id === selectedId);
      if (entry) return entry;
    }
    const data = manualFields(towerId);
    if (!data.name) return null;
    if (sourceInfo().mode === 'region') {
      WKD.showNotice?.(tr('tower.regionManualAddBlocked', 'Для таблиці регіону нового гравця спочатку додай через форму/таблицю регіону, а потім вибери його зі списку.'));
      return null;
    }
    const row = {
      _rowId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: data.name,
      alliance: data.alliance,
      role: data.role,
      tier: data.tier,
      tierRank: tierRankValue(data.tier),
      march: data.march,
      rally: data.rally,
      shift: activeShift,
      shiftLabel: shiftLabel(activeShift),
      captain: false
    };
    const list = players();
    list.push(row);
    try { WKD.saveJson?.(WKD.storageKeys.players, list); } catch (_error) {}
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'tower-manual-local', persist: true } }));
    return { player: row, id: playerId(row, list.length - 1), index: list.length - 1 };
  }
  function resetTierLimits() {
    Object.keys(TIER_DEFAULTS).forEach(tier => { plan.settings.tierLimits[tier] = 0; });
    plan.settings.useTierLimits = true;
  }
  function towerTierInputs(towerId) {
    return $$(`[data-tower-tier-scope="${CSS.escape(String(towerId || ''))}"]`);
  }
  function readTowerTierLimits(towerId) {
    const limits = {};
    Object.keys(TIER_DEFAULTS).forEach(tier => { limits[tier] = 0; });
    towerTierInputs(towerId).forEach(input => {
      const tier = String(input.dataset.towerTierLimit || '').toUpperCase();
      if (tier) limits[tier] = Math.max(0, Number(input.value) || 0);
    });
    return limits;
  }
  function saveTowerTierLimits(towerId) {
    const slot = plan.assignments?.[activeShift]?.[towerId];
    if (!slot) return null;
    ensureSlotShape(slot);
    slot.tierLimits = readTowerTierLimits(towerId);
    return slot.tierLimits;
  }
  function resetTowerTierLimits(towerId) {
    const slot = plan.assignments?.[activeShift]?.[towerId];
    if (!slot) return;
    ensureSlotShape(slot);
    Object.keys(TIER_DEFAULTS).forEach(tier => { slot.tierLimits[tier] = 0; });
  }
  function recalculateTowerComposition(towerId, shift = activeShift) {
    const slot = plan.assignments?.[shift]?.[towerId];
    if (!slot) return { ok: false, reason: tr('tower.turretNotFound', 'Турель не знайдена.') };
    ensureSlotShape(slot);
    const captain = playerById(slot.captain);
    if (!captain) return { ok: false, reason: tr('tower.setCaptainFirst', 'Спочатку постав капітана.') };
    const helpers = (slot.helpers || []).map(id => ({ id, player: playerById(id) })).filter(item => item.id && item.player);
    if (!helpers.length) return { ok: false, reason: tr('tower.noHelpers', 'У цій турелі ще немає помічників.') };
    const tierOrderLowToHigh = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','T13','T14'];
    const tierLimits = slot.tierLimits || {};
    const explicitTierIndices = [];
    const helpersByTier = Object.fromEntries(tierOrderLowToHigh.map(tier => [tier, []]));
    const assigned = {};

    helpers.forEach(({ id, player }) => {
      const tier = tierOrderLowToHigh.includes(String(player.tier || '').toUpperCase()) ? String(player.tier || '').toUpperCase() : 'T9';
      const limit = Math.max(0, Number(tierLimits?.[tier] || 0) || 0);
      const full = Math.max(0, Number(player.march || 0) || 0);
      const current = Math.max(0, Number(helperAssignedMarch(id, slot, player) || 0) || 0);
      if (limit > 0) explicitTierIndices.push(tierOrderLowToHigh.indexOf(tier));
      assigned[id] = limit > 0 ? Math.min(full, limit) : current;
      helpersByTier[tier].push({ id, player });
    });

    if (!explicitTierIndices.length) {
      return { ok: true, changed: false, reason: tr('tower.zeroLimits', 'Усі ліміти 0 — склад не змінено.') };
    }

    const distributeTier = (items, target, maxById) => {
      const result = {};
      let free = Math.max(0, Math.floor(Number(target || 0) || 0));
      let queue = items.map(item => ({ id: item.id, left: Math.max(0, Math.floor(Number(maxById[item.id] || 0) || 0)) })).filter(item => item.id && item.left > 0);
      items.forEach(item => { result[item.id] = 0; });
      let guard = 0;
      while (queue.length && free > 0 && guard < 200) {
        guard += 1;
        const slice = Math.max(1, Math.floor(free / queue.length));
        let used = 0;
        const next = [];
        for (const item of queue) {
          const grant = Math.min(item.left, slice, free - used);
          if (grant > 0) {
            result[item.id] += grant;
            item.left -= grant;
            used += grant;
          }
          if (item.left > 0) next.push(item);
          if (used >= free) break;
        }
        if (used <= 0) break;
        free -= used;
        queue = next;
      }
      return result;
    };
    const trimTier = (tier, overflow) => {
      if (overflow <= 0) return 0;
      const items = helpersByTier[tier] || [];
      if (!items.length) return overflow;
      const currentById = {};
      const total = items.reduce((sum, item) => {
        currentById[item.id] = Math.max(0, Number(assigned[item.id] || 0) || 0);
        return sum + currentById[item.id];
      }, 0);
      if (total <= 0) return overflow;
      if (overflow >= total) {
        items.forEach(item => { assigned[item.id] = 0; });
        return overflow - total;
      }
      const kept = Math.max(0, total - overflow);
      const next = distributeTier(items, kept, currentById);
      items.forEach(item => { assigned[item.id] = Math.max(0, Math.floor(Number(next[item.id] || 0) || 0)); });
      return 0;
    };

    const rally = Math.max(0, Number(captain.rally || 0) || 0);
    let total = Object.values(assigned).reduce((sum, value) => sum + (Math.max(0, Number(value || 0)) || 0), 0);
    if (total > rally) {
      let overflow = total - rally;
      const lowestExplicitIndex = Math.min(...explicitTierIndices);
      const firstPass = tierOrderLowToHigh.slice(0, Math.max(0, lowestExplicitIndex));
      for (const tier of firstPass) { overflow = trimTier(tier, overflow); if (overflow <= 0) break; }
      if (overflow > 0) {
        for (const tier of tierOrderLowToHigh) {
          if (firstPass.includes(tier)) continue;
          overflow = trimTier(tier, overflow);
          if (overflow <= 0) break;
        }
      }
    }

    helpers.forEach(({ id, player }) => {
      const full = Math.max(0, Number(player.march || 0) || 0);
      const value = Math.max(0, Math.min(full, Math.floor(Number(assigned[id] || 0) || 0)));
      setHelperAssignedMarch(slot, id, value);
    });
    return { ok: true, changed: true, used: slotHelpersMarch(slot), free: towerRoom(slot), helpers: helpers.length };
  }

  function renderStatus() {
    const head = $('#towerStatusHead');
    const filters = $('#towerStatusFilters');
    const body = $('#towerStatusBody');
    if (!head || !filters || !body) return;
    const used = usedIdsAll();
    const shifts = availableShifts();
    const inTower = playerEntries().filter(e => used.has(e.id)).length;
    head.innerHTML = `<div class="tower-summary-card"><b>${inTower}</b><span>${esc(tr('tower.inTowers', 'У турелях'))}</span><small>${esc(tr('tower.inTowersNow', 'Зараз реально стоять у турелях'))}</small></div><div class="tower-summary-card"><b>${Math.max(0, players().length - inTower)}</b><span>${esc(tr('tower.outsideTowers', 'Поза турелями'))}</span><small>${esc(tr('tower.notInAnyTower', 'Не стоять у жодній турелі'))}</small></div><div class="tower-summary-card"><b>${players().length}</b><span>${esc(tr('tower.total', 'Усього'))}</span><small>${esc(tr('tower.totalPlayers', 'Загальна кількість гравців'))}</small></div>`;
    const filterItems = ['all', 'in', 'reserve', ...shifts, 'both'].filter((value, index, arr) => arr.indexOf(value) === index).map(filter => `<button class="btn btn-sm ${filter === statusFilter ? 'is-active' : ''}" type="button" data-status-filter="${filter}">${filter === 'all' ? tr('common.all', 'Усі') : filter === 'in' ? tr('tower.inTowers', 'У турелях') : filter === 'reserve' ? tr('tower.outsideTowers', 'Поза турелями') : shiftLabel(filter)}</button>`).join('');
    filters.innerHTML = filterItems;
    let rows = playerEntries().filter(entry => {
      const assigned = assignmentOf(entry.id);
      if (statusFilter === 'in') return Boolean(assigned);
      if (statusFilter === 'reserve') return !assigned;
      if (statusFilter === 'both') return normalizeShift(entry.player.shift || entry.player.shiftLabel) === 'both';
      if (SHIFT_ORDER.includes(statusFilter)) return normalizeShift(entry.player.shift || entry.player.shiftLabel) === statusFilter || normalizeShift(entry.player.shift || entry.player.shiftLabel) === 'both';
      return true;
    });
    body.innerHTML = rows.length ? rows.map(({ player, id }) => {
      const assigned = assignmentOf(id);
      const shift = normalizeShift(player.shift || player.shiftLabel);
      return `<tr><td><b>${esc(player.name)}</b></td><td>${esc(player.alliance || '—')}</td><td>${esc(roleLabel(player))} / ${esc(player.tier || '—')}</td><td>${fmt(player.march)}</td><td>${assigned ? `<span class="tower-status-pill is-in">${esc(tr('tower.inTowers', 'У турелі'))}</span>` : `<span class="tower-status-pill is-reserve">${esc(tr('tower.outsideTowers', 'Поза туреллю'))}</span>`}</td><td>${assigned ? `${esc(assigned.tower.uk)} · ${shiftLabel(assigned.shift)} · ${assigned.kind}` : '—'}</td><td>${statusActions(id, shift, Boolean(assigned))}</td></tr>`;
    }).join('') : `<tr><td colspan="7">${esc(tr('playerManager.noPlayers', 'Гравців не знайдено.'))}</td></tr>`;
  }
  function statusActions(id, shift, assigned) {
    if (!canEditPlan()) return tr('common.view', 'Перегляд');
    if (assigned) return `<button class="btn btn-sm" data-edit-only type="button" data-status-reserve="${esc(id)}">${esc(tr('tower.toReserve', 'В резерв'))}</button>`;
    const buttons = availableShifts().slice(0, 4).map(s => `<button class="btn btn-sm" data-edit-only type="button" data-status-auto-place="${esc(id)}" data-status-shift="${s}">${shiftLabel(s)}</button>`).join(' ');
    return buttons || `<button class="btn btn-sm" data-edit-only type="button" data-status-auto-place="${esc(id)}" data-status-shift="${shift}">${esc(tr('tower.place', 'Поставити'))}</button>`;
  }
  function towerSourceOptions() {
    const external = Array.isArray(WKD.towerPlannerRegionOptions) ? WKD.towerPlannerRegionOptions : [];
    const seen = new Set();
    const out = [];
    const add = item => {
      const id = clean(item?.id || item?.region || '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      const isRegion = item?.mode === 'region' || id.startsWith('region:');
      out.push({
        id,
        label: clean(item?.label || (isRegion ? `R${clean(item?.region || id.replace(/^region:/, ''))}` : tr('tower.localMode', 'Локально'))),
        mode: isRegion ? 'region' : 'local',
        region: clean(item?.region || id.replace(/^region:/, ''))
      });
    };
    external.forEach(add);
    if (!out.some(item => item.mode === 'local')) out.unshift({ id: 'home', label: tr('tower.localMode', 'Локально'), mode: 'local', region: '' });
    return out;
  }
  function signedInForTowerSource() {
    if (typeof WKD.setTowerPlannerSource !== 'function') return false;
    try {
      const auth = typeof window.firebase?.auth === 'function' ? window.firebase.auth() : window.firebase?.auth;
      if (auth?.currentUser) return true;
    } catch (_error) {}
    return Boolean(sourceInfo().canViewRegion || towerSourceOptions().some(item => item.mode === 'region'));
  }
  function activeTowerSourceOption() {
    const info = sourceInfo();
    const options = towerSourceOptions();
    if (info.mode === 'region') {
      const region = clean(info.region || '');
      return options.find(item => item.mode === 'region' && String(item.region) === region)
        || { id: `region:${region}`, label: region ? `R${region}` : tr('tower.regionalMode', 'Регіонально'), mode: 'region', region };
    }
    return options.find(item => item.mode === 'local') || { id: 'home', label: tr('tower.localMode', 'Локально'), mode: 'local', region: '' };
  }
  function towerSourceLabel() {
    const active = activeTowerSourceOption();
    return active.mode === 'region'
      ? `${tr('tower.regionalMode', 'Регіонально')} · ${active.label}`
      : tr('tower.localMode', 'Локально');
  }
  function renderPlannerScopeTrigger() {
    const button = $('#towerSourceTrigger');
    const badge = $('#towerPlannerScopeBadge');
    const options = towerSourceOptions();
    const canPick = signedInForTowerSource() && options.length > 0;
    if (badge) badge.hidden = true;
    if (!button) return;
    if (!canPick) {
      button.hidden = true;
      return;
    }
    const active = activeTowerSourceOption();
    button.textContent = towerSourceLabel();
    button.hidden = false;
    button.classList.toggle('is-region', active.mode === 'region');
    button.classList.toggle('is-local', active.mode !== 'region');
  }
  function ensureTowerSourceDialog() {
    let root = document.getElementById('towerSourceDialog');
    if (!root) {
      root = document.createElement('div');
      root.id = 'towerSourceDialog';
      root.className = 'tower-source-modal';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    return root;
  }
  function renderTowerSourceDialog() {
    const root = document.getElementById('towerSourceDialog');
    if (!root) return;
    const options = towerSourceOptions();
    const regions = options.filter(item => item.mode === 'region');
    const active = activeTowerSourceOption();
    const regionActive = active.mode === 'region';
    const regionList = regions.length
      ? regions.map(item => `<button class="tower-source-region ${item.region === active.region ? 'is-active' : ''}" type="button" data-tower-source-region="${esc(item.region)}"><b>${esc(item.label)}</b><span>${esc(tr('tower.regionSourceHelp', 'План зберігається в базі цього регіону.'))}</span></button>`).join('')
      : `<div class="tower-source-empty">${esc(tr('tower.noManagedRegions', 'Немає регіонів, де у тебе є права на план.'))}</div>`;
    root.innerHTML = `<button class="tower-source-backdrop" type="button" data-tower-scope-close aria-label="${esc(tr('common.close', 'Закрити'))}"></button>
      <div class="tower-source-card" role="dialog" aria-modal="true" aria-label="${esc(tr('tower.sourceTitle', 'Джерело плану'))}">
        <div class="tower-source-head"><div><h3>${esc(tr('tower.sourceTitle', 'Джерело плану'))}</h3><p>${esc(tr('tower.sourceHelp', 'Вибери локальний план або регіональний план з бази.'))}</p></div><button class="btn btn-icon" type="button" data-tower-scope-close>✕</button></div>
        <div class="tower-source-mode-grid">
          <button class="tower-source-mode ${!regionActive ? 'is-active' : ''}" type="button" data-tower-source-mode="local"><b>${esc(tr('tower.localMode', 'Локально'))}</b><span>${esc(tr('tower.localSourceHelp', 'Зберігається тільки в цьому браузері.'))}</span></button>
          <button class="tower-source-mode ${regionActive ? 'is-active' : ''}" type="button" data-tower-source-mode="region" ${regions.length ? '' : 'disabled'}><b>${esc(tr('tower.regionalMode', 'Регіонально'))}</b><span>${esc(tr('tower.regionalSourceHelp', 'Видно тим, хто має права в регіоні.'))}</span></button>
        </div>
        <div class="tower-source-regions" ${regionActive ? '' : 'hidden'}>
          <label class="tower-source-search"><span>${esc(tr('common.search', 'Пошук'))}</span><input type="search" data-tower-scope-search placeholder="${esc(tr('tower.searchRegion', 'Наприклад 987'))}"></label>
          <div class="tower-source-region-list">${regionList}</div>
        </div>
        <div class="tower-source-actions"><button class="btn" type="button" data-tower-scope-close>${esc(tr('common.done', 'Готово'))}</button></div>
      </div>`;
  }
  function openTowerSourceDialog() {
    if (!signedInForTowerSource()) return;
    const root = ensureTowerSourceDialog();
    renderTowerSourceDialog();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
  }
  function closeTowerSourceDialog() {
    const root = document.getElementById('towerSourceDialog');
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
  }
  function filterTowerSourceRegions(value = '') {
    const root = document.getElementById('towerSourceDialog');
    if (!root) return;
    const query = clean(value).toLowerCase();
    $$('[data-tower-source-region]', root).forEach(btn => {
      btn.hidden = query && !btn.textContent.toLowerCase().includes(query);
    });
  }
  async function chooseTowerSource(options = {}) {
    const mode = options.mode === 'region' ? 'region' : 'local';
    const region = clean(options.region || '');
    if (mode === 'region' && !region) return;
    closeTowerSourceDialog();
    try {
      if (typeof WKD.setTowerPlannerSource === 'function') {
        await WKD.setTowerPlannerSource(mode === 'region' ? { mode: 'region', region } : { mode: 'local' });
      }
      const info = sourceInfo();
      if (info.mode === 'region') {
        const draft = readRegionDraft(info.region || region || '');
        plan = draft?.plan ? normalizePlan(draft.plan) : normalizePlan(null);
        prunePlanToCurrentPlayers();
      } else {
        plan = localLoadPlan();
      }
      render();
      WKD.showNotice?.(mode === 'region'
        ? `${tr('tower.regionalMode', 'Регіонально')}: R${region}`
        : tr('tower.localMode', 'Локально'));
    } catch (error) {
      console.error('[WKD] tower source switch failed:', error);
      WKD.showNotice?.(tr('tower.sourceSwitchFailed', 'Не вдалося переключити джерело плану.'));
    }
  }

  function renderFinalToolbar(root) {
    if (!root) return;
    const info = sourceInfo();
    const canPublish = info.mode === 'region' && canEditPlan();
    const hasDraft = canPublish && regionHasUnpublishedDraft(info.region || '');
    const shifts = availableShifts();
    if (!shifts.includes(activeFinalShift)) activeFinalShift = shifts[0] || 'shift1';
    const shiftButtons = shifts.map(shift => `<button class="btn btn-sm ${shift === activeFinalShift ? 'is-active' : ''}" type="button" data-final-shift="${shift}">${shiftLabel(shift)}</button>`).join('');
    const languageButton = `<button class="btn btn-sm tower-final-lang-trigger board-lang-trigger" type="button" data-final-lang-open>${esc(tr('finalPlan.langButton', 'Мова плану'))}</button>`;
    const sourceButton = signedInForTowerSource() ? `<button class="btn btn-sm" type="button" data-tower-scope-open>${esc(towerSourceLabel())}</button>` : '';
    const exportButtons = `
      <button class="btn btn-sm" type="button" data-final-download>${esc(tr('finalPlan.downloadPng', 'Завантажити PNG'))}</button>
      <button class="btn btn-sm" type="button" data-final-txt>TXT</button>
      <button class="btn btn-sm" type="button" data-final-share>${esc(tr('finalPlan.share', 'Поділитися'))}</button>
      <button class="btn btn-sm" type="button" data-final-copy-link>${esc(window.WKD_t?.('finalPlan.copyLink') || tr('finalPlan.copyLink', 'Копіювати посилання'))}</button>`;
    if (info.mode !== 'region') {
      root.classList.add('is-local-mode');
      root.classList.remove('is-region-mode');
      root.innerHTML = `${shiftButtons}${languageButton}${sourceButton}${exportButtons}`;
      return;
    }
    root.classList.add('is-region-mode');
    root.classList.remove('is-local-mode');
    root.innerHTML = `${shiftButtons}${languageButton}${sourceButton}
      ${canPublish ? `<button class="btn btn-sm" type="button" data-tower-publish>${esc(tr('tower.publishPlan', 'Опублікувати в регіон'))}</button>` : ''}
      <span class="tower-final-more-wrap">
        <button class="btn btn-sm" type="button" data-final-more-toggle aria-haspopup="true" aria-expanded="false">${esc(tr('tower.moreActions', 'Ще'))} ▾</button>
        <span class="tower-final-more-menu" data-final-more-menu hidden>
          <button type="button" data-tower-scope-open>${esc(tr('tower.changeSource', 'Переключити регіон'))}</button>
          ${hasDraft ? `<button type="button" data-tower-load-published>${esc(tr('tower.loadPublishedPlan', 'Повернути опублікований'))}</button>` : ''}
          <button type="button" data-final-download>${esc(tr('finalPlan.downloadPng', 'Завантажити PNG'))}</button>
          <button type="button" data-final-txt>TXT</button>
          <button type="button" data-final-share>${esc(tr('finalPlan.share', 'Поділитися'))}</button>
          <button type="button" data-final-copy-link>${esc(window.WKD_t?.('finalPlan.copyLink') || tr('finalPlan.copyLink', 'Копіювати посилання'))}</button>
        </span>
      </span>`;
  }
  function towerTitle(tower) {
    return combinedText(lang => towerLangName(tower, lang));
  }
  function fmtBoard(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(number)));
  }
  function tierAssignedMarch(player, isCaptain = false) {
    const march = Math.max(0, Number(player?.march || 0) || 0);
    if (isCaptain) return march;
    const tier = String(player?.tier || '').toUpperCase();
    const cap = Math.max(0, Number(plan.settings?.tierLimits?.[tier] || 0) || 0);
    return cap > 0 ? Math.min(march, cap) : march;
  }
  function ensureSlotShape(slot) {
    if (!slot) return { captain: '', captainLocked: false, helpers: [], helperMarches: {}, tierLimits: {} };
    slot.captain = clean(slot.captain || '');
    slot.captainLocked = Boolean(slot.captain && slot.captainLocked);
    if (!Array.isArray(slot.helpers)) slot.helpers = [];
    if (!slot.helperMarches || typeof slot.helperMarches !== 'object') slot.helperMarches = {};
    if (!slot.tierLimits || typeof slot.tierLimits !== 'object') slot.tierLimits = {};
    Object.keys(TIER_DEFAULTS).forEach(tier => {
      slot.tierLimits[tier] = Math.max(0, Number(slot.tierLimits?.[tier] || 0) || 0);
    });
    const uniqueHelpers = [];
    slot.helpers.forEach(id => {
      const key = clean(id);
      if (key && key !== slot.captain && !uniqueHelpers.includes(key)) uniqueHelpers.push(key);
    });
    slot.helpers = uniqueHelpers.slice(0, MAX_HELPERS_PER_TOWER);
    Object.keys(slot.helperMarches).forEach(id => {
      if (!slot.helpers.includes(id)) delete slot.helperMarches[id];
    });
    return slot;
  }
  function maxHelperMarch(player) {
    const march = Math.max(0, Number(player?.march || 0) || 0);
    if (!march) return 0;
    if (!plan.settings?.useTierLimits) return march;
    const tier = String(player?.tier || '').toUpperCase();
    const cap = Math.max(0, Number(plan.settings?.tierLimits?.[tier] || 0) || 0);
    return cap > 0 ? Math.min(march, cap) : march;
  }
  function baseHelperMarch(player) {
    return maxHelperMarch(player);
  }
  function preferredHelperMarch(player) {
    return maxHelperMarch(player);
  }
  function tierGrowWeight(player) {
    const rank = tierRankValue(player);
    if (rank >= 13) return 1.35;
    if (rank === 12) return 1.15;
    if (rank === 11) return 0.92;
    if (rank === 10) return 0.66;
    if (rank === 9) return 0.42;
    return 0.28;
  }
  function minimumHelperMarch(player) {
    const march = Math.max(0, Number(player?.march || 0) || 0);
    return march > 0 ? Math.min(march, MIN_HELPER_MARCH) : 0;
  }
  function helperAssignedMarch(id, slot, player = null) {
    const normalized = ensureSlotShape(slot || {});
    const current = player || playerById(id);
    const base = baseHelperMarch(current);
    const stored = Math.max(0, Number(normalized.helperMarches?.[id] || 0) || 0);
    if (stored > 0) return Math.min(base || stored, stored);
    return base;
  }
  function slotHelpersMarch(slot) {
    const normalized = ensureSlotShape(slot || {});
    return normalized.helpers.reduce((sum, id) => sum + helperAssignedMarch(id, normalized), 0);
  }
  function setHelperAssignedMarch(slot, id, amount) {
    const normalized = ensureSlotShape(slot);
    const player = playerById(id);
    const base = baseHelperMarch(player);
    const value = Math.max(0, Math.min(base || amount || 0, Number(amount) || 0));
    if (value > 0) normalized.helperMarches[id] = value;
    else delete normalized.helperMarches[id];
    return value;
  }
  function finalRoleText(role) {
    const key = roleKey(role);
    if (!key) return combinedText(lang => finalPhrase('unknownTroop', lang));
    const phraseKey = key === 'Fighter' ? 'fighterPlural' : key === 'Rider' ? 'riderPlural' : 'shooterPlural';
    return combinedText(lang => finalPhrase(phraseKey, lang));
  }
  function renderFinalBoard(target) {
    if (!target) return;
    const shift = activeFinalShift;
    const title = combinedText(lang => shiftFinalLabel(shift, lang));
    target.innerHTML = `<div class="board-sheet wkd-final-sheet" data-final-sheet="1" data-no-fallback-i18n="1"><div class="board-title" data-board-title="1" data-no-fallback-i18n="1">${esc(title)}</div><div class="board-grid">${TOWERS.map(tower => finalColumn(shift, tower)).join('')}</div><div aria-label="Final plan signature" class="board-signature"><img alt="Developed by Lwowsky" class="board-signature-image" decoding="async" src="img/board-signature-flatflags.svg" width="220" onerror="this.onerror=null;this.src='img/board-signature-flatflags.png';"></div></div>`;
  }
  function finalColumn(shift, tower) {
    const slot = plan.assignments?.[shift]?.[tower.id] || { captain: '', helpers: [], helperMarches: {} };
    const captain = playerById(slot.captain);
    const helperItems = (slot.helpers || [])
      .map(id => ({ id, player: playerById(id) }))
      .filter(item => item.player)
      .sort((left, right) => Number(right.player?.tierRank || String(right.player?.tier || '').replace(/\D/g, '') || 0) - Number(left.player?.tierRank || String(left.player?.tier || '').replace(/\D/g, '') || 0) || Number(right.player?.march || 0) - Number(left.player?.march || 0) || String(left.player?.name || '').localeCompare(String(right.player?.name || '')));
    const role = captain ? roleKey(captain) : '';
    const theme = captain ? (role === 'Fighter' ? 'fighter-theme' : role === 'Rider' ? 'rider-theme' : role === 'Shooter' ? 'shooter-theme' : 'is-auto') : 'is-auto';
    const captainMarch = tierAssignedMarch(captain, true);
    const rallySize = Math.max(0, Number(captain?.rally || 0) || 0);
    const helperTotal = helperItems.reduce((sum, item) => sum + helperAssignedMarch(item.id, slot, item.player), 0);
    const usedMarch = captainMarch + helperTotal;
    const capacityTotal = captain ? captainMarch + rallySize : 0;
    const freeMarch = Math.max(0, capacityTotal - usedMarch);
    const title = towerTitle(tower);
    const subtitle = captain ? finalRoleText(captain) : combinedText(lang => finalPhrase('typeByCaptain', lang));
    const rows = [];
    if (captain) {
      rows.push(`<li class="captain-row captain-row--highlight"><span title="${esc(captain.name)}">${esc(captain.name)}</span><em>${esc(captain.alliance || '—')}</em><b>${esc(captain.tier || '')}</b><strong class="captain-march-warn">${fmtBoard(captainMarch)}</strong></li>`);
    }
    helperItems.forEach(item => {
      const player = item.player;
      rows.push(`<li class="helper-row"><span title="${esc(player.name)}">${esc(player.name)}</span><em>${esc(player.alliance || '—')}</em><b>${esc(player.tier || '')}</b><strong>${fmtBoard(helperAssignedMarch(item.id, slot, player))}</strong></li>`);
    });
    const emptyClass = rows.length ? '' : ' empty';
    const body = rows.length ? rows.join('') : `<li class="empty-row">${esc(combinedText(lang => finalPhrase('noAssigned', lang)))}</li>`;
    return `<section class="board-col ${theme}${emptyClass}" data-base-id="${esc(tower.id)}" data-shift="${esc(shift)}"><header><h4>${esc(title)}</h4><div class="board-sub${captain ? '' : ' is-auto'}">${esc(subtitle)}</div><div class="board-cap board-cap-grid"><span class="board-cap-pill board-cap-pill--blue cap-total">${fmtBoard(capacityTotal)}</span><span class="board-cap-pill board-cap-pill--green cap-free">${fmtBoard(freeMarch)}</span><span class="board-cap-pill board-cap-pill--gold cap-used">${fmtBoard(usedMarch)}</span></div></header><ul>${body}</ul></section>`;
  }
  function renderFinals() {
    renderFinalToolbar($('[data-tower-panel="final"] [data-final-toolbar]'));
    renderFinalBoard($('#towerFinalBoard'));
    renderFinalToolbar($('#finalPlanOnlyModal [data-final-toolbar]'));
    renderFinalBoard($('#finalPlanOnlyBoard'));
    renderFinalLangDialog();
  }
  function ensureFinalLangDialog() {
    let root = document.getElementById('towerFinalLangDialog');
    if (!root) {
      root = document.createElement('div');
      root.id = 'towerFinalLangDialog';
      root.className = 'tower-final-lang-modal';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    return root;
  }
  function renderFinalLangDialog() {
    const root = document.getElementById('towerFinalLangDialog');
    if (!root) return;
    const selected = new Set(finalLangs);
    root.innerHTML = `<button class="tower-final-lang-backdrop" type="button" data-final-lang-close aria-label="${esc(tr('common.close', 'Закрити'))}"></button><div class="tower-final-lang-card" role="dialog" aria-modal="true" aria-label="${esc(tr('finalPlan.langButton', 'Мова плану'))}"><div class="tower-final-lang-head"><div><h3>${esc(tr('finalPlan.langButton', 'Мова плану'))}</h3><p>${esc(tr('finalPlan.langHelp', 'Познач мови, які треба показувати у фінальному плані.'))}</p></div><button class="btn btn-icon" type="button" data-final-lang-close>✕</button></div><div class="tower-final-lang-grid">${languages().map(lang => `<label class="tower-final-lang-option ${selected.has(lang.id) ? 'is-active' : ''}"><input type="checkbox" data-final-lang-option="${esc(lang.id)}" ${selected.has(lang.id) ? 'checked' : ''} ${lang.id === 'en' ? 'disabled' : ''}><img src="${esc(lang.icon)}" alt=""><span>${esc(lang.name)}</span></label>`).join('')}</div><div class="tower-final-lang-actions"><button class="btn" type="button" data-final-lang-close>${esc(tr('common.done', 'Готово'))}</button></div></div>`;
  }
  function openFinalLangDialog() {
    const root = ensureFinalLangDialog();
    renderFinalLangDialog();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
  }
  function closeFinalLangDialog() {
    const root = document.getElementById('towerFinalLangDialog');
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
  }
  function updateFinalLangSelection() {
    const root = document.getElementById('towerFinalLangDialog');
    if (!root) return;
    const picked = $$('[data-final-lang-option]', root).filter(input => input.checked || input.dataset.finalLangOption === 'en').map(input => input.dataset.finalLangOption);
    finalLangs = normalizeFinalLangs(picked);
    saveFinalLangs();
    renderFinals();
    openFinalLangDialog();
  }
  function preferredPngScale() {
    const dpr = Number(window.devicePixelRatio || 1) || 1;
    return dpr >= 1.5 ? 5 : 4;
  }
  async function waitForImages(root) {
    const images = $$('img', root);
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (typeof img.decode === 'function') return img.decode().catch(() => {});
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }
  async function renderSheetToPngBlob(sheet, options = {}) {
    if (!sheet) throw new Error('html2canvas_unavailable');
    if (typeof window.html2canvas !== 'function' && typeof WKD.ensureHtml2Canvas === 'function') await WKD.ensureHtml2Canvas();
    if (typeof window.html2canvas !== 'function') throw new Error('html2canvas_unavailable');
    const exportScale = Math.max(4, Math.min(5, Number(options.scale || preferredPngScale()) || 5));
    const cleanup = [];
    try {
      const sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.left = '-100000px';
      sandbox.style.top = '0';
      sandbox.style.pointerEvents = 'none';
      sandbox.style.opacity = '1';
      sandbox.style.zIndex = '-1';
      sandbox.style.overflow = 'visible';
      sandbox.style.background = '#d7dce5';
      document.body.appendChild(sandbox);
      cleanup.push(() => sandbox.remove());

      const style = document.createElement('style');
      style.textContent = `
        .png-export-sheet{display:block;width:max-content;max-width:none;min-width:0;overflow:visible;box-sizing:border-box;margin:0;padding:10px 12px 16px;background:#d7dce5;color:#111827;font-family:Arial,sans-serif}
        .png-export-sheet,.png-export-sheet *{box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;text-shadow:none!important;filter:none!important}
        .png-export-sheet .board-grid{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:10px;width:max-content;max-width:none;min-width:0;overflow:visible}
        .png-export-sheet .board-col{flex:0 0 272px;width:272px;min-width:272px;max-width:272px;box-sizing:border-box;overflow:hidden}
        .png-export-sheet .board-cap span{border:0!important;outline:0!important;box-shadow:none!important;background-image:none!important;border-radius:8px;padding:6px 10px;font-weight:900;line-height:1;display:block;text-align:center}
        .png-export-sheet .board-cap .cap-total{background:#4e73c6!important;color:#f9fbff!important}
        .png-export-sheet .board-cap .cap-free{background:#5aa174!important;color:#f8fff9!important}
        .png-export-sheet .board-cap .cap-used{background:#f1bb3e!important;color:#1c1400!important}
        .png-export-sheet .board-signature{margin-top:16px;display:flex;justify-content:center;align-items:center;padding:0 8px}
        .png-export-sheet .board-signature-image{display:block;width:220px!important;max-width:220px!important;height:auto!important}
      `;
      sandbox.appendChild(style);
      cleanup.push(() => style.remove());

      const exportSheet = sheet.cloneNode(true);
      exportSheet.classList.add('png-export-sheet', 'is-exporting-png');
      sandbox.appendChild(exportSheet);
      await waitForImages(exportSheet);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const grid = exportSheet.querySelector('.board-grid');
      const exportWidth = Math.ceil(Math.max(exportSheet.scrollWidth || 0, grid?.scrollWidth || 0, exportSheet.getBoundingClientRect().width || 0));
      const exportHeight = Math.ceil(Math.max(exportSheet.scrollHeight || 0, exportSheet.getBoundingClientRect().height || 0));
      const canvas = await window.html2canvas(exportSheet, {
        backgroundColor: null,
        scale: exportScale,
        useCORS: true,
        logging: false,
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
        scrollX: 0,
        scrollY: 0
      });
      try {
        const ctx = canvas.getContext?.('2d');
        if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
      } catch (_error) {}
      return await new Promise((resolve, reject) => {
        try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('png_blob_failed')), 'image/png'); }
        catch (error) { reject(error); }
      });
    } finally {
      cleanup.reverse().forEach(fn => { try { fn(); } catch (_error) {} });
    }
  }
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function downloadFinalPng() {
    const sheet = document.querySelector('.final-plan-modal.is-open .board-sheet') || document.querySelector('#towerPlannerModal.is-open [data-tower-panel="final"].is-active .board-sheet') || document.querySelector('#finalPlanOnlyBoard .board-sheet') || document.querySelector('#towerFinalBoard .board-sheet');
    if (!sheet) return;
    try {
      if (typeof window.html2canvas !== 'function' && typeof WKD.ensureHtml2Canvas === 'function') await WKD.ensureHtml2Canvas();
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(tr('finalPlan.pngLibraryLoadFailed', 'Не вдалося завантажити бібліотеку для PNG. Перевір інтернет і спробуй ще раз.'));
      return;
    }
    if (typeof window.html2canvas !== 'function') {
      WKD.showNotice?.(tr('finalPlan.pngLibraryMissing', 'Не вдалося завантажити PNG: бібліотека html2canvas ще не завантажилась. Онови сторінку і спробуй ще раз.'));
      return;
    }
    sheet.classList.add('is-exporting-png');
    try {
      const blob = await renderSheetToPngBlob(sheet, { scale: 5 });
      downloadBlob(`wasteland-final-plan-${activeFinalShift}-${Date.now()}.png`, blob);
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(tr('finalPlan.pngCreateFailed', 'Не вдалося створити PNG фінального плану.'));
    } finally {
      sheet.classList.remove('is-exporting-png');
    }
  }
  function render() {
    setFormValues();
    renderTierLimits();
    updateAccessUi();
    renderSetup();
    renderTowerCards();
    renderStatus();
    renderFinals();
    setActiveTab(activeTab);
  }
  function setActiveTab(tab) {
    activeTab = ['setup', 'towers', 'status', 'final'].includes(tab) ? tab : 'setup';
    $$('#towerPlannerModal [data-tower-main-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.towerMainTab === activeTab));
    $$('#towerPlannerModal [data-tower-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.towerPanel === activeTab));
  }
  function clearShift(shift = activeShift) {
    TOWERS.forEach(tower => { plan.assignments[shift][tower.id] = { captain: '', helpers: [], helperMarches: {}, tierLimits: {} }; });
  }
  function clearShiftHelpersKeepCaptains(shift = activeShift) {
    TOWERS.forEach(tower => {
      const slot = plan.assignments[shift][tower.id] || { captain: '', helpers: [], helperMarches: {} };
      plan.assignments[shift][tower.id] = { captain: clean(slot.captain || ''), captainLocked: Boolean(slot.captain && slot.captainLocked), helpers: [], helperMarches: {}, tierLimits: { ...(slot.tierLimits || {}) } };
    });
  }
  function clearAll() { plan.assignments = emptyAssignments(); }
  async function resetPlanToEmpty(source = '') {
    const eventSource = String(source || 'tower-reset');
    const info = sourceInfo();
    plan = normalizePlan(null);
    if (info.mode === 'region') {
      if (canEditPlan()) await savePlan(false);
    } else if (!/registration-form|local-to-region|region/i.test(eventSource)) {
      localSavePlan(plan);
    }
    if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) render();
    return plan;
  }
  function limitPerTower() { return MAX_PLAYERS_PER_TOWER; }
  function helpersLimitReached(slot) { return (slot.helpers || []).length >= MAX_HELPERS_PER_TOWER; }
  function towerRoom(slot) {
    const normalized = ensureSlotShape(slot || {});
    const captain = playerById(normalized.captain);
    if (!captain) return 0;
    const rally = Math.max(0, Number(captain.rally || 0) || 0);
    return Math.max(0, rally - slotHelpersMarch(normalized));
  }
  function helperMarchForSlot(entry, slot, mode = 'preferred') {
    if (!entry?.player || !slot?.captain) return 0;
    const room = towerRoom(slot);
    if (room <= 0) return 0;
    const target = mode === 'minimum' ? minimumHelperMarch(entry.player) : preferredHelperMarch(entry.player);
    return target > 0 ? Math.min(target, room) : 0;
  }
  function shrinkSlotHelperMarchesToMinimum(slot) {
    const normalized = ensureSlotShape(slot || {});
    if (!normalized.captain || !normalized.helpers.length) return;
    normalized.helpers.forEach(id => {
      const player = playerById(id);
      const amount = minimumHelperMarch(player);
      if (amount > 0) setHelperAssignedMarch(normalized, id, amount);
    });
  }
  function shrinkShiftHelperMarchesToMinimum(shift) {
    TOWERS.forEach(tower => shrinkSlotHelperMarchesToMinimum(plan.assignments?.[shift]?.[tower.id]));
  }
  function growSlotHelperMarches(slot) {
    const normalized = ensureSlotShape(slot || {});
    if (!normalized.captain || !normalized.helpers.length) return 0;
    const mode = String(plan.settings?.fillMode || 'mid').toLowerCase();
    const ordered = normalized.helpers
      .map(id => ({ id, player: playerById(id) }))
      .filter(entry => entry.player)
      .sort(compareAutoCandidates);
    let added = 0;

    const addExtra = (entry, wantedExtra) => {
      const current = helperAssignedMarch(entry.id, normalized, entry.player);
      const max = maxHelperMarch(entry.player);
      const room = towerRoom(normalized);
      const extra = Math.max(0, Math.min(Number(wantedExtra) || 0, max - current, room));
      if (extra > 0) {
        setHelperAssignedMarch(normalized, entry.id, current + extra);
        added += extra;
        return true;
      }
      return false;
    };

    if (mode === 'mid') {
      // Розумний баланс: усі вже стоять мінімумом, а вільне місце роздається
      // колами. Вищі тіри отримують більший крок, але нижчі не залишаються вічно по 1k,
      // якщо в ралі ще багато місця.
      let guard = 0;
      while (towerRoom(normalized) > 0 && guard < 300) {
        guard += 1;
        let progress = false;
        ordered.forEach(entry => {
          const step = Math.max(1000, Math.round(18000 * tierGrowWeight(entry.player) / 1000) * 1000);
          if (addExtra(entry, step)) progress = true;
        });
        if (!progress) break;
      }
      return added;
    }

    // Максимум і Мінімум: заповнюємо ралі зверху вниз. У мінімальному режимі нижчі тіри
    // лишаються малими, доки вищі тіри не взяли свій доступний максимум.
    ordered.forEach(entry => addExtra(entry, maxHelperMarch(entry.player)));
    return added;
  }
  function growShiftHelperMarches(shift) {
    TOWERS.forEach(tower => growSlotHelperMarches(plan.assignments?.[shift]?.[tower.id]));
  }
  function slotHelperLoad(slot) {
    return (slot?.helpers || []).length;
  }
  function slotUsedHelperMarch(slot) {
    return slotHelpersMarch(slot || {});
  }
  function slotFillRatio(slot) {
    const captain = playerById(slot?.captain);
    const rally = Math.max(0, Number(captain?.rally || 0) || 0);
    return rally > 0 ? slotUsedHelperMarch(slot) / rally : 1;
  }
  function canEntryFitSlot(entry, shift, slot, used, assignedNickKeys, captainPlayer = null) {
    if (!slot?.captain || helpersLimitReached(slot)) return false;
    const captain = captainPlayer || playerById(slot.captain);
    if (!captain) return false;
    if (!canUseEntryInShift(entry, shift, used, assignedNickKeys, captain)) return false;
    const effective = helperMarchForSlot(entry, slot, 'minimum');
    return effective > 0;
  }
  function chooseBalancedSlotForHelper(entry, slots, shift, used, assignedNickKeys) {
    const choices = slots
      .map(item => ({ ...item, captain: playerById(item.slot.captain) }))
      .filter(item => canEntryFitSlot(entry, shift, item.slot, used, assignedNickKeys, item.captain));
    if (!choices.length) return null;
    choices.sort((left, right) =>
      slotFillRatio(left.slot) - slotFillRatio(right.slot)
      || slotHelperLoad(left.slot) - slotHelperLoad(right.slot)
      || slotUsedHelperMarch(left.slot) - slotUsedHelperMarch(right.slot)
      || towerRoom(right.slot) - towerRoom(left.slot)
      || TOWERS.findIndex(tower => tower.id === left.tower.id) - TOWERS.findIndex(tower => tower.id === right.tower.id)
    );
    return choices[0];
  }
  function distributeHelpersBalanced(shift, entries, used, assignedNickKeys) {
    const slots = TOWERS.map(tower => ({ tower, slot: plan.assignments?.[shift]?.[tower.id] })).filter(item => item.slot?.captain);
    let added = 0;

    // 1) Спочатку стараємось поставити всіх гравців маленьким безпечним маршем.
    // 2) Після цього роздаємо вільне місце зверху вниз: T14/T13/T12 беруть максимум, нижчі тіри — тільки залишок.
    while (true) {
      let progress = false;
      const candidates = entries.filter(entry => entry.id && !used.has(entry.id));
      for (const entry of candidates) {
        const picked = chooseBalancedSlotForHelper(entry, slots, shift, used, assignedNickKeys);
        if (!picked) continue;
        if (addHelperToSlot(picked.slot, entry, used, assignedNickKeys, { mode: 'minimum' })) {
          added += 1;
          progress = true;
        }
      }
      if (!progress) break;
      if (slots.every(item => helpersLimitReached(item.slot) || towerRoom(item.slot) <= 0)) break;
    }
    growShiftHelperMarches(shift);
    return added;
  }
  function canUseEntryInShift(entry, shift, used, assignedNickKeys, captainPlayer = null) {
    if (!entry?.id || used.has(entry.id)) return false;
    if (plan.settings.matchShift) {
      const playerShift = normalizeShift(entry.player.shift || entry.player.shiftLabel);
      if (playerShift !== shift && !(plan.settings.useBoth && playerShift === 'both')) return false;
    }
    if (captainPlayer && plan.settings.sameRole) { const captainRole = roleKey(captainPlayer); const playerRole = roleKey(entry.player); if (captainRole && playerRole && playerRole !== captainRole) return false; }
    return true;
  }
  function assignedNickKeysForShift(shift) {
    const keys = new Set();
    Object.values(plan.assignments?.[shift] || {}).forEach(slot => {
      [slot.captain, ...(slot.helpers || [])].filter(Boolean).forEach(id => {
        const key = nickKey(playerById(id));
        if (key) keys.add(key);
      });
    });
    return keys;
  }
  function candidateEntriesForShift(shift) {
    return entriesForShift(shift, Boolean(plan.settings.useBoth)).sort(compareAutoCandidates);
  }
  function pickCaptain(entries, shift, used, assignedNickKeys) {
    return entries.find(entry => canUseEntryInShift(entry, shift, used, assignedNickKeys) && (!plan.settings.onlyCaptains || entry.player.captain));
  }
  function pickHelper(entries, shift, slot, used, assignedNickKeys) {
    if (!slot.captain || helpersLimitReached(slot)) return null;
    const captain = playerById(slot.captain);
    if (!captain) return null;
    const room = towerRoom(slot);
    if (room <= 0) return null;
    return entries.find(entry => {
      if (entry.id === slot.captain) return false;
      if (!canUseEntryInShift(entry, shift, used, assignedNickKeys, captain)) return false;
      const effective = helperMarchForSlot(entry, slot, 'minimum');
      return effective > 0 && room > 0;
    }) || null;
  }
  function addHelperToSlot(slot, entry, used, assignedNickKeys, options = {}) {
    if (!entry?.id || helpersLimitReached(slot)) return false;
    const normalized = ensureSlotShape(slot);
    const amount = helperMarchForSlot(entry, normalized, options.mode === 'minimum' ? 'minimum' : 'preferred');
    if (amount <= 0) return false;
    if (!normalized.helpers.includes(entry.id)) normalized.helpers.push(entry.id);
    setHelperAssignedMarch(normalized, entry.id, amount);
    used.add(entry.id);
    const key = nickKey(entry.player);
    if (key) assignedNickKeys.add(key);
    return true;
  }
  function loadShiftBackup() {
    try {
      const data = JSON.parse(localStorage.getItem(SHIFT_BACKUP_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_error) { return {}; }
  }
  function saveShiftBackup(data) {
    try { localStorage.setItem(SHIFT_BACKUP_KEY, JSON.stringify(data || {})); } catch (_error) {}
  }
  async function updatePlayerShift(id, shift, remember = true) {
    const targetShift = normalizeShift(shift);
    if (!(SHIFT_ORDER.includes(targetShift) || targetShift === 'both')) return false;
    const idText = String(id || '');
    const sourceIndex = players().findIndex((player, index) => playerId(player, index) === idText);
    const sourcePlayer = sourceIndex >= 0 ? players()[sourceIndex] : null;
    const entry = playerEntries().find(item => item.id === idText);
    if (!entry || !sourcePlayer) return false;

    const backup = loadShiftBackup();
    if (remember && !Object.prototype.hasOwnProperty.call(backup, entry.id)) {
      backup[entry.id] = baseShiftForPlayer(sourcePlayer);
      saveShiftBackup(backup);
    }

    const info = sourceInfo();
    if (info.mode === 'region') {
      plan.shiftOverrides = plan.shiftOverrides && typeof plan.shiftOverrides === 'object' ? plan.shiftOverrides : {};
      const originalShift = strictBaseShiftForPlayer(sourcePlayer) || 'both';
      if (originalShift !== 'both') {
        // Do not rewrite real shift 1/2 players into “both” or another shift from this panel.
        delete plan.shiftOverrides[entry.id];
        removePlayer(entry.id);
        await savePlan(false);
        return targetShift === originalShift;
      }
      if (targetShift === 'both') delete plan.shiftOverrides[entry.id];
      else plan.shiftOverrides[entry.id] = targetShift;
      sanitizeShiftOverridesForCurrentPlayers();
      removePlayer(entry.id);
      await savePlan(false);
      return true;
    }

    if (typeof WKD.updatePlayerInActiveSource === 'function') {
      await WKD.updatePlayerInActiveSource(entry.id, { shift: targetShift });
    } else {
      sourcePlayer.shift = targetShift;
      sourcePlayer.shiftLabel = shiftLabel(targetShift);
      WKD.saveJson?.(WKD.storageKeys.players, players());
      WKD.renderPlayers?.();
      document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'tower-shift-local', persist: true } }));
    }
    removePlayer(entry.id);
    return true;
  }
  async function applyManualBothShiftAdds() {
    recordLocalPlannerAction('manual-both-shift-add');
    if (!canEditPlan()) return;
    readFormValues();
    const add1 = Math.max(0, Number($('#towerShiftAdd1')?.value || 0) || 0);
    const add2 = Math.max(0, Number($('#towerShiftAdd2')?.value || 0) || 0);
    if (!add1 && !add2) { await savePlan(false); render(); return; }
    const both = entriesForExactShift('both').sort(compareAutoCandidates);
    const toShift1 = both.slice(0, add1);
    const toShift2 = both.slice(add1, add1 + add2);
    for (const entry of toShift1) await updatePlayerShift(entry.id, 'shift1', true);
    for (const entry of toShift2) await updatePlayerShift(entry.id, 'shift2', true);
    render();
    await savePlan(false);
    WKD.showNotice?.(tr('tower.bothShiftApplied', 'Обидві: додано у зміну 1 — {shift1}, у зміну 2 — {shift2}.', { shift1: toShift1.length, shift2: toShift2.length }));
  }
  async function restoreManualShiftBackup() {
    if (!canEditPlan()) return;
    const backup = loadShiftBackup();
    const ids = Object.keys(backup);
    if (!ids.length) { WKD.showNotice?.(tr('tower.noManualShiftBackup', 'Немає збереженого ручного розподілу для відновлення.')); return; }
    for (const id of ids) {
      const shift = backup[id];
      if (['shift1','shift2','shift3','shift4','both'].includes(shift)) await updatePlayerShift(id, shift, false);
    }
    saveShiftBackup({});
    render();
    await savePlan(false);
    WKD.showNotice?.(tr('tower.importShiftRestored', 'Зміни гравців відновлено з імпортованого стану.'));
  }
  function autoDistribute({ topup = false } = {}) {
    invalidatePlayerEntryCache();
    recordLocalPlannerAction(topup ? 'autofill-towers' : 'redistribute');
    readFormValues();
    const shifts = availableShifts();
    if (!topup) shifts.forEach(clearShiftHelpersKeepCaptains);
    shifts.forEach(shift => autoDistributeShift(shift));
    render();
    savePlan(false);
    WKD.showNotice?.(topup ? tr('tower.autoFilled', 'Турелі дозаповнено.') : tr('tower.redistributionDone', 'Перерозподіл застосовано. Капітани, поставлені вручну, залишились у своїх турелях.'));
  }
  function autoDistributeShift(shift) {
    const entries = candidateEntriesForShift(shift);
    const used = usedIdsForShift(shift);
    const assignedNickKeys = assignedNickKeysForShift(shift);

    TOWERS.forEach(tower => {
      const slot = plan.assignments[shift][tower.id];
      if (!slot.captain) {
        const captain = pickCaptain(entries, shift, used, assignedNickKeys);
        if (captain) {
          setSlotCaptain(slot, captain.id, { locked: false, promotePrevious: false });
          used.add(captain.id);
          const key = nickKey(captain.player);
          if (key) assignedNickKeys.add(key);
        }
      }
    });

    shrinkShiftHelperMarchesToMinimum(shift);
    distributeHelpersBalanced(shift, entries, used, assignedNickKeys);
    growShiftHelperMarches(shift);
  }
  function fillSlotToCapacity(slot, entries, shift, used = usedIdsForShift(shift), assignedNickKeys = assignedNickKeysForShift(shift)) {
    if (!slot || !slot.captain) return 0;
    ensureSlotShape(slot);
    let added = 0;
    while (!helpersLimitReached(slot)) {
      const helper = pickHelper(entries, shift, slot, used, assignedNickKeys);
      if (!helper) break;
      if (!addHelperToSlot(slot, helper, used, assignedNickKeys, { mode: 'minimum' })) break;
      added += 1;
    }
    growSlotHelperMarches(slot);
    return added;
  }
  function autoFillTower(towerId, shift = activeShift) {
    const tower = TOWERS.find(item => item.id === towerId);
    if (!tower || !plan.assignments?.[shift]?.[towerId]) return;
    const entries = candidateEntriesForShift(shift);
    const used = usedIdsForShift(shift);
    const assignedNickKeys = assignedNickKeysForShift(shift);
    const slot = plan.assignments[shift][towerId];
    if (!slot.captain) {
      const captain = pickCaptain(entries, shift, used, assignedNickKeys);
      if (captain) {
        setSlotCaptain(slot, captain.id, { locked: false, promotePrevious: false });
        used.add(captain.id);
        const key = nickKey(captain.player);
        if (key) assignedNickKeys.add(key);
      }
    }
    shrinkSlotHelperMarchesToMinimum(slot);
    fillSlotToCapacity(slot, entries, shift, used, assignedNickKeys);
  }
  function autoPlacePlayer(id, shift) {
    removePlayer(id, '', { forceCaptain: true });
    if (!plan.assignments[shift]) return;
    const entry = playerEntries().find(item => item.id === String(id));
    for (const tower of TOWERS) {
      const slot = plan.assignments[shift][tower.id];
      if (!slot.captain && entry?.player?.captain) { setSlotCaptain(slot, id, { locked: true, promotePrevious: false }); return; }
      if (slot.captain && addHelperToSlot(slot, entry, usedIdsForShift(shift), assignedNickKeysForShift(shift))) return;
    }
  }
  function ensureTowerPlannerBound() {
    if (initialized) return true;
    if (!modal() && !finalModal()) return false;
    try {
      bind();
      initialized = true;
      document.documentElement.dataset.wkdTowerBind = '1';
      return true;
    } catch (error) {
      initialized = false;
      console.warn('[WKD] tower planner bind skipped:', error);
      return false;
    }
  }

  async function openPlanner(trigger = null, tab = 'setup') {
    if (!ensureTowerPlannerBound()) { WKD.showNotice?.(tr('tower.plannerLoading', 'Розподіл по турелях ще завантажується. Спробуй ще раз.')); return; }
    const root = modal();
    if (!root) return;
    lastTrigger = trigger || document.activeElement;
    activeTab = tab;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
    await ensureRegionPlayersFreshForTower(false);
    await loadPlan();
    render();
  }
  function closePlanner() {
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (!finalModal()?.classList.contains('is-open')) document.body.classList.remove('wkd-modal-open');
    try { lastTrigger?.focus?.(); } catch (_error) {}
  }
  async function openFinal(trigger = null) {
    if (!ensureTowerPlannerBound()) { WKD.showNotice?.(tr('tower.finalLoading', 'Фінальний план ще завантажується. Спробуй ще раз.')); return; }
    const root = finalModal();
    if (!root) return;
    lastTrigger = trigger || document.activeElement;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
    await ensureRegionPlayersFreshForTower(false);
    await loadPlan();
    renderFinals();
  }
  function closeFinal() {
    const root = finalModal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (!modal()?.classList.contains('is-open')) document.body.classList.remove('wkd-modal-open');
    try { lastTrigger?.focus?.(); } catch (_error) {}
  }
  function txtLine(char = '═', length = 32) {
    return char.repeat(length);
  }
  function txtShiftTitle(shift) {
    return combinedText(lang => shiftFinalLabel(shift, lang));
  }
  function txtRoleText(role) {
    const key = roleKey(role);
    if (!key) return combinedText(lang => finalPhrase('unknownTroop', lang));
    const phraseKey = key === 'Fighter' ? 'fighterPlural' : key === 'Rider' ? 'riderPlural' : 'shooterPlural';
    return combinedText(lang => finalPhrase(phraseKey, lang));
  }
  function txtPlayerLine(player, march) {
    if (!player) return '';
    return `│ ${clean(player.name || '—')} ✦ ${clean(player.alliance || player.allianceTag || '—')} ✦ ${clean(player.tier || '—')} ✦ ${fmtBoard(march)}`;
  }
  function txtTowerBlock(shift, tower) {
    const slot = ensureSlotShape(plan.assignments?.[shift]?.[tower.id] || { captain: '', helpers: [], helperMarches: {} });
    const captain = playerById(slot.captain);
    const helpers = (slot.helpers || [])
      .map(id => ({ id, player: playerById(id) }))
      .filter(item => item.player)
      .sort((left, right) => compareAutoCandidates(left, right));
    const troopText = captain ? txtRoleText(captain) : combinedText(lang => finalPhrase('typeByCaptain', lang));
    const lines = [
      '┌───────────────────────────────',
      `│ Turret: ${towerTitle(tower)}`,
      `│ Troop type: ${troopText}`,
      '├─ Captain ─────────────────────'
    ];
    lines.push(captain ? txtPlayerLine(captain, tierAssignedMarch(captain, true)) : '│ —');
    lines.push('├─ Players ─────────────────────');
    if (helpers.length) {
      helpers.forEach(item => lines.push(txtPlayerLine(item.player, helperAssignedMarch(item.id, slot, item.player))));
    } else {
      lines.push(`│ ${combinedText(lang => finalPhrase('noAssigned', lang))}`);
    }
    lines.push('└───────────────────────────────');
    return lines.join('\n');
  }
  function shiftHasPlan(shift) {
    return TOWERS.some(tower => {
      const slot = plan.assignments?.[shift]?.[tower.id];
      return Boolean(slot?.captain || (Array.isArray(slot?.helpers) && slot.helpers.length));
    });
  }
  function txtShiftsToExport() {
    const shifts = availableShifts().filter(shift => shiftHasPlan(shift));
    if (shifts.length) return shifts;
    return availableShifts().filter(shift => SHIFT_ORDER.includes(shift)).slice(0, 2);
  }
  function currentTxt({ allShifts = true } = {}) {
    const shifts = allShifts ? txtShiftsToExport() : [activeFinalShift];
    return shifts.map(shift => [
      txtLine(),
      `◆ ${txtShiftTitle(shift)}`,
      txtLine(),
      '',
      TOWERS.map(tower => txtTowerBlock(shift, tower)).join('\n\n')
    ].join('\n')).join('\n\n');
  }
  function downloadFinalTxt() {
    const text = currentTxt({ allShifts: true });
    const shifts = txtShiftsToExport().map(shift => String(shift).replace('shift', 'shift')).join('-') || activeFinalShift;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(`pns-final-plan-${shifts}-${Date.now()}.txt`, blob);
    WKD.showNotice?.(tr('tower.txtDownloaded', 'TXT фінального плану завантажено.'));
  }
  async function copyFinalText() {
    const text = currentTxt({ allShifts: true });
    try { await navigator.clipboard.writeText(text); WKD.showNotice?.(tr('tower.txtCopied', 'Фінальний план скопійовано в TXT.')); }
    catch { window.prompt(tr('tower.copyTxtPrompt', 'Скопіюй TXT:'), text); }
  }
  function finalShareShifts() {
    const shifts = txtShiftsToExport();
    return (shifts.length ? shifts : [activeFinalShift]).filter(Boolean).slice(0, 6);
  }
  function renderFinalShareSheets(shifts = finalShareShifts()) {
    const originalShift = activeFinalShift;
    const temp = document.createElement('div');
    temp.className = 'wkd-final-share-render';
    temp.style.position = 'fixed';
    temp.style.left = '-10000px';
    temp.style.top = '0';
    temp.style.width = '1800px';
    temp.style.pointerEvents = 'none';
    document.body.appendChild(temp);
    const sheets = [];
    try {
      shifts.forEach(shift => {
        activeFinalShift = shift;
        renderFinalBoard(temp);
        const sheet = temp.querySelector('.board-sheet');
        if (sheet) sheets.push({ shift, html: sheet.outerHTML, node: sheet.cloneNode(true) });
      });
    } finally {
      activeFinalShift = originalShift;
      temp.remove();
      renderFinals();
    }
    return sheets;
  }
  async function finalSharePngFiles(sheets = []) {
    if (!sheets.length) return [];
    try {
      if (typeof window.html2canvas !== 'function' && typeof WKD.ensureHtml2Canvas === 'function') await WKD.ensureHtml2Canvas();
    } catch (error) {
      console.warn('[WKD] html2canvas lazy load failed:', error);
      return [];
    }
    if (typeof window.html2canvas !== 'function') return [];
    const files = [];
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = '-10000px';
    wrap.style.top = '0';
    wrap.style.width = '1800px';
    wrap.style.pointerEvents = 'none';
    document.body.appendChild(wrap);
    try {
      for (const item of sheets) {
        wrap.innerHTML = '';
        wrap.appendChild(item.node.cloneNode(true));
        const sheet = wrap.querySelector('.board-sheet');
        if (!sheet) continue;
        try {
          const pngBlob = await renderSheetToPngBlob(sheet, { scale: 4 });
          files.push(new File([pngBlob], `wasteland-final-plan-${item.shift}.png`, { type: 'image/png' }));
        } catch (error) {
          console.warn('[WKD] share png skipped:', item.shift, error);
        }
      }
    } finally {
      wrap.remove();
    }
    return files;
  }
  async function makeFinalShareData() {
    const text = currentTxt({ allShifts: true });
    const info = sourceInfo();
    const sheets = renderFinalShareSheets(finalShareShifts());
    const html = `<div class="wkd-final-share-stack">${sheets.map(item => item.html).join('')}</div>`;
    let shareUrl = '';
    if (info.mode === 'region' && typeof WKD.shareRegionFinalPlan === 'function' && sheets.length) {
      const result = await WKD.shareRegionFinalPlan({ html, text, title: 'Wasteland final plan', shift: sheets.map(item => item.shift).join(',') });
      shareUrl = result.url || '';
    }
    return { text, sheets, shareUrl };
  }
  async function copyFinalShareLink() {
    try {
      const { shareUrl } = await makeFinalShareData();
      if (!shareUrl) throw new Error('share-url-empty');
      await navigator.clipboard.writeText(shareUrl);
      WKD.showNotice?.(tr('finalPlan.linkCopied', 'Секретне посилання скопійовано.'));
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(tr('finalPlan.shareLinkFailed', 'Не вдалося створити секретне посилання.'));
    }
  }
  async function shareFinalText() {
    let data;
    try {
      data = await makeFinalShareData();
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(tr('finalPlan.shareLinkFailed', 'Не вдалося створити секретне посилання.'));
      data = { text: currentTxt({ allShifts: true }), sheets: renderFinalShareSheets(finalShareShifts()), shareUrl: '' };
    }
    const { text, sheets, shareUrl } = data;
    const title = 'Wasteland final plan';
    const files = await finalSharePngFiles(sheets);
    try { files.push(new File([text], 'wasteland-final-plan.txt', { type: 'text/plain' })); } catch (_error) {}
    const sharePayload = { title, text: shareUrl ? `${shareUrl}

${text}` : text };
    if (shareUrl) sharePayload.url = shareUrl;
    if (files.length && navigator.canShare?.({ files })) sharePayload.files = files;
    if (navigator.share) {
      try { await navigator.share(sharePayload); return; } catch (_error) {}
    }
    if (shareUrl) {
      try { await navigator.clipboard.writeText(shareUrl); } catch (_error) {}
      WKD.actionDoneDialog?.({
        title: tr('finalPlan.shareLinkReadyTitle', 'Посилання готове'),
        message: tr('finalPlan.shareLinkReadyMessage', 'Секретне посилання на фінальний план скопійовано. Його можуть відкрити гравці без входу.'),
        href: shareUrl,
        acceptText: tr('finalPlan.openSharedPlan', 'Відкрити план'),
        cancelText: tr('common.continue', 'Продовжити')
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      WKD.showNotice?.(tr('finalPlan.txtCopied', 'Фінальний план скопійовано в TXT.'));
    } catch {
      window.prompt(tr('tower.copyTxtPrompt', 'Скопіюй TXT:'), text);
    }
  }
  function cycleFinalLang() {
    openFinalLangDialog();
  }
  function bind() {
    document.addEventListener('click', event => {
      const disabled = event.target.closest('[data-disabled-note]');
      if (disabled) {
        const text = disabled.dataset.disabledNote || '';
        if (/Фінальний план/i.test(text)) { event.preventDefault(); openFinal(disabled); return; }
        if (/Розподіл по турелях/i.test(text)) { event.preventDefault(); openPlanner(disabled); return; }
      }
      const closeTower = event.target.closest('[data-tower-close]');
      if (closeTower) { event.preventDefault(); closePlanner(); return; }
      const finalCloseBtn = event.target.closest('[data-final-close]');
      if (finalCloseBtn) { event.preventDefault(); closeFinalPlan(); return; }
      const tab = event.target.closest('[data-tower-main-tab]');
      if (tab) { event.preventDefault(); setActiveTab(tab.dataset.towerMainTab); return; }
      const moreToggle = event.target.closest('[data-final-more-toggle]');
      if (moreToggle) {
        event.preventDefault();
        const wrap = moreToggle.closest('.tower-final-more-wrap');
        const panel = wrap?.querySelector('[data-final-more-menu]');
        const willOpen = Boolean(panel?.hidden);
        document.querySelectorAll('[data-final-more-menu]').forEach(menu => {
          if (menu !== panel) {
            menu.hidden = true;
            menu.classList.remove('is-fixed-open');
            menu.removeAttribute('style');
          }
        });
        if (panel) {
          panel.hidden = !willOpen;
          panel.classList.toggle('is-fixed-open', willOpen);
          if (willOpen) {
            const rect = moreToggle.getBoundingClientRect();
            const width = Math.min(300, Math.max(230, rect.width + 80));
            const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
            const top = Math.max(10, Math.min(window.innerHeight - 12, rect.bottom + 8));
            panel.style.minWidth = `${width}px`;
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.right = 'auto';
          } else {
            panel.removeAttribute('style');
          }
        }
        moreToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }
      const sourceOpen = event.target.closest('[data-tower-scope-open]');
      if (sourceOpen) { event.preventDefault(); openTowerSourceDialog(); return; }
      const sourceClose = event.target.closest('[data-tower-scope-close]');
      if (sourceClose) { event.preventDefault(); closeTowerSourceDialog(); return; }
      const sourceMode = event.target.closest('[data-tower-source-mode]');
      if (sourceMode) {
        event.preventDefault();
        if (sourceMode.dataset.towerSourceMode === 'local') { chooseTowerSource({ mode: 'local' }); return; }
        const root = document.getElementById('towerSourceDialog');
        if (root) {
          root.querySelector('.tower-source-regions')?.removeAttribute('hidden');
          root.querySelectorAll('.tower-source-mode').forEach(btn => btn.classList.toggle('is-active', btn === sourceMode));
        }
        return;
      }
      const sourceRegion = event.target.closest('[data-tower-source-region]');
      if (sourceRegion) { event.preventDefault(); chooseTowerSource({ mode: 'region', region: sourceRegion.dataset.towerSourceRegion || '' }); return; }
      const shiftBtn = event.target.closest('[data-tower-shift]');
      if (shiftBtn) { event.preventDefault(); activeShift = shiftBtn.dataset.towerShift; render(); return; }
      const towerSelect = event.target.closest('[data-tower-select]');
      if (towerSelect) { event.preventDefault(); activeTowerId = towerSelect.dataset.towerSelect || activeTowerId; renderTowerCards(); return; }
      const statusBtn = event.target.closest('[data-status-filter]');
      if (statusBtn) { event.preventDefault(); statusFilter = statusBtn.dataset.statusFilter; renderStatus(); return; }
      const setCaptain = event.target.closest('[data-tower-set-captain]');
      if (setCaptain && canEditPlan()) {
        event.preventDefault();
        const tid = setCaptain.dataset.towerSetCaptain;
        const select = $(`[data-tower-captain-pick="${CSS.escape(tid)}"]`);
        const id = select?.value || '';
        if (!id || !plan.assignments[activeShift]?.[tid]) return;
        removePlayer(id, activeShift, { forceCaptain: true });
        setSlotCaptain(plan.assignments[activeShift][tid], id, { locked: true });
        render();
        savePlan(false);
        return;
      }
      const manualCaptain = event.target.closest('[data-tower-add-manual-captain]');
      if (manualCaptain && canEditPlan()) {
        event.preventDefault();
        const tid = manualCaptain.dataset.towerAddManualCaptain;
        const entry = manualEntryOrSelected(tid, `[data-tower-helper-pick="${CSS.escape(tid)}"]`);
        if (!entry || !plan.assignments[activeShift]?.[tid]) return;
        removePlayer(entry.id, activeShift, { forceCaptain: true });
        setSlotCaptain(plan.assignments[activeShift][tid], entry.id, { locked: true });
        render();
        savePlan(false);
        return;
      }
      const saveTier = event.target.closest('[data-tower-save-tier]');
      if (saveTier && canEditPlan()) {
        event.preventDefault();
        const tid = saveTier.dataset.towerSaveTier || activeTowerId;
        saveTowerTierLimits(tid);
        savePlan();
        return;
      }
      const resetTier = event.target.closest('[data-tower-reset-tier]');
      if (resetTier && canEditPlan()) {
        event.preventDefault();
        const tid = resetTier.dataset.towerResetTier || activeTowerId;
        resetTowerTierLimits(tid);
        render();
        savePlan(false);
        return;
      }
      const recalcTier = event.target.closest('[data-tower-recalc-tier]');
      if (recalcTier && canEditPlan()) {
        event.preventDefault();
        const tid = recalcTier.dataset.towerRecalcTier || activeTowerId;
        saveTowerTierLimits(tid);
        const result = recalculateTowerComposition(tid, activeShift);
        render();
        savePlan(false);
        WKD.showNotice?.(result.reason || tr('tower.recalculated', 'Склад цієї турелі перераховано.'));
        return;
      }
      const addHelper = event.target.closest('[data-tower-add-helper]');
      if (addHelper && canEditPlan()) {
        event.preventDefault();
        const tid = addHelper.dataset.towerAddHelper;
        const slot = plan.assignments[activeShift]?.[tid];
        const entry = manualEntryOrSelected(tid);
        if (entry?.id && slot) {
          if (helpersLimitReached(slot)) { WKD.showNotice?.(tr('tower.helpersFull', 'У турелі вже 29 помічників. Більше не влазить.')); return; }
          if (slot.captain && towerRoom(slot) <= 0) { WKD.showNotice?.(tr('tower.rallyNoRoom', 'У цій турелі вже немає вільного місця ралі.')); return; }
          removePlayer(entry.id, activeShift, { forceCaptain: true });
          const used = usedIdsForShift(activeShift);
          const keys = assignedNickKeysForShift(activeShift);
          if (!addHelperToSlot(plan.assignments[activeShift][tid], entry, used, keys)) { WKD.showNotice?.(tr('tower.playerNoRoom', 'Цей гравець не влазить у вільне місце ралі.')); return; }
          render();
          savePlan(false);
        }
        return;
      }
      const clear = event.target.closest('[data-tower-clear]');
      if (clear && canEditPlan()) { event.preventDefault(); plan.assignments[activeShift][clear.dataset.towerClear] = { captain: '', helpers: [], helperMarches: {} }; render(); savePlan(false); return; }
      const autofillOne = event.target.closest('[data-tower-autofill-one]');
      if (autofillOne && canEditPlan()) { event.preventDefault(); readFormValues(); autoFillTower(autofillOne.dataset.towerAutofillOne, activeShift); render(); savePlan(false); return; }
      const editPlayer = event.target.closest('[data-tower-edit-player]');
      if (editPlayer) {
        event.preventDefault();
        if (typeof WKD.openPlayerEditModal === 'function') WKD.openPlayerEditModal(editPlayer.dataset.towerEditPlayer, editPlayer);
        else WKD.showNotice?.(tr('tower.editorLoading', 'Редактор гравців ще не завантажився.'));
        return;
      }
      const remove = event.target.closest('[data-tower-remove-player]');
      if (remove && canEditPlan()) { event.preventDefault(); removePlayer(remove.dataset.towerRemovePlayer, activeShift, { forceCaptain: true }); render(); savePlan(false); return; }
      const reserve = event.target.closest('[data-status-reserve]');
      if (reserve && canEditPlan()) { event.preventDefault(); removePlayer(reserve.dataset.statusReserve, '', { forceCaptain: true }); render(); savePlan(false); return; }
      const place = event.target.closest('[data-status-auto-place]');
      if (place && canEditPlan()) { event.preventDefault(); autoPlacePlayer(place.dataset.statusAutoPlace, place.dataset.statusShift || activeShift); render(); savePlan(false); return; }
      const finalShift = event.target.closest('[data-final-shift]');
      if (finalShift) { event.preventDefault(); recordLocalPlannerAction('switch-final-shift'); activeFinalShift = finalShift.dataset.finalShift; renderFinals(); return; }
      if (event.target.closest('[data-final-lang],[data-final-lang-open]')) { event.preventDefault(); recordLocalPlannerAction('plan-language'); openFinalLangDialog(); return; }
      if (event.target.closest('[data-final-lang-close]')) { event.preventDefault(); closeFinalLangDialog(); return; }
      if (event.target.closest('[data-final-download]')) { event.preventDefault(); downloadFinalPng(); return; }
      if (event.target.closest('[data-final-txt]')) { event.preventDefault(); downloadFinalTxt(); return; }
      if (event.target.closest('[data-tower-publish]')) { event.preventDefault(); publishPlan(true); return; }
      if (event.target.closest('[data-tower-load-published]')) { event.preventDefault(); reloadPublishedPlan(); return; }
      if (event.target.closest('[data-final-share]')) { event.preventDefault(); shareFinalText(); return; }
      if (event.target.closest('[data-final-copy-link]')) { event.preventDefault(); copyFinalShareLink(); return; }
    });
    document.addEventListener('input', event => {
      if (event.target.matches('[data-tower-scope-search]')) { filterTowerSourceRegions(event.target.value); return; }
    });
    document.addEventListener('change', event => {
      if (event.target.matches('[data-final-lang-option]')) { updateFinalLangSelection(); return; }
      if (event.target.matches('[data-tower-helper-pick]')) {
        const tid = event.target.dataset.towerHelperPick || '';
        const entry = playerEntries().find(item => item.id === event.target.value);
        fillManualFieldsFromEntry(tid, entry);
        return;
      }
      if (!modal()?.contains(event.target) || !canEditPlan()) return;
      if (event.target.matches('[data-tower-tier-limit]')) {
        const tid = event.target.dataset.towerTierScope || activeTowerId;
        const slot = plan.assignments?.[activeShift]?.[tid];
        if (slot) { ensureSlotShape(slot); slot.tierLimits = readTowerTierLimits(tid); savePlan(false); }
      }
      else if (event.target.matches('[data-tier-limit]')) { const tier = event.target.dataset.tierLimit; if (tier) plan.settings.tierLimits[tier] = Math.max(0, Number(event.target.value) || 0); plan.settings.useTierLimits = true; render(); savePlan(false); }
      else if (event.target.matches('#towerFillMode,#towerOnlyCaptains,#towerMatchShift,#towerSameRole,#towerUseBoth,#towerUseTierLimits,#towerManualShiftEdit,#towerShiftLimit1,#towerShiftLimit2')) { readFormValues(); render(); savePlan(false); }
      if (event.target.matches('[data-tower-setting]')) { const key = event.target.dataset.towerSetting; if (key && Object.prototype.hasOwnProperty.call(plan.settings, key)) { plan.settings[key] = Boolean(event.target.checked); render(); savePlan(false); } }
      if (event.target.matches('[data-tower-captain]')) { const tid = event.target.dataset.towerCaptain; const id = event.target.value || ''; if (id) { removePlayer(id, activeShift, { forceCaptain: true }); setSlotCaptain(plan.assignments[activeShift][tid], id, { locked: true }); } render(); savePlan(false); }
    });
    $('#towerAutoDistributeBtn')?.addEventListener('click', event => { event.preventDefault(); if (canEditPlan()) autoDistribute({ topup: false }); });
    $('#towerAutoFillBtn')?.addEventListener('click', event => { event.preventDefault(); if (canEditPlan()) autoDistribute({ topup: true }); });
    $('#towerClearPlanBtn')?.addEventListener('click', async event => {
      event.preventDefault();
      if (!canEditPlan()) return;
      const ok = await (WKD.confirmDialog?.({ title: tr('tower.clearPlanTitle', 'Очистити розподіл?'), message: tr('tower.clearPlanMessage', 'Усі гравці будуть прибрані з турелей, але таблиця гравців залишиться.'), acceptText: tr('tower.clear', 'Очистити') }) ?? Promise.resolve(window.confirm(tr('tower.clearPlanTitle', 'Очистити розподіл?'))));
      if (!ok) return;
      recordLocalPlannerAction('clear-local-plan'); clearAll(); render(); savePlan();
    });
    $('#towerSavePlanBtn')?.addEventListener('click', event => { event.preventDefault(); if (canEditPlan()) savePlan(); });
    document.addEventListener('click', event => {
      if (event.target.closest('#towerApplyShiftAddBtn')) { event.preventDefault(); applyManualBothShiftAdds(); }
      if (event.target.closest('#towerRestoreImportShiftBtn')) { event.preventDefault(); restoreManualShiftBackup(); }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (document.getElementById('towerFinalLangDialog')?.classList.contains('is-open')) { event.preventDefault(); closeFinalLangDialog(); }
      else if (document.getElementById('towerSourceDialog')?.classList.contains('is-open')) { event.preventDefault(); closeTowerSourceDialog(); }
      else if (finalModal()?.classList.contains('is-open')) { event.preventDefault(); closeFinal(); }
      else if (modal()?.classList.contains('is-open')) { event.preventDefault(); closePlanner(); }
    });
    document.addEventListener('wkd:open-tower-planner', event => openPlanner(event.detail?.trigger || null, event.detail?.tab || 'setup'));
    document.addEventListener('wkd:open-final-plan', event => openFinal(event.detail?.trigger || null));
    document.addEventListener('wkd:player-edit-saved', () => {
      if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) {
        plan = normalizePlan(plan);
        render();
      }
    });
    document.addEventListener('wkd:tower-region-options-updated', () => {
      renderPlannerScopeTrigger();
      if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) renderFinals();
      if (document.getElementById('towerSourceDialog')?.classList.contains('is-open')) renderTowerSourceDialog();
    });
    document.addEventListener('wkd:tower-plan-hard-reset', event => {
      resetPlanToEmpty(event.detail?.source || 'hard-reset').catch(error => console.warn('[WKD] tower hard reset skipped:', error));
    });
    document.addEventListener('wkd:players-updated', event => {
      invalidatePlayerEntryCache();
      const source = event?.detail?.source || '';
      window.setTimeout(() => {
        disableTierLimitsForFreshData(source).catch(error => console.warn('tower tier limit reset skipped', error));
        if (modal()?.classList.contains('is-open') || finalModal()?.classList.contains('is-open')) {
          plan = normalizePlan(plan);
          const prunedRegionalPlan = sourceInfo().mode === 'region' ? prunePlanToCurrentPlayers() : false;
          if (prunedRegionalPlan && canEditPlan()) savePlan(false);
          render();
        }
      }, 30);
    });
  }
  function closeFinalPlan() { closeFinal(); }
  function openInitialRouteFromHash() {
    const hash = String(window.location.hash || '').toLowerCase();
    if (hash === '#final-plan' || hash === '#finalplan') {
      window.setTimeout(() => openFinal(null), 120);
    } else if (hash === '#tower-planner' || hash === '#towerplanner' || hash === '#towers') {
      window.setTimeout(() => openPlanner(null, 'setup'), 120);
    }
  }
  WKD.initTowerPlanner = () => {
    if (!ensureTowerPlannerBound()) return;
    openInitialRouteFromHash();
  };
  WKD.openTowerPlanner = openPlanner;
  WKD.openFinalPlanModal = openFinal;
  document.addEventListener('wkd:open-final-plan', event => window.setTimeout(() => openFinal(event.detail?.trigger || null), 0));
  document.addEventListener('wkd:open-tower-planner', event => window.setTimeout(() => openPlanner(event.detail?.trigger || null, 'setup'), 0));
  WKD.renderSharedFinalPlan = renderFinals;
  WKD.ensureTowerPlanLoaded = loadPlan;
  WKD.resetTowerPlannerPlan = resetPlanToEmpty;
  WKD.getTowerPlannerTowers = () => TOWERS.map(tower => ({ ...tower }));
  WKD.getPlayerTowerAssignment = publicAssignmentOf;
  WKD.assignPlayerToTowerFromEditor = assignPlayerFromEditor;
  WKD.publishTowerPlanDraft = publishPlan;
})();
