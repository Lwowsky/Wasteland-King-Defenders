/* Hotfix: make Player Status respect the user's Shift Recognition merge rules. */
(function(){
  const PNS = window.PNS = window.PNS || {};

  function label(key){
    try {
      if (typeof PNS.formatShiftLabelForCell === 'function') return PNS.formatShiftLabelForCell(key);
      if (typeof PNS.shiftLabel === 'function') return PNS.shiftLabel(key);
      if (typeof PNS.t === 'function') return PNS.t(key, key === 'both' ? 'Всі' : `Зміна ${String(key).replace('shift','')}`);
    } catch {}
    return key === 'both' ? 'Всі' : `Зміна ${String(key).replace('shift','')}`;
  }

  function rawShiftForPlayer(player){
    if (!player) return '';
    const mappingField = PNS.state?.importData?.mapping?.shift_availability;
    const candidates = [];
    const push = (value) => { const text = String(value ?? '').trim(); if (text) candidates.push(text); };
    push(player.registeredShiftRaw);
    if (mappingField && player.raw) push(player.raw[mappingField]);
    push(player.raw?.shift_availability);
    if (player.raw && typeof player.raw === 'object') {
      Object.keys(player.raw).forEach(key => {
        if (/(shift|availability|зміна|змiна|смена|черга|очеред)/i.test(String(key || ''))) push(player.raw[key]);
      });
    }
    push(player.registeredShift);
    push(player.shift);
    push(player.registeredShiftLabel);
    push(player.shiftLabel);
    return candidates[0] || '';
  }

  function resolveMergedShift(raw, player){
    try {
      if (raw && typeof PNS.applyImportShiftRule === 'function') {
        const mapped = String(PNS.applyImportShiftRule(raw) || '').toLowerCase();
        if (/^shift[1-4]$/.test(mapped) || mapped === 'both') return mapped;
        if (mapped === 'ignore') return '';
      }
    } catch {}
    try {
      const normalized = String(PNS.normalizeShiftValue?.(raw || player?.shift || player?.registeredShift || player?.shiftLabel || '') || '').toLowerCase();
      if (/^shift[1-4]$/.test(normalized) || normalized === 'both') return normalized;
    } catch {}
    const text = String(raw || player?.shift || player?.registeredShift || '').toLowerCase().trim();
    return /^shift[1-4]$/.test(text) || text === 'both' ? text : '';
  }

  function applyMergedShiftsToCurrentPlayers(){
    const players = Array.isArray(PNS.state?.players) ? PNS.state.players : [];
    let changed = 0;
    players.forEach(player => {
      if (!player || player.manualShiftOverride) return;
      const raw = rawShiftForPlayer(player);
      const merged = resolveMergedShift(raw, player);
      if (!(/^shift[1-4]$/.test(merged) || merged === 'both')) return;
      if (player.shift !== merged || player.registeredShift !== merged || player.shiftLabel !== label(merged)) {
        player.shift = merged;
        player.registeredShift = merged;
        player.registeredShiftLabel = label(merged);
        player.shiftLabel = label(merged);
        if (player.rowEl) {
          player.rowEl.dataset.shift = merged;
          const cell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
          if (cell) cell.textContent = label(merged);
        }
        changed += 1;
      }
    });
    if (changed) {
      try { PNS.savePlayersSnapshot?.(players); } catch {}
      try { PNS.applyPlayerTableFilters?.({ debounceMs: 0 }); } catch { try { PNS.applyPlayerTableFilters?.(); } catch {} }
      try { PNS.updateShiftBreakdownUI?.(); } catch {}
      try { PNS.renderAll?.(); } catch {}
      try { window.computeTowerCalcResults?.(); } catch {}
      try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
      try { PNS.towerCalcRefreshStatusPlayersUi?.(document.getElementById('towerCalcModal') || document); } catch {}
      try { document.dispatchEvent(new CustomEvent('pns:import-shift-merge-reapplied', { detail:{ changed } })); } catch {}
    }
    return changed;
  }

  let timer = 0;
  function runSoon(){
    clearTimeout(timer);
    timer = setTimeout(() => applyMergedShiftsToCurrentPlayers(), 40);
  }

  PNS.reapplyImportShiftMergeToPlayers = applyMergedShiftsToCurrentPlayers;
  PNS.repairShift34PlayerStatus = applyMergedShiftsToCurrentPlayers;

  ['DOMContentLoaded','players-table-data-changed','pns:region-shifts-changed','pns:import-shift-rules-applied','pns:manual-shift-add-applied','change'].forEach(name => {
    document.addEventListener(name, runSoon, true);
  });
  window.addEventListener?.('pns:import-shift-rules-applied', runSoon);
  runSoon();
  setTimeout(runSoon, 300);
  setTimeout(runSoon, 1200);
})();
