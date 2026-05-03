/* Final plan preview and board rendering helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const ModalsShift = PNS.ModalsShift = PNS.ModalsShift || {};
  const state = PNS.state = PNS.state || {};

  function escapeHtml(value) {
    return (PNS.escapeHtml || (v => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))))(String(value ?? ''));
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function roleNorm(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized.includes('fight')) return 'fighter';
    if (normalized.includes('rid')) return 'rider';
    if (normalized.includes('shoot') || normalized.includes('arch')) return 'shooter';
    return '';
  }

  function shiftLabel(shift) {
    const key = String(shift || '').toLowerCase();
    const n = Number(key.replace(/\D/g, '')) || 0;
    try {
      const label = typeof PNS.shiftLabel === 'function' ? String(PNS.shiftLabel(key) || '') : '';
      if (label && label !== key && !/^shift[1-4]$/i.test(label)) return label;
    } catch {}
    if (key === 'both') return tr('both', 'Всі');
    if (n >= 1 && n <= 4) return n === 1 ? tr('shift1', 'Зміна 1') : n === 2 ? tr('shift2', 'Зміна 2') : n === 3 ? tr('shift3', 'Зміна 3') : tr('shift4', 'Зміна 4');
    return String(shift || '');
  }

  function roleLabel(role, short = false) {
    try {
      return typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role, short) : String(role || '');
    } catch {
      return String(role || '');
    }
  }

  const REGION_SETTINGS_KEY = 'pns_import_region_shift_settings_v1';
  const ACTIVE_REGION_KEY = 'pns_tower_calc_active_region_v1';
  const REGION_KEYS = ['region1', 'region2', 'region3'];
  const SHIFT_KEYS = ['shift1', 'shift2', 'shift3', 'shift4'];
  const LOCAL_ALL_TIME_LABELS = { en: 'All time', uk: 'На весь час', ru: 'На весь час', de: 'Gesamte Zeit', pl: 'Na cały czas', vi: 'Toàn thời gian', zh: '全程', ja: '全時間', ko: '전체 시간', ar: 'طوال الوقت' };
  const LOCAL_REGION_CAPTURE_LABELS = {"en":{"import_region_1":"Home","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Capture region","capture_region_1":"Capture region 1","capture_region_2":"Capture region 2","shift3":"Shift 3","shift4":"Shift 4"},"uk":{"import_region_1":"Дім","import_region_2":"Регіон 1","import_region_3":"Регіон 2","capture_region":"Захоплення регіону","capture_region_1":"Захоплення регіону 1","capture_region_2":"Захоплення регіону 2","shift3":"Зміна 3","shift4":"Зміна 4"},"ru":{"import_region_1":"Дом","import_region_2":"Регион 1","import_region_3":"Регион 2","capture_region":"Захват региона","capture_region_1":"Захват региона 1","capture_region_2":"Захват региона 2","shift3":"Смена 3","shift4":"Смена 4"},"de":{"import_region_1":"Heimat","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Eroberung der Region","capture_region_1":"Eroberung Region 1","capture_region_2":"Eroberung Region 2","shift3":"Schicht 3","shift4":"Schicht 4"},"pl":{"import_region_1":"Dom","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Przejęcie regionu","capture_region_1":"Przejęcie regionu 1","capture_region_2":"Przejęcie regionu 2","shift3":"Zmiana 3","shift4":"Zmiana 4"},"vi":{"import_region_1":"Nhà","import_region_2":"Khu vực 1","import_region_3":"Khu vực 2","capture_region":"Chiếm khu vực","capture_region_1":"Chiếm khu vực 1","capture_region_2":"Chiếm khu vực 2","shift3":"Ca 3","shift4":"Ca 4"},"zh":{"import_region_1":"家园","import_region_2":"区域 1","import_region_3":"区域 2","capture_region":"占领区域","capture_region_1":"占领区域 1","capture_region_2":"占领区域 2","shift3":"班次 3","shift4":"班次 4"},"ja":{"import_region_1":"ホーム","import_region_2":"地域 1","import_region_3":"地域 2","capture_region":"地域の占領","capture_region_1":"地域1の占領","capture_region_2":"地域2の占領","shift3":"シフト3","shift4":"シフト4"},"ko":{"import_region_1":"홈","import_region_2":"지역 1","import_region_3":"지역 2","capture_region":"지역 점령","capture_region_1":"지역 1 점령","capture_region_2":"지역 2 점령","shift3":"교대 3","shift4":"교대 4"},"ar":{"import_region_1":"الوطن","import_region_2":"المنطقة 1","import_region_3":"المنطقة 2","capture_region":"احتلال المنطقة","capture_region_1":"احتلال المنطقة 1","capture_region_2":"احتلال المنطقة 2","shift3":"النوبة 3","shift4":"النوبة 4"}};

  function normalizeLocale(locale) {
    const value = String(locale || '').trim().toLowerCase();
    if (value === 'ua') return 'uk';
    return value || 'uk';
  }

  function getCurrentLocale() {
    try { return normalizeLocale(window.PNSI18N?.locale || window.PNS?.I18N?.locale || document.documentElement.dataset.locale || document.documentElement.lang || 'uk'); }
    catch { return 'uk'; }
  }

  function localLabel(key, fallback = '', locale = getCurrentLocale()) {
    const normalized = normalizeLocale(locale);
    const dict = LOCAL_REGION_CAPTURE_LABELS[normalized] || LOCAL_REGION_CAPTURE_LABELS[normalized.split('-')[0]] || LOCAL_REGION_CAPTURE_LABELS.uk || {};
    return String(dict[key] || fallback || key);
  }

  function wireHorizontalToolbar(toolbar) {
    if (!toolbar) return;
    if (window.matchMedia && !window.matchMedia('(max-width: 980px)').matches) return;
    if (toolbar.dataset.horizontalToolbarReady === 'true') return;
    toolbar.dataset.horizontalToolbarReady = 'true';
    toolbar.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (toolbar.scrollWidth <= toolbar.clientWidth) return;
      event.preventDefault();
      toolbar.scrollLeft += event.deltaY;
    }, { passive: false });
    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    toolbar.addEventListener('pointerdown', (event) => {
      if (event.target?.closest?.('button,a,select,input,textarea,label,summary,[role="button"]')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startLeft = toolbar.scrollLeft;
      try { toolbar.setPointerCapture(event.pointerId); } catch {}
    });
    toolbar.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      toolbar.scrollLeft = startLeft - (event.clientX - startX);
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      try { toolbar.releasePointerCapture(event.pointerId); } catch {}
    };
    toolbar.addEventListener('pointerup', stop);
    toolbar.addEventListener('pointercancel', stop);
  }


  function readRegionSettings() {
    const defaults = {
      activeRegion: 'region1',
      regions: {
        region1: { enabled: true, shifts: { '1': false, '2': true, '3': false, '4': false } },
        region2: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
        region3: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } }
      }
    };
    try {
      const raw = JSON.parse(localStorage.getItem(REGION_SETTINGS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (REGION_KEYS.includes(raw.activeRegion)) defaults.activeRegion = raw.activeRegion;
        REGION_KEYS.forEach(region => {
          const src = raw.regions && raw.regions[region] ? raw.regions[region] : null;
          if (!src) return;
          defaults.regions[region].enabled = region === 'region1' ? true : !!src.enabled;
          const selected = ['1','2','3','4'].find(n => src.shifts && src.shifts[n]) || '2';
          ['1','2','3','4'].forEach(n => { defaults.regions[region].shifts[n] = n === selected; });
        });
      }
    } catch {}
    defaults.regions.region1.enabled = true;
    return defaults;
  }

  function getEnabledRegions() {
    try {
      const fromPns = typeof PNS.getTowerCalcEnabledRegions === 'function' ? PNS.getTowerCalcEnabledRegions() : null;
      if (Array.isArray(fromPns) && fromPns.length) return fromPns.filter(region => REGION_KEYS.includes(region));
    } catch {}
    const settings = readRegionSettings();
    return REGION_KEYS.filter(region => region === 'region1' || !!settings.regions?.[region]?.enabled);
  }

  function getActiveRegion() {
    try {
      const fromPns = typeof PNS.getTowerCalcActiveRegion === 'function' ? PNS.getTowerCalcActiveRegion() : '';
      if (REGION_KEYS.includes(fromPns)) return fromPns;
    } catch {}
    const settings = readRegionSettings();
    const enabled = getEnabledRegions();
    let region = '';
    try { region = localStorage.getItem(ACTIVE_REGION_KEY) || ''; } catch {}
    if (!REGION_KEYS.includes(region)) region = settings.activeRegion || 'region1';
    if (!enabled.includes(region)) region = enabled[0] || 'region1';
    return region;
  }

  function setActiveRegion(region) {
    const enabled = getEnabledRegions();
    const next = enabled.includes(region) ? region : (enabled[0] || 'region1');
    try {
      if (typeof PNS.setTowerCalcActiveRegion === 'function') return PNS.setTowerCalcActiveRegion(next);
    } catch {}
    try {
      const settings = readRegionSettings();
      settings.activeRegion = next;
      localStorage.setItem(REGION_SETTINGS_KEY, JSON.stringify(settings));
      localStorage.setItem(ACTIVE_REGION_KEY, next);
    } catch {}
    return next;
  }

  function getRegionLabel(region) {
    const key = region === 'region2' ? 'import_region_2' : region === 'region3' ? 'import_region_3' : 'import_region_1';
    const fallback = localLabel(key);
    try {
      const translated = tr(key, fallback);
      return translated && translated !== key ? translated : fallback;
    } catch {
      return fallback;
    }
  }

  function getEnabledCaptureRegions() {
    return getEnabledRegions().filter(region => region === 'region2' || region === 'region3');
  }

  function getCaptureKey(region = getActiveRegion()) {
    if (region !== 'region2' && region !== 'region3') return '';
    const captures = getEnabledCaptureRegions();
    if (captures.length <= 1) return 'capture_region';
    return region === 'region2' ? 'capture_region_1' : 'capture_region_2';
  }

  function getCaptureFallback(region = getActiveRegion(), locale = 'uk') {
    const key = getCaptureKey(region);
    return key ? localLabel(key, '', locale) : '';
  }

  function getCaptureLabel(region = getActiveRegion()) {
    const key = getCaptureKey(region);
    if (!key) return '';
    const fallback = getCaptureFallback(region);
    try {
      const translated = tr(key, fallback);
      return translated && translated !== key ? translated : fallback;
    } catch {
      return fallback;
    }
  }

  function getCaptureTitle(region = getActiveRegion(), shift = 'shift1') {
    const key = getCaptureKey(region);
    if (!key) return '';
    const count = getRegionShiftCount(region);
    const normalized = normalizePreviewShift(shift);
    return mapBoardLanguageTextEnglishFirst(locale => {
      const capture = getBoardLanguageText(key, getCaptureFallback(region, locale), locale);
      if (count <= 1) {
        const allTime = getBoardLanguageText('all_time', LOCAL_ALL_TIME_LABELS[locale] || LOCAL_ALL_TIME_LABELS.uk, locale);
        return allTime ? `${capture} • ${allTime}` : capture;
      }
      const shiftText = getBoardLanguageText(normalized, shiftLabel(normalized), locale);
      return `${capture} • ${shiftText}`;
    });
  }

  function getPlanTitlePrefix(region = getActiveRegion(), shift = 'shift1') {
    const title = getCaptureTitle(region, shift);
    return title ? `${title} • ` : '';
  }

  function getRegionShiftCount(region = getActiveRegion()) {
    try {
      if (typeof PNS.getTowerCalcShiftCount === 'function') {
        const count = Number(PNS.getTowerCalcShiftCount(undefined, region));
        if (Number.isFinite(count)) return Math.max(1, Math.min(4, count));
      }
    } catch {}
    const settings = readRegionSettings();
    const shifts = settings.regions?.[region]?.shifts || {};
    const selected = ['1','2','3','4'].find(n => shifts[n]) || '2';
    return Math.max(1, Math.min(4, Number(selected) || 2));
  }

  function normalizePreviewShift(shift) {
    const value = String(shift || '').toLowerCase();
    return SHIFT_KEYS.includes(value) ? value : 'shift1';
  }

  function clampPreviewShift(shift, region = getActiveRegion()) {
    const count = getRegionShiftCount(region);
    let normalized = normalizePreviewShift(shift);
    if ((Number(normalized.replace('shift', '')) || 1) > count) normalized = `shift${count}`;
    return normalized;
  }

  function renderShiftTabs(kind, previewShift) {
    const count = getRegionShiftCount(getActiveRegion());
    if (count <= 1) return '';
    const attr = kind === 'calc' ? 'data-calc-preview-shift' : 'data-shift-tab';
    const active = clampPreviewShift(previewShift);
    return Array.from({ length: count }, (_, index) => {
      const shift = `shift${index + 1}`;
      return `<button class="btn btn-sm board-shift-tab ${shift === active ? 'active' : ''}" ${attr}="${escapeHtml(shift)}" type="button">${escapeHtml(shiftLabel(shift))}</button>`;
    }).join('');
  }

  function renderRegionPicker(kind) {
    const regions = getEnabledRegions();
    if (regions.length <= 1) return '';
    const active = getActiveRegion();
    const label = escapeHtml(getRegionLabel(active));
    const items = regions.map(region => `<button class="board-region-option ${region === active ? 'active' : ''}" data-final-plan-region-choice="${escapeHtml(region)}" data-final-plan-kind="${escapeHtml(kind)}" type="button">${escapeHtml(getRegionLabel(region))}</button>`).join('');
    return `<div class="board-region-picker" data-final-plan-region-picker="${escapeHtml(kind)}"><button class="btn btn-sm board-region-trigger" data-final-plan-region-trigger="${escapeHtml(kind)}" type="button" aria-haspopup="true" aria-expanded="false">${label} ▾</button><div class="board-region-menu" role="menu">${items}</div></div>`;
  }


  function closeFinalRegionMenus(root = document) {
    try {
      root.querySelectorAll('.board-region-picker.is-open').forEach((picker) => {
        picker.classList.remove('is-open');
        picker.querySelector('[data-final-plan-region-trigger]')?.setAttribute('aria-expanded', 'false');
      });
    } catch {}
  }

  function handleFinalRegionChange(nextRegion) {
    const region = setActiveRegion(nextRegion);
    const calc = getCalcState();
    calc.previewShift = clampPreviewShift(calc.previewShift || state.activeShift || 'shift1', region);
    persistCalcState(calc);
    try { window.PNS?.loadTowerCalcRegionPlans?.(region); } catch {}
    try { window.PNS?.renderRegionShiftUi?.(); } catch {}
    refreshOpenFinalPlans();
    return region;
  }

  function wireFinalPlanRegionPicker(root = document) {
    if (!root || root.__finalPlanRegionPickerWired) return;
    try { root.__finalPlanRegionPickerWired = true; } catch {}

    root.addEventListener('click', (event) => {
      const trigger = event.target.closest?.('[data-final-plan-region-trigger]');
      if (trigger && root.contains(trigger)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const picker = trigger.closest('.board-region-picker');
        const willOpen = !picker?.classList.contains('is-open');
        closeFinalRegionMenus(root);
        if (picker && willOpen) {
          picker.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        return false;
      }

      const choice = event.target.closest?.('[data-final-plan-region-choice]');
      if (choice && root.contains(choice)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const nextRegion = String(choice.getAttribute('data-final-plan-region-choice') || 'region1');
        closeFinalRegionMenus(root);
        handleFinalRegionChange(nextRegion);
        return false;
      }

      if (!event.target.closest?.('.board-region-picker')) closeFinalRegionMenus(root);
    }, true);
  }

  function refreshOpenFinalPlans() {
    try { renderLiveFinalBoard(document.getElementById('towerCalcModal')); } catch {}
    try { renderStandaloneFinalBoard(document.getElementById('board-modal')); } catch {}
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcState === 'function') return window.getCalcState();
    } catch {}
    state.towerCalc = state.towerCalc && typeof state.towerCalc === 'object' ? state.towerCalc : {};
    return state.towerCalc;
  }

  function persistCalcState(calcState) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(calcState));
    } catch {}
  }

  function getBoardLanguageText(key, fallback, locale) {
    try {
      return typeof window.getBoardLanguageText === 'function'
        ? window.getBoardLanguageText(key, fallback, locale)
        : String(fallback || '');
    } catch {
      return String(fallback || '');
    }
  }

  function mapBoardLanguageText(mapper) {
    try {
      return typeof window.mapBoardLanguageText === 'function' ? window.mapBoardLanguageText(mapper) : '';
    } catch {
      return '';
    }
  }

  function mapBoardLanguageTextEnglishFirst(mapper) {
    const locales = (() => {
      try {
        const list = typeof window.getBoardLanguageLocales === 'function' ? window.getBoardLanguageLocales() : ['en'];
        const normalized = Array.isArray(list)
          ? list.map(value => String(value || '').toLowerCase() === 'ua' ? 'uk' : String(value || '').toLowerCase()).filter(Boolean)
          : ['en'];
        return ['en', ...normalized.filter(locale => locale !== 'en')];
      } catch {
        return ['en'];
      }
    })();
    const seen = new Set();
    const values = [];
    locales.forEach(locale => {
      let value = '';
      try { value = mapper(locale); } catch { value = ''; }
      const text = String(value || '').trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      values.push(text);
    });
    return values.join(' ✦ ');
  }

  function getBoardLanguageTextMulti(key, fallback) {
    try {
      return typeof window.getBoardLanguageTextMulti === 'function'
        ? window.getBoardLanguageTextMulti(key, fallback)
        : String(fallback || '');
    } catch {
      return String(fallback || '');
    }
  }

  function renderBoardLanguagePickerMarkup(kind) {
    try {
      return typeof window.renderBoardLanguagePickerMarkup === 'function'
        ? window.renderBoardLanguagePickerMarkup(kind)
        : '';
    } catch {
      return '';
    }
  }

  function getBaseSlots() {
    const bases = [];
    try {
      (ModalsShift.getTowerCards?.() || []).forEach(card => {
        const baseId = String(card?.dataset?.baseId || card?.dataset?.baseid || '');
        if (baseId && !bases.includes(baseId)) bases.push(baseId);
      });
    } catch {}
    if (!bases.length) {
      for (const base of state.bases || []) {
        const baseId = String(base?.id || '');
        if (baseId && !bases.includes(baseId)) bases.push(baseId);
      }
    }
    return bases.slice(0, 5).map(baseId => state.baseById?.get?.(baseId) || { id: baseId, title: baseId });
  }

  function getShiftBaseAssignments(shift) {
    (function ensureShiftPlans() {
      try { state.shiftPlans = state.shiftPlans || {}; } catch {}
      try {
        const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null') || {};
        const activeRegion = localStorage.getItem('pns_tower_calc_active_region_v1') || settings.activeRegion || 'region1';
        const regionStore = JSON.parse(localStorage.getItem('pns_layout_region_shift_plans_store_v1') || '{}') || {};
        const flatStore = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}') || {};
        const source = regionStore?.[activeRegion] || flatStore || {};
        ['shift1','shift2','shift3','shift4'].forEach(key => {
          if (source[key]) state.shiftPlans[key] = JSON.parse(JSON.stringify(source[key]));
        });
      } catch {}
      return state.shiftPlans;
    })();
    const slots = getBaseSlots();
    const planBases = state.shiftPlans?.[shift]?.bases || {};
    return slots.map((base, index) => {
      const saved = planBases?.[base?.id] || {};
      const captainId = String(saved.captainId || '');
      const helperIds = Array.isArray(saved.helperIds) ? saved.helperIds : [];
      const role = saved.role || base?.role || null;
      return {
        index,
        baseId: String(base?.id || ''),
        title: String(base?.title || base?.id || `${tr('turret', 'Турель')} ${index + 1}`),
        captainId,
        helperIds: helperIds.slice ? helperIds.slice() : [],
        helperCount: Array.isArray(helperIds) ? helperIds.length : 0,
        role
      };
    });
  }

  function normalizeBoardPlayerName(player) {
    const raw = String(player?.name || '').trim();
    if (!raw) return '';
    try {
      return raw
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');
    } catch {
      return raw
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9а-яіїєґёё一-龯ぁ-ゖァ-ヺ가-힣]+/g, '');
    }
  }

  function dedupeBoardHelpers(baseLike, helpers, captain) {
    const unique = [];
    const seenIds = new Set();
    const seenNames = new Set();
    const captainNameKey = normalizeBoardPlayerName(captain);
    if (captainNameKey) seenNames.add(captainNameKey);
    for (const helper of Array.isArray(helpers) ? helpers : []) {
      if (!helper) continue;
      const helperId = String(helper.id || '');
      const nameKey = normalizeBoardPlayerName(helper);
      if (helperId && seenIds.has(helperId)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;
      if (helperId) seenIds.add(helperId);
      if (nameKey) seenNames.add(nameKey);
      unique.push(helper);
    }
    return unique;
  }

  function getBoardAssignedMarch(baseLike, player, shift) {
    if (!player) return 0;
    const playerMarch = Math.max(0, Number(player.march || 0) || 0);
    try {
      if (baseLike?.captainId && String(baseLike.captainId) === String(player.id)) return playerMarch;
    } catch {}
    try {
      const override = PNS.getTowerMarchOverride?.(baseLike?.id, player?.id, shift);
      if (Number.isFinite(override) && override >= 0) return Math.max(0, Number(override) || 0);
    } catch {}
    const tierCap = Math.max(0, Number(baseLike?.tierMinMarch?.[String(player.tier || '').toUpperCase()] || 0) || 0);
    return tierCap > 0 ? Math.min(playerMarch, tierCap) : playerMarch;
  }

  function resolveBoardTowerState(base, shift) {
    const linked = getShiftBaseAssignments(shift).find(item => String(item?.baseId || '') === String(base?.id || '')) || {
      baseId: String(base?.id || ''),
      title: String(base?.title || base?.id || ''),
      captainId: '',
      helperIds: [],
      role: base?.role || null
    };
    const savedRule = (typeof PNS.getBaseTowerRule === 'function' && PNS.getBaseTowerRule(String(base?.id || ''), { shift })) || {};
    const baseLike = {
      id: String(base?.id || ''),
      title: String(base?.title || base?.id || ''),
      captainId: String(linked?.captainId || ''),
      helperIds: Array.isArray(linked?.helperIds) ? linked.helperIds.slice() : [],
      role: linked?.role || base?.role || null,
      maxHelpers: Number(savedRule?.maxHelpers ?? base?.maxHelpers ?? 29) || 29,
      tierMinMarch: {
        T14: Number(savedRule?.tierMinMarch?.T14 ?? base?.tierMinMarch?.T14 ?? 0) || 0,
        T13: Number(savedRule?.tierMinMarch?.T13 ?? base?.tierMinMarch?.T13 ?? 0) || 0,
        T12: Number(savedRule?.tierMinMarch?.T12 ?? base?.tierMinMarch?.T12 ?? 0) || 0,
        T11: Number(savedRule?.tierMinMarch?.T11 ?? base?.tierMinMarch?.T11 ?? 0) || 0,
        T10: Number(savedRule?.tierMinMarch?.T10 ?? base?.tierMinMarch?.T10 ?? 0) || 0,
        T9: Number(savedRule?.tierMinMarch?.T9 ?? base?.tierMinMarch?.T9 ?? 0) || 0
      }
    };
    const captain = baseLike.captainId ? state.playerById?.get?.(baseLike.captainId) : null;
    const helperPool = (Array.isArray(baseLike.helperIds) ? baseLike.helperIds : []).map(id => state.playerById?.get?.(id)).filter(Boolean);
    const helpers = dedupeBoardHelpers(baseLike, helperPool, captain);
    const captainMarch = Math.max(0, Number(captain?.march || 0) || 0);
    const rallySize = Math.max(0, Number(captain?.rally || 0) || 0);
    const helpersTotal = helpers.reduce((sum, helper) => sum + getBoardAssignedMarch(baseLike, helper, shift), 0);
    const total = captainMarch + helpersTotal;
    const capacityTotal = captainMarch + rallySize;
    const free = Math.max(0, capacityTotal - total);
    return {
      captain,
      helpers,
      rule: { maxHelpers: baseLike.maxHelpers, tierMinMarch: { ...(baseLike.tierMinMarch || {}) } },
      captainMarch,
      rallySize,
      helpersTotal,
      total,
      capacityTotal,
      free,
      baseLike
    };
  }

  function renderBoardSheet(shift) {
    shiftLabel(shift);
    const colsHtml = getBaseSlots()
      .map(base => state.baseById?.get?.(String(base?.id || '')) || base)
      .filter(Boolean)
      .map((base, index) => {
        const boardState = resolveBoardTowerState(base, shift);
        const captain = boardState.captain;
        const helpers = boardState.helpers.slice().sort((left, right) =>
          Number(right.tierRank || 0) - Number(left.tierRank || 0)
          || Number(right.march || 0) - Number(left.march || 0)
          || String(left.name || '').localeCompare(String(right.name || ''))
        );
        const troopTheme = String(roleNorm(captain?.role) || '').toLowerCase();
        const subtitle = escapeHtml(captain
          ? mapBoardLanguageText(locale => {
              const normalizedRole = String(roleNorm(String(captain.role || '')) || '').toLowerCase();
              const key = normalizedRole === 'fighter'
                ? 'fighter_plural'
                : normalizedRole === 'rider'
                  ? 'rider_plural'
                  : normalizedRole === 'shooter'
                    ? 'shooter_plural'
                    : '';
              return key ? getBoardLanguageText(key, String(captain.role || ''), locale) : String(captain.role || '');
            })
          : getBoardLanguageTextMulti('type_defined_by_captain', tr('type_defined_by_captain', 'Тип визначається капітаном')));
        const modClass = captain ? ` ${troopTheme}-theme` : ' is-auto';
        const title = escapeHtml(mapBoardLanguageText(locale => {
          const raw = String(base.title || base.id || `${tr('turret', 'Турель')} ${index + 1}`);
          const lower = raw.toLowerCase();
          let key = '';
          if (/테크\s*허브|기술\s*허브|テックハブ|技术中心|trung\s*tâm\s*kỹ\s*thuật|trung\s*tam\s*ky\s*thuat|المركز\s*التقني|техно|hub|central|tech-zentrum|centrum tech|centrum techniczn/.test(lower)) key = 'hub';
          else if (/북쪽\s*포탑|北タレット|北炮塔|tháp\s*pháo\s*bắc|thap\s*phao\s*bac|північ|north|север|nord|północ|البرج\s*الشمالي/.test(lower)) key = 'north_turret';
          else if (/서쪽\s*포탑|西タレット|西炮塔|tháp\s*pháo\s*tây|thap\s*phao\s*tay|захід|west|запад|zachod|البرج\s*الغربي/.test(lower)) key = 'west_turret';
          else if (/동쪽\s*포탑|東タレット|东炮塔|tháp\s*pháo\s*đông|thap\s*phao\s*dong|схід|east|вост|ost|wschod|البرج\s*الشرقي/.test(lower)) key = 'east_turret';
          else if (/남쪽\s*포탑|南タレット|南炮塔|tháp\s*pháo\s*nam|thap\s*phao\s*nam|півден|south|юж|süd|sud|połud|البرج\s*الجنوبي/.test(lower)) key = 'south_turret';
          return key ? getBoardLanguageText(key, raw, locale) : raw;
        }));
        const rows = [];
        if (captain) {
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-captain-row', {
            name: escapeHtml(String(captain.name || '')),
            alliance: escapeHtml(String(captain.alliance || '')),
            tier: escapeHtml(String(captain.tier || '')),
            march: formatNumber(boardState.captainMarch)
          }));
        }
        helpers.forEach(helper => {
          const assignedMarch = getBoardAssignedMarch(boardState.baseLike, helper, shift);
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-helper-row', {
            name: escapeHtml(String(helper.name || '')),
            alliance: escapeHtml(String(helper.alliance || '')),
            tier: escapeHtml(String(helper.tier || '')),
            march: formatNumber(assignedMarch)
          }));
        });
        if (!rows.length) {
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-empty-row', {
            message: escapeHtml(getBoardLanguageTextMulti('no_assigned_players', tr('no_assigned_players', 'Немає призначених гравців')))
          }));
        }
        return PNS.renderHtmlTemplate('tpl-board-col', {
          mod_class: modClass,
          shift: escapeHtml(shift),
          base_id: escapeHtml(String(base.id || '')),
          title,
          auto_class: captain ? '' : ' is-auto',
          sub_text: captain ? subtitle : escapeHtml(getBoardLanguageTextMulti('type_defined_by_captain', tr('type_defined_by_captain', 'Тип визначається капітаном'))),
          cap_total: formatNumber(boardState.capacityTotal),
          cap_free: formatNumber(boardState.free),
          cap_used: formatNumber(boardState.total),
          rows_html: rows.join('')
        });
      })
      .join('');

    return PNS.renderHtmlTemplate('tpl-board-sheet', {
      title: escapeHtml((function renderSheetTitle(targetShift) {
        const normalized = normalizePreviewShift(targetShift);
        const region = getActiveRegion();
        const captureTitle = getCaptureTitle(region, normalized);
        if (captureTitle) return captureTitle;
        return mapBoardLanguageText(locale => {
          const shiftText = getBoardLanguageText(normalized, shiftLabel(normalized), locale);
          const showHalf = getRegionShiftCount(region) <= 2;
          const halfKey = showHalf && normalized === 'shift1' ? 'first_half' : showHalf && normalized === 'shift2' ? 'second_half' : '';
          const halfText = halfKey ? getBoardLanguageText(halfKey, '', locale) : '';
          return halfText ? `${shiftText} • ${halfText}` : shiftText;
        });
      })(shift)),
      cols_html: colsHtml
    });
  }

  function setCalcPreviewShift(shift) {
    const calcState = getCalcState();
    calcState.previewShift = clampPreviewShift(shift);
    persistCalcState(calcState);
    return calcState.previewShift;
  }

  function renderLiveFinalBoard(modal) {
    const root = modal || document.getElementById('towerCalcModal');
    const target = root?.querySelector?.('#towerCalcGlobalOut');
    if (!target) return;
    const calcState = getCalcState();
    const activeShift = window.PNS?.state?.activeShift;
    const previewShift = clampPreviewShift(calcState.previewShift || activeShift || 'shift1');
    if (calcState.previewShift !== previewShift) {
      calcState.previewShift = previewShift;
      persistCalcState(calcState);
    }
    target.innerHTML = window.renderHtmlTemplate('tpl-tower-calc-preview', {
      shift1_active: previewShift === 'shift1' ? 'active' : '',
      shift2_active: previewShift === 'shift2' ? 'active' : '',
      shift1_text: shiftLabel('shift1'),
      shift2_text: shiftLabel('shift2'),
      shift_tabs_html: renderShiftTabs('calc', previewShift),
      region_picker_html: renderRegionPicker('calc'),
      lang_picker_html: renderBoardLanguagePickerMarkup('calc'),
      export_png_text: tr('export_png', 'Завантажити PNG'),
      export_txt_text: tr('export_txt', 'TXT'),
      share_text: tr('final_plan_share', 'Поділитися'),
      status_text: tr('final_plan_status', 'Фінальний план'),
      shift_text: getCaptureTitle(getActiveRegion(), previewShift) || shiftLabel(previewShift),
      sheet_html: renderBoardSheet(previewShift)
    });
    try { target.querySelector('.tower-calc-preview-toolbar')?.scrollTo?.({ left: 0, top: 0 }); } catch {}
    try {
      const previewStatus = target.querySelector('#towerCalcPreviewStatus');
      if (previewStatus) {
        previewStatus.textContent = '';
        previewStatus.style.display = 'none';
      }
    } catch {}
    try { window.PNS?.wireBoardLanguageButtons?.(target); } catch {}
    try { wireFinalPlanRegionPicker(target); } catch {}
    try {
      target.querySelectorAll('[data-calc-preview-shift], [data-shift-tab]').forEach((button) => {
        button.onclick = function(ev) {
          try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
          const nextShift = String(button.getAttribute('data-calc-preview-shift') || button.getAttribute('data-shift-tab') || 'shift1');
          setCalcPreviewShift(nextShift);
          renderLiveFinalBoard(root);
          try { renderStandaloneFinalBoard(document.getElementById('board-modal')); } catch {}
          return false;
        };
      });
      const exportBtn = target.querySelector('[data-calc-preview-export]');
      if (exportBtn) exportBtn.onclick = function(ev) { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {} return !!window.exportBoardAsPNG?.({ sheet: target.querySelector('#towerCalcBoardPreviewSheet .board-sheet') || target.querySelector('#towerCalcBoardPreviewSheet'), shift: getCalcState()?.previewShift || previewShift, statusEl: target.querySelector('#towerCalcPreviewStatus') }); };
      const txtBtn = target.querySelector('[data-calc-preview-export-txt]');
      if (txtBtn) txtBtn.onclick = function(ev) { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {} return !!window.exportBoardAsTXT?.(); };
      const shareBtn = target.querySelector('[data-calc-preview-share]');
      if (shareBtn) shareBtn.onclick = async function(ev) {
        try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
        try {
          if (typeof window.calcSharePreviewBoard === 'function') return !!(await window.calcSharePreviewBoard());
          return !!(await window.shareBoardAsImage?.({
            sheet: target.querySelector('#towerCalcBoardPreviewSheet .board-sheet') || target.querySelector('#towerCalcBoardPreviewSheet'),
            shift: getCalcState()?.previewShift || previewShift,
            statusEl: target.querySelector('#towerCalcPreviewStatus')
          }));
        } catch (err) {
          try { console.error(err); } catch {}
          return false;
        }
      };
    } catch {}
  }

  function renderStandaloneFinalBoard(modal) {
    const root = modal || document.getElementById('board-modal');
    if (!root) return false;
    const toolbar = root.querySelector('.tower-calc-preview-toolbar');
    const status = root.querySelector('#boardPreviewStatus');
    const sheet = root.querySelector('#boardModalPreviewSheet');
    if (!toolbar || !status || !sheet) return false;

    const calcState = getCalcState();
    const previewShift = clampPreviewShift(calcState.previewShift || state.activeShift || 'shift1');
    calcState.previewShift = previewShift;
    persistCalcState(calcState);

    toolbar.innerHTML = window.renderHtmlTemplate('tpl-board-modal-toolbar', {
      shift1_active: previewShift === 'shift1' ? 'active' : '',
      shift2_active: previewShift === 'shift2' ? 'active' : '',
      shift1_text: shiftLabel('shift1'),
      shift2_text: shiftLabel('shift2'),
      shift_tabs_html: renderShiftTabs('board', previewShift),
      region_picker_html: renderRegionPicker('board'),
      lang_picker_html: renderBoardLanguagePickerMarkup('board'),
      board_language_text: escapeHtml(tr('board_language', 'Мова плану')),
      export_png_text: escapeHtml(tr('export_png', 'Завантажити PNG')),
      export_txt_text: escapeHtml(tr('export_txt', 'TXT')),
      share_text: escapeHtml(tr('final_plan_share', 'Поділитися'))
    });
    try { toolbar.classList.remove('board-head-actions--single'); } catch {}
    try { toolbar.scrollLeft = 0; } catch {}
    try { requestAnimationFrame(() => { toolbar.scrollLeft = 0; }); } catch {}
    try { wireHorizontalToolbar(toolbar); } catch {}
    try { wireFinalPlanRegionPicker(root); } catch {}
    status.textContent = '';
    try { status.style.display = 'none'; } catch {}
    sheet.innerHTML = renderBoardSheet(previewShift);
    try { sheet.scrollTop = 0; sheet.scrollLeft = 0; } catch {}

    try { window.PNS?.wireBoardLanguageButtons?.(toolbar); } catch {}
    try {
      toolbar.querySelectorAll('[data-calc-preview-shift], [data-shift-tab]').forEach((button) => {
        button.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          const nextShift = String(
            button.getAttribute('data-calc-preview-shift')
            || button.getAttribute('data-shift-tab')
            || 'shift1'
          );
          try { setCalcPreviewShift(nextShift); } catch {}
          try { renderStandaloneFinalBoard(root); } catch {}
          return false;
        };
      });
      toolbar.querySelectorAll('[data-final-plan-region-choice]').forEach((button) => {
        button.onclick = function(ev) {
          try { ev.preventDefault(); ev.stopPropagation(); } catch {}
          const nextRegion = String(button.getAttribute('data-final-plan-region-choice') || 'region1');
          setActiveRegion(nextRegion);
          const calc = getCalcState();
          calc.previewShift = clampPreviewShift(calc.previewShift || previewShift, nextRegion);
          persistCalcState(calc);
          try { renderStandaloneFinalBoard(root); } catch {}
          try { renderLiveFinalBoard(document.getElementById('towerCalcModal')); } catch {}
          return false;
        };
      });
      const exportBtn = toolbar.querySelector('[data-preview-export-png], #exportPngBtn');
      if (exportBtn) {
        exportBtn.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          try { ev.stopImmediatePropagation?.(); } catch {}
          return !!window.exportBoardAsPNG?.({
            sheet: sheet.querySelector('.board-sheet') || sheet,
            shift: getCalcState()?.previewShift || previewShift,
            statusEl: status
          });
        };
      }
      const txtBtn = toolbar.querySelector('[data-preview-export-txt], #exportBoardTxtBtn');
      if (txtBtn) {
        txtBtn.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          try { ev.stopImmediatePropagation?.(); } catch {}
          return !!window.exportBoardAsTXT?.();
        };
      }
      const shareBtn = toolbar.querySelector('[data-preview-share-board], #shareBoardBtn');
      if (shareBtn) {
        shareBtn.onclick = async function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          try { ev.stopImmediatePropagation?.(); } catch {}
          return await (window.shareBoardAsImage?.({
            sheet: sheet.querySelector('.board-sheet') || sheet,
            shift: getCalcState()?.previewShift || previewShift,
            statusEl: status
          }) || false);
        };
      }

      const mobileMenu = toolbar.querySelector('[data-board-mobile-menu]');
      const mobileMenuTrigger = toolbar.querySelector('[data-board-mobile-menu-trigger]');
      const mobileMenuPanel = toolbar.querySelector('[data-board-mobile-menu-panel]');
      if (mobileMenu && mobileMenuTrigger) {
        mobileMenuTrigger.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          const willOpen = !mobileMenu.classList.contains('is-open');
          mobileMenu.classList.toggle('is-open', willOpen);
          mobileMenuTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return false;
        };
      }
      if (mobileMenuPanel) {
        mobileMenuPanel.querySelectorAll('button').forEach((button) => {
          button.addEventListener('click', () => {
            mobileMenu?.classList.remove('is-open');
            mobileMenuTrigger?.setAttribute('aria-expanded', 'false');
          });
        });
      }
    } catch {}
    return true;
  }

  try { wireFinalPlanRegionPicker(document); } catch {}

  Object.assign(PNS, {
    getBaseSlots,
    getShiftBaseAssignments,
    getBoardAssignedMarch,
    resolveBoardTowerState,
    renderBoardSheet,
    setCalcPreviewShift,
    renderLiveFinalBoard,
    renderStandaloneFinalBoard
  });

  if (typeof window.shareBoardPreview !== 'function') {
    window.shareBoardPreview = async function() {
      if (typeof window.calcSharePreviewBoard === 'function') return await window.calcSharePreviewBoard();
      const root = document.getElementById('towerCalcModal') || document;
      return await (window.shareBoardAsImage?.({
        sheet: root.querySelector('#towerCalcBoardPreviewSheet .board-sheet') || root.querySelector('#towerCalcBoardPreviewSheet'),
        shift: getCalcState()?.previewShift || state.activeShift || 'shift1',
        statusEl: root.querySelector('#towerCalcPreviewStatus')
      }) || false);
    };
  }

  Object.assign(window, {
    __pnsGetBaseSlots: getBaseSlots,
    __pnsGetShiftBaseAssignments: getShiftBaseAssignments,
    __pnsGetBoardAssignedMarch: getBoardAssignedMarch,
    __pnsResolveBoardTowerState: resolveBoardTowerState,
    __pnsRenderBoardSheet: renderBoardSheet,
    __pnsSetCalcPreviewShift: setCalcPreviewShift,
    __pnsRenderLiveFinalBoard: renderLiveFinalBoard,
    __pnsRenderStandaloneFinalBoard: renderStandaloneFinalBoard
  });
})();
