/* Clean region/shift integration. Replaces previous hotfix layers. */
(function(){
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const SETTINGS_KEY = 'pns_import_region_shift_settings_v1';
  const ACTIVE_REGION_KEY = 'pns_tower_calc_active_region_v1';
  const REGION_PLANS_KEY = 'pns_layout_region_shift_plans_store_v1';
  const CALC_KEY = 'pns_tower_calc_state';
  const REGIONS = ['region1', 'region2', 'region3'];
  const SHIFTS = ['shift1', 'shift2', 'shift3', 'shift4'];

  const LOCAL_REGION_LABELS = {"en":{"import_region_1":"Home","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Capture region","capture_region_1":"Capture region 1","capture_region_2":"Capture region 2","shift3":"Shift 3","shift4":"Shift 4"},"uk":{"import_region_1":"Дім","import_region_2":"Регіон 1","import_region_3":"Регіон 2","capture_region":"Захоплення регіону","capture_region_1":"Захоплення регіону 1","capture_region_2":"Захоплення регіону 2","shift3":"Зміна 3","shift4":"Зміна 4"},"ru":{"import_region_1":"Дом","import_region_2":"Регион 1","import_region_3":"Регион 2","capture_region":"Захват региона","capture_region_1":"Захват региона 1","capture_region_2":"Захват региона 2","shift3":"Смена 3","shift4":"Смена 4"},"de":{"import_region_1":"Heimat","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Eroberung der Region","capture_region_1":"Eroberung Region 1","capture_region_2":"Eroberung Region 2","shift3":"Schicht 3","shift4":"Schicht 4"},"pl":{"import_region_1":"Dom","import_region_2":"Region 1","import_region_3":"Region 2","capture_region":"Przejęcie regionu","capture_region_1":"Przejęcie regionu 1","capture_region_2":"Przejęcie regionu 2","shift3":"Zmiana 3","shift4":"Zmiana 4"},"vi":{"import_region_1":"Nhà","import_region_2":"Khu vực 1","import_region_3":"Khu vực 2","capture_region":"Chiếm khu vực","capture_region_1":"Chiếm khu vực 1","capture_region_2":"Chiếm khu vực 2","shift3":"Ca 3","shift4":"Ca 4"},"zh":{"import_region_1":"家园","import_region_2":"区域 1","import_region_3":"区域 2","capture_region":"占领区域","capture_region_1":"占领区域 1","capture_region_2":"占领区域 2","shift3":"班次 3","shift4":"班次 4"},"ja":{"import_region_1":"ホーム","import_region_2":"地域 1","import_region_3":"地域 2","capture_region":"地域の占領","capture_region_1":"地域1の占領","capture_region_2":"地域2の占領","shift3":"シフト3","shift4":"シフト4"},"ko":{"import_region_1":"홈","import_region_2":"지역 1","import_region_3":"지역 2","capture_region":"지역 점령","capture_region_1":"지역 1 점령","capture_region_2":"지역 2 점령","shift3":"교대 3","shift4":"교대 4"},"ar":{"import_region_1":"الوطن","import_region_2":"المنطقة 1","import_region_3":"المنطقة 2","capture_region":"احتلال المنطقة","capture_region_1":"احتلال المنطقة 1","capture_region_2":"احتلال المنطقة 2","shift3":"النوبة 3","shift4":"النوبة 4"}};

  function normalizeLocale(locale) {
    const value = String(locale || '').trim().toLowerCase();
    if (value === 'ua') return 'uk';
    return value || 'uk';
  }

  function getCurrentLocale() {
    try { return normalizeLocale(window.PNSI18N?.locale || PNS.I18N?.locale || document.documentElement.dataset.locale || document.documentElement.lang || 'uk'); }
    catch { return 'uk'; }
  }

  function localLabel(key, fallback = '', locale = getCurrentLocale()) {
    const normalized = normalizeLocale(locale);
    const dict = LOCAL_REGION_LABELS[normalized] || LOCAL_REGION_LABELS[normalized.split('-')[0]] || LOCAL_REGION_LABELS.uk || {};
    return String(dict[key] || fallback || key);
  }


  function t(key, fallback){
    try { return typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback; } catch { return fallback; }
  }

  function defaultSettings(){
    return {
      activeRegion: 'region1',
      regions: {
        region1: { enabled: true, shifts: { '1': false, '2': true, '3': false, '4': false } },
        region2: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
        region3: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } }
      }
    };
  }

  function readSettings(){
    const out = defaultSettings();
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (REGIONS.includes(raw.activeRegion)) out.activeRegion = raw.activeRegion;
        REGIONS.forEach(region => {
          const src = raw.regions && raw.regions[region] ? raw.regions[region] : null;
          if (!src) return;
          out.regions[region].enabled = region === 'region1' ? true : !!src.enabled;
          const selected = ['1', '2', '3', '4'].find(n => src.shifts && src.shifts[n]) || '2';
          ['1', '2', '3', '4'].forEach(n => { out.regions[region].shifts[n] = n === selected; });
        });
      }
    } catch {}
    out.regions.region1.enabled = true;
    return out;
  }

  function saveSettings(settings){
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    PNS.importRegionShiftSettings = settings;
  }

  function enabledRegions(settings = readSettings()){
    return REGIONS.filter(region => region === 'region1' || !!settings.regions?.[region]?.enabled);
  }

  function activeRegion(settings = readSettings()){
    const enabled = enabledRegions(settings);
    let value = '';
    try { value = localStorage.getItem(ACTIVE_REGION_KEY) || ''; } catch {}
    if (!REGIONS.includes(value)) value = settings.activeRegion || 'region1';
    if (!enabled.includes(value)) value = enabled[0] || 'region1';
    return value;
  }

  function setActiveRegion(region){
    const previous = activeRegion();
    if (REGIONS.includes(previous)) {
      try { saveRegionShiftPlans(previous); } catch {}
    }
    const settings = readSettings();
    const enabled = enabledRegions(settings);
    const next = enabled.includes(region) ? region : (enabled[0] || 'region1');
    settings.activeRegion = next;
    saveSettings(settings);
    try { localStorage.setItem(ACTIVE_REGION_KEY, next); } catch {}
    if (next !== previous) {
      try { loadRegionShiftPlans(next); } catch {}
    }
    return next;
  }

  function shiftCount(settings = readSettings(), region = activeRegion(settings)){
    const shifts = settings.regions?.[region]?.shifts || {};
    const selected = ['1', '2', '3', '4'].find(n => shifts[n]) || '2';
    return Math.max(1, Math.min(4, Number(selected) || 2));
  }

  function regionLabel(region){
    const key = region === 'region2' ? 'import_region_2' : region === 'region3' ? 'import_region_3' : 'import_region_1';
    const fallback = localLabel(key);
    try {
      const translated = t(key, fallback);
      return translated && translated !== key ? translated : fallback;
    } catch {
      return fallback;
    }
  }

  function shiftLabel(shift){
    const n = Number(String(shift || '').replace(/\D/g, '')) || 1;
    if (n === 1) return t('shift1', 'Зміна 1');
    if (n === 2) return t('shift2', 'Зміна 2');
    if (n === 3) return t('shift3', 'Зміна 3');
    if (n === 4) return t('shift4', 'Зміна 4');
    return `${t('shift', 'Зміна')} ${n}`;
  }

  function currentShift(){
    let shift = '';
    try {
      const btn = document.querySelector('#towerCalcModal #towerCalcTabs [data-calc-tab].is-active, #towerCalcModal #towerCalcTabs [data-calc-tab].active, #towerCalcModal #towerCalcTabs [data-calc-tab][aria-selected="true"]');
      shift = String(btn?.getAttribute('data-calc-tab') || '').toLowerCase();
    } catch {}
    if (!SHIFTS.includes(shift)) {
      try {
        shift = String(PNS.state?.towerCalc?.activeTab || PNS.state?.towerCalc?.activeShift || PNS.state?.activeShift || '').toLowerCase();
      } catch {}
    }
    if (!SHIFTS.includes(shift)) {
      try {
        const calc = JSON.parse(localStorage.getItem(CALC_KEY) || '{}') || {};
        shift = String(calc.activeTab || calc.activeShift || '').toLowerCase();
      } catch {}
    }
    return SHIFTS.includes(shift) ? shift : 'shift1';
  }

  function setCurrentShift(shift){
    const next = SHIFTS.includes(String(shift || '').toLowerCase()) ? String(shift).toLowerCase() : 'shift1';
    const modal = document.getElementById('towerCalcModal');

    modal?.querySelectorAll?.('#towerCalcTabs [data-calc-tab]').forEach(btn => {
      const active = String(btn.getAttribute('data-calc-tab') || '').toLowerCase() === next;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    try {
      const calc = JSON.parse(localStorage.getItem(CALC_KEY) || '{}') || {};
      calc.activeTab = next;
      calc.activeShift = next;
      localStorage.setItem(CALC_KEY, JSON.stringify(calc));
    } catch {}

    PNS.state = PNS.state || {};
    PNS.state.activeShift = next;
    PNS.state.towerCalc = PNS.state.towerCalc || {};
    PNS.state.towerCalc.activeTab = next;
    PNS.state.towerCalc.activeShift = next;

    return next;
  }

  function setHelperFillMode(value){
    const mode = ['min', 'mid', 'max'].includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'mid';
    const count = mode === 'min' ? 1 : mode === 'max' ? 29 : 10;
    const modal = document.getElementById('towerCalcModal');
    const select = modal?.querySelector?.('#towerCalcHelperFillModeSelect');
    const hidden = modal?.querySelector?.('#towerCalcHelperFillMode');
    if (select && select.value !== mode) select.value = mode;
    if (hidden) hidden.value = mode;

    try {
      const calc = JSON.parse(localStorage.getItem(CALC_KEY) || '{}') || {};
      calc.helperFillMode = mode;
      calc.minHelpersPerTower = true;
      calc.minHelpersCount = count;
      localStorage.setItem(CALC_KEY, JSON.stringify(calc));
    } catch {}

    PNS.state = PNS.state || {};
    PNS.state.towerCalc = PNS.state.towerCalc || {};
    PNS.state.towerCalc.helperFillMode = mode;
    PNS.state.towerCalc.minHelpersPerTower = true;
    PNS.state.towerCalc.minHelpersCount = count;
    return mode;
  }


  function emptyShiftPlans(){
    return { shift1:null, shift2:null, shift3:null, shift4:null };
  }

  function cloneShiftPlan(value){
    if (!value || typeof value !== 'object') return null;
    try { return JSON.parse(JSON.stringify(value)); } catch {}
    return null;
  }

  function cloneShiftPlans(plans){
    const source = plans && typeof plans === 'object' ? plans : {};
    return {
      shift1: cloneShiftPlan(source.shift1),
      shift2: cloneShiftPlan(source.shift2),
      shift3: cloneShiftPlan(source.shift3),
      shift4: cloneShiftPlan(source.shift4),
    };
  }

  function hasAnyPlan(plans){
    const normalized = cloneShiftPlans(plans);
    return SHIFTS.some(shift => !!normalized[shift]);
  }

  function readJsonKey(key, fallback){
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonKey(key, value){
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch {}
  }

  function readFlatShiftPlans(){
    return cloneShiftPlans(readJsonKey('pns_layout_shift_plans_store_v1', {}));
  }

  function writeFlatShiftPlans(plans){
    writeJsonKey('pns_layout_shift_plans_store_v1', cloneShiftPlans(plans));
  }

  function readRegionPlanStore(){
    const store = readJsonKey(REGION_PLANS_KEY, {});
    const normalized = {};
    REGIONS.forEach(region => { normalized[region] = cloneShiftPlans(store[region]); });
    return normalized;
  }

  function writeRegionPlanStore(store){
    const normalized = {};
    REGIONS.forEach(region => { normalized[region] = cloneShiftPlans(store?.[region]); });
    writeJsonKey(REGION_PLANS_KEY, normalized);
  }

  function persistRegionPlansFromState(region = activeRegion()){
    const state = PNS.state || {};
    const plans = cloneShiftPlans(state.shiftPlans);
    const store = readRegionPlanStore();
    store[region] = plans;
    writeRegionPlanStore(store);
    if (region === activeRegion()) writeFlatShiftPlans(plans);
    return plans;
  }

  function saveRegionShiftPlans(region = activeRegion(), options = {}){
    try {
      if (!options.skipSnapshot && PNS.ModalsShift?.saveCurrentShiftPlanSnapshot) {
        PNS.ModalsShift.saveCurrentShiftPlanSnapshot({ preserveOtherShift:true });
      }
    } catch {}
    return persistRegionPlansFromState(region);
  }

  let regionPlansLoadedFor = '';

  function ensureRegionPlansForActiveRegion(){
    const region = activeRegion();
    if (regionPlansLoadedFor === region) return true;
    const store = readRegionPlanStore();
    let plans = cloneShiftPlans(store[region]);
    if (!hasAnyPlan(plans) && region === 'region1') {
      const flat = readFlatShiftPlans();
      if (hasAnyPlan(flat)) plans = flat;
    }
    PNS.state = PNS.state || {};
    PNS.state.shiftPlans = cloneShiftPlans(plans);
    writeFlatShiftPlans(PNS.state.shiftPlans);
    regionPlansLoadedFor = region;
    return true;
  }

  function loadRegionShiftPlans(region = activeRegion()){
    const store = readRegionPlanStore();
    let plans = cloneShiftPlans(store[region]);
    if (!hasAnyPlan(plans) && region === 'region1') {
      const flat = readFlatShiftPlans();
      if (hasAnyPlan(flat)) plans = flat;
    }
    PNS.state = PNS.state || {};
    PNS.state.shiftPlans = cloneShiftPlans(plans);
    writeFlatShiftPlans(PNS.state.shiftPlans);
    regionPlansLoadedFor = region;

    const shift = SHIFTS.includes(currentShift()) ? currentShift() : 'shift1';
    try {
      if (PNS.ModalsShift?.loadShiftPlanSnapshot) PNS.ModalsShift.loadShiftPlanSnapshot(shift);
      else if (PNS.ModalsShift?.restoreShiftPlan) PNS.ModalsShift.restoreShiftPlan(PNS.state.shiftPlans?.[shift] || null);
    } catch {
      try { PNS.ModalsShift?.restoreShiftPlan?.(PNS.state.shiftPlans?.[shift] || null); } catch {}
    }
    return true;
  }

  function wrapRegionPlanApis(){
    const api = PNS.ModalsShift || null;
    if (!api || api.__rsRegionPlansWrapped) return false;
    const originalSave = typeof api.saveCurrentShiftPlanSnapshot === 'function' ? api.saveCurrentShiftPlanSnapshot : null;
    if (originalSave) {
      api.saveCurrentShiftPlanSnapshot = function(...args){
        const result = originalSave.apply(this, args);
        try { persistRegionPlansFromState(activeRegion()); } catch {}
        return result;
      };
    }

    const originalApply = typeof api.applyShiftFilter === 'function' ? api.applyShiftFilter : null;
    if (originalApply) {
      api.applyShiftFilter = function(...args){
        ensureRegionPlansForActiveRegion();
        const result = originalApply.apply(this, args);
        try { persistRegionPlansFromState(activeRegion()); } catch {}
        return result;
      };
    }

    api.__rsRegionPlansWrapped = true;
    return true;
  }


  function installStyle(){
    if (document.getElementById('region-shift-clean-style')) return;
    const style = document.createElement('style');
    style.id = 'region-shift-clean-style';
    style.textContent = `
      #towerCalcModal #towerCalcTabs{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        flex-wrap:nowrap!important;
        overflow:visible!important;
      }
      #towerCalcModal #towerCalcTabs .rs-shift-tabs,
      #towerCalcModal #towerCalcTabs .rs-region-tabs{
        display:inline-flex!important;
        align-items:center!important;
        gap:8px!important;
        flex-wrap:nowrap!important;
      }
      #towerCalcModal #towerCalcTabs .rs-region-tabs{
        margin-left:auto!important;
        justify-content:flex-end!important;
      }
      #towerCalcModal #towerCalcTabs .rs-region-tabs[hidden]{display:none!important;}


      #towerCalcModal .tcv-pro-head,
      #towerCalcModal .v8-advanced-head,
      #towerCalcModal .v9-advanced-head,
      #towerCalcModal .v10-advanced-head,
      #towerCalcModal .v11-advanced-head{
        display:none!important;
      }

      #towerCalcModal .rs-advanced-head{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:12px!important;
        width:100%!important;
        margin:0 0 12px!important;
      }
      #towerCalcModal .rs-toolbar-left,
      #towerCalcModal .rs-region-right{
        display:inline-flex!important;
        align-items:center!important;
        gap:8px!important;
        flex-wrap:nowrap!important;
      }
      #towerCalcModal .rs-toolbar-left{flex:1 1 auto!important; min-width:0!important;}
      #towerCalcModal .rs-region-right{flex:0 0 auto!important; justify-content:flex-end!important;}
      #towerCalcModal .rs-region-right[hidden]{display:none!important;}

      #towerCalcModal #towerCalcTabs .btn,
      #towerCalcModal .rs-toolbar-left .btn,
      #towerCalcModal .rs-region-right .btn{
        white-space:nowrap!important;
        width:auto!important;
        min-width:0!important;
        transform:none!important;
        translate:none!important;
        animation:none!important;
        transition:background-color .15s ease,border-color .15s ease,color .15s ease,opacity .15s ease!important;
      }
      #towerCalcModal #towerCalcTabs .btn:hover,
      #towerCalcModal #towerCalcTabs .btn:focus,
      #towerCalcModal #towerCalcTabs .btn:active,
      #towerCalcModal .rs-toolbar-left .btn:hover,
      #towerCalcModal .rs-toolbar-left .btn:focus,
      #towerCalcModal .rs-toolbar-left .btn:active,
      #towerCalcModal .rs-region-right .btn:hover,
      #towerCalcModal .rs-region-right .btn:focus,
      #towerCalcModal .rs-region-right .btn:active{
        transform:none!important;
        translate:none!important;
        animation:none!important;
      }

      #towerCalcModal .rs-clear-wrap{
        position:relative!important;
        overflow:visible!important;
        z-index:50!important;
      }
      #towerCalcModal .rs-clear-menu{
        position:absolute!important;
        right:0!important;
        top:calc(100% + 8px)!important;
        min-width:240px!important;
        max-height:320px!important;
        overflow:auto!important;
        background:#101a33!important;
        border:1px solid #ffffff1a!important;
        border-radius:14px!important;
        padding:8px!important;
        z-index:260500!important;
        display:none!important;
        box-shadow:0 12px 40px rgba(0,0,0,.35)!important;
      }
      #towerCalcModal .rs-clear-menu.open{display:block!important;}
      #towerCalcModal .rs-clear-item{
        width:100%!important;
        display:block!important;
        text-align:left!important;
        background:transparent!important;
        border:0!important;
        color:inherit!important;
        padding:10px 12px!important;
        border-radius:10px!important;
        cursor:pointer!important;
      }
      #towerCalcModal .rs-clear-item:hover{background:rgba(255,255,255,.06)!important;}


      #towerCalcModal #tcv35-row,
      #towerCalcModal .tower-calc-toolbar-main,
      #towerCalcModal .tower-calc-toolbar .tower-calc-controls-muted,
      #towerCalcModal .tower-calc-toolbar .tower-calc-controls.muted.small{
        display:none!important;
      }




      #towerCalcModal #towerCalcShiftBalance #tcv14AddRow ~ #tcv14BtnRow,
      #towerCalcModal #towerCalcShiftBalance #tcv14AddRow + #tcv14BtnRow,
      #towerCalcModal #towerCalcShiftBalance #tcv14AddRow + .rs-limit-buttons{
        margin-top:12px!important;
      }

      #towerCalcModal #towerCalcShiftBalance #tcv14BtnRow,
      #towerCalcModal #towerCalcShiftBalance .tcv14-btn-row{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        gap:12px!important;
        align-items:center!important;
        width:100%!important;
      }
      #towerCalcModal #towerCalcShiftBalance #tcv14BtnRow > .btn,
      #towerCalcModal #towerCalcShiftBalance .tcv14-btn-row > .btn{
        width:100%!important;
        min-width:0!important;
        white-space:nowrap!important;
        box-sizing:border-box!important;
      }

      #towerCalcModal #towerCalcShiftBalance .tcv5-actions,
      #towerCalcModal #towerCalcShiftBalance .tcv14-actions,
      #towerCalcModal #towerCalcShiftBalance .actions,
      #towerCalcModal #towerCalcShiftBalance .form-actions,
      #towerCalcModal #towerCalcShiftBalance .button-row{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        gap:12px!important;
        align-items:center!important;
        width:100%!important;
      }
      #towerCalcModal #towerCalcShiftBalance #applyShiftAddBtn,
      #towerCalcModal #towerCalcShiftBalance #towerCalcRestoreImportShiftsBtn{
        width:100%!important;
        min-width:0!important;
        white-space:nowrap!important;
        box-sizing:border-box!important;
      }
      #towerCalcModal #towerCalcShiftBalance .rs-limit-buttons{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        gap:12px!important;
        width:100%!important;
      }
      #towerCalcModal #towerCalcShiftBalance .rs-limit-buttons > .btn{
        width:100%!important;
        min-width:0!important;
        white-space:nowrap!important;
      }


      #towerCalcModal .board-sheet .board-signature,
      #board-modal .board-sheet .board-signature{
        display:flex!important;
        justify-content:center!important;
        align-items:center!important;
        margin-top:18px!important;
        width:100%!important;
      }
      #towerCalcModal .board-signature-image,
      #board-modal .board-signature-image{
        display:block!important;
        width:220px!important;
        max-width:46vw!important;
        height:auto!important;
      }

      #towerCalcModal .picker-meta-row{
        display:flex!important;
        align-items:center!important;
        gap:12px!important;
        flex-wrap:wrap!important;
        min-height:28px!important;
        margin-top:2px!important;
      }
      #towerCalcModal .picker-only-captains{
        display:inline-flex!important;
        align-items:center!important;
        gap:8px!important;
        white-space:nowrap!important;
      }
      #towerCalcModal .picker-only-captains input{
        width:auto!important;
        height:auto!important;
        flex:0 0 auto!important;
      }

      #towerCalcModal .rs-carousel{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        width:100%!important;
      }
      #towerCalcModal .rs-carousel-track{flex:1 1 auto!important; min-width:0!important; overflow:hidden!important;}
      #towerCalcModal .rs-carousel-track > .tcv7-grid{
        display:flex!important;
        gap:12px!important;
        flex-wrap:nowrap!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scrollbar-width:none!important;
        -ms-overflow-style:none!important;
        scroll-behavior:smooth!important;
      }
      #towerCalcModal .rs-carousel-track > .tcv7-grid::-webkit-scrollbar{display:none!important;}
      #towerCalcModal .rs-carousel-track > .tcv7-grid > .tcv7-card{
        flex:0 0 calc((100% - 36px) / 4)!important;
        min-width:0!important;
      }
      #towerCalcModal .rs-carousel-btn{
        flex:0 0 34px!important;
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        padding:0!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
      }

      #towerCalcModal #towerCalcShiftBalance .tcv18-manual-region-tabs,
      #towerCalcModal #towerCalcShiftBalance .tower-calc-region-tabs,
      #towerCalcModal #towerCalcShiftBalance [data-hotfix-manual-region-tab],
      #towerCalcModal #towerCalcShiftBalance [data-v8-region-tab],
      #towerCalcModal #towerCalcShiftBalance [data-v9-region-tab],
      #towerCalcModal #towerCalcShiftBalance [data-v10-region-tab],
      #towerCalcModal #towerCalcShiftBalance [data-v11-region-tab],
      #towerCalcModal #towerCalcShiftBalance [data-rs-region-tab]{
        display:none!important;
      }

      @media(max-width:900px){
  
      #towerCalcModal .tcv-pro-head,
      #towerCalcModal .v8-advanced-head,
      #towerCalcModal .v9-advanced-head,
      #towerCalcModal .v10-advanced-head,
      #towerCalcModal .v11-advanced-head{
        display:none!important;
      }

      #towerCalcModal .rs-advanced-head{align-items:flex-start!important; flex-direction:column!important;}
        #towerCalcModal .rs-region-right{width:100%!important; justify-content:flex-end!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function removeLimitRegionUI(){
    const panel = document.querySelector('#towerCalcModal #towerCalcShiftBalance');
    if (!panel) return;
    panel.querySelectorAll('.tower-calc-region-tabs,[data-hotfix-manual-region-tab],[data-v8-region-tab],[data-v9-region-tab],[data-v10-region-tab],[data-v11-region-tab],[data-rs-region-tab]')
      .forEach(n => {
        const group = n.closest('.tower-calc-region-tabs,.tcv18-manual-region-tabs,.v8-region-right,.v9-region-right,.v10-region-right,.v11-region-right,.rs-region-right') || n;
        if (panel.contains(group)) group.remove();
      });
  }

  function removeOldRegionUI(){
    const modal = document.getElementById('towerCalcModal');
    if (!modal) return;
    modal.querySelectorAll(
      '.v8-advanced-head,.v9-advanced-head,.v10-advanced-head,.v11-advanced-head,.tcv-pro-head,' +
      '.v8-region-right,.v9-region-right,.v10-region-right,.v11-region-right,.tcv18-manual-region-tabs'
    ).forEach(n => n.remove());
    modal.querySelectorAll('#tcv35-row').forEach(n => n.remove());
    removeLimitRegionUI();
  }

  function renderTowerTabs(){
    const modal = document.getElementById('towerCalcModal');
    const tabs = modal?.querySelector?.('#towerCalcTabs');
    if (!modal || !tabs) return false;

    const settings = readSettings();
    const regions = enabledRegions(settings);
    const region = activeRegion(settings);
    const count = shiftCount(settings, region);
    let shift = currentShift();
    if (Number(shift.replace('shift', '')) > count) shift = `shift${count}`;

    let shiftWrap = tabs.querySelector(':scope > .rs-shift-tabs');
    let regionWrap = tabs.querySelector(':scope > .rs-region-tabs');

    tabs.querySelectorAll(':scope > :not(.rs-shift-tabs):not(.rs-region-tabs)').forEach(n => n.remove());

    if (!shiftWrap) {
      shiftWrap = document.createElement('span');
      shiftWrap.className = 'rs-shift-tabs';
      tabs.insertBefore(shiftWrap, tabs.firstChild);
    }
    if (!regionWrap) {
      regionWrap = document.createElement('span');
      regionWrap.className = 'rs-region-tabs';
      tabs.appendChild(regionWrap);
    }

    for (let i = 1; i <= 4; i += 1) {
      const key = `shift${i}`;
      let btn = shiftWrap.querySelector(`[data-calc-tab="${key}"]`);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm';
        btn.setAttribute('data-calc-tab', key);
        shiftWrap.appendChild(btn);
      }
      btn.textContent = shiftLabel(key);
      btn.hidden = i > count;
      btn.style.display = i > count ? 'none' : '';
      const active = key === shift;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }

    const existingRegionButtons = Array.from(regionWrap.querySelectorAll('[data-rs-region-tab]'));
    const sameRegions = existingRegionButtons.length === regions.length && existingRegionButtons.every((btn, idx) => btn.getAttribute('data-rs-region-tab') === regions[idx]);
    if (!sameRegions) {
      regionWrap.innerHTML = '';
      regions.forEach(r => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm';
        btn.setAttribute('data-rs-region-tab', r);
        btn.textContent = regionLabel(r);
        regionWrap.appendChild(btn);
      });
    }
    regionWrap.hidden = regions.length <= 1;
    regionWrap.querySelectorAll('[data-rs-region-tab]').forEach(btn => {
      const active = btn.getAttribute('data-rs-region-tab') === region;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    setCurrentShift(shift);
    return true;
  }

  function clickHidden(selector){
    const modal = document.getElementById('towerCalcModal');
    const el = modal?.querySelector?.(selector);
    if (!el) return false;
    try { el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); return true; } catch {}
    try { el.click(); return true; } catch {}
    return false;
  }

  function setApplyMode(mode){
    const select = document.querySelector('#towerCalcModal #towerCalcApplyModeUi');
    if (select) {
      select.value = mode;
      try { select.dispatchEvent(new Event('change', { bubbles:true })); } catch {}
    }
  }

  function button(label, fn){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.textContent = label;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    });
    return btn;
  }


  function clearShiftScope(scope){
    try {
      if (typeof PNS.towerCalcClearShiftKeepCaptains === 'function') {
        PNS.towerCalcClearShiftKeepCaptains(scope);
        renderSummary();
        ensurePickerControls();
        return true;
      }
    } catch {}
    if (/^shift[1-4]$/.test(String(scope || ''))) {
      try {
        const active = currentShift();
        loadShiftForAction(scope);
        PNS.state?.bases?.forEach?.(base => { try { PNS.clearBase?.(base.id, false); } catch {} });
        try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.({ forceEmpty:true, preserveOtherShift:true }); } catch {}
        loadShiftForAction(active);
        return true;
      } catch {}
    }
    if (scope === 'all') return clickHidden('#towerCalcClearHelpersAllBtn');
    return false;
  }

  function renderToolbar(){
    const left = document.createElement('div');
    left.className = 'rs-toolbar-left';
    left.setAttribute('data-rs-clear-shift-count', String(shiftCount()));

    left.appendChild(button(t('rebalance', 'Застосувати перерозподіл'), () => {
      setApplyMode('rebalance');
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.({ preserveOtherShift:true }); } catch {}
      clickHidden('#towerCalcQuickApplyBtn') || clickHidden('#towerCalcApplyAndAssignBtn') || clickHidden('#towerCalcApplyToTowersBtn');
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.({ preserveOtherShift:true }); } catch {}
    }));

    left.appendChild(button(t('topup_turrets', 'Дозаповнити турелі'), () => {
      setApplyMode('topup');
      clickHidden('#towerCalcQuickApplyBtn') || clickHidden('#towerCalcAutoFitBtn') || clickHidden('#towerCalcApplyAndAssignBtn');
    }));

    const wrap = document.createElement('div');
    wrap.className = 'rs-clear-wrap';
    const menu = document.createElement('div');
    menu.className = 'rs-clear-menu';

    const addItem = (label, action) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'rs-clear-item';
      item.textContent = label;
      item.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove('open');
        if (typeof action === 'function') action();
      });
      menu.appendChild(item);
    };

    const clear = button(`${t('clear', 'Очистити')} ▾`, () => menu.classList.toggle('open'));
    const clearCount = shiftCount();
    for (let i = 1; i <= clearCount; i += 1) {
      addItem(`${t('clear_shift', 'Очистити зміну')} ${i}`, () => clearShiftScope(`shift${i}`));
    }
    addItem(t('clear_all_shifts', 'Очистити всі зміни'), () => clearShiftScope('all'));
    if (document.querySelector('#towerCalcModal #towerCalcRestoreImportShiftsBtn')) addItem(t('restore_from_import', 'Відновити з імпорту'), () => clickHidden('#towerCalcRestoreImportShiftsBtn'));

    wrap.appendChild(clear);
    wrap.appendChild(menu);
    left.appendChild(wrap);
    return left;
  }

  function renderHeaderRegions(){
    const settings = readSettings();
    const regions = enabledRegions(settings);
    const region = activeRegion(settings);

    const right = document.createElement('div');
    right.className = 'rs-region-right';
    right.hidden = regions.length <= 1;
    regions.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm' + (r === region ? ' is-active active' : '');
      btn.setAttribute('data-rs-region-tab', r);
      btn.setAttribute('aria-selected', r === region ? 'true' : 'false');
      btn.textContent = regionLabel(r);
      right.appendChild(btn);
    });
    return right;
  }

  function renderAdvancedHeader(){
    const modal = document.getElementById('towerCalcModal');
    const advanced = modal?.querySelector?.('#towerCalcAdvanced');
    if (!modal || !advanced) return false;

    const inner = advanced.querySelector('.inner') || advanced;
    const layout = inner.querySelector('#tcv7AdvancedTopLayout');
    if (!layout) return false;

    modal.querySelectorAll('.v8-advanced-head,.v9-advanced-head,.v10-advanced-head,.v11-advanced-head,.tcv-pro-head,#tcv35-row').forEach(n => n.remove());

    const heads = Array.from(modal.querySelectorAll('.rs-advanced-head'));
    let head = heads.find(node => node.parentElement === inner) || heads[0] || null;
    heads.forEach(node => { if (node !== head) node.remove(); });
    if (!head) {
      head = document.createElement('div');
      head.className = 'rs-advanced-head';
    }

    let left = head.querySelector(':scope > .rs-toolbar-left');
    const toolbarShiftCount = String(shiftCount());
    if (!left) {
      left = renderToolbar();
      head.insertBefore(left, head.firstChild || null);
    } else if (left.getAttribute('data-rs-clear-shift-count') !== toolbarShiftCount) {
      const nextLeft = renderToolbar();
      left.replaceWith(nextLeft);
      left = nextLeft;
    }

    let right = head.querySelector(':scope > .rs-region-right');
    if (!right) {
      right = renderHeaderRegions();
      head.appendChild(right);
    } else {
      const fresh = renderHeaderRegions();
      const oldKeys = Array.from(right.querySelectorAll('[data-rs-region-tab]')).map(btn => btn.getAttribute('data-rs-region-tab')).join('|');
      const newKeys = Array.from(fresh.querySelectorAll('[data-rs-region-tab]')).map(btn => btn.getAttribute('data-rs-region-tab')).join('|');
      if (oldKeys !== newKeys) {
        right.replaceWith(fresh);
        right = fresh;
      } else {
        right.hidden = fresh.hidden;
        const activeRegionValue = activeRegion();
        right.querySelectorAll('[data-rs-region-tab]').forEach(btn => {
          const active = btn.getAttribute('data-rs-region-tab') === activeRegionValue;
          btn.classList.toggle('is-active', active);
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
    }

    if (head.parentElement !== inner || head.nextElementSibling !== layout) inner.insertBefore(head, layout);
    return true;
  }


  function stabilizeLimitButtons(){
    const panel = document.querySelector('#towerCalcModal #towerCalcShiftBalance');
    if (!panel) return false;

    const applyBtn = panel.querySelector('#applyShiftAddBtn');
    const restoreBtn = panel.querySelector('#towerCalcRestoreImportShiftsBtn');
    if (!applyBtn || !restoreBtn) return false;

    let row = panel.querySelector('#tcv14BtnRow') || panel.querySelector('.rs-limit-buttons');
    if (!row) {
      row = document.createElement('div');
      row.id = 'tcv14BtnRow';
      row.className = 'tcv7-btn-row tcv14-btn-row rs-limit-buttons';
    }
    row.classList.add('rs-limit-buttons', 'tcv14-btn-row');

    const addRow = panel.querySelector('#tcv14AddRow');
    const note = panel.querySelector('#towerCalcShiftLimitNote');
    const force = panel.querySelector('.tower-calc-shift-force');
    const anchor = addRow ? addRow.nextSibling : (note || force || applyBtn);
    const targetParent = addRow?.parentElement || anchor?.parentElement || panel;

    if (row.parentElement !== targetParent || (addRow && row.previousElementSibling !== addRow)) {
      targetParent.insertBefore(row, anchor);
    }

    if (applyBtn.parentElement !== row) row.appendChild(applyBtn);
    if (restoreBtn.parentElement !== row) row.appendChild(restoreBtn);

    applyBtn.classList.add('btn');
    restoreBtn.classList.add('btn');
    return true;
  }

  function renderManualLimits(){
    const modal = document.getElementById('towerCalcModal');
    const panel = modal?.querySelector?.('#towerCalcShiftBalance');
    const limitRow = panel?.querySelector?.('#tcv14LimitRow');
    const addRow = panel?.querySelector?.('#tcv14AddRow');
    if (!panel || !limitRow || !addRow) return false;

    const count = shiftCount();
    const manualEnabled = !!panel.querySelector('#tcv5EnableShiftLimits')?.checked;
    const readValue = (row, kind, n, fallback) => {
      return row.querySelector(`[data-rs-kind="${kind}"][data-rs-shift="${n}"] input`)?.value || fallback;
    };
    const old = {
      l1: panel.querySelector('#shiftLimitS1')?.value || readValue(limitRow, 'limit', 1, '100'),
      l2: panel.querySelector('#shiftLimitS2')?.value || readValue(limitRow, 'limit', 2, '100'),
      l3: readValue(limitRow, 'limit', 3, '100'),
      l4: readValue(limitRow, 'limit', 4, '100'),
      a1: panel.querySelector('#shiftAddS1')?.value || readValue(addRow, 'add', 1, '0'),
      a2: panel.querySelector('#shiftAddS2')?.value || readValue(addRow, 'add', 2, '0'),
      a3: readValue(addRow, 'add', 3, '0'),
      a4: readValue(addRow, 'add', 4, '0')
    };

    const labelText = (type, n) => {
      if (type === 'limit') return n === 1 ? t('shift1_limit', 'Ліміт зміни 1') : n === 2 ? t('shift2_limit', 'Ліміт зміни 2') : `Ліміт зміни ${n}`;
      return n === 1 ? t('add_to_shift1', 'Додати в зміну 1') : n === 2 ? t('add_to_shift2', 'Додати в зміну 2') : `Додати в зміну ${n}`;
    };

    const makeField = (type, n, value, disabled) => {
      const label = document.createElement('label');
      label.className = 'rs-manual-field';
      label.setAttribute('data-rs-kind', type);
      label.setAttribute('data-rs-shift', String(n));
      const span = document.createElement('span');
      span.textContent = labelText(type, n);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(value);
      input.disabled = !!disabled;
      label.appendChild(span);
      label.appendChild(input);
      return label;
    };

    limitRow.innerHTML = '';
    addRow.innerHTML = '';
    limitRow.style.display = 'grid';
    addRow.style.display = 'grid';
    limitRow.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
    addRow.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;

    for (let i = 1; i <= count; i += 1) {
      const limitValue = i === 1 ? old.l1 : i === 2 ? old.l2 : i === 3 ? old.l3 : old.l4;
      const addValue = i === 1 ? old.a1 : i === 2 ? old.a2 : i === 3 ? old.a3 : old.a4;
      limitRow.appendChild(makeField('limit', i, limitValue, !manualEnabled));
      addRow.appendChild(makeField('add', i, addValue, false));
    }

    panel.querySelector('#towerCalcShiftLimitNote')?.remove();
    stabilizeLimitButtons();
    removeLimitRegionUI();
    return true;
  }


  function syncPickerToggles(root){
    const scope = root?.querySelector ? root : (root?.closest?.('.tower-picker-scope,.tower-picker-detail') || document.getElementById('towerCalcModal'));
    const state = PNS.state = PNS.state || {};
    const map = [
      ['pickerOnlyCaptains', 'towerPickerOnlyCaptains', 'pns_picker_only_captains'],
      ['pickerMatchRegisteredShift', 'towerPickerMatchRegisteredShift', 'pns_picker_match_registered_shift'],
      ['pickerNoMixTroops', 'towerPickerNoMixTroops', 'pns_picker_no_mix_troops'],
      ['pickerNoCrossShiftDupes', 'towerPickerNoCrossShiftDupes', 'pns_picker_no_cross_shift_dupes'],
    ];
    map.forEach(([id, prop, key]) => {
      const input = scope?.querySelector?.(`#${id}`) || document.getElementById(id);
      if (!input) return;
      state[prop] = !!input.checked;
      try { localStorage.setItem(key, input.checked ? '1' : '0'); } catch {}
    });
    return true;
  }

  function applyStoredPickerToggles(root){
    const scope = root?.querySelector ? root : document.getElementById('towerCalcModal');
    const state = PNS.state = PNS.state || {};
    const read = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === '1') return true;
        if (raw === '0') return false;
      } catch {}
      return fallback;
    };
    const map = [
      ['pickerOnlyCaptains', 'towerPickerOnlyCaptains', 'pns_picker_only_captains', true],
      ['pickerMatchRegisteredShift', 'towerPickerMatchRegisteredShift', 'pns_picker_match_registered_shift', true],
      ['pickerNoMixTroops', 'towerPickerNoMixTroops', 'pns_picker_no_mix_troops', true],
      ['pickerNoCrossShiftDupes', 'towerPickerNoCrossShiftDupes', 'pns_picker_no_cross_shift_dupes', false],
    ];
    map.forEach(([id, prop, key, fallback]) => {
      const value = read(key, typeof state[prop] === 'boolean' ? state[prop] : fallback);
      state[prop] = value;
      scope?.querySelectorAll?.(`#${id}`).forEach(input => { input.checked = value; });
    });
    return true;
  }

  function clearPickerTower(button, helpersOnly){
    const btn = button?.closest ? button : null;
    if (!btn) return false;
    const baseId = String(btn.dataset.pickerClearBase || btn.dataset.pickerClearHelpers || '');
    if (!baseId) return false;
    const scope = btn.closest('.tower-picker-scope,.tower-picker-detail');
    syncPickerToggles(scope || btn);
    const shift = String(scope?.getAttribute?.('data-calc-inline-scope') || currentShift() || 'shift1').toLowerCase();
    try {
      if (PNS.ModalsShift?.applyShiftFilter && String(PNS.state?.activeShift || '') !== shift) {
        PNS.ModalsShift.applyShiftFilter(shift);
      }
    } catch {}
    try { PNS.clearBase?.(baseId, !!helpersOnly); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.({ forceEmpty: true }); } catch {}
    try { PNS.savePlayersSnapshot?.(PNS.state?.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    return true;
  }

  function ensurePickerControls(){
    const modal = document.getElementById('towerCalcModal');
    if (!modal) return false;
    const shift = setCurrentShift(currentShift());
    applyStoredPickerToggles(modal);

    const checkboxValue = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === '1') return true;
        if (raw === '0') return false;
      } catch {}
      return fallback;
    };

    modal.querySelectorAll('.tower-picker-scope').forEach(scope => {
      scope.setAttribute('data-calc-inline-scope', shift);
      let row = scope.querySelector('.picker-meta-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'picker-meta-row muted small';
        const h3 = scope.querySelector('h3');
        if (h3) h3.insertAdjacentElement('afterend', row);
        else scope.insertBefore(row, scope.firstChild || null);
      }

      row.innerHTML = '';
      const text = document.createElement('span');
      text.className = 'picker-meta-shift';
      text.textContent = `${t('shift', 'Зміна')}: ${shiftLabel(shift)}`;
      row.appendChild(text);

      [
        ['pickerOnlyCaptains', t('only_captains', 'Тільки капітани'), 'pns_picker_only_captains', true],
        ['pickerMatchRegisteredShift', t('respect_player_shift', 'Враховувати зміну гравця'), 'pns_picker_match_registered_shift', true],
        ['pickerNoMixTroops', t('same_troop_only', 'Лише той самий тип військ'), 'pns_picker_no_mix_troops', true],
        ['pickerNoCrossShiftDupes', t('use_both', 'Використовувати «Всі»'), 'pns_picker_no_cross_shift_dupes', false]
      ].forEach(([id, labelText, storageKey, fallback]) => {
        const label = document.createElement('label');
        label.className = 'picker-only-captains';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.name = id;
        input.checked = checkboxValue(storageKey, fallback);
        input.setAttribute('data-rs-picker-toggle', storageKey);
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + labelText));
        row.appendChild(label);
      });
    });
    applyStoredPickerToggles(modal);
    return true;
  }

  function summaryStatsForShift(shift){
    const PNS = window.PNS || {};
    const state = PNS.state || {};
    const normalizeShift = value => {
      try {
        const normalized = typeof PNS.normalizeShiftValue === 'function' ? String(PNS.normalizeShiftValue(value) || '').toLowerCase() : '';
        if (/^shift[1-4]$/.test(normalized) || normalized === 'both') return normalized;
      } catch {}
      const text = String(value || '').trim().toLowerCase();
      if (/^shift[1-4]$/.test(text) || text === 'both') return text;
      if (/^[1-4]$/.test(text)) return `shift${text}`;
      return 'both';
    };
    const normalizeRole = value => {
      try {
        const normalized = typeof PNS.normalizeRole === 'function' ? String(PNS.normalizeRole(value) || '').toLowerCase() : '';
        if (normalized.includes('shoot')) return 'shooter';
        if (normalized.includes('rid')) return 'rider';
        if (normalized.includes('fight')) return 'fighter';
      } catch {}
      const text = String(value || '').toLowerCase();
      if (/shoot|arch|стріл|стрел|shooter/.test(text)) return 'shooter';
      if (/rid|наїз|наезд|rider/.test(text)) return 'rider';
      return 'fighter';
    };
    const assigned = new Set();
    const addPlan = plan => {
      const bases = plan?.bases && typeof plan.bases === 'object' ? plan.bases : null;
      if (!bases) return;
      Object.values(bases).forEach(base => {
        const captainId = String(base?.captainId || '');
        if (captainId) assigned.add(captainId);
        (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach(id => {
          const value = String(id || '');
          if (value) assigned.add(value);
        });
      });
    };
    try { addPlan(state.shiftPlans?.[shift]); } catch {}
    try {
      const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null') || {};
      const region = localStorage.getItem('pns_tower_calc_active_region_v1') || settings.activeRegion || 'region1';
      const regionPlans = JSON.parse(localStorage.getItem('pns_layout_region_shift_plans_store_v1') || '{}') || {};
      addPlan(regionPlans?.[region]?.[shift]);
      const flatPlans = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}') || {};
      addPlan(flatPlans?.[shift]);
    } catch {}
    try {
      const slots = typeof window.calcGetTowerSlotsForShift === 'function' ? window.calcGetTowerSlotsForShift(shift) : [];
      (Array.isArray(slots) ? slots : []).forEach(slot => {
        const captainId = String(slot?.captainId || '');
        if (captainId) assigned.add(captainId);
        (Array.isArray(slot?.helperIds) ? slot.helperIds : []).forEach(id => {
          const value = String(id || '');
          if (value) assigned.add(value);
        });
      });
    } catch {}
    const stats = { total:0, fighter:0, rider:0, shooter:0, inTowers:0, reserve:0 };
    const players = Array.isArray(state.players) ? state.players : [];
    players.forEach(player => {
      const raw = (() => {
        try {
          if (typeof PNS.getRegisteredShiftForPlayer === 'function') return PNS.getRegisteredShiftForPlayer(player);
        } catch {}
        return player?.manualShiftOverride
          ? (player?.shift || player?.shiftLabel || player?.registeredShiftRaw || player?.registeredShift || player?.registeredShiftLabel || player?.raw?.shift_availability || 'both')
          : (player?.registeredShiftRaw || player?.raw?.shift_availability || player?.registeredShift || player?.registeredShiftLabel || player?.shift || player?.shiftLabel || 'both');
      })();
      if (normalizeShift(raw) !== shift) return;
      stats.total += 1;
      const role = normalizeRole(player?.role);
      stats[role] = (stats[role] || 0) + 1;
      const id = String(player?.id || '');
      if (id && assigned.has(id)) stats.inTowers += 1;
      else stats.reserve += 1;
    });
    return stats;
  }

  function updateSummaryCardForShift(card, shift){
    if (!card) return;
    const stats = summaryStatsForShift(shift);
    const value = card.querySelector('.tcv7-card-value');
    if (value) value.textContent = String(stats.total || 0);
    const bottom = card.querySelector('.tcv7-card-bottom');
    if (bottom) bottom.textContent = `${t('in_turrets', 'У турелях')} ${stats.inTowers || 0} · ${t('reserve', 'Резерв')} ${stats.reserve || 0} ${t('from_total', 'із')} ${stats.total || 0}`;
    const fighter = card.querySelector('.tcv7-role-item.is-fighter strong');
    const rider = card.querySelector('.tcv7-role-item.is-rider strong');
    const shooter = card.querySelector('.tcv7-role-item.is-shooter strong');
    if (fighter) fighter.textContent = String(stats.fighter || 0);
    if (rider) rider.textContent = String(stats.rider || 0);
    if (shooter) shooter.textContent = String(stats.shooter || 0);
  }

  function summaryCard(title){
    const card = document.createElement('article');
    card.className = 'tcv7-card';
    card.setAttribute('data-rs-extra-card', '1');
    card.innerHTML = [
      `<div class="tcv7-card-head">${title}</div>`,
      '<div class="tcv7-card-main"><div class="tcv7-card-value">0</div>',
      `<div class="tcv7-card-kicker">${t('total_players_short', 'усього гравців')}</div>`,
      `<div class="tcv7-card-bottom">${t('in_turrets', 'У турелях')} 0 · ${t('reserve', 'Резерв')} 0 ${t('from_total', 'із')} 0</div>`,
      '<div class="tcv7-role-row">',
      '<div class="tcv7-role-item is-fighter"><span aria-hidden="true" class="tcv7-role-icon"><img alt="" decoding="async" loading="lazy" src="img/fighter.webp"></span><strong>0</strong></div>',
      '<div class="tcv7-role-item is-rider"><span aria-hidden="true" class="tcv7-role-icon"><img alt="" decoding="async" loading="lazy" src="img/rider.webp"></span><strong>0</strong></div>',
      '<div class="tcv7-role-item is-shooter"><span aria-hidden="true" class="tcv7-role-icon"><img alt="" decoding="async" loading="lazy" src="img/shooter.webp"></span><strong>0</strong></div>',
      '</div></div>'
    ].join('');
    return card;
  }

  function unwrapCarousel(grid){
    const shell = grid?.closest?.('.rs-carousel,.v8-carousel,.v9-carousel,.v10-carousel,.v11-carousel,.tcv18-scroll-shell');
    if (!shell) return;
    const parent = shell.parentElement;
    if (!parent) return;
    parent.insertBefore(grid, shell);
    shell.remove();
  }

  function wrapCarousel(grid){
    if (!grid || grid.closest('.rs-carousel')) return;
    const parent = grid.parentElement;
    if (!parent) return;

    const shell = document.createElement('div');
    shell.className = 'rs-carousel';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-sm rs-carousel-btn';
    prev.textContent = '‹';
    const track = document.createElement('div');
    track.className = 'rs-carousel-track';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-sm rs-carousel-btn';
    next.textContent = '›';

    parent.insertBefore(shell, grid);
    shell.appendChild(prev);
    shell.appendChild(track);
    track.appendChild(grid);
    shell.appendChild(next);

    const scroll = dir => grid.scrollBy({ left: dir * Math.max(260, Math.round(grid.clientWidth * 0.75)), behavior: 'smooth' });
    prev.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); scroll(-1); });
    next.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); scroll(1); });
  }

  function renderSummary(){
    const grid = document.querySelector('#towerCalcModal #towerCalcTopShiftSummaryV7 .tcv7-grid');
    if (!grid) return false;

    // v63: the core summary now renders shift1/shift2/shift3/shift4 itself.
    // The old compatibility layer used to add extra shift3/shift4 cards manually,
    // which caused duplicate labels like "Зміна 3" twice. Remove old generated cards
    // and only keep the carousel behavior here.
    grid.querySelectorAll('[data-rs-extra-card]').forEach(card => card.remove());

    const visibleCards = Array.from(grid.querySelectorAll(':scope > .tcv7-card'))
      .filter(card => card.style.display !== 'none').length;
    const isWrapped = !!grid.closest('.rs-carousel');

    if (visibleCards > 4 && !isWrapped) wrapCarousel(grid);
    if (visibleCards <= 4 && isWrapped) unwrapCarousel(grid);

    return true;
  }

  function wrapNativeRenderers(){
    [
      'installTowerCalcSummaryUi',
      'towerCalcRenderTopSummary',
      'installTowerCalcLayoutUi',
      'towerCalcLayoutAdvancedColumns',
      'patchTowerCalcPresentation',
      'patchTowerCalcRuntimeUi',
      'installTowerCalcRuntimeUi'
    ].forEach((name) => {
      const original = PNS[name];
      if (typeof original !== 'function' || original.__rsWrapped) return;
      const wrapped = function(...args){
        const result = original.apply(this, args);
        if (!running) renderAll();
        return result;
      };
      wrapped.__rsWrapped = true;
      PNS[name] = wrapped;
    });
  }


  function getScopeShiftFromElement(element){
    const scope = element?.closest?.('.tower-picker-scope,.tower-picker-detail');
    const scoped = String(scope?.getAttribute?.('data-calc-inline-scope') || '').toLowerCase();
    if (SHIFTS.includes(scoped)) return scoped;
    return currentShift();
  }

  function loadShiftForAction(shift){
    const next = SHIFTS.includes(String(shift || '').toLowerCase()) ? String(shift).toLowerCase() : 'shift1';

    // Important: applyShiftFilter must run BEFORE setCurrentShift().
    // setCurrentShift() changes state.activeShift, and then the native shift loader thinks
    // it is already on that shift and does not restore that shift's plan.
    try {
      if (PNS.ModalsShift?.applyShiftFilter) PNS.ModalsShift.applyShiftFilter(next);
      else setCurrentShift(next);
    } catch {
      setCurrentShift(next);
    }

    setCurrentShift(next);
    return next;
  }

  function saveCurrentShiftAction(forceEmpty){
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(forceEmpty ? { forceEmpty:true } : {}); } catch {}
    try { PNS.savePlayersSnapshot?.(PNS.state?.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
  }

  function refreshTowerAction(scope){
    try { PNS.renderAll?.(); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { ensureBoardSignature(document.getElementById('towerCalcModal') || document); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try { ensurePickerControls(); } catch {}
    try { scope && PNS.ModalsShift?.maybeAdvanceFocusedTower?.(); } catch {}
  }

  function handleScopedCaptain(button){
    const baseId = String(button?.dataset?.pickerSetCaptain || '');
    const scope = button?.closest?.('.tower-picker-scope,.tower-picker-detail');
    const select = scope?.querySelector?.('#towerPickerCaptainSelect');
    const playerId = String(select?.value || '');
    if (!baseId || !playerId) {
      try { alert(t('choose_captain_first', 'Оберіть капітана')); } catch {}
      return true;
    }
    syncPickerToggles(scope || button);
    try {
      if (baseId && scope?.querySelector && typeof PNS.setBaseTowerRule === 'function' && typeof PNS.readBaseEditorSettingsInputs === 'function') {
        PNS.setBaseTowerRule(baseId, PNS.readBaseEditorSettingsInputs(baseId, scope), { persist:true, rerender:false });
      }
    } catch {}
    const shift = loadShiftForAction(getScopeShiftFromElement(button));
    try { PNS.assignPlayerToBase?.(playerId, baseId, 'captain'); } catch {}
    saveCurrentShiftAction(false);
    try { PNS.setImportStatus?.(`${t('saved_turret_table','Збережено таблицю турелі')} (${t('captain','капітан')}).`, 'good'); } catch {}
    refreshTowerAction(scope);
    setCurrentShift(shift);
    return true;
  }

  function handleScopedAutofill(button){
    const baseId = String(button?.dataset?.pickerAutofill || '');
    if (!baseId) return true;
    const scope = button?.closest?.('.tower-picker-scope,.tower-picker-detail');
    syncPickerToggles(scope || button);
    try {
      if (baseId && scope?.querySelector && typeof PNS.setBaseTowerRule === 'function' && typeof PNS.readBaseEditorSettingsInputs === 'function') {
        PNS.setBaseTowerRule(baseId, PNS.readBaseEditorSettingsInputs(baseId, scope), { persist:true, rerender:false });
      }
    } catch {}
    const shift = loadShiftForAction(getScopeShiftFromElement(button));
    try { PNS.autoFillBase?.(baseId); } catch {}
    saveCurrentShiftAction(false);
    refreshTowerAction(scope);
    setCurrentShift(shift);
    return true;
  }

  function handleScopedClearBase(button){
    const baseId = String(button?.dataset?.pickerClearBase || button?.dataset?.pickerClearHelpers || '');
    if (!baseId) return true;
    const helpersOnly = !!button?.dataset?.pickerClearHelpers;
    const scope = button?.closest?.('.tower-picker-scope,.tower-picker-detail');
    syncPickerToggles(scope || button);
    const shift = loadShiftForAction(getScopeShiftFromElement(button));
    try { PNS.clearBase?.(baseId, helpersOnly); } catch {}
    saveCurrentShiftAction(true);
    try { PNS.setImportStatus?.(helpersOnly ? t('helpers_cleared','Помічників очищено') : t('turret_cleared','Турель очищено'), 'good'); } catch {}
    refreshTowerAction(scope);
    setCurrentShift(shift);
    return true;
  }

  function normalizeShiftForAdd(player){
    const normalize = value => {
      try {
        const normalized = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(value) : String(value || '');
        const out = String(normalized || '').toLowerCase();
        return /^shift[1-4]$/.test(out) || out === 'both' ? out : '';
      } catch { return ''; }
    };
    return normalize(player?.shift)
      || normalize(player?.shiftLabel)
      || normalize(player?.registeredShift)
      || normalize(player?.registeredShiftLabel)
      || (() => { try { const raw = player?.registeredShiftRaw || player?.raw?.shift_availability || ''; const mapped = raw && PNS.applyImportShiftRule?.(raw); return normalize(mapped); } catch { return ''; } })()
      || normalize(player?.registeredShiftRaw)
      || normalize(player?.raw?.shift_availability)
      || 'both';
  }

  function setPlayerShiftForAdd(player, shift){
    try { PNS.setPlayerShift?.(player, shift); return; } catch {}
    player.shift = shift;
    player.shiftLabel = typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(shift) : shiftLabel(shift);
    player.manualShiftOverride = true;
    player.registeredShift = shift;
    player.registeredShiftLabel = player.shiftLabel;
    if (player.rowEl) {
      player.rowEl.dataset.shift = shift;
      const cell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
      if (cell) cell.textContent = player.shiftLabel;
    }
  }

  function applyManualShiftAdds(){
    const panel = document.querySelector('#towerCalcModal #towerCalcShiftBalance');
    if (!panel) return false;
    const adds = {};
    for (let i = 1; i <= 4; i += 1) {
      const input = panel.querySelector(`[data-rs-kind="add"][data-rs-shift="${i}"] input`) || panel.querySelector(`#shiftAddS${i}`);
      const value = Math.max(0, Math.floor(Number(input?.value || 0)));
      if (value > 0) adds[`shift${i}`] = value;
    }
    if (!Object.keys(adds).length) return false;
    const players = Array.isArray(PNS.state?.players) ? PNS.state.players : [];
    const limits = {};
    for (let i = 1; i <= 4; i += 1) {
      const limitInput = panel.querySelector(`[data-rs-kind="limit"][data-rs-shift="${i}"] input`) || panel.querySelector(`#shiftLimitS${i}`);
      const limit = Math.max(0, Math.min(100, Math.floor(Number(limitInput?.value || 100))));
      limits[`shift${i}`] = Number.isFinite(limit) ? limit : 100;
    }
    const counts = { shift1:0, shift2:0, shift3:0, shift4:0, both:0 };
    players.forEach(player => { const sh = normalizeShiftForAdd(player); if (counts[sh] != null) counts[sh] += 1; else counts.both += 1; });
    const bothPlayers = players
      .filter(player => normalizeShiftForAdd(player) === 'both')
      .sort((a,b) => (Number(b?.tierRank||0)-Number(a?.tierRank||0)) || (Number(b?.march||0)-Number(a?.march||0)) || String(a?.name||'').localeCompare(String(b?.name||'')));
    const added = { shift1:0, shift2:0, shift3:0, shift4:0 };
    let index = 0;
    for (const shift of ['shift1','shift2','shift3','shift4']) {
      let need = Number(adds[shift] || 0);
      while (need > 0 && index < bothPlayers.length && counts[shift] < (limits[shift] || 100)) {
        const player = bothPlayers[index++];
        setPlayerShiftForAdd(player, shift);
        counts[shift] += 1;
        counts.both = Math.max(0, counts.both - 1);
        added[shift] += 1;
        need -= 1;
      }
    }
    try { PNS.savePlayersSnapshot?.(players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { PNS.refreshShiftUi?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try {
      PNS.setImportStatus?.(`Оновлено зміни: +${added.shift1} у Зміну 1, +${added.shift2} у Зміну 2, +${added.shift3} у Зміну 3, +${added.shift4} у Зміну 4.`, 'good');
    } catch {}
    return true;
  }

  function ensureBoardSignature(root){
    const area = root || document;
    area.querySelectorAll?.('.board-sheet').forEach(sheet => {
      if (sheet.querySelector('.board-signature')) return;
      const sig = document.createElement('div');
      sig.className = 'board-signature';
      sig.setAttribute('aria-label', 'Final plan signature');
      sig.innerHTML = '<img alt="Developed by Lwowsky" class="board-signature-image" decoding="async" src="img/board-signature-flatflags.svg" width="220" />';
      sheet.appendChild(sig);
    });
  }

  let running = false;
  function renderAll(){
    const modal = document.getElementById('towerCalcModal');
    if (!modal || running) return;
    running = true;
    try {
      installStyle();
      wrapRegionPlanApis();
      ensureRegionPlansForActiveRegion();
      wrapNativeRenderers();
      removeOldRegionUI();
      renderTowerTabs();
      renderAdvancedHeader();
      renderManualLimits();
      ensurePickerControls();
      renderSummary();
      removeLimitRegionUI();
      setCurrentShift(currentShift());
      try { ensureBoardSignature(document.getElementById('towerCalcModal') || document); } catch {}
      try { ensureBoardSignature(document.getElementById('board-modal') || document); } catch {}
    } finally {
      running = false;
    }
  }

  function rerenderAfterNative(){
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    renderAll();
    requestAnimationFrame(renderAll);
  }



  document.addEventListener('input', event => {
    const pickerToggle = event.target.closest('#towerCalcModal #pickerOnlyCaptains, #towerCalcModal #pickerMatchRegisteredShift, #towerCalcModal #pickerNoMixTroops, #towerCalcModal #pickerNoCrossShiftDupes');
    if (!pickerToggle) return;
    syncPickerToggles(pickerToggle.closest('.tower-picker-scope,.tower-picker-detail') || document.getElementById('towerCalcModal'));
  }, true);

  document.addEventListener('change', event => {
    const pickerToggle = event.target.closest('#towerCalcModal #pickerOnlyCaptains, #towerCalcModal #pickerMatchRegisteredShift, #towerCalcModal #pickerNoMixTroops, #towerCalcModal #pickerNoCrossShiftDupes');
    if (!pickerToggle) return;
    syncPickerToggles(pickerToggle.closest('.tower-picker-scope,.tower-picker-detail') || document.getElementById('towerCalcModal'));
    // Do not redraw the whole picker on checkbox change; that made the checkbox jump back.
  }, true);

  document.addEventListener('click', event => {
    const clearBaseBtn = event.target.closest('#towerCalcModal [data-picker-clear-base]');
    if (clearBaseBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clearPickerTower(clearBaseBtn, false);
      return;
    }
    const clearHelpersBtn = event.target.closest('#towerCalcModal [data-picker-clear-helpers]');
    if (clearHelpersBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clearPickerTower(clearHelpersBtn, true);
    }
  }, true);


  document.addEventListener('change', event => {
    const toggle = event.target.closest('#towerCalcModal [data-rs-picker-toggle], #towerCalcModal #pickerOnlyCaptains, #towerCalcModal #pickerMatchRegisteredShift, #towerCalcModal #pickerNoMixTroops, #towerCalcModal #pickerNoCrossShiftDupes');
    if (!toggle) return;
    const scope = toggle.closest('.tower-picker-scope,.tower-picker-detail') || document.getElementById('towerCalcModal');
    syncPickerToggles(scope);
  }, true);

  document.addEventListener('click', event => {
    const captainBtn = event.target.closest('#towerCalcModal [data-picker-set-captain]');
    if (captainBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      handleScopedCaptain(captainBtn);
      return;
    }
    const autofillBtn = event.target.closest('#towerCalcModal [data-picker-autofill]');
    if (autofillBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      handleScopedAutofill(autofillBtn);
      return;
    }
    const clearBtn = event.target.closest('#towerCalcModal [data-picker-clear-base], #towerCalcModal [data-picker-clear-helpers]');
    if (clearBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      handleScopedClearBase(clearBtn);
      return;
    }
    const applyShiftAddBtn = event.target.closest('#towerCalcModal #applyShiftAddBtn');
    if (applyShiftAddBtn) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      applyManualShiftAdds();
      return;
    }
  }, true);

  document.addEventListener('click', event => {
    const shiftBtn = event.target.closest('#towerCalcModal #towerCalcTabs [data-calc-tab]');
    if (!shiftBtn) return;
    const shift = String(shiftBtn.getAttribute('data-calc-tab') || '').toLowerCase();
    if (!SHIFTS.includes(shift)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    try {
      if (PNS.ModalsShift?.applyShiftFilter) PNS.ModalsShift.applyShiftFilter(shift);
      else setCurrentShift(shift);
    } catch { setCurrentShift(shift); }
    setCurrentShift(shift);
    rerenderAfterNative();
  }, true);

  document.addEventListener('click', event => {
    const regionBtn = event.target.closest('#towerCalcModal [data-rs-region-tab]');
    if (!regionBtn) return;
    const region = regionBtn.getAttribute('data-rs-region-tab') || '';
    if (!REGIONS.includes(region)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    setActiveRegion(region);
    renderAll();
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest('#towerCalcModal')) return;
    document.querySelectorAll('#towerCalcModal .rs-clear-menu.open').forEach(menu => {
      if (!menu.parentElement?.contains(event.target)) menu.classList.remove('open');
    });
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('#openTowerCalcBtn, #openTowerCalcBtnMobile, [data-modal="towerCalc"], [data-calc-main-tab], .tab-btn')) {
      setTimeout(renderAll, 0); requestAnimationFrame(renderAll);
    }
    if (event.target.closest('#towerCalcApplyAndAssignBtn, #towerCalcQuickApplyBtn, #towerCalcAutoFitBtn, #towerCalcApplyToTowersBtn')) {
      [20, 80, 180].forEach(ms => setTimeout(renderAll, ms));
    }
    if (event.target.closest('#towerCalcModal .tower-picker-item, #towerCalcModal .tower-thumb-card, #towerCalcModal .bases-grid .base-card, #towerCalcModal [data-preview-slot]')) {
      setTimeout(() => {
        setCurrentShift(currentShift());
        ensurePickerControls();
      }, 0);
    }
    if (event.target.closest('[data-import-region-shifts], [data-import-region-enable]')) {
      requestAnimationFrame(renderAll);
    }
  }, true);

  document.addEventListener('change', event => {
    const fillModeControl = event.target.closest('#towerCalcHelperFillModeSelect, #towerCalcHelperFillMode');
    if (fillModeControl) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setHelperFillMode(fillModeControl.value);
      renderSummary();
      renderManualLimits();
      stabilizeLimitButtons();
      removeLimitRegionUI();
      requestAnimationFrame(stabilizeLimitButtons);
      return;
    }

    if (event.target.closest('#towerCalcTierAuto, #towerCalcBoth50, #towerCalcModeUi, #towerCalcApplyModeUi')) {
      renderSummary();
      renderManualLimits();
      removeLimitRegionUI();
      requestAnimationFrame(() => { renderSummary(); renderManualLimits(); removeLimitRegionUI(); });
      return;
    }

    if (event.target.closest('[data-import-region-enable], [data-import-region-shifts], #tcv5EnableShiftLimits')) {
      renderAll();
      requestAnimationFrame(renderAll);
    }
  }, true);

  document.addEventListener('pns:dom:refreshed', () => { renderAll(); });
  document.addEventListener('pns:i18n-changed', () => { renderAll(); });
  window.addEventListener('resize', () => setTimeout(renderAll, 80));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderAll();
      [80, 180].forEach(ms => setTimeout(renderAll, ms));
    }, { once: true });
  } else {
    renderAll();
    [80, 180].forEach(ms => setTimeout(renderAll, ms));
  }
  window.addEventListener('load', () => [100, 250].forEach(ms => setTimeout(renderAll, ms)), { once: true });
  Object.assign(PNS, {
    getTowerCalcActiveRegion: activeRegion,
    setTowerCalcActiveRegion: function(region){
      const next = setActiveRegion(region);
      try { renderAll(); } catch {}
      return next;
    },
    getTowerCalcEnabledRegions: enabledRegions,
    getTowerCalcRegionLabel: regionLabel,
    getTowerCalcShiftCount: shiftCount,
    saveTowerCalcRegionShiftPlans: saveRegionShiftPlans,
    loadTowerCalcRegionShiftPlans: loadRegionShiftPlans,
    readTowerCalcRegionPlanStore: readRegionPlanStore,
    writeTowerCalcRegionPlanStore: writeRegionPlanStore
  });

  PNS.renderRegionShiftUi = renderAll;
})();

/* v55: keep tower picker scope on active shift before captain assignment */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const SHIFTS = ['shift1','shift2','shift3','shift4'];
  function getActiveShift(){
    let shift = '';
    try {
      const modal = document.getElementById('towerCalcModal');
      const btn = modal?.querySelector?.('#towerCalcTabs [data-calc-tab].is-active, #towerCalcTabs [data-calc-tab].active, #towerCalcTabs [data-calc-tab][aria-selected="true"]');
      shift = String(btn?.getAttribute('data-calc-tab') || '').toLowerCase();
    } catch {}
    if (!SHIFTS.includes(shift)) {
      try { shift = String(PNS.state?.towerCalc?.activeTab || PNS.state?.towerCalc?.activeShift || PNS.state?.activeShift || '').toLowerCase(); } catch {}
    }
    if (!SHIFTS.includes(shift)) shift = 'shift1';
    return shift;
  }
  document.addEventListener('pointerdown', (event) => {
    const button = event.target?.closest?.('[data-picker-set-captain],[data-picker-autofill],[data-picker-clear-base],[data-picker-clear-helpers]');
    if (!button || !button.closest('#towerCalcModal')) return;
    const shift = getActiveShift();
    const scope = button.closest('.tower-picker-scope,.tower-picker-detail');
    try { scope?.setAttribute?.('data-calc-inline-scope', shift); } catch {}
    /* Do not write activeTab here. The click handler loads the correct shift first. */
  }, true);
})();
