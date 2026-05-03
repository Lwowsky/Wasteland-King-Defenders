/* ==== import-shift-review.js ==== */
/* Import wizard: review detected shift values and optionally merge shifts */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const wiz = PNS.ImportWizard = PNS.ImportWizard || {};
  const state = PNS.state || {};
  const RULES_KEY = 'pns_import_shift_review_rules_v1';

  const tr = (key, fallback='') => {
    try { return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (wiz.translate?.(key, fallback) || fallback || key); }
    catch { return fallback || key; }
  };

  const SHIFT_VALUES = ['shift1','shift2','shift3','shift4','both','ignore'];

  function readConfig(){
    try {
      const parsed = JSON.parse(localStorage.getItem(RULES_KEY) || 'null');
      if (parsed && typeof parsed === 'object') return {
        rules: parsed.rules && typeof parsed.rules === 'object' ? parsed.rules : {},
        mergeMode: parsed.mergeMode || 'none',
        customMerge: parsed.customMerge && typeof parsed.customMerge === 'object' ? parsed.customMerge : {},
      };
    } catch {}
    return { rules:{}, mergeMode:'none', customMerge:{} };
  }

  function writeConfig(config){
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify({
        rules: config?.rules && typeof config.rules === 'object' ? config.rules : {},
        mergeMode: config?.mergeMode || 'none',
        customMerge: config?.customMerge && typeof config.customMerge === 'object' ? config.customMerge : {},
      }));
    } catch {}
  }

  function normalizeText(value){
    return String(value ?? '').normalize('NFKC').trim();
  }

  function detectTimeOption(value){
    const raw = normalizeText(value).toLowerCase();
    if (!raw) return '';
    const compact = raw
      .replace(/[–—−]/g, '-')
      .replace(/[〜～]/g, '~')
      .replace(/\s+/g, '')
      .replace(/[・•·,;|]+/g, '·');

    if (/alltime|all-time|all_time|allshifts?|anyshift|anytime|any-time|全シフト|すべて|全部|両方/.test(compact) || /\ball\s*time\b|\bany\s*time\b|\ball\s*shifts?\b|\bany\s*shift\b/.test(raw)) return 'both';

    if (/utc10:?00?~12:?00?/.test(compact) || /mos13:?00?~15:?00?/.test(compact) || /(kor|jpn)19:?00?~21:?00?/.test(compact)) return 'shift1';
    if (/utc12:?00?~14:?00?/.test(compact) || /mos15:?00?~17:?00?/.test(compact) || /(kor|jpn)21:?00?~23:?00?/.test(compact)) return 'shift2';
    if (/utc14:?00?~16:?00?/.test(compact) || /mos17:?00?~19:?00?/.test(compact) || /(kor|jpn)23:?00?~1:?00?/.test(compact)) return 'shift3';
    if (/utc16:?00?~18:?00?/.test(compact) || /mos19:?00?~21:?00?/.test(compact) || /(kor|jpn)1:?00?~3:?00?/.test(compact)) return 'shift4';

    return '';
  }

  function detectShift(value){
    const time = detectTimeOption(value);
    if (time) return time;
    try {
      const normalized = String(PNS.normalizeShiftValue?.(value) || '').toLowerCase();
      if (/^shift[1-4]$/.test(normalized) || normalized === 'both') return normalized;
    } catch {}
    return 'both';
  }

  function shiftLabel(value){
    const key = String(value || '').toLowerCase();
    if (key === 'shift1') return tr('shift1', 'Зміна 1');
    if (key === 'shift2') return tr('shift2', 'Зміна 2');
    if (key === 'shift3') return tr('shift3', 'Зміна 3');
    if (key === 'shift4') return tr('shift4', 'Зміна 4');
    if (key === 'ignore') return tr('shift_review_ignore', 'Ігнорувати');
    return tr('both', 'Всі');
  }


  function getActiveConfiguredShiftCount(){
    try {
      const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null') || {};
      const region = localStorage.getItem('pns_tower_calc_active_region_v1') || settings.activeRegion || 'region1';
      const shifts = settings?.regions?.[region]?.shifts || settings?.regions?.region1?.shifts || {};
      const selected = ['4','3','2','1'].find(n => !!shifts[n]) || '2';
      return Math.max(1, Math.min(4, Number(selected) || 2));
    } catch { return 2; }
  }
  function keepDistinctShift34(){ return getActiveConfiguredShiftCount() >= 3; }
  function applyMerge(shift, config = readConfig()){
    const source = String(shift || '').toLowerCase();
    if (source === 'ignore') return 'ignore';
    if (source === 'both') return 'both';
    if (!/^shift[1-4]$/.test(source)) return 'both';

    const mode = String(config.mergeMode || 'none');
    if (mode === 'merge_12_34') {
      if (source === 'shift1' || source === 'shift2') return 'shift1';
      if (source === 'shift3' || source === 'shift4') return 'shift2';
    }
    if (mode === 'merge_13_24') {
      if (source === 'shift1' || source === 'shift3') return 'shift1';
      if (source === 'shift2' || source === 'shift4') return 'shift2';
    }
    if (mode === 'custom') {
      const mapped = String(config.customMerge?.[source] || source).toLowerCase();
      return SHIFT_VALUES.includes(mapped) ? mapped : source;
    }
    return source;
  }

  function resolveImportShiftValue(rawValue){
    const config = readConfig();
    const raw = normalizeText(rawValue);
    const base = config.rules && Object.prototype.hasOwnProperty.call(config.rules, raw)
      ? String(config.rules[raw] || 'both')
      : detectShift(raw);
    return applyMerge(base, config);
  }

  function getShiftColumn(){
    const mapping = state.importData?.mapping || {};
    return mapping.shift_availability || '';
  }

  function getUniqueValues(){
    const header = getShiftColumn();
    const map = new Map();
    if (!header) return [];
    (state.importData?.rows || []).forEach((row) => {
      const raw = normalizeText(row?.[header] ?? '');
      if (!raw) return;
      const entry = map.get(raw) || { value: raw, count: 0 };
      entry.count += 1;
      map.set(raw, entry);
    });
    return Array.from(map.values());
  }

  function optionHtml(selected){
    return SHIFT_VALUES.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${PNS.escapeHtml?.(shiftLabel(value)) || shiftLabel(value)}</option>`).join('');
  }

  function syncCustomOptions(config = readConfig()){
    document.querySelectorAll('[data-shift-review-merge]').forEach((select) => {
      const from = select.dataset.shiftReviewMerge;
      select.innerHTML = ['shift1','shift2','shift3','shift4','both','ignore']
        .map((value) => `<option value="${value}">${PNS.escapeHtml?.(shiftLabel(value)) || shiftLabel(value)}</option>`)
        .join('');
      select.value = config.customMerge?.[from] || from;
    });
  }

  function collectConfigFromDom(){
    const current = readConfig();
    const rules = { ...current.rules };
    document.querySelectorAll('[data-shift-review-raw]').forEach((select) => {
      const raw = select.dataset.shiftReviewRaw || '';
      if (raw) rules[raw] = select.value || detectShift(raw);
    });
    const mergeMode = document.getElementById('shiftReviewMergeMode')?.value || current.mergeMode || 'none';
    const customMerge = { ...current.customMerge };
    document.querySelectorAll('[data-shift-review-merge]').forEach((select) => {
      const from = select.dataset.shiftReviewMerge;
      if (from) customMerge[from] = select.value || from;
    });
    return { rules, mergeMode, customMerge };
  }

  function setStatus(text, tone=''){
    const el = document.getElementById('shiftReviewStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = `shift-review-status muted small ${tone || ''}`.trim();
  }

  function render(){
    const panel = document.getElementById('importShiftReviewPanel');
    if (!panel) return;

    const config = readConfig();
    const mode = document.getElementById('shiftReviewMergeMode');
    if (mode && mode.value !== config.mergeMode) mode.value = config.mergeMode || 'none';

    const customHost = document.getElementById('shiftReviewCustomMerge');
    if (customHost) customHost.hidden = (mode?.value || config.mergeMode || 'none') !== 'custom';
    syncCustomOptions(config);

    const tbody = document.getElementById('shiftReviewRows');
    if (!tbody) return;
    tbody.innerHTML = '';

    const values = getUniqueValues();
    if (!getShiftColumn()) {
      setStatus(tr('shift_review_no_column', 'Спочатку прив’яжи колонку зміни в обов’язкових колонках.'), 'warn');
      return;
    }
    if (!values.length) {
      setStatus(tr('shift_review_empty_loaded', 'У вибраній колонці зміни немає значень.'), 'warn');
      return;
    }

    values.forEach((item) => {
      const saved = Object.prototype.hasOwnProperty.call(config.rules || {}, item.value) ? config.rules[item.value] : detectShift(item.value);
      const after = applyMerge(saved, config);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><div class="shift-review-value"></div></td>
        <td><select class="shift-review-row-select" data-shift-review-raw=""></select></td>
        <td><span class="shift-review-after ${after === 'ignore' ? 'is-ignore' : ''}"></span></td>
        <td>${Number(item.count || 0).toLocaleString('en-US')}</td>`;
      row.querySelector('.shift-review-value').textContent = item.value;
      const select = row.querySelector('[data-shift-review-raw]');
      select.dataset.shiftReviewRaw = item.value;
      select.innerHTML = optionHtml(saved);
      row.querySelector('.shift-review-after').textContent = shiftLabel(after);
      select.addEventListener('change', () => {
        const next = collectConfigFromDom();
        const merged = applyMerge(select.value, next);
        row.querySelector('.shift-review-after').textContent = shiftLabel(merged);
        row.querySelector('.shift-review-after').classList.toggle('is-ignore', merged === 'ignore');
      });
      tbody.appendChild(row);
    });

    setStatus(tr('shift_review_found_values', 'Перевір знайдені значення перед імпортом.') + ` ${values.length}`, 'good');
    try { PNSI18N?.apply?.(panel); } catch {}
  }

  function saveRules(){
    const config = collectConfigFromDom();
    writeConfig(config);
    render();
    try { wiz.saveImportTemplate?.({ silent: true }); } catch {}
    try { wiz.setImportStatus?.(tr('shift_review_saved', 'Правила розпізнавання змін збережено.'), 'good'); } catch {}
  }

  function autoDetect(){
    const config = readConfig();
    const rules = {};
    getUniqueValues().forEach((item) => { rules[item.value] = detectShift(item.value); });
    writeConfig({ ...config, rules });
    render();
    try { wiz.setImportStatus?.(tr('shift_review_auto_done', 'Зміни розпізнано автоматично. Перевір результат.'), 'good'); } catch {}
  }

  function resetRules(){
    const config = readConfig();
    writeConfig({ ...config, rules:{}, mergeMode:'none', customMerge:{} });
    render();
    try { wiz.setImportStatus?.(tr('shift_review_reset_done', 'Правила змін скинуто.'), 'good'); } catch {}
  }

  function applyMergedShiftSettings(players){
    try {
      const max = (players || []).reduce((out, player) => {
        const shift = String(player?.shift || player?.registeredShift || '').toLowerCase();
        const match = shift.match(/^shift([1-4])$/);
        return match ? Math.max(out, Number(match[1]) || 0) : out;
      }, 0);
      const count = Math.max(1, Math.min(4, max || 2));
      const key = 'pns_import_region_shift_settings_v1';
      const current = JSON.parse(localStorage.getItem(key) || 'null') || {};
      current.activeRegion = current.activeRegion || 'region1';
      current.regions = current.regions || {};
      current.regions.region1 = current.regions.region1 || { enabled:true, shifts:{} };
      current.regions.region1.enabled = true;
      current.regions.region1.shifts = { '1': count === 1, '2': count === 2, '3': count === 3, '4': count === 4 };
      current.regions.region2 = current.regions.region2 || { enabled:false, shifts:{ '1': false, '2': true, '3': false, '4': false } };
      current.regions.region3 = current.regions.region3 || { enabled:false, shifts:{ '1': false, '2': true, '3': false, '4': false } };
      localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail:{ source:'shift-review', count } }));
    } catch {}
  }

  function bind(){
    document.getElementById('shiftReviewSaveRulesBtn')?.addEventListener('click', saveRules);
    document.getElementById('shiftReviewAutoBtn')?.addEventListener('click', autoDetect);
    document.getElementById('shiftReviewResetBtn')?.addEventListener('click', resetRules);
    document.getElementById('shiftReviewMergeMode')?.addEventListener('change', () => {
      const config = collectConfigFromDom();
      writeConfig(config);
      render();
    });
    document.querySelectorAll('[data-shift-review-merge]').forEach((select) => {
      select.addEventListener('change', () => {
        writeConfig(collectConfigFromDom());
        render();
      });
    });
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.('select[data-map-field="shift_availability"]')) {
        setTimeout(render, 0);
      }
    }, true);
  }

  PNS.resolveImportShiftValue = resolveImportShiftValue;
  PNS.applyImportShiftReviewMerge = applyMerge;
  PNS.ImportShiftReview = {
    readConfig,
    writeConfig,
    detectShift,
    resolveImportShiftValue,
    applyMerge,
    applyMergedShiftSettings,
    render,
    saveRules,
    autoDetect,
    resetRules,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); render(); }, { once:true });
  } else {
    bind();
    setTimeout(render, 0);
  }
})();
