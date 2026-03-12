(function () {
  const PNS = window.PNS || {};
  const I18N = window.PNSI18N || {};
  const roleLabel = (v, plural=false) => typeof I18N.roleLabel === 'function' ? I18N.roleLabel(v, plural) : String(v || '');
  const shiftLabel = (v) => typeof I18N.shiftLabel === 'function' ? I18N.shiftLabel(v) : String(v || '');
  const towerLabel = (v) => typeof I18N.towerLabel === 'function' ? I18N.towerLabel(v) : String(v || '');

  function localize(root=document) {
    document.documentElement.lang = 'uk';
    root.querySelectorAll('#topRoleFilter').forEach((select) => Array.from(select.options || []).forEach((opt) => {
      const raw = String(opt.value || opt.textContent || '');
      if (/^all$/i.test(raw)) opt.textContent = 'Усі';
      else opt.textContent = roleLabel(raw, true);
    }));
    root.querySelectorAll('#tpeRole,#pickerManualRole').forEach((select) => Array.from(select.options || []).forEach((opt) => opt.textContent = roleLabel(opt.value || opt.textContent, false)));
    root.querySelectorAll('#topShiftFilter,#tpePlacementShift').forEach((select) => Array.from(select.options || []).forEach((opt) => opt.textContent = shiftLabel(opt.value || opt.textContent)));
    root.querySelectorAll('.tag--role').forEach((el) => el.textContent = roleLabel(el.textContent, false));
    root.querySelectorAll('.shift-badge,.player-placement-shift,.shift-tab,.board-shift-tab,[data-shift-tab]').forEach((el) => {
      const txt = String(el.textContent || '').trim(); if (txt) el.textContent = shiftLabel(txt);
    });
    root.querySelectorAll('.tower-thumb-name,.player-placement-item strong').forEach((el) => {
      const txt = String(el.textContent || '').trim(); if (txt) el.textContent = towerLabel(txt);
    });
    root.querySelectorAll('.player-placement-item small').forEach((el) => {
      const txt = String(el.textContent || '').trim();
      if (/^captain$/i.test(txt)) el.textContent = 'Капітан';
      else if (/^helper$/i.test(txt)) el.textContent = 'Помічник';
      else if (/not assigned/i.test(txt)) el.textContent = 'Не призначено';
    });
    const info = root.querySelector('#pageInfoText');
    if (info) {
      const m = String(info.textContent || '').match(/(?:Page|Сторінка)\s+(\d+)\s*\/\s*(\d+)(?:\s*•\s*(?:shown|показано)\s*(\d+)|\s*•\s*(\d+)\s*shown)?/i);
      if (m) info.textContent = (m[3] || m[4]) ? `Сторінка ${m[1]} / ${m[2]} • показано ${m[3] || m[4]}` : `Сторінка ${m[1]} / ${m[2]}`;
    }
  }
  ['DOMContentLoaded','htmx:afterSwap','htmx:afterSettle','players-table-rendered','players-table-data-changed','players-table-filters-changed','pns:assignment-changed'].forEach((evt) => document.addEventListener(evt, () => localize(document)));
  if (document.readyState !== 'loading') localize(document);
})();
