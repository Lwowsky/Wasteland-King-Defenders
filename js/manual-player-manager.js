/* Manual player manager: add/edit/delete roster players outside Excel import */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};
  const KEY = 'pns_manual_players_v1';
  const DELETED_KEY = 'pns_deleted_player_ids_v1';
  const tr = (key, fallback='') => typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const safeParse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const normalizeRole = (value) => typeof PNS.normalizeRole === 'function' ? PNS.normalizeRole(value || 'Fighter') : String(value || 'Fighter');
  const normalizeTier = (value) => typeof PNS.normalizeTierText === 'function' ? PNS.normalizeTierText(value || 'T10') : String(value || 'T10').toUpperCase();
  const parseNumber = (value) => typeof PNS.parseNumber === 'function' ? PNS.parseNumber(value) : (Number(String(value || '').replace(/[^\d.-]/g,'')) || 0);
  const normalizeShift = (value) => typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(value || 'both') : String(value || 'both').toLowerCase();
  const shiftLabel = (value) => typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(normalizeShift(value)) : String(value || '');
  const escapeHtml = (value) => typeof PNS.escapeHtml === 'function' ? PNS.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let activeId = '';

  function readManual(){
    const list = safeParse(localStorage.getItem(KEY) || '[]', []);
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

  function writeManual(list){
    try { localStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch {}
  }

  function readDeletedIds(){
    const list = safeParse(localStorage.getItem(DELETED_KEY) || '[]', []);
    return new Set((Array.isArray(list) ? list : []).map(id => String(id || '')).filter(Boolean));
  }

  function writeDeletedIds(ids){
    try { localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(ids || []).map(id => String(id || '')).filter(Boolean))); } catch {}
  }

  function markDeleted(id){
    const clean = String(id || '').trim();
    if (!clean) return;
    const ids = readDeletedIds();
    ids.add(clean);
    writeDeletedIds(ids);
  }

  function clearDeletedIds(){
    try { localStorage.removeItem(DELETED_KEY); } catch {}
  }

  function isDeleted(id){
    const clean = String(id || '').trim();
    return !!clean && readDeletedIds().has(clean);
  }

  function applyDeletedFilter(){
    ensureArrays();
    const ids = readDeletedIds();
    if (!ids.size) return 0;
    const before = state.players.length;
    ids.forEach(removeFromAssignments);
    state.players = state.players.filter(player => !ids.has(String(player?.id || '')));
    state.playerById = new Map(state.players.map(player => [String(player.id || ''), player]));
    return Math.max(0, before - state.players.length);
  }

  function nextId(){
    const players = Array.isArray(state.players) ? state.players : [];
    const used = new Set(players.map(p => String(p?.id || '')).filter(Boolean));
    readManual().forEach(p => p?.id && used.add(String(p.id)));
    let index = Date.now();
    let id = `mp_${index}`;
    while (used.has(id)) id = `mp_${++index}`;
    return id;
  }

  function ensureArrays(){
    if (!Array.isArray(state.players)) state.players = [];
    if (!(state.playerById instanceof Map)) state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
  }

  function getCustomDefs(){
    try { return typeof PNS.getCustomOptionalDefs === 'function' ? PNS.getCustomOptionalDefs() : []; } catch { return []; }
  }

  function slugify(label){
    const api = PNS.ImportWizard || {};
    if (typeof api.slugifyImportKey === 'function') return api.slugifyImportKey(label);
    return String(label || '').trim().toLowerCase().replace(/[^a-z0-9а-яіїєґё]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,32) || 'custom_field';
  }

  function addCustomDef(label){
    const clean = String(label || '').trim();
    if (!clean) return null;
    const api = PNS.ImportWizard || {};
    const current = getCustomDefs().slice();
    let key = `manual_${slugify(clean)}`.replace(/[^a-zA-Z0-9_:-]/g,'_');
    const keys = new Set(current.map(d => String(d.key || '')));
    let n = 2;
    while (keys.has(key)) key = `manual_${slugify(clean)}_${n++}`;
    try { api.restoreCustomOptionalDef?.(key); } catch {}
    current.push({ key, label: clean, required:false, colKey:key, visibleDefault:true, isCustom:true });
    state.importData = state.importData || { headers:[], rows:[], mapping:{}, loaded:false, customOptionalDefs:[] };
    state.importData.customOptionalDefs = current;
    try { api.persistCustomOptionalDefs?.(current); } catch {}
    state.visibleOptionalColumns = Array.from(new Set([...(state.visibleOptionalColumns || []), key]));
    try { PNS.saveVisibleOptionalColumns?.(); } catch {}
    try { PNS.applyColumnVisibility?.(state.showAllColumns); } catch {}
    return key;
  }

  function normalizePlayer(player){
    const id = String(player?.id || nextId());
    const shift = normalizeShift(player?.shift || player?.registeredShift || 'both');
    const out = {
      id,
      name: String(player?.name || '').trim(),
      playerExternalId: String(player?.playerExternalId || ''),
      alliance: String(player?.alliance || '').trim(),
      role: normalizeRole(player?.role || 'Fighter'),
      tier: normalizeTier(player?.tier || 'T10'),
      tierRank: typeof PNS.tierRank === 'function' ? PNS.tierRank(player?.tier || 'T10') : 0,
      march: parseNumber(player?.march),
      rally: parseNumber(player?.rally),
      captainReady: !!player?.captainReady,
      registeredShiftRaw: String(player?.registeredShiftRaw || shiftLabel(shift)),
      registeredShift: shift,
      registeredShiftLabel: shiftLabel(shift),
      shift,
      shiftLabel: shiftLabel(shift),
      lairLevel: String(player?.lairLevel || ''),
      secondaryRole: String(player?.secondaryRole || ''),
      secondaryTier: String(player?.secondaryTier || ''),
      troop200k: String(player?.troop200k || ''),
      notes: String(player?.notes || ''),
      customFields: player?.customFields && typeof player.customFields === 'object' ? { ...player.customFields } : {},
      customFieldLabels: player?.customFieldLabels && typeof player.customFieldLabels === 'object' ? { ...player.customFieldLabels } : {},
      raw: player?.raw || null,
      rowEl: null,
      actionCellEl: null,
      assignment: player?.assignment || null,
      manualShiftOverride: !!player?.manualShiftOverride,
      manualAdded: player?.manualAdded !== false
    };
    return out;
  }

  function mergeManualIntoState(){
    ensureArrays();
    applyDeletedFilter();
    const list = readManual().map(normalizePlayer).filter(player => !isDeleted(player.id));
    if (!list.length) {
      state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
      return;
    }
    const byId = new Map(state.players.map((p, idx) => [String(p?.id || ''), idx]));
    for (const player of list) {
      const idx = byId.get(String(player.id));
      if (idx >= 0) state.players[idx] = { ...state.players[idx], ...player, assignment: state.players[idx].assignment || player.assignment || null };
      else state.players.push(player);
    }
    applyDeletedFilter();
    state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
    try { PNS.autoEnableTiersFromPlayers?.(list, { mode:'append' }); } catch {}
  }

  function saveManualFromState(){
    ensureArrays();
    writeManual(state.players.filter(p => p?.manualAdded).map(p => normalizePlayer(p)));
  }

  function persistAll(){
    applyDeletedFilter();
    saveManualFromState();
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.renderPlayersTableFromState?.(); } catch {}
    try { PNS.buildRowActions?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(20); } catch {}
    try { document.dispatchEvent(new CustomEvent('players-table-data-changed')); } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:players-deleted-filter-applied')); } catch {}
  }

  function removeFromAssignments(playerId){
    const id = String(playerId || '');
    if (!id) return;
    (state.bases || []).forEach(base => {
      if (!base) return;
      if (String(base.captainId || '') === id) { base.captainId = null; base.role = null; }
      if (Array.isArray(base.helperIds)) base.helperIds = base.helperIds.filter(x => String(x || '') !== id);
    });
    const plans = state.shiftPlans && typeof state.shiftPlans === 'object' ? state.shiftPlans : {};
    Object.values(plans).forEach(plan => {
      const players = plan?.players;
      if (players && typeof players === 'object') delete players[id];
      const bases = plan?.bases && typeof plan.bases === 'object' ? plan.bases : {};
      Object.values(bases).forEach(base => {
        if (String(base?.captainId || '') === id) base.captainId = '';
        if (Array.isArray(base?.helperIds)) base.helperIds = base.helperIds.filter(x => String(x || '') !== id);
      });
    });
  }

  function modal(){ return $('#manualPlayerManagerModal'); }

  function openModal(){
    mergeManualIntoState();
    const el = modal();
    if (!el) return;
    el.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    closeDrawer();
    renderExtraFields();
    renderList();
    if (!activeId) resetForm(); else fillForm(activeId);
  }

  function closeModal(){
    const el = modal();
    if (!el) return;
    el.classList.remove('is-open');
    if (!document.querySelector('.modal.is-open')) document.documentElement.style.overflow = '';
  }

  function closeDrawer(){
    const drawer = $('#drawer');
    const burger = $('#burgerBtn');
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden','true'); }
    if (burger) { burger.classList.remove('is-open'); burger.setAttribute('aria-expanded','false'); }
  }

  function resetForm(){
    activeId = '';
    const form = $('#manualPlayerForm');
    form?.reset?.();
    $('#manualPlayerId').value = '';
    $('#manualPlayerRole').value = 'Fighter';
    $('#manualPlayerTier').value = 'T10';
    $('#manualPlayerShift').value = 'shift1';
    $('#manualPlayerCaptain').value = 'no';
    $('#manualPlayerCapture').value = 'no';
    $('#manualPlayerFormTitle').textContent = tr('manual_player_new_title','Новий гравець');
    $('#manualPlayerDeleteBtn').disabled = true;
    renderExtraFields({});
    setStatus('');
    $$('.manual-player-row').forEach(row => row.classList.remove('is-active'));
  }

  function fillForm(id){
    ensureArrays();
    const player = state.players.find(p => String(p?.id || '') === String(id));
    if (!player) return resetForm();
    activeId = String(id);
    $('#manualPlayerId').value = activeId;
    $('#manualPlayerName').value = String(player.name || '');
    $('#manualPlayerAlliance').value = String(player.alliance || '');
    $('#manualPlayerMarch').value = Number(player.march || 0) || '';
    $('#manualPlayerRally').value = Number(player.rally || 0) || '';
    $('#manualPlayerRole').value = normalizeRole(player.role || 'Fighter');
    $('#manualPlayerTier').value = String(player.tier || 'T10');
    $('#manualPlayerShift').value = normalizeShift(player.shift || player.registeredShift || 'both');
    $('#manualPlayerCaptain').value = player.captainReady ? 'yes' : 'no';
    const capture = typeof PNS.isCaptureRegionAutoEligible === 'function' ? PNS.isCaptureRegionAutoEligible(player) : !!String(player.lairLevel || '').trim();
    $('#manualPlayerCapture').value = capture ? 'yes' : 'no';
    $('#manualPlayerFormTitle').textContent = String(player.name || tr('edit','Редагувати'));
    $('#manualPlayerDeleteBtn').disabled = false;
    renderExtraFields(player.customFields || {});
    setExtraCollapsed(true);
    setStatus('');
    $$('.manual-player-row').forEach(row => row.classList.toggle('is-active', row.dataset.playerId === activeId));
  }

  function removeCustomDef(key){
    const targetKey = String(key || '').trim();
    if (!targetKey) return;
    const defs = getCustomDefs();
    const def = defs.find(item => String(item?.key || '') === targetKey);
    const label = String(def?.label || targetKey);
    if (!confirm(tr('manual_player_remove_column_confirm','Видалити колонку?') + ` ${label}`)) return;

    const api = PNS.ImportWizard || {};
    try { api.hideCustomOptionalDef?.(targetKey); } catch {}

    const updated = getCustomDefs().filter(item => String(item?.key || '') !== targetKey);
    state.importData = state.importData || { headers:[], rows:[], mapping:{}, loaded:false, customOptionalDefs:[] };
    state.importData.customOptionalDefs = updated;
    try { api.persistCustomOptionalDefs?.(updated); } catch {}

    if (state.importData?.mapping && targetKey in state.importData.mapping) delete state.importData.mapping[targetKey];
    if (Array.isArray(state.visibleOptionalColumns)) {
      state.visibleOptionalColumns = state.visibleOptionalColumns.filter(col => String(col) !== targetKey);
      try { PNS.saveVisibleOptionalColumns?.(); } catch {}
    }

    (state.players || []).forEach(player => {
      if (player?.customFields && Object.prototype.hasOwnProperty.call(player.customFields, targetKey)) delete player.customFields[targetKey];
      if (player?.customFieldLabels && Object.prototype.hasOwnProperty.call(player.customFieldLabels, targetKey)) delete player.customFieldLabels[targetKey];
    });

    const manual = readManual().map(player => {
      if (player?.customFields) delete player.customFields[targetKey];
      if (player?.customFieldLabels) delete player.customFieldLabels[targetKey];
      return player;
    });
    writeManual(manual);

    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.applyColumnVisibility?.(state.showAllColumns); } catch {}
    try { PNS.renderPlayersTableFromState?.(); } catch {}
    renderExtraFields();
    renderList();
    setStatus(tr('manual_player_column_removed','Колонку видалено.'));
  }

  function setExtraCollapsed(collapsed){
    const form = $('#manualPlayerForm');
    const toggle = $('#manualPlayerExtraToggle');
    const body = $('#manualPlayerExtraBody');
    const isCollapsed = collapsed !== false;
    form?.classList.toggle('is-extra-collapsed', isCollapsed);
    toggle?.setAttribute('aria-expanded', String(!isCollapsed));
    if (body) body.hidden = isCollapsed;
  }

  function toggleExtraColumns(){
    const form = $('#manualPlayerForm');
    setExtraCollapsed(!form?.classList.contains('is-extra-collapsed'));
  }

  function renderExtraFields(values = null){
    const host = $('#manualPlayerExtraFields');
    if (!host) return;
    const fields = getCustomDefs();
    const current = values || (activeId ? (state.players || []).find(p => String(p.id) === activeId)?.customFields || {} : {});
    host.innerHTML = fields.map(def => {
      const key = String(def.key || '');
      const label = String(def.label || key);
      const removeTitle = escapeHtml(tr('manual_player_remove_column','Видалити колонку'));
      return `<div class="manual-player-extra-field" data-manual-extra-field="${escapeHtml(key)}">
        <label><span>${escapeHtml(label)}</span><input data-manual-extra-key="${escapeHtml(key)}" value="${escapeHtml(current[key] || '')}" type="text" /></label>
        <button class="manual-player-remove-column" data-manual-remove-column="${escapeHtml(key)}" title="${removeTitle}" aria-label="${removeTitle}: ${escapeHtml(label)}" type="button">×</button>
      </div>`;
    }).join('') || `<div class="muted small">${escapeHtml(tr('manual_player_no_extra_columns','Додаткових колонок ще немає.'))}</div>`;
  }

  function collectForm(){
    const name = String($('#manualPlayerName')?.value || '').trim();
    if (!name) return null;
    const id = String($('#manualPlayerId')?.value || '') || nextId();
    const shift = normalizeShift($('#manualPlayerShift')?.value || 'shift1');
    const customFields = {};
    $$('[data-manual-extra-key]').forEach(input => {
      const key = String(input.dataset.manualExtraKey || '');
      if (!key) return;
      const value = String(input.value || '').trim();
      if (value) customFields[key] = value;
    });
    const customFieldLabels = {};
    getCustomDefs().forEach(def => { if (def?.key) customFieldLabels[String(def.key)] = String(def.label || def.key); });
    return normalizePlayer({
      id,
      name,
      alliance: $('#manualPlayerAlliance')?.value || '',
      march: $('#manualPlayerMarch')?.value || 0,
      rally: $('#manualPlayerRally')?.value || 0,
      role: $('#manualPlayerRole')?.value || 'Fighter',
      tier: $('#manualPlayerTier')?.value || 'T10',
      captainReady: $('#manualPlayerCaptain')?.value === 'yes',
      shift,
      registeredShiftRaw: shiftLabel(shift),
      registeredShift: shift,
      registeredShiftLabel: shiftLabel(shift),
      shiftLabel: shiftLabel(shift),
      lairLevel: $('#manualPlayerCapture')?.value === 'yes' ? 'Так' : 'Ні',
      customFields,
      customFieldLabels,
      manualAdded: true
    });
  }

  function saveCurrent(ev){
    ev?.preventDefault?.();
    const player = collectForm();
    if (!player) return setStatus(tr('manual_player_name_required','Введи нік гравця.'), true);
    ensureArrays();
    const idx = state.players.findIndex(p => String(p?.id || '') === String(player.id));
    if (idx >= 0) {
      state.players[idx] = { ...state.players[idx], ...player, assignment: state.players[idx].assignment || null, manualAdded: state.players[idx].manualAdded || player.manualAdded };
    } else {
      state.players.push(player);
    }
    state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
    try { PNS.enableTierVisibilityForTier?.(player.tier); } catch {}
    activeId = player.id;
    persistAll();
    renderList();
    fillForm(activeId);
    setStatus(tr('saved','Збережено'));
  }

  function deleteCurrent(ev){
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    const id = String($('#manualPlayerId')?.value || activeId || '');
    if (!id) return setStatus(tr('manual_player_select_to_delete','Спочатку вибери гравця.'), true);
    const player = (state.players || []).find(p => String(p?.id || '') === id);
    const name = player?.name || '';
    if (!confirm(tr('manual_player_delete_confirm','Видалити гравця?') + (name ? ` ${name}` : ''))) return;
    markDeleted(id);
    removeFromAssignments(id);
    state.players = (state.players || []).filter(p => String(p?.id || '') !== id);
    state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
    activeId = '';
    persistAll();
    renderList();
    resetForm();
    setStatus(tr('manual_player_deleted','Гравця видалено.'));
  }

  function renderList(){
    ensureArrays();
    const host = $('#manualPlayerList');
    if (!host) return;
    const q = String($('#manualPlayerSearchInput')?.value || '').trim().toLowerCase();
    const players = (state.players || []).filter(player => {
      if (!q) return true;
      return [player.name, player.alliance, player.role, player.tier, player.shiftLabel].join(' ').toLowerCase().includes(q);
    }).slice().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric:true, sensitivity:'base' }));
    host.innerHTML = players.map(player => {
      const manual = player.manualAdded ? tr('manual_player_manual_badge','Ручний') : tr('manual_player_import_badge','Імпорт');
      return `<button class="manual-player-row ${String(player.id) === activeId ? 'is-active' : ''}" data-player-id="${escapeHtml(player.id)}" type="button"><span><strong>${escapeHtml(player.name || '—')}</strong><small>${escapeHtml(player.alliance || '—')} · ${escapeHtml(player.role || '—')} · ${escapeHtml(player.tier || '—')} · ${escapeHtml(player.shiftLabel || '')}</small></span><span class="manual-player-origin">${escapeHtml(manual)}</span></button>`;
    }).join('') || `<div class="muted small">${escapeHtml(tr('manual_player_empty','Гравців не знайдено.'))}</div>`;
  }

  function setStatus(text, danger=false){
    const el = $('#manualPlayerStatus');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-danger', !!danger);
  }

  function clearManualPlayersForNewImport(){
    writeManual([]);
    clearDeletedIds();
    try {
      if (Array.isArray(state.players)) {
        const removed = new Set(state.players.filter(p => p?.manualAdded).map(p => String(p.id || '')));
        removed.forEach(removeFromAssignments);
        state.players = state.players.filter(p => !p?.manualAdded);
        state.playerById = new Map(state.players.map(p => [String(p.id || ''), p]));
        PNS.savePlayersSnapshot?.(state.players);
      }
    } catch {}
    activeId = '';
    try { renderList(); resetForm(); } catch {}
  }

  function bind(){
    $('#openManualPlayerManagerBtnMobile')?.addEventListener('click', openModal);
    document.addEventListener('click', ev => {
      if (ev.target.closest('[data-close-manual-player-manager]')) { ev.preventDefault(); closeModal(); }
      const removeColumnBtn = ev.target.closest('[data-manual-remove-column]');
      if (removeColumnBtn && removeColumnBtn.closest('#manualPlayerManagerModal')) {
        ev.preventDefault();
        removeCustomDef(removeColumnBtn.dataset.manualRemoveColumn || '');
        return;
      }
      const row = ev.target.closest('.manual-player-row[data-player-id]');
      if (row) { ev.preventDefault(); fillForm(row.dataset.playerId); }
    });
    $('#manualPlayerNewBtn')?.addEventListener('click', resetForm);
    $('#manualPlayerExtraToggle')?.addEventListener('click', toggleExtraColumns);
    $('#manualPlayerSearchInput')?.addEventListener('input', renderList);
    $('#manualPlayerForm')?.addEventListener('submit', saveCurrent);
    $('#manualPlayerDeleteBtn')?.addEventListener('click', deleteCurrent);
    $('#manualPlayerAddColumnBtn')?.addEventListener('click', () => {
      const input = $('#manualPlayerNewColumnName');
      const key = addCustomDef(input?.value || '');
      if (!key) return setStatus(tr('manual_player_column_name_required','Введи назву колонки.'), true);
      if (input) input.value = '';
      renderExtraFields();
      setExtraCollapsed(false);
      try { PNS.renderPlayersTableFromState?.(); } catch {}
      setStatus(tr('manual_player_column_added','Колонку додано.'));
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && modal()?.classList.contains('is-open')) closeModal();
    });
  }

  function init(){
    mergeManualIntoState();
    applyDeletedFilter();
    bind();
    try { PNS.renderPlayersTableFromState?.(); } catch {}
  }

  PNS.ManualPlayerManager = {
    open: openModal,
    close: closeModal,
    readManualPlayers: readManual,
    saveManualPlayers: writeManual,
    readDeletedPlayerIds: () => Array.from(readDeletedIds()),
    clearDeletedPlayerIds: clearDeletedIds,
    isDeletedPlayer: isDeleted,
    applyDeletedPlayersFilter: applyDeletedFilter,
    mergeManualIntoState,
    clearManualPlayersForNewImport,
    persistManualPlayers: saveManualFromState,
  };
  PNS.isDeletedPlayer = isDeleted;
  PNS.applyDeletedPlayersFilter = applyDeletedFilter;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
