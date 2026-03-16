/* ==== shift-balance-actions.js ==== */
/* Shift balance UI shell, boot and event bindings */
(function(){
  const e = window.PNS;
  if (!e) return;
  const { state: t, $$: a } = e;

  function ensureTowerCalcShiftUi(){
    const shell = document.getElementById('towerCalcShiftBalance');
    if (!shell) return false;

    const cards = shell.querySelector('.tower-calc-shift-cards');
    if (cards) cards.style.display = 'none';

    const head = shell.querySelector('.tower-calc-shift-balance-head');
    const line = shell.querySelector('#towerCalcShiftCountsLine');
    if (head && line) {
      head.classList.add('tcv18-shift-balance-head');
      line.classList.add('tcv18-shift-counts-line');
    }

    const left = shell.querySelector('.tower-calc-shift-controls-left');
    if (!left) return true;

    const restoreBtn = shell.querySelector('#towerCalcRestoreImportShiftsBtn') || document.getElementById('towerCalcRestoreImportShiftsBtn');
    if (restoreBtn && restoreBtn.parentNode !== left) left.appendChild(restoreBtn);
    try { e.syncTowerCalcShiftLimitUi?.(); } catch {}
    return true;
  }

  function bindShiftUiActions(){
    if (t._shiftSplitUiBound) return;
    t._shiftSplitUiBound = true;

    document.addEventListener('click', evt => {
      if (!evt.target.closest('#applyShiftAddBtn')) return;
      evt.preventDefault();
      const shift1Add = Number(document.getElementById('shiftAddS1')?.value || 0);
      const shift2Add = Number(document.getElementById('shiftAddS2')?.value || 0);
      const force = !!document.getElementById('shiftSplitForceChk')?.checked;
      const limits = e.getTowerCalcShiftLimits();
      const result = e.addPlayersToShifts(t.players, { shift1Add, shift2Add, force, maxShift1: limits.shift1, maxShift2: limits.shift2 });
      try { e.savePlayersSnapshot?.(t.players); } catch {}
      try { e.applyPlayerTableFilters?.(); } catch {}
      try { e.refreshShiftUi?.(); } catch {}
      try {
        const warn = result.remaining?.shift1 || result.remaining?.shift2;
        e.setImportStatus?.(`Оновлено shifts: +${result.added1} у Shift 1, +${result.added2} у Shift 2. Зараз ${result.counts.shift1}/${result.counts.shift2}/${result.counts.both}.${warn ? ` Не вистачило місця по ліміту: S1 ${result.remaining.shift1 || 0}, S2 ${result.remaining.shift2 || 0}.` : ''}`, warn ? 'warn' : 'good');
      } catch {}
    });

    document.addEventListener('click', evt => {
      if (!evt.target.closest('#towerCalcRestoreImportShiftsBtn')) return;
      evt.preventDefault();
      const s1 = document.getElementById('shiftAddS1');
      const s2 = document.getElementById('shiftAddS2');
      const force = document.getElementById('shiftSplitForceChk');
      if (s1) s1.value = 0;
      if (s2) s2.value = 0;
      if (force) force.checked = false;
      const restored = e.restorePlayerShiftsFromImport(t.players);
      try { e.savePlayersSnapshot?.(t.players); } catch {}
      try { e.applyPlayerTableFilters?.(); } catch {}
      try { e.refreshShiftUi?.(); } catch {}
      try {
        e.setImportStatus?.(`Shifts відновлено з імпорту. Shift 1: ${restored.shift1}, Shift 2: ${restored.shift2}, Both: ${restored.both}${restored.unknown ? `, Невідомо: ${restored.unknown}` : ''}.`, restored.unknown ? 'warn' : 'good');
      } catch {}
    });

    document.addEventListener('change', evt => {
      if (!evt.target.closest('#shiftLimitS1,#shiftLimitS2')) return;
      const limits = e.syncTowerCalcShiftLimitUi();
      try { e.refreshShiftUi?.(); } catch {}
      try { e.setImportStatus?.(`Оновлено ліміти змін: Зміна 1 — ${limits.shift1}, Зміна 2 — ${limits.shift2}.`, 'good'); } catch {}
    });
  }

  function bootstrap(){
    e.ensurePlayersLinked?.();
    try { ensureTowerCalcShiftUi(); } catch {}
    try { e.syncTowerCalcShiftLimitUi?.(); } catch {}
    try { e.updateShiftBreakdownUI?.(); } catch {}
  }

  e.ensureTowerCalcShiftUi = ensureTowerCalcShiftUi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  document.addEventListener('players-table-rendered', () => {
    try { ensureTowerCalcShiftUi(); } catch {}
    try { e.syncTowerCalcShiftLimitUi?.(); } catch {}
    try { e.updateShiftBreakdownUI?.(); } catch {}
  });

  document.addEventListener('pns:dom:refreshed', () => {
    e.ensurePlayersLinked?.();
    try { ensureTowerCalcShiftUi(); } catch {}
    try { e.syncTowerCalcShiftLimitUi?.(); } catch {}
    try { e.updateShiftBreakdownUI?.(); } catch {}
  });

  bindShiftUiActions();
})();
