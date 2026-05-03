/* Import wizard: region and shift capture controls */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const KEY = 'pns_import_region_shift_settings_v1';
  const REGIONS = ['region1','region2','region3'];
  const SHIFT_COUNTS = ['1','2','3','4'];
  const fallback = {
    activeRegion: 'region1',
    regions: {
      region1: { enabled: true, shifts: { '1': false, '2': true, '3': false, '4': false } },
      region2: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
      region3: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
    },
  };
  const t = (key, text) => (typeof PNS.t === 'function' ? PNS.t(key, text) : text);

  const LOCAL_IMPORT_REGION_TEXTS = {"en":{"import_region_enabled_text":"Enabled","import_region_disabled_text":"Disabled"},"uk":{"import_region_enabled_text":"Включено","import_region_disabled_text":"Виключено"},"ru":{"import_region_enabled_text":"Включено","import_region_disabled_text":"Выключено"},"de":{"import_region_enabled_text":"Aktiviert","import_region_disabled_text":"Deaktiviert"},"pl":{"import_region_enabled_text":"Włączone","import_region_disabled_text":"Wyłączone"},"vi":{"import_region_enabled_text":"Đã bật","import_region_disabled_text":"Đã tắt"},"zh":{"import_region_enabled_text":"已启用","import_region_disabled_text":"已禁用"},"ja":{"import_region_enabled_text":"有効","import_region_disabled_text":"無効"},"ko":{"import_region_enabled_text":"켜짐","import_region_disabled_text":"꺼짐"},"ar":{"import_region_enabled_text":"مفعّل","import_region_disabled_text":"معطّل"}};

  function importRegionLocale() {
    try {
      const value = String(window.PNSI18N?.locale || window.PNS?.I18N?.locale || document.documentElement.dataset.locale || document.documentElement.lang || 'uk').trim().toLowerCase();
      return value === 'ua' ? 'uk' : (value || 'uk');
    } catch {
      return 'uk';
    }
  }

  function importRegionText(key, fallback) {
    const locale = importRegionLocale();
    const dict = LOCAL_IMPORT_REGION_TEXTS[locale] || LOCAL_IMPORT_REGION_TEXTS[locale.split('-')[0]] || LOCAL_IMPORT_REGION_TEXTS.uk || {};
    try {
      const translated = t(key, dict[key] || fallback);
      return translated && translated !== key ? translated : (dict[key] || fallback);
    } catch {
      return dict[key] || fallback;
    }
  }


  function cloneDefault(){
    return JSON.parse(JSON.stringify(fallback));
  }

  function normalizeState(raw){
    const state = cloneDefault();
    if (raw && typeof raw === 'object') {
      if (REGIONS.includes(raw.activeRegion)) state.activeRegion = raw.activeRegion;
      REGIONS.forEach((region) => {
        const source = raw.regions && raw.regions[region] ? raw.regions[region] : {};
        state.regions[region].enabled = region === 'region1' ? true : !!source.enabled;
        const selectedShift = ['4','3','2','1'].find((count) => !!(source.shifts && source.shifts[count])) || '2';
        SHIFT_COUNTS.forEach((count) => {
          state.regions[region].shifts[count] = count === selectedShift;
        });
      });
    }
    state.regions.region1.enabled = true;
    return state;
  }

  function loadState(){
    try {
      return normalizeState(JSON.parse(localStorage.getItem(KEY) || 'null'));
    } catch {
      return cloneDefault();
    }
  }

  function saveState(state){
    const next = normalizeState(state);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    PNS.importRegionShiftSettings = next;
    return next;
  }

  function notifyRegionShiftChanged(region){
    try {
      window.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region } }));
    } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region } })); } catch {}
  }

  function getCard(root){
    return (root || document).querySelector?.('#importRegionsCard') || null;
  }

  function setActiveRegion(region){
    const state = loadState();
    if (REGIONS.includes(region)) state.activeRegion = region;
    saveState(state);
    render();
    notifyRegionShiftChanged(region);
  }

  function setRegionEnabled(region, enabled){
    if (region === 'region1' || !REGIONS.includes(region)) return;
    const state = loadState();
    state.regions[region].enabled = !!enabled;
    if (!state.regions[region].enabled && state.activeRegion === region) {
      state.activeRegion = 'region1';
    } else if (state.regions[region].enabled) {
      state.activeRegion = region;
    }
    saveState(state);
    render();
    notifyRegionShiftChanged(region);
  }

  function setShift(region, count, checked){
    const nextCount = String(count);
    if (!REGIONS.includes(region) || !SHIFT_COUNTS.includes(nextCount)) return;
    const state = loadState();
    const selectedShift = checked ? nextCount : (['4','3','2','1'].find((item) => state.regions[region].shifts[item]) || '2');
    SHIFT_COUNTS.forEach((item) => {
      state.regions[region].shifts[item] = item === selectedShift;
    });
    saveState(state);
    if (region === 'region1') {
      try { localStorage.setItem('pns_import_region1_shift_manual_override_v1', '1'); } catch {}
    }
    render();
    notifyRegionShiftChanged(region);
  }

  function render(root){
    const card = getCard(root);
    if (!card) return;
    const state = saveState(loadState());

    card.querySelectorAll('[data-import-region-tab]').forEach((tab) => {
      const region = tab.getAttribute('data-import-region-tab');
      const active = region === state.activeRegion;
      const enabled = region === 'region1' || !!state.regions[region]?.enabled;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.classList.toggle('is-disabled', !enabled);
    });

    card.querySelectorAll('[data-import-region-panel]').forEach((panel) => {
      const region = panel.getAttribute('data-import-region-panel');
      const active = region === state.activeRegion;
      const enabled = region === 'region1' || !!state.regions[region]?.enabled;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
      panel.classList.toggle('is-disabled', !enabled);

      panel.querySelectorAll('[data-import-region-shifts]').forEach((input) => {
        const count = input.getAttribute('data-import-region-shifts');
        input.checked = !!state.regions[region]?.shifts?.[count];
        input.disabled = !enabled;
      });

      const toggle = panel.querySelector('input[data-import-region-enable]');
      if (toggle) {
        toggle.checked = !!enabled;
        toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
      }

      const wrap = panel.querySelector('.import-region-enable-wrap');
      if (wrap) {
        wrap.classList.toggle('is-enabled', !!enabled);
        wrap.classList.toggle('is-disabled', !enabled);
      }

      const status = panel.querySelector('[data-import-region-enable-status]');
      if (status) {
        const isEnabled = !!enabled;
        try {
          status.textContent = isEnabled ? importRegionText('import_region_enabled_text', 'Включено') : importRegionText('import_region_disabled_text', 'Виключено');
        } catch {
          status.textContent = isEnabled ? 'Enabled' : 'Disabled';
        }
        status.classList.toggle('is-enabled', isEnabled);
        status.classList.toggle('is-disabled', !isEnabled);
        status.setAttribute('data-state', isEnabled ? 'enabled' : 'disabled');
      }
    });
  }

  function bind(root){
    const card = getCard(root);
    if (!card || card.dataset.regionShiftBound === '1') {
      render(root);
      return;
    }
    card.dataset.regionShiftBound = '1';

    card.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-import-region-tab]');
      if (tab && card.contains(tab)) {
        event.preventDefault();
        setActiveRegion(tab.getAttribute('data-import-region-tab'));
      }
    });

    card.addEventListener('change', (event) => {
      const regionToggle = event.target.closest('input[data-import-region-enable]');
      if (regionToggle && card.contains(regionToggle)) {
        setRegionEnabled(regionToggle.getAttribute('data-import-region-enable'), regionToggle.checked);
        return;
      }
      const input = event.target.closest('[data-import-region-shifts]');
      if (!input || !card.contains(input)) return;
      setShift(
        input.getAttribute('data-import-region'),
        input.getAttribute('data-import-region-shifts'),
        input.checked,
      );
    });

    render(root);
  }

  function init(){
    bind(document);
  }

  PNS.getImportRegionShiftSettings = function(){
    return loadState();
  };
  PNS.setImportRegionShiftSettings = function(next){
    saveState(next);
    render();
  };
  PNS.initImportRegionShiftControls = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pns:i18n-changed', init);
})();
