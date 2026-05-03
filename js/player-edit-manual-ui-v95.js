(function(){
  const PNS = window.PNS = window.PNS || {};
  const tr = (key, fallback='') => typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback;
  const esc = (value) => typeof PNS.escapeHtml === 'function'
    ? PNS.escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function normalizeShift(value){
    try {
      const normalized = typeof PNS.normalizeShiftValue === 'function'
        ? PNS.normalizeShiftValue(value)
        : String(value || '').toLowerCase();
      return /^shift[1-4]$/.test(normalized) || normalized === 'both' ? normalized : '';
    } catch { return ''; }
  }

  function shiftLabel(key){
    if (key === 'both') return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel('both') : tr('both','Всі');
    return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(key) : tr(key, key.replace('shift','Shift '));
  }

  function getActiveShiftKeys(){
    try {
      const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null') || {};
      const region = localStorage.getItem('pns_tower_calc_active_region_v1') || settings.activeRegion || 'region1';
      const data = settings?.regions?.[region] || settings?.regions?.region1 || {};
      const selected = ['1','2','3','4'].find(n => !!data?.shifts?.[n]);
      const count = Math.max(1, Math.min(4, Number(selected) || 2));
      return Array.from({ length: count }, (_, i) => `shift${i + 1}`);
    } catch {
      return ['shift1','shift2'];
    }
  }

  function registeredShift(player){
    if (!player) return '';
    if (player.manualShiftOverride) {
      const manual = normalizeShift(player.shift || player.shiftLabel || player.registeredShift || player.registeredShiftLabel || '');
      if (manual) return manual;
    }
    try {
      const reg = typeof PNS.getRegisteredShiftForPlayer === 'function' ? PNS.getRegisteredShiftForPlayer(player) : '';
      const normalized = normalizeShift(reg);
      if (normalized) return normalized;
    } catch {}
    try {
      const raw = player.registeredShiftRaw || player.raw?.shift_availability || player.registeredShift || player.registeredShiftLabel || player.shift || player.shiftLabel || '';
      if (raw && typeof PNS.applyImportShiftRule === 'function') {
        const mapped = normalizeShift(PNS.applyImportShiftRule(raw));
        if (mapped) return mapped;
      }
      return normalizeShift(raw);
    } catch { return ''; }
  }

  function assignmentForShift(player, shift){
    if (!player || !shift) return null;
    const planRoot = PNS.state?.shiftPlans?.[shift] || null;
    const planPlayers = planRoot && typeof planRoot === 'object' && planRoot.players && typeof planRoot.players === 'object' ? planRoot.players : null;
    if (planPlayers) {
      const plan = planPlayers[player.id] || null;
      return plan && plan.baseId ? { ...plan } : null;
    }
    if (String(PNS.state?.activeShift || '').toLowerCase() === shift && player.assignment?.baseId) return { ...player.assignment };
    return null;
  }

  function assignedShift(player){
    for (const shift of getActiveShiftKeys()) if (assignmentForShift(player, shift)?.baseId) return shift;
    for (const shift of ['shift1','shift2','shift3','shift4']) if (assignmentForShift(player, shift)?.baseId) return shift;
    return '';
  }

  function preferredEditShift(player){
    const assigned = assignedShift(player);
    if (assigned) return assigned;
    const reg = registeredShift(player);
    if (reg === 'both') return 'both';
    if (/^shift[1-4]$/.test(reg)) return reg;
    return getActiveShiftKeys()[0] || 'shift1';
  }

  function addOption(select, value, label){
    if (!select || Array.from(select.options).some(opt => opt.value === value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  function syncShiftSelect(select, selectedValue, includeBoth=true){
    if (!select) return;
    const keep = selectedValue || select.value || '';
    select.innerHTML = '';
    getActiveShiftKeys().forEach(shift => addOption(select, shift, shiftLabel(shift)));
    if (includeBoth) addOption(select, 'both', shiftLabel('both'));
    if (keep && !Array.from(select.options).some(opt => opt.value === keep)) addOption(select, keep, shiftLabel(keep));
    select.value = keep && Array.from(select.options).some(opt => opt.value === keep)
      ? keep
      : (includeBoth && selectedValue === 'both' ? 'both' : (getActiveShiftKeys()[0] || 'shift1'));
  }

  function syncTowerEditModal(){
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal || !modal.classList.contains('is-open')) return;

    const deleteBtn = modal.querySelector('#tpeDeletePlayerBtn');
    if (deleteBtn) {
      deleteBtn.classList.add('btn-danger-real');
      deleteBtn.textContent = tr('delete_player','Видалити гравця');
    }

    const select = modal.querySelector('#tpePlacementShift');
    if (!select) return;

    const playerId = String(modal.dataset.playerId || '');
    const player = PNS.state?.playerById?.get?.(playerId) || (PNS.state?.players || []).find(p => String(p?.id || '') === playerId);
    const preferred = modal.dataset.mode === 'roster' ? preferredEditShift(player) : (select.value || preferredEditShift(player));
    syncShiftSelect(select, preferred, true);

    if (modal.dataset.mode === 'roster' && preferred === 'both') {
      const baseSelect = modal.querySelector('#tpePlacementBase');
      if (baseSelect) baseSelect.value = '';
      const hint = modal.querySelector('#tpePlacementHint');
      if (hint) hint.textContent = `${shiftLabel('both')} · ${tr('reserve','Резерв')}.`;
    }
  }

  function normalizeTier(value){
    const text = String(value || '').trim().toUpperCase().replace(/\s+/g,'');
    const match = text.match(/^T?([1-9]|1[0-4])$/);
    return match ? `T${Number(match[1])}` : (text || 'T10');
  }

  function getVisibleTierOptions(){
    try {
      if (typeof PNS.getVisibleTierOrder === 'function') {
        const list = PNS.getVisibleTierOrder().map(normalizeTier).filter(Boolean);
        if (list.length) return Array.from(new Set(list));
      }
    } catch {}
    return ['T14','T13','T12','T11','T10','T9'];
  }

  function collectAlliances(){
    const values = new Set();
    (Array.isArray(PNS.state?.players) ? PNS.state.players : []).forEach(p => {
      const v = String(p?.alliance || '').trim();
      if (v) values.add(v);
    });
    return Array.from(values).sort((a,b) => a.localeCompare(b));
  }

  function closeComboMenu(){
    document.getElementById('manualComboMenu')?.remove();
  }

  function openComboMenu(input, values){
    if (!input) return;
    closeComboMenu();
    const unique = Array.from(new Set((values || []).map(v => String(v || '').trim()).filter(Boolean)));
    const rect = input.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'manualComboMenu';
    menu.className = 'manual-combo-menu';
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.width = `${Math.max(180, rect.width)}px`;
    menu.innerHTML = unique.length
      ? unique.map(value => `<button type="button" data-value="${esc(value)}">${esc(value)}</button>`).join('')
      : `<div class="manual-combo-empty">${esc(tr('no_options','Немає варіантів'))}</div>`;
    document.body.appendChild(menu);
    menu.addEventListener('mousedown', ev => {
      const btn = ev.target.closest?.('button[data-value]');
      if (!btn) return;
      ev.preventDefault();
      input.value = btn.dataset.value || input.value;
      if (input.id === 'manualPlayerTier') {
        input.value = normalizeTier(input.value);
        try { PNS.enableTierVisibilityForTier?.(input.value); } catch {}
      }
      input.dispatchEvent(new Event('change', { bubbles:true }));
      closeComboMenu();
    });
  }

  function ensureCombo(input, kind){
    if (!input) return;
    input.removeAttribute('list');
    input.classList.add('manual-combo-input');
    const label = input.closest('label');
    if (!label) return;
    label.classList.add('manual-combo-label');

    let arrow = label.querySelector(`.manual-combo-arrow[data-combo-kind="${kind}"]`);
    if (!arrow) {
      arrow = document.createElement('button');
      arrow.type = 'button';
      arrow.className = 'manual-combo-arrow';
      arrow.dataset.comboKind = kind;
      arrow.setAttribute('aria-label', kind === 'tier' ? tr('tier','Тір') : tr('alliance','Альянс'));
      arrow.innerHTML = '<span aria-hidden="true"></span>';
      arrow.addEventListener('mousedown', ev => {
        ev.preventDefault();
        openComboMenu(input, kind === 'tier' ? getVisibleTierOptions() : collectAlliances());
      });
      label.appendChild(arrow);
    }
  }

  function syncManualPlayerForm(){
    const modal = document.getElementById('manualPlayerManagerModal');
    if (!modal || !modal.classList.contains('is-open')) return;

    const alliance = modal.querySelector('#manualPlayerAlliance');
    ensureCombo(alliance, 'alliance');

    const tier = modal.querySelector('#manualPlayerTier');
    if (tier) {
      ensureCombo(tier, 'tier');
      if (!/^T/i.test(String(tier.value || '')) && String(tier.value || '').trim()) tier.value = normalizeTier(tier.value);
    }

    const shift = modal.querySelector('#manualPlayerShift');
    if (shift) syncShiftSelect(shift, normalizeShift(shift.value) || 'shift1', true);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('.manual-combo-arrow')) return;
    if (!event.target.closest?.('#manualComboMenu')) closeComboMenu();

    if (event.target?.closest?.('#openManualPlayerManagerBtn,#openManualPlayerManagerBtnMobile,[data-edit-player-placement],#tpeDeletePlayerBtn,.row-action-edit')) {
      setTimeout(() => { syncManualPlayerForm(); syncTowerEditModal(); }, 80);
    }
  }, true);

  document.addEventListener('focusin', event => {
    if (event.target?.id === 'manualPlayerAlliance' || event.target?.id === 'manualPlayerTier') syncManualPlayerForm();
  }, true);

  window.addEventListener('resize', closeComboMenu);

  document.addEventListener('input', event => {
    if (event.target?.id === 'manualPlayerTier' || event.target?.id === 'tpeTier') {
      const el = event.target;
      const atEnd = el.selectionStart === el.value.length;
      el.value = el.value.toUpperCase().replace(/^\s*(\d)/, 'T$1').replace(/\s+/g,'');
      if (atEnd) try { el.selectionStart = el.selectionEnd = el.value.length; } catch {}
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id === 'manualPlayerTier' || event.target?.id === 'tpeTier') {
      event.target.value = normalizeTier(event.target.value);
      try { PNS.enableTierVisibilityForTier?.(event.target.value); } catch {}
    }
    if (event.target?.id === 'manualPlayerShift') syncManualPlayerForm();
    if (event.target?.id === 'tpePlacementShift') setTimeout(syncTowerEditModal, 0);
  }, true);

  function placementFor(player, shift){
    const assignment = assignmentForShift(player, shift);
    if (!assignment?.baseId) return { assigned:false, title:tr('reserve','Резерв'), detail:tr('not_assigned','Не призначено') };
    const base = PNS.state?.baseById?.get?.(assignment.baseId) || null;
    const rawTitle = String(base?.title || tr('turret','Турель')).split('/')[0].trim() || tr('turret','Турель');
    const title = typeof PNS.towerLabel === 'function' ? PNS.towerLabel(rawTitle) : rawTitle;
    const detail = assignment.kind === 'captain' ? tr('captain','Капітан') : tr('helper','Помічник');
    return { assigned:true, title, detail };
  }

  function renderPlacementCard(player){
    const chips = getActiveShiftKeys().map(shift => {
      const item = placementFor(player, shift);
      const active = String(PNS.state?.activeShift || '').toLowerCase() === shift;
      return `<div class="player-placement-item ${item.assigned ? 'is-assigned' : 'is-reserve'} ${active ? 'is-active' : ''}">
        <span class="placement-shift-pill">${esc(shiftLabel(shift))}</span>
        <strong>${esc(item.title)}</strong>
        <small>${esc(item.detail)}</small>
      </div>`;
    }).join('');
    return `<div class="player-placement-card"><div class="player-placement-grid">${chips}</div><button class="btn btn-xs btn-placement-edit" type="button" data-edit-player-placement="${esc(player.id || '')}" aria-label="${esc(tr('edit','Редагувати'))}"><span aria-hidden="true" class="btn-placement-edit-ico">✎</span></button></div>`;
  }

  function rebuildRowActions(){
    const players = Array.isArray(PNS.state?.players) ? PNS.state.players : [];
    players.forEach(player => {
      const cell = player?.actionCellEl;
      if (!cell) return;
      cell.classList.remove('muted');
      cell.innerHTML = renderPlacementCard(player);
      const edit = cell.querySelector('[data-edit-player-placement]');
      if (edit) edit.addEventListener('click', () => PNS.ModalsShift?.openRosterPlayerEditModal?.(player.id));
    });
  }

  function patchBuildRowActions(){
    if (PNS.__v99PlacementPatched) return;
    if (typeof PNS.buildRowActions !== 'function') return;
    PNS.__v99PlacementPatched = true;
    const oldBuild = PNS.buildRowActions;
    PNS.buildRowActions = function(){
      const result = oldBuild.apply(this, arguments);
      try { rebuildRowActions(); } catch {}
      return result;
    };
  }

  let timer = 0;
  function scheduleRefresh(){
    clearTimeout(timer);
    timer = setTimeout(() => {
      patchBuildRowActions();
      syncManualPlayerForm();
      syncTowerEditModal();
      try { rebuildRowActions(); } catch {}
    }, 80);
  }

  ['players-table-data-changed','pns:assignment-changed','pns:import-shift-rules-applied','pns:manual-shift-add-applied','pns:i18n-changed','pns:region-shifts-changed','pns:tier-visibility-changed'].forEach(name => {
    document.addEventListener(name, scheduleRefresh);
  });

  document.addEventListener('DOMContentLoaded', scheduleRefresh);
  setTimeout(scheduleRefresh, 300);
  setTimeout(scheduleRefresh, 1000);
})();