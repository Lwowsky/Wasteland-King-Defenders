(function(){
  const PNS = window.PNS = window.PNS || {};
  const I18N = window.PNSI18N = window.PNSI18N || {};
  const DICTS = window.PNSI18N_DICTS = window.PNSI18N_DICTS || {};

  const baseT = typeof PNS.t === 'function'
    ? PNS.t.bind(PNS)
    : (key, fallback='') => {
        const locale = String(I18N.locale || document.documentElement.dataset.locale || 'uk').toLowerCase();
        return (DICTS[locale] && DICTS[locale][key]) || (DICTS.uk && DICTS.uk[key]) || fallback || key;
      };

  const baseShiftLabel = typeof PNS.shiftLabel === 'function'
    ? PNS.shiftLabel.bind(PNS)
    : (value) => String(value || '');

  function readJson(key, fallback){
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  const MODE_KEY = 'pns_dynamic_both_label_mode_v1';

  function readStoredMode(){
    try {
      const value = String(localStorage.getItem(MODE_KEY) || '').toLowerCase();
      return value === 'all' || value === 'both' ? value : '';
    } catch {
      return '';
    }
  }

  function writeStoredMode(mode){
    try {
      if (mode === 'all' || mode === 'both') localStorage.setItem(MODE_KEY, mode);
    } catch {}
  }

  function homeShiftInfo(){
    try {
      const settings = readJson('pns_import_region_shift_settings_v1', null);
      const shifts = settings?.regions?.region1?.shifts || null;
      const selected = shifts ? ['1','2','3','4'].find((n) => !!shifts[n]) : '';
      if (selected) return { count: Math.max(1, Math.min(4, Number(selected) || 2)), explicit:true };
    } catch {}
    return { count: readStoredMode() === 'all' ? 4 : 2, explicit:false };
  }

  function effectiveShiftInfo(){
    const base = homeShiftInfo();
    const baseCount = base.count;
    const merge = readJson('pns_import_shift_merge_v1', null) || {};
    const mode = String(merge.mode || 'custom');

    if (mode === 'all_to_1') return { count:1, explicit:base.explicit || !!merge.mode };
    if (mode === 'pair12_34') return { count:Math.min(2, Math.max(1, baseCount)), explicit:base.explicit || !!merge.mode };

    if (mode === 'custom') {
      const custom = merge.custom && typeof merge.custom === 'object' ? merge.custom : {};
      const sources = Array.from({ length: Math.max(1, Math.min(4, baseCount)) }, (_, index) => `shift${index + 1}`);
      const targets = new Set();
      for (const source of sources) {
        const target = String(custom[source] || source).toLowerCase();
        if (/^shift[1-4]$/.test(target)) targets.add(target);
      }
      if (targets.size) return { count:Math.max(1, Math.min(4, targets.size)), explicit:base.explicit || !!merge.mode };
    }

    return base;
  }

  function effectiveShiftCount(){
    return effectiveShiftInfo().count;
  }

  function useBothWord(){
    const info = effectiveShiftInfo();
    const mode = info.count <= 2 ? 'both' : 'all';
    if (info.explicit) writeStoredMode(mode);
    return mode === 'both';
  }

  function labelBoth(){
    return useBothWord()
      ? baseT('both_dynamic_two', baseT('both', 'Both'))
      : baseT('both_dynamic_many', baseT('all', 'All'));
  }

  function labelUseBoth(){
    return useBothWord()
      ? baseT('use_both_dynamic_two', baseT('use_both', 'Use “Both”'))
      : baseT('use_both_dynamic_many', baseT('use_all', 'Use “All”'));
  }

  function dynamicT(key, fallback=''){
    if (key === 'both') return labelBoth();
    if (key === 'shift_recognition_all') return labelBoth();
    if (key === 'use_both') return labelUseBoth();
    return baseT(key, fallback);
  }

  function dynamicShiftLabel(value){
    const key = String(value || '').toLowerCase();
    if (key === 'both') return labelBoth();
    return baseShiftLabel(value);
  }

  function refreshBothText(root=document){
    try {
      const label = labelBoth();
      const useLabel = labelUseBoth();
      writeStoredMode(useBothWord() ? 'both' : 'all');

      (root.querySelectorAll ? root : document).querySelectorAll('[data-i18n="both"],[data-i18n="shift_recognition_all"]').forEach((el) => {
        el.textContent = label;
      });
      (root.querySelectorAll ? root : document).querySelectorAll('[data-i18n="use_both"]').forEach((el) => {
        el.textContent = useLabel;
      });

      document.querySelectorAll('td[data-field="shiftLabel"], [data-shift-label-cell]').forEach((el) => {
        const row = el.closest('[data-shift], tr[data-shift]');
        if (String(row?.dataset?.shift || '').toLowerCase() === 'both') el.textContent = label;
      });

      document.querySelectorAll('option[value="both"]').forEach((option) => {
        option.textContent = label;
      });

      document.querySelectorAll('[data-shift-pill="both"], [data-shift-card="both"]').forEach((el) => {
        el.textContent = label;
      });
    } catch {}
  }

  PNS.t = dynamicT;
  window.t = dynamicT;
  PNS.shiftLabel = dynamicShiftLabel;
  PNS.formatShiftLabelForCell = function(value){
    const key = String(value || '').toLowerCase();
    if (key === 'both') return labelBoth();
    if (/^shift[1-4]$/.test(key)) return dynamicShiftLabel(key);
    try { return dynamicShiftLabel(PNS.normalizeShiftValue ? PNS.normalizeShiftValue(value) : value); } catch { return String(value || ''); }
  };
  PNS.getBothDisplayLabel = labelBoth;
  PNS.getBothDisplayMode = () => useBothWord() ? 'both' : 'all';
  PNS.getEffectiveShiftCountForLabels = effectiveShiftCount;
  PNS.refreshDynamicBothLabels = refreshBothText;

  const oldApply = I18N.apply;
  if (typeof oldApply === 'function' && !oldApply.__pnsDynamicBothWrapped) {
    const wrapped = function(root){
      const result = oldApply.apply(this, arguments);
      try { refreshBothText(root || document); } catch {}
      return result;
    };
    wrapped.__pnsDynamicBothWrapped = true;
    I18N.apply = wrapped;
    PNS.applyI18n = wrapped;
  }

  try { refreshBothText(document); } catch {}
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => refreshBothText(document), 20));
  window.addEventListener('storage', (event) => {
    if (String(event.key || '').includes('shift') || String(event.key || '').includes('merge')) setTimeout(() => refreshBothText(document), 30);
  });
  document.addEventListener('pns:region-shifts-changed', () => setTimeout(() => refreshBothText(document), 30));
  document.addEventListener('pns:dom:refreshed', () => setTimeout(() => refreshBothText(document), 30));
  document.addEventListener('change', (event) => {
    if (event.target?.matches?.('#shiftRecognitionMergeMode,[data-shift-merge-source]')) setTimeout(() => refreshBothText(document), 50);
  }, true);
})();