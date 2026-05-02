(function(){
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state || {};
  const DELETED_KEY = 'pns_deleted_player_ids_v1';
  const tr = (k, f='') => typeof PNS.t === 'function' ? PNS.t(k, f) : f;

  function readDeletedIds(){
    try {
      const list = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
      return new Set((Array.isArray(list) ? list : []).map(String).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  function writeDeletedIds(ids){
    try { localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(ids || []).map(String).filter(Boolean))); } catch {}
  }

  function markDeleted(id){
    const ids = readDeletedIds();
    const clean = String(id || '').trim();
    if (clean) ids.add(clean);
    writeDeletedIds(ids);
  }

  function normalizeShift(value){
    try {
      const normalized = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(value) : String(value || '').toLowerCase();
      return /^shift[1-4]$/.test(normalized) || normalized === 'both' ? normalized : '';
    } catch {
      return '';
    }
  }

  function playerPreferredShift(player){
    if (!player) return '';
    if (player.manualShiftOverride) return normalizeShift(player.shift || player.shiftLabel || player.registeredShift || player.registeredShiftLabel || '');
    try {
      const registered = typeof PNS.getRegisteredShiftForPlayer === 'function' ? PNS.getRegisteredShiftForPlayer(player) : '';
      const normalized = normalizeShift(registered);
      if (/^shift[1-4]$/.test(normalized)) return normalized;
    } catch {}
    return normalizeShift(player.shift || player.registeredShift || player.shiftLabel || player.registeredShiftLabel || '');
  }

  function removeFromPlanObject(plan, playerId){
    const id = String(playerId || '');
    if (!id || !plan || typeof plan !== 'object') return;
    if (plan.players && typeof plan.players === 'object') delete plan.players[id];
    const bases = plan.bases && typeof plan.bases === 'object' ? plan.bases : {};
    Object.values(bases).forEach(base => {
      if (!base || typeof base !== 'object') return;
      if (String(base.captainId || '') === id) base.captainId = '';
      if (Array.isArray(base.helperIds)) base.helperIds = base.helperIds.filter(x => String(x || '') !== id);
    });
  }

  function removePlayerFromAssignments(playerId){
    const id = String(playerId || '');
    const st = PNS.state || {};
    if (!id) return;
    (Array.isArray(st.bases) ? st.bases : []).forEach(base => {
      if (!base) return;
      if (String(base.captainId || '') === id) { base.captainId = null; base.role = null; }
      if (Array.isArray(base.helperIds)) base.helperIds = base.helperIds.filter(x => String(x || '') !== id);
    });
    const plans = st.shiftPlans && typeof st.shiftPlans === 'object' ? st.shiftPlans : {};
    Object.values(plans).forEach(plan => removeFromPlanObject(plan, id));
    try {
      const raw = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}') || {};
      Object.values(raw).forEach(plan => removeFromPlanObject(plan, id));
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify(raw));
    } catch {}
    try {
      const store = PNS.readTowerCalcRegionPlanStore?.();
      if (store && typeof store === 'object') {
        Object.values(store).forEach(regionPlans => {
          if (!regionPlans || typeof regionPlans !== 'object') return;
          Object.values(regionPlans).forEach(plan => removeFromPlanObject(plan, id));
        });
        PNS.writeTowerCalcRegionPlanStore?.(store);
      }
    } catch {}
  }

  function deleteRosterPlayer(playerId){
    const id = String(playerId || '').trim();
    const st = PNS.state || {};
    if (!id) return false;
    const player = (Array.isArray(st.players) ? st.players : []).find(p => String(p?.id || '') === id);
    const name = player?.name || '';
    if (!confirm(`${tr('delete_player_confirm','Delete player from the table?')}${name ? ' ' + name : ''}`)) return false;

    markDeleted(id);
    removePlayerFromAssignments(id);
    st.players = (Array.isArray(st.players) ? st.players : []).filter(p => String(p?.id || '') !== id);
    st.playerById = new Map(st.players.map(p => [String(p.id || ''), p]));

    try { PNS.applyDeletedPlayersFilter?.(); } catch {}
    try { PNS.savePlayersSnapshot?.(st.players); } catch {}
    try { PNS.saveTowerCalcRegionShiftPlans?.(undefined, { skipSnapshot: true }); } catch {}
    try { PNS.renderPlayersTableFromState?.(); } catch {}
    try { PNS.buildRowActions?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {}
    try { PNS.persistSessionStateSoon?.(20); } catch {}
    return true;
  }

  PNS.deleteRosterPlayer = deleteRosterPlayer;

  function ensureDeleteButton(modal){
    if (!modal || modal.querySelector('#tpeDeletePlayerBtn')) return;
    const removeBtn = modal.querySelector('#tpeRemoveBtn');
    if (!removeBtn) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-danger';
    btn.id = 'tpeDeletePlayerBtn';
    btn.textContent = tr('delete_player','Delete player');
    removeBtn.insertAdjacentElement('afterend', btn);
  }

  function fixRosterEditShift(modal){
    try {
      if (!modal || modal.dataset.mode !== 'roster') return;
      const id = String(modal.dataset.playerId || '');
      const player = PNS.state?.playerById?.get?.(id) || (PNS.state?.players || []).find(p => String(p?.id || '') === id);
      const shift = playerPreferredShift(player);
      const select = modal.querySelector('#tpePlacementShift');
      if (select && /^shift[1-4]$/.test(shift)) {
        if (!Array.from(select.options).some(opt => opt.value === shift)) {
          const opt = document.createElement('option');
          opt.value = shift;
          opt.textContent = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : shift;
          select.appendChild(opt);
        }
        select.value = shift;
      }
    } catch {}
  }

  function patchRosterEditOpen(){
    const api = PNS.ModalsShift;
    if (!api || api.__v94RosterEditPatched || typeof api.openRosterPlayerEditModal !== 'function') return false;
    api.__v94RosterEditPatched = true;
    const original = api.openRosterPlayerEditModal;
    api.openRosterPlayerEditModal = function(playerId){
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const modal = document.getElementById('towerPlayerEditModal');
        ensureDeleteButton(modal);
        fixRosterEditShift(modal);
        try {
          const btn = modal?.querySelector('#tpeDeletePlayerBtn');
          if (btn) btn.hidden = false;
        } catch {}
      }, 0);
      return result;
    };
    return true;
  }

  function patchTowerEditOpen(){
    const api = PNS.ModalsShift;
    if (!api || api.__v94TowerEditPatched || typeof api.openTowerPlayerEditModal !== 'function') return false;
    api.__v94TowerEditPatched = true;
    const original = api.openTowerPlayerEditModal;
    api.openTowerPlayerEditModal = function(){
      const result = original.apply(this, arguments);
      setTimeout(() => ensureDeleteButton(document.getElementById('towerPlayerEditModal')), 0);
      return result;
    };
    return true;
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('#tpeDeletePlayerBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.stopImmediatePropagation?.(); } catch {}
    const modal = document.getElementById('towerPlayerEditModal');
    const id = modal?.dataset.playerId || '';
    if (deleteRosterPlayer(id)) {
      modal?.classList.remove('is-open');
      try { PNS.ModalsShift?.syncBodyModalLock?.(); } catch {}
    }
  }, true);

  const mo = new MutationObserver(() => {
    const modal = document.getElementById('towerPlayerEditModal');
    if (modal) {
      ensureDeleteButton(modal);
      fixRosterEditShift(modal);
    }
    patchRosterEditOpen();
    patchTowerEditOpen();
  });
  try { mo.observe(document.documentElement, { childList:true, subtree:true }); } catch {}

  document.addEventListener('DOMContentLoaded', () => {
    patchRosterEditOpen();
    patchTowerEditOpen();
    ensureDeleteButton(document.getElementById('towerPlayerEditModal'));
  });
  setTimeout(() => { patchRosterEditOpen(); patchTowerEditOpen(); }, 300);
})();