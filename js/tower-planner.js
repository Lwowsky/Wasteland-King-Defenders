window.WKD = window.WKD || {};

(function () {
  const LOCAL_KEY = 'wkd.clean.tower.plan.v1';
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
  const tr = (key, fallback = '') => {
    const fb = fallback || key;
    if (!window.WKD_t) return fb;
    const value = window.WKD_t(key);
    return (!value || value === key) ? fb : value;
  };

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

  plan = normalizePlan(null);

  function emptyAssignments() {
    return Object.fromEntries(SHIFT_ORDER.map(shift => [shift, Object.fromEntries(TOWERS.map(tower => [tower.id, { captain: '', helpers: [], helperMarches: {} }]))]));
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
        assignments[shift][tower.id] = {
          captain: clean(item.captain || item.captainId || ''),
          helpers,
          helperMarches,
          tierLimits: towerTierLimits
        };
      });
    });
    return {
      ...base,
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
  function playerId(player = {}, index = 0) {
    if (!player._rowId) player._rowId = String(player.id || player.uid || `local-${index + 1}`);
    return String(player._rowId);
  }
  function playerEntries() { return players().map((player, index) => ({ player, id: playerId(player, index), index })); }
  function playerById(id) { return playerEntries().find(entry => entry.id === String(id || ''))?.player || null; }
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
  function normalizeShift(value) {
    const text = clean(value).toLowerCase();
    if (/4/.test(text)) return 'shift4';
    if (/3/.test(text)) return 'shift3';
    if (/2/.test(text)) return 'shift2';
    if (/1/.test(text)) return 'shift1';
    return 'both';
  }
  function shiftLabel(shift) {
    return ({ shift1: 'Зміна 1', shift2: 'Зміна 2', shift3: 'Зміна 3', shift4: 'Зміна 4', both: 'Обидві' })[shift] || 'Зміна';
  }
  function normalizeTowerId(value) {
    const id = clean(value || '').toLowerCase();
    return TOWERS.some(tower => tower.id === id) ? id : '';
  }
  function roleKey(role = '') {
    const text = clean(role).toLowerCase();
    if (/fighter|бійц|боєц|боец|воїн|воин/.test(text)) return 'Fighter';
    if (/rider|наїз|наезд/.test(text)) return 'Rider';
    return 'Shooter';
  }
  function roleLabel(role = '') {
    const key = roleKey(role);
    return key === 'Fighter' ? 'Бійці' : key === 'Rider' ? 'Наїзники' : 'Стрільці';
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
    if (captain) return roleKey(captain.role);
    const firstHelper = (slot?.helpers || []).map(id => playerById(id)).find(Boolean);
    return firstHelper ? roleKey(firstHelper.role) : 'Shooter';
  }
  function roleSelectOptions(selected = 'Shooter') {
    const current = roleKey(selected);
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
    return WKD.getPlayersSourceInfo?.() || { mode: 'local', label: 'локального списку', canUpdate: true, region: '' };
  }
  function canEditPlan() {
    const info = sourceInfo();
    return info.mode !== 'region' || Boolean(info.canPlan ?? info.canUpdate);
  }
  function localLoadPlan() { return normalizePlan(WKD.loadJson ? WKD.loadJson(LOCAL_KEY, null) : JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null')); }
  function localSavePlan(nextPlan) { WKD.saveJson ? WKD.saveJson(LOCAL_KEY, nextPlan) : localStorage.setItem(LOCAL_KEY, JSON.stringify(nextPlan)); }
  async function loadPlan() {
    if (loading) return plan;
    loading = true;
    try {
      const info = sourceInfo();
      if (info.mode === 'region' && typeof WKD.loadTowerPlanFromActiveSource === 'function') {
        const loaded = await WKD.loadTowerPlanFromActiveSource();
        plan = normalizePlan(loaded?.plan || loaded || null);
        prunePlanToCurrentPlayers();
      } else {
        plan = localLoadPlan();
      }
    } catch (error) {
      console.error(error);
      plan = localLoadPlan();
      WKD.showNotice?.('Не вдалося завантажити план регіону. Показую локальний план.');
    } finally {
      loading = false;
    }
    return plan;
  }
  async function savePlan(show = true) {
    plan.updatedAtMs = Date.now();
    const info = sourceInfo();
    if (info.mode === 'region' && typeof WKD.saveTowerPlanToActiveSource === 'function') {
      if (!canEditPlan()) {
        WKD.showNotice?.('Для регіону редагувати план можуть консул або офіцер свого регіону.');
        return false;
      }
      await WKD.saveTowerPlanToActiveSource(plan);
      if (show) WKD.showNotice?.(`План збережено в таблиці ${info.label || 'регіону'}.`);
      return true;
    }
    localSavePlan(plan);
    if (show) WKD.showNotice?.('Локальний план збережено в цьому браузері.');
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
      const text = info.mode === 'region' ? 'Регіональний' : signedIn ? 'Локальний' : '';
      badge.textContent = text;
      badge.hidden = !text;
      badge.classList.toggle('is-region', info.mode === 'region');
      badge.classList.toggle('is-local', Boolean(text) && info.mode !== 'region');
    }

    renderPlannerScopeTrigger();

    const note = $('#towerPlannerAccessNote');
    if (note) {
      note.textContent = '';
      note.hidden = true;
      note.classList.toggle('is-locked', !editable);
    }
  }
  function renderTierLimits() {
    const host = $('#towerTierLimits');
    if (!host) return;
    host.classList.toggle('is-disabled-by-auto', !plan.settings.useTierLimits);
    host.innerHTML = Object.keys(TIER_DEFAULTS).map(tier => `<label><span>${tier}</span><input data-edit-only data-tier-limit="${tier}" type="number" min="0" step="1000" value="${Number(plan.settings.tierLimits?.[tier] || 0)}"></label>`).join('');
  }
  function countRoles(list) {
    const res = { Fighter: 0, Rider: 0, Shooter: 0 };
    list.forEach(({ player }) => { res[roleKey(player.role)] += 1; });
    return res;
  }
  function entriesForShift(shift, includeBoth = true) {
    return playerEntries().filter(({ player }) => {
      const s = normalizeShift(player.shift || player.shiftLabel);
      return s === shift || (includeBoth && s === 'both');
    });
  }
  function roleIcon(role) {
    const key = roleKey(role).toLowerCase();
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
      <div class="tower-shift-balance-title"><strong>Обидві зміни і ліміти гравців в альянсі</strong><span>${both.length} гравців</span></div>
      <label class="tower-check tower-manual-toggle"><input id="towerManualShiftEdit" type="checkbox" ${plan.settings.manualShiftEdit ? 'checked' : ''} ${disabled}><span>Редагувати ліміти вручну</span></label>
      <div class="tower-shift-balance-grid tower-shift-limits-grid">
        <label class="tower-limit-row"><span>Ліміт<br>зміни 1</span><input id="towerShiftLimit1" type="number" min="0" max="100" value="${Number(plan.settings.shiftLimits?.shift1 ?? 100)}" ${manualDisabled}></label>
        <label class="tower-limit-row"><span>Ліміт<br>зміни 2</span><input id="towerShiftLimit2" type="number" min="0" max="100" value="${Number(plan.settings.shiftLimits?.shift2 ?? 100)}" ${manualDisabled}></label>
        <label class="tower-limit-row"><span>Додати в<br>зміну 1</span><input id="towerShiftAdd1" type="number" min="0" max="${both.length}" value="0" ${disabled}></label>
        <label class="tower-limit-row"><span>Додати в<br>зміну 2</span><input id="towerShiftAdd2" type="number" min="0" max="${both.length}" value="0" ${disabled}></label>
      </div>
      <div class="tower-shift-balance-actions"><button class="btn" type="button" id="towerApplyShiftAddBtn" ${disabled}>Застосувати</button><button class="btn" type="button" id="towerRestoreImportShiftBtn" ${disabled}>Відновити з імпорту</button></div>
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
    host.innerHTML = [
      renderSetupCard('Зміна 1', shift1.length, `У турелях ${[...used1].filter(id => shift1.some(e => e.id === id)).length} · Резерв ${Math.max(0, shift1.length - [...used1].filter(id => shift1.some(e => e.id === id)).length)}`, countRoles(shift1)),
      renderSetupCard('Зміна 2', shift2.length, `У турелях ${[...used2].filter(id => shift2.some(e => e.id === id)).length} · Резерв ${Math.max(0, shift2.length - [...used2].filter(id => shift2.some(e => e.id === id)).length)}`, countRoles(shift2)),
      renderSetupCard('Обидві зміни', both.length, 'окремо від основного плану', countRoles(both)),
      renderSetupCard('Усього', all.length, `У турелях ${usedAll.size} · Резерв ${Math.max(0, all.length - usedAll.size)}`, countRoles(all))
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
  async function assignPlayerFromEditor(id, options = {}) {
    const playerId = String(id || '');
    if (!playerId) return false;
    await loadPlan();
    if (!canEditPlan()) throw new Error('region-plan-access-denied');
    const shift = SHIFT_ORDER.includes(normalizeShift(options.shift)) ? normalizeShift(options.shift) : 'shift1';
    const towerId = normalizeTowerId(options.towerId || options.tower || options.placement);
    const placementRole = options.role === 'captain' ? 'captain' : 'helper';
    removePlayer(playerId);

    if (towerId) {
      const slot = ensureSlotShape(plan.assignments[shift][towerId] || { captain: '', helpers: [], helperMarches: {} });
      slot.helpers = (slot.helpers || []).filter(helperId => helperId !== playerId);
      if (slot.helperMarches) delete slot.helperMarches[playerId];
      if (placementRole === 'captain') {
        if (slot.captain && slot.captain !== playerId && !slot.helpers.includes(slot.captain)) slot.helpers.unshift(slot.captain);
        slot.captain = playerId;
        ensureSlotShape(slot);
      } else {
        if (slot.captain === playerId) slot.captain = '';
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
  function removePlayer(id, onlyShift = '') {
    const shifts = onlyShift ? [onlyShift] : SHIFT_ORDER;
    shifts.forEach(shift => TOWERS.forEach(tower => {
      const slot = plan.assignments[shift][tower.id];
      if (slot.captain === id) slot.captain = '';
      slot.helpers = (slot.helpers || []).filter(helperId => helperId !== id);
      if (slot.helperMarches) delete slot.helperMarches[id];
    }));
  }
  function optionPlayers({ shift, towerId, selected = '', captainOnly = false, excludeUsed = false, ignoreRole = false }) {
    const used = usedIdsForShift(shift);
    const slot = plan.assignments[shift]?.[towerId] || { captain: '', helpers: [], helperMarches: {} };
    const captain = playerById(slot.captain);
    const captainRole = roleKey(captain?.role || '');
    let list = playerEntries().filter(({ player, id }) => {
      if (excludeUsed && used.has(id) && id !== selected) return false;
      if (captainOnly && plan.settings.onlyCaptains && !player.captain) return false;
      if (plan.settings.matchShift) {
        const s = normalizeShift(player.shift || player.shiftLabel);
        const allowBothForCaptain = captainOnly && s === 'both';
        if (s !== shift && !(plan.settings.useBoth && s === 'both') && !allowBothForCaptain) return false;
      }
      if (!captainOnly && !ignoreRole && plan.settings.sameRole && captain && roleKey(player.role) !== captainRole) return false;
      return true;
    });
    list = list.sort((a, b) => Number(b.player.captain) - Number(a.player.captain) || Number(b.player.rally || 0) - Number(a.player.rally || 0) || Number(b.player.march || 0) - Number(a.player.march || 0));
    return `<option value="">—</option>` + list.map(({ player, id }) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(player.name)} · ${esc(player.alliance || '—')} · ${esc(roleLabel(player.role))} ${esc(player.tier || '')}</option>`).join('');
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
      <aside class="tower-picker-list" aria-label="Список турелей">
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
        <b>${esc(tower.uk)}</b>
        <small class="tower-picker-captain">${captain ? esc(captain.name) : 'Без капітана'}</small>
        <em class="${countClass}">гравців: ${count}</em>
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
        <div class="tower-card-title"><img class="tower-icon" src="${esc(tower.icon)}" alt=""><div><h3>${esc(tower.uk)}</h3></div></div>
        <span class="tower-role-pill">${captain ? roleLabel(captain.role) : 'Без капітана'}</span>
      </div>
      <div class="tower-picker-flags tower-picker-flags--single-row">
        <label><input data-tower-setting="onlyCaptains" type="checkbox" ${plan.settings.onlyCaptains ? 'checked' : ''} ${disabledAttr}><span>Тільки капітани</span></label>
        <label><input data-tower-setting="matchShift" type="checkbox" ${plan.settings.matchShift ? 'checked' : ''} ${disabledAttr}><span>Зміна гравця</span></label>
        <label><input data-tower-setting="sameRole" type="checkbox" ${plan.settings.sameRole ? 'checked' : ''} ${disabledAttr}><span>Той самий тип</span></label>
        <label><input data-tower-setting="useBoth" type="checkbox" ${plan.settings.useBoth ? 'checked' : ''} ${disabledAttr}><span>Обидві</span></label>
      </div>
      <div class="tower-picker-topline tower-picker-topline--captain">
        <label class="tower-field"><span>Капітан</span><select ${editableAttr} data-tower-captain-pick="${esc(tower.id)}">${optionPlayers({ shift: activeShift, towerId: tower.id, selected: slot.captain, captainOnly: true, excludeUsed: false })}</select></label>
        <button class="btn" ${editableAttr} type="button" data-tower-set-captain="${esc(tower.id)}">Поставити капітана</button>
        <button class="btn" ${editableAttr} type="button" data-tower-autofill-one="${esc(tower.id)}">Автозаповнення</button>
        <button class="btn" ${editableAttr} type="button" data-tower-clear="${esc(tower.id)}">Очистити турель</button>
      </div>
      <div class="tower-picker-metrics">
        <div><span>Марш капітана</span><strong>${fmt(captainMarch)}</strong></div>
        <div><span>Розмір ралі</span><strong>${fmt(rally)}</strong></div>
        <div><span>Разом</span><strong>${fmt(total)}</strong></div>
        <div><span>Вільне місце</span><strong>${fmt(free)}</strong></div>
      </div>
      <details class="tower-collapsible tower-inline-section tower-tier-editor" id="towerPickerLimitsBlock-${esc(tower.id)}">
        <summary>Налаштування турелі · ліміти по тірах (марш)</summary>
        <div class="tower-collapsible-inner">
          <div class="tower-tier-toolbar">
            <label class="tower-field tower-max-players-field"><span>Макс. гравців</span><input data-edit-only type="number" min="1" max="${MAX_HELPERS_PER_TOWER}" value="${MAX_HELPERS_PER_TOWER}" disabled></label>
            <button class="btn" ${editableAttr} type="button" data-tower-save-tier="${esc(tower.id)}">Зберегти ліміти</button>
            <button class="btn" ${editableAttr} type="button" data-tower-recalc-tier="${esc(tower.id)}">Перерахувати склад</button>
            <button class="btn" ${editableAttr} type="button" data-tower-reset-tier="${esc(tower.id)}">Скинути ліміти</button>
          </div>
          <div class="tower-tier-grid tower-tier-grid-compact">${Object.keys(TIER_DEFAULTS).map(tier => `<label><span>${tier}</span><input data-edit-only data-tower-tier-limit="${tier}" data-tower-tier-scope="${esc(tower.id)}" type="number" min="0" step="1000" value="${Number(slot.tierLimits?.[tier] || 0)}"></label>`).join('')}</div>
          <p class="tower-help-text">0 = не рухати цей тір. Вкажи число тільки для тіру, який хочеш перерахувати в цій турелі.</p>
        </div>
      </details>
      <details class="tower-collapsible tower-inline-section tower-manual-add-section" id="towerPickerManualBlock-${esc(tower.id)}">
        <summary>Додати гравця вручну</summary>
        <div class="tower-collapsible-inner">
        ${allianceDatalist(`towerAllianceOptions-${tower.id}`)}
        <div class="tower-manual-grid tower-manual-grid--top">
          <label class="tower-field"><span>Пошук гравця (зі списку)</span><select ${editableAttr} data-tower-helper-pick="${esc(tower.id)}">${optionPlayers({ shift: activeShift, towerId: tower.id, selected: '', captainOnly: false, excludeUsed: false, ignoreRole: true })}</select></label>
          <label class="tower-field"><span>Нік (можна свій, не зі списку)</span><input ${editableAttr} data-manual-name="${esc(tower.id)}" type="text" placeholder="Нік гравця"></label>
          <label class="tower-field"><span>Альянс</span><input ${editableAttr} list="towerAllianceOptions-${esc(tower.id)}" data-manual-alliance="${esc(tower.id)}" type="text" placeholder="Вибери або введи новий"></label>
          <label class="tower-field"><span>Тип військ</span><select ${editableAttr} data-manual-role="${esc(tower.id)}">${roleSelectOptions(towerManualRole(tower.id))}</select></label>
        </div>
        <div class="tower-manual-grid tower-manual-grid--bottom">
          <label class="tower-field"><span>Тір</span><select ${editableAttr} data-manual-tier="${esc(tower.id)}">${tierSelectOptions(visibleTierOptions()[0] || 'T14')}</select></label>
          <label class="tower-field"><span>Марш</span><input ${editableAttr} data-manual-march="${esc(tower.id)}" type="number" min="0" step="1000" placeholder="Марш"></label>
          <label class="tower-field"><span>Розмір ралі</span><input ${editableAttr} data-manual-rally="${esc(tower.id)}" type="number" min="0" step="1000" placeholder="Ралі"></label>
          <button class="btn" ${editableAttr} type="button" data-tower-add-manual-captain="${esc(tower.id)}">Поставити капітана</button>
          <button class="btn" ${editableAttr} type="button" data-tower-add-helper="${esc(tower.id)}">Додати гравця вручну</button>
        </div>
        </div>
      </details>
      <div class="tower-assignment-table">
        <div class="tower-assignment-table-title">Гравці в турелі <small>Капітан і гравці</small></div>
        <div class="tower-assignment-table-head"><span>Гравець</span><span>Альянс</span><span>Роль</span><span>Тір</span><span>Марш</span><span>✎</span></div>
        <div class="tower-assignment-table-body">
          ${ids.length ? `${slot.captain ? assignmentRow(slot.captain, captain, 'Капітан', slot) : ''}${helpers.map(item => assignmentRow(item.id, item.player, 'Помічник', slot)).join('')}` : '<div class="tower-empty-note">Немає призначених гравців</div>'}
        </div>
      </div>
    </div>`;
  }
  function assignmentRow(id, player, kind, slot = null) {
    if (!player) return '';
    const shownMarch = kind === 'Капітан' ? Number(player.march || 0) : helperAssignedMarch(id, slot, player);
    return `<div class="tower-assignment-row ${kind === 'Капітан' ? 'is-captain' : ''}">
      <span><b>${esc(player.name)}</b><small>${esc(kind)}</small></span>
      <span>${esc(player.alliance || '—')}</span>
      <span>${esc(roleLabel(player.role))}</span>
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
      role: roleKey(entry.player.role),
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
      WKD.showNotice?.('Для таблиці регіону нового гравця спочатку додай через форму/таблицю регіону, а потім вибери його зі списку.');
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
    if (!slot) return { ok: false, reason: 'Турель не знайдено.' };
    ensureSlotShape(slot);
    const captain = playerById(slot.captain);
    if (!captain) return { ok: false, reason: 'Спочатку постав капітана.' };
    const helpers = (slot.helpers || []).map(id => ({ id, player: playerById(id) })).filter(item => item.id && item.player);
    if (!helpers.length) return { ok: false, reason: 'У турелі ще немає помічників.' };
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
      return { ok: true, changed: false, reason: 'Усі ліміти 0 — склад не змінено.' };
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
    head.innerHTML = `<div class="tower-summary-card"><b>${inTower}</b><span>У турелях</span><small>Зараз реально стоять у турелях</small></div><div class="tower-summary-card"><b>${Math.max(0, players().length - inTower)}</b><span>Поза турелями</span><small>Не стоять у жодній турелі</small></div><div class="tower-summary-card"><b>${players().length}</b><span>Усього</span><small>Загальна кількість гравців</small></div>`;
    const filterItems = ['all', 'in', 'reserve', ...shifts, 'both'].filter((value, index, arr) => arr.indexOf(value) === index).map(filter => `<button class="btn btn-sm ${filter === statusFilter ? 'is-active' : ''}" type="button" data-status-filter="${filter}">${filter === 'all' ? 'Усі' : filter === 'in' ? 'У турелях' : filter === 'reserve' ? 'Поза турелями' : shiftLabel(filter)}</button>`).join('');
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
      return `<tr><td><b>${esc(player.name)}</b></td><td>${esc(player.alliance || '—')}</td><td>${esc(roleLabel(player.role))} / ${esc(player.tier || '—')}</td><td>${fmt(player.march)}</td><td>${assigned ? '<span class="tower-status-pill is-in">У турелі</span>' : '<span class="tower-status-pill is-reserve">Поза туреллю</span>'}</td><td>${assigned ? `${esc(assigned.tower.uk)} · ${shiftLabel(assigned.shift)} · ${assigned.kind}` : '—'}</td><td>${statusActions(id, shift, Boolean(assigned))}</td></tr>`;
    }).join('') : '<tr><td colspan="7">Гравців не знайдено.</td></tr>';
  }
  function statusActions(id, shift, assigned) {
    if (!canEditPlan()) return 'Перегляд';
    if (assigned) return `<button class="btn btn-sm" data-edit-only type="button" data-status-reserve="${esc(id)}">В резерв</button>`;
    const buttons = availableShifts().slice(0, 4).map(s => `<button class="btn btn-sm" data-edit-only type="button" data-status-auto-place="${esc(id)}" data-status-shift="${s}">${shiftLabel(s)}</button>`).join(' ');
    return buttons || `<button class="btn btn-sm" data-edit-only type="button" data-status-auto-place="${esc(id)}" data-status-shift="${shift}">Поставити</button>`;
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
  function finalSourceButton() {
    if (!signedInForTowerSource()) return '';
    return `<button class="btn btn-sm tower-source-trigger-inline ${activeTowerSourceOption().mode === 'region' ? 'is-region' : ''}" type="button" data-tower-scope-open>${esc(towerSourceLabel())}</button>`;
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
      await loadPlan();
      const prunedRegionalPlan = sourceInfo().mode === 'region' ? prunePlanToCurrentPlayers() : false;
      if (prunedRegionalPlan && canEditPlan()) await savePlan(false);
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
    const shifts = availableShifts();
    if (!shifts.includes(activeFinalShift)) activeFinalShift = shifts[0] || 'shift1';
    const buttons = shifts.map(shift => `<button class="btn btn-sm ${shift === activeFinalShift ? 'is-active' : ''}" type="button" data-final-shift="${shift}">${shiftLabel(shift)}</button>`).join('');
    root.innerHTML = `${buttons}
      ${finalSourceButton()}
      <button class="btn btn-sm tower-final-lang-trigger board-lang-trigger" type="button" data-final-lang-open>Мова плану</button>
      <button class="btn btn-sm" type="button" data-final-download>Завантажити PNG</button>
      <button class="btn btn-sm" type="button" data-final-txt>TXT</button>
      <button class="btn btn-sm" type="button" data-final-share>Поділитися</button>
      <button class="btn btn-sm" type="button" data-final-copy-link>${window.WKD_t?.('finalPlan.copyLink') || 'Копіювати посилання'}</button>`;
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
    if (!slot) return { captain: '', helpers: [], helperMarches: {} };
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
    const role = captain ? roleKey(captain.role) : '';
    const theme = captain ? (role === 'Fighter' ? 'fighter-theme' : role === 'Rider' ? 'rider-theme' : 'shooter-theme') : 'is-auto';
    const captainMarch = tierAssignedMarch(captain, true);
    const rallySize = Math.max(0, Number(captain?.rally || 0) || 0);
    const helperTotal = helperItems.reduce((sum, item) => sum + helperAssignedMarch(item.id, slot, item.player), 0);
    const usedMarch = captainMarch + helperTotal;
    const capacityTotal = captain ? captainMarch + rallySize : 0;
    const freeMarch = Math.max(0, capacityTotal - usedMarch);
    const title = towerTitle(tower);
    const subtitle = captain ? finalRoleText(captain.role) : combinedText(lang => finalPhrase('typeByCaptain', lang));
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
    root.innerHTML = `<button class="tower-final-lang-backdrop" type="button" data-final-lang-close aria-label="Закрити"></button><div class="tower-final-lang-card" role="dialog" aria-modal="true" aria-label="Мова плану"><div class="tower-final-lang-head"><div><h3>Мова плану</h3><p>Познач мови, які треба показувати у фінальному плані.</p></div><button class="btn btn-icon" type="button" data-final-lang-close>✕</button></div><div class="tower-final-lang-grid">${languages().map(lang => `<label class="tower-final-lang-option ${selected.has(lang.id) ? 'is-active' : ''}"><input type="checkbox" data-final-lang-option="${esc(lang.id)}" ${selected.has(lang.id) ? 'checked' : ''} ${lang.id === 'en' ? 'disabled' : ''}><img src="${esc(lang.icon)}" alt=""><span>${esc(lang.name)}</span></label>`).join('')}</div><div class="tower-final-lang-actions"><button class="btn" type="button" data-final-lang-close>Готово</button></div></div>`;
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
      WKD.showNotice?.('Не вдалося завантажити бібліотеку для PNG. Перевір інтернет і спробуй ще раз.');
      return;
    }
    if (typeof window.html2canvas !== 'function') {
      WKD.showNotice?.('Не вдалося завантажити PNG: бібліотека html2canvas ще не завантажилась. Онови сторінку і спробуй ще раз.');
      return;
    }
    sheet.classList.add('is-exporting-png');
    try {
      const blob = await renderSheetToPngBlob(sheet, { scale: 5 });
      downloadBlob(`wasteland-final-plan-${activeFinalShift}-${Date.now()}.png`, blob);
    } catch (error) {
      console.error(error);
      WKD.showNotice?.('Не вдалося створити PNG фінального плану.');
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
      plan.assignments[shift][tower.id] = { captain: clean(slot.captain || ''), helpers: [], helperMarches: {}, tierLimits: { ...(slot.tierLimits || {}) } };
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
    if (captainPlayer && plan.settings.sameRole && roleKey(entry.player.role) !== roleKey(captainPlayer.role)) return false;
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
    const entry = playerEntries().find(item => item.id === String(id || ''));
    if (!entry) return false;
    const backup = loadShiftBackup();
    if (remember && !Object.prototype.hasOwnProperty.call(backup, entry.id)) {
      backup[entry.id] = normalizeShift(entry.player.shift || entry.player.shiftLabel);
      saveShiftBackup(backup);
    }
    if (typeof WKD.updatePlayerInActiveSource === 'function') {
      await WKD.updatePlayerInActiveSource(entry.id, { shift });
    } else {
      entry.player.shift = shift;
      entry.player.shiftLabel = shiftLabel(shift);
      WKD.saveJson?.(WKD.storageKeys.players, players());
      WKD.renderPlayers?.();
      document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'tower-shift-local', persist: true } }));
    }
    removePlayer(entry.id);
    return true;
  }
  async function applyManualBothShiftAdds() {
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
    await loadPlan();
    render();
    await savePlan(false);
    WKD.showNotice?.(`Обидві: додано у зміну 1 — ${toShift1.length}, у зміну 2 — ${toShift2.length}.`);
  }
  async function restoreManualShiftBackup() {
    if (!canEditPlan()) return;
    const backup = loadShiftBackup();
    const ids = Object.keys(backup);
    if (!ids.length) { WKD.showNotice?.('Немає збереженого ручного розподілу для відновлення.'); return; }
    for (const id of ids) {
      const shift = backup[id];
      if (['shift1','shift2','shift3','shift4','both'].includes(shift)) await updatePlayerShift(id, shift, false);
    }
    saveShiftBackup({});
    await loadPlan();
    render();
    await savePlan(false);
    WKD.showNotice?.('Зміни гравців відновлено з імпортованого стану.');
  }
  function autoDistribute({ topup = false } = {}) {
    readFormValues();
    const shifts = availableShifts();
    if (!topup) shifts.forEach(clearShiftHelpersKeepCaptains);
    shifts.forEach(shift => autoDistributeShift(shift));
    render();
    savePlan(false);
    WKD.showNotice?.(topup ? 'Турелі дозаповнено.' : 'Перерозподіл застосовано. Капітани, поставлені вручну, залишились у своїх турелях.');
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
          slot.captain = captain.id;
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
        slot.captain = captain.id;
        used.add(captain.id);
        const key = nickKey(captain.player);
        if (key) assignedNickKeys.add(key);
      }
    }
    shrinkSlotHelperMarchesToMinimum(slot);
    fillSlotToCapacity(slot, entries, shift, used, assignedNickKeys);
  }
  function autoPlacePlayer(id, shift) {
    removePlayer(id);
    if (!plan.assignments[shift]) return;
    const entry = playerEntries().find(item => item.id === String(id));
    for (const tower of TOWERS) {
      const slot = plan.assignments[shift][tower.id];
      if (!slot.captain && entry?.player?.captain) { slot.captain = id; return; }
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
    if (!ensureTowerPlannerBound()) { WKD.showNotice?.('Розподіл по турелях ще завантажується. Спробуй ще раз.'); return; }
    const root = modal();
    if (!root) return;
    lastTrigger = trigger || document.activeElement;
    activeTab = tab;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
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
    if (!ensureTowerPlannerBound()) { WKD.showNotice?.('Фінальний план ще завантажується. Спробуй ще раз.'); return; }
    const root = finalModal();
    if (!root) return;
    lastTrigger = trigger || document.activeElement;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
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
    const troopText = captain ? txtRoleText(captain.role) : combinedText(lang => finalPhrase('typeByCaptain', lang));
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
    WKD.showNotice?.('TXT фінального плану завантажено.');
  }
  async function copyFinalText() {
    const text = currentTxt({ allShifts: true });
    try { await navigator.clipboard.writeText(text); WKD.showNotice?.('Фінальний план скопійовано в TXT.'); }
    catch { window.prompt('Скопіюй TXT:', text); }
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
      WKD.showNotice?.(window.WKD_t?.('finalPlan.linkCopied') || 'Секретне посилання скопійовано.');
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(window.WKD_t?.('finalPlan.shareLinkFailed') || 'Не вдалося створити секретне посилання.');
    }
  }
  async function shareFinalText() {
    let data;
    try {
      data = await makeFinalShareData();
    } catch (error) {
      console.error(error);
      WKD.showNotice?.(window.WKD_t?.('finalPlan.shareLinkFailed') || 'Не вдалося створити секретне посилання.');
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
        title: window.WKD_t?.('finalPlan.shareLinkReadyTitle') || 'Посилання готове',
        message: window.WKD_t?.('finalPlan.shareLinkReadyMessage') || 'Секретне посилання на фінальний план скопійовано. Його можуть відкрити гравці без входу.',
        href: shareUrl,
        acceptText: window.WKD_t?.('finalPlan.openSharedPlan') || 'Відкрити план',
        cancelText: window.WKD_t?.('common.continue') || 'Продовжити'
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      WKD.showNotice?.(window.WKD_t?.('finalPlan.txtCopied') || 'Фінальний план скопійовано в TXT.');
    } catch {
      window.prompt('Скопіюй TXT:', text);
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
        removePlayer(id, activeShift);
        plan.assignments[activeShift][tid].captain = id;
        ensureSlotShape(plan.assignments[activeShift][tid]);
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
        removePlayer(entry.id, activeShift);
        plan.assignments[activeShift][tid].captain = entry.id;
        ensureSlotShape(plan.assignments[activeShift][tid]);
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
        WKD.showNotice?.(result.reason || 'Склад цієї турелі перераховано.');
        return;
      }
      const addHelper = event.target.closest('[data-tower-add-helper]');
      if (addHelper && canEditPlan()) {
        event.preventDefault();
        const tid = addHelper.dataset.towerAddHelper;
        const slot = plan.assignments[activeShift]?.[tid];
        const entry = manualEntryOrSelected(tid);
        if (entry?.id && slot) {
          if (helpersLimitReached(slot)) { WKD.showNotice?.('У турелі вже 29 помічників. Більше не влазить.'); return; }
          if (slot.captain && towerRoom(slot) <= 0) { WKD.showNotice?.('У цій турелі вже немає вільного місця ралі.'); return; }
          removePlayer(entry.id, activeShift);
          const used = usedIdsForShift(activeShift);
          const keys = assignedNickKeysForShift(activeShift);
          if (!addHelperToSlot(plan.assignments[activeShift][tid], entry, used, keys)) { WKD.showNotice?.('Цей гравець не влазить у вільне місце ралі.'); return; }
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
        else WKD.showNotice?.('Редактор гравців ще не завантажився.');
        return;
      }
      const remove = event.target.closest('[data-tower-remove-player]');
      if (remove && canEditPlan()) { event.preventDefault(); removePlayer(remove.dataset.towerRemovePlayer, activeShift); render(); savePlan(false); return; }
      const reserve = event.target.closest('[data-status-reserve]');
      if (reserve && canEditPlan()) { event.preventDefault(); removePlayer(reserve.dataset.statusReserve); render(); savePlan(false); return; }
      const place = event.target.closest('[data-status-auto-place]');
      if (place && canEditPlan()) { event.preventDefault(); autoPlacePlayer(place.dataset.statusAutoPlace, place.dataset.statusShift || activeShift); render(); savePlan(false); return; }
      const finalShift = event.target.closest('[data-final-shift]');
      if (finalShift) { event.preventDefault(); activeFinalShift = finalShift.dataset.finalShift; renderFinals(); return; }
      if (event.target.closest('[data-final-lang],[data-final-lang-open]')) { event.preventDefault(); openFinalLangDialog(); return; }
      if (event.target.closest('[data-final-lang-close]')) { event.preventDefault(); closeFinalLangDialog(); return; }
      if (event.target.closest('[data-final-download]')) { event.preventDefault(); downloadFinalPng(); return; }
      if (event.target.closest('[data-final-txt]')) { event.preventDefault(); downloadFinalTxt(); return; }
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
      if (event.target.matches('[data-tower-captain]')) { const tid = event.target.dataset.towerCaptain; const id = event.target.value || ''; if (id) removePlayer(id, activeShift); plan.assignments[activeShift][tid].captain = id; render(); savePlan(false); }
    });
    $('#towerAutoDistributeBtn')?.addEventListener('click', event => { event.preventDefault(); if (canEditPlan()) autoDistribute({ topup: false }); });
    $('#towerAutoFillBtn')?.addEventListener('click', event => { event.preventDefault(); if (canEditPlan()) autoDistribute({ topup: true }); });
    $('#towerClearPlanBtn')?.addEventListener('click', async event => {
      event.preventDefault();
      if (!canEditPlan()) return;
      const ok = await (WKD.confirmDialog?.({ title: 'Очистити розподіл?', message: 'Усі гравці будуть прибрані з турелей, але таблиця гравців залишиться.', acceptText: 'Очистити' }) ?? Promise.resolve(window.confirm('Очистити розподіл?')));
      if (!ok) return;
      clearAll(); render(); savePlan();
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
})();
