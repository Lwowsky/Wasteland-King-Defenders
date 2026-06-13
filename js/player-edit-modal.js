window.WKD = window.WKD || {};

(function () {
  let initialized = false;
  let activePlayerId = '';
  let activeTrigger = null;
  let saving = false;

  const roleOptions = ['Fighter', 'Rider', 'Shooter'];
  const shiftOptions = ['shift1', 'shift2', 'shift3', 'shift4', 'both'];

  const $ = selector => document.querySelector(selector);
  const esc = value => WKD.escapeHtml ? WKD.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const allianceTag3 = value => window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const clean = value => WKD.clean ? WKD.clean(value) : String(value ?? '').trim();
  const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
  const tv = (key, fallback = '', vars = {}) => {
    let text = t(key, fallback);
    Object.entries(vars || {}).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value));
    });
    return text;
  };

  function modal() { return $('#playerEditModal'); }
  function field(id) { return document.getElementById(id); }
  function getPlayers() { return Array.isArray(WKD.state?.players) ? WKD.state.players : []; }
  function rowId(player = {}, index = 0) { return String(player._rowId || player.id || player.uid || `row-${index}`); }
  function findEntry(id = activePlayerId) {
    const wanted = String(id || '');
    const players = getPlayers();
    const index = players.findIndex((player, i) => rowId(player, i) === wanted);
    return index >= 0 ? { player: players[index], index, id: rowId(players[index], index) } : null;
  }
  function toNumber(value) {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  function normalizeTier(value) {
    const text = clean(value);
    const found = text.match(/T?\s*(\d{1,2})/);
    return found ? `T${Math.max(1, Math.min(14, Number(found[1])) || 10)}` : (text || 'T10');
  }
  function normalizeShift(value) {
    const raw = clean(value).toLowerCase();
    if (/4/.test(raw)) return 'shift4';
    if (/3/.test(raw)) return 'shift3';
    if (/2/.test(raw)) return 'shift2';
    if (/1/.test(raw)) return 'shift1';
    if (/both|all|всі|обидві|обе/.test(raw)) return 'both';
    return shiftOptions.includes(value) ? value : 'both';
  }
  function shiftLabel(shift) {
    const key = normalizeShift(shift);
    return t(`shift.${key}`, ({ shift1: 'Shift 1', shift2: 'Shift 2', shift3: 'Shift 3', shift4: 'Shift 4', both: 'Both' })[key] || 'Shift');
  }
  function placementRoleLabel(role) {
    return role === 'captain' ? t('tower.captain', 'Captain') : t('tower.helper', 'Helper');
  }
  function siteLang() { return String(window.WKD_activeLang ? window.WKD_activeLang() : (window.WKD_CURRENT_LANG || document.documentElement.lang || localStorage.getItem('wkd.lang') || 'en')).toLowerCase(); }
  function towerDisplayName(item) {
    if (item.id === 'reserve') return t('tower.reserve', item.en || item.uk || 'Reserve');
    const key = `tower.${item.id}`;
    const translated = t(key, '');
    if (translated && translated !== key) return clean(translated);
    const lang = siteLang();
    const text = item[lang] || item.en || item.uk || '';
    return clean(text).replace(/\s*[·•]\s*.+$/, '').trim();
  }

  function placementOptions() {
    const towers = typeof WKD.getTowerPlannerTowers === 'function' ? WKD.getTowerPlannerTowers() : [];
    return [{ id: 'reserve', uk: 'Резерв', en: 'Reserve' }, ...towers];
  }
  function populatePlacementOptions(selected = 'reserve') {
    const select = field('playerEditPlacement');
    if (!select) return;
    const current = clean(selected || 'reserve');
    select.innerHTML = placementOptions().map(item => `<option value="${esc(item.id)}">${esc(towerDisplayName(item))}</option>`).join('');
    select.value = [...select.options].some(option => option.value === current) ? current : 'reserve';
  }
  function normalizeRole(value) {
    const text = clean(value).toLowerCase();
    if (/fighter|бійц|боєц|боец|воїн|воин|піхот/.test(text)) return 'Fighter';
    if (/rider|наїз|наезд|кавал/.test(text)) return 'Rider';
    if (/shooter|стріл|стрел|shoot/.test(text)) return 'Shooter';
    return roleOptions.includes(value) ? value : 'Shooter';
  }
  function isCaptain(value) {
    if (value === true) return true;
    const text = clean(value).toLowerCase();
    return /^(1|true|yes|y|так|да)$/i.test(text) || /готов|ready|can|мож/.test(text);
  }
  function sourceInfo() {
    return WKD.getPlayersSourceInfo?.() || { mode: 'local', canUpdate: true, canDelete: true, label: t('playerManager.localList', 'local list') };
  }
  function canEdit(entry) {
    const info = sourceInfo();
    if (info.mode !== 'region') return true;
    return Boolean(info.canUpdate && entry?.player?.regionRegistrationId);
  }
  function canDelete(entry) {
    const info = sourceInfo();
    if (info.mode !== 'region') return true;
    return Boolean(info.canDelete && entry?.player?.regionRegistrationId);
  }
  function setStatus(message = '', type = 'info') {
    const box = field('playerEditStatus');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message;
    box.classList.toggle('is-error', type === 'error');
    box.classList.toggle('is-success', type === 'success');
  }
  function setBusy(value) {
    saving = Boolean(value);
    ['playerEditSaveBtn', 'playerEditDeleteBtn', 'playerEditReserveBtn'].forEach(id => {
      const btn = field(id);
      if (btn) btn.disabled = saving || btn.dataset.locked === '1';
    });
  }
  function setValue(id, value) {
    const el = field(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value ?? '';
  }
  function readValues() {
    const towerId = clean(field('playerEditPlacement')?.value || 'reserve');
    const towerOptionText = clean(field('playerEditPlacement')?.selectedOptions?.[0]?.textContent || '');
    const towerRole = field('playerEditPlacementRole')?.value === 'captain' ? 'captain' : 'helper';
    const shift = normalizeShift(field('playerEditShift')?.value);
    const placement = towerId === 'reserve'
      ? t('tower.reserve', 'Reserve')
      : `${shiftLabel(shift)} · ${towerOptionText.replace(/\s*·\s*[^·]+$/, '')} · ${placementRoleLabel(towerRole)}`;
    return {
      name: clean(field('playerEditName')?.value),
      alliance: allianceTag3(field('playerEditAlliance')?.value),
      role: normalizeRole(field('playerEditRole')?.value),
      tier: normalizeTier(field('playerEditTier')?.value),
      march: toNumber(field('playerEditMarch')?.value),
      rally: toNumber(field('playerEditRally')?.value),
      towerMarch: clean(field('playerEditTowerMarch')?.value),
      shift,
      lair: field('playerEditLair')?.checked ? t('common.yes', 'Yes') : t('common.no', 'No'),
      captain: Boolean(field('playerEditCaptain')?.checked),
      placement,
      towerId,
      towerRole
    };
  }
  function fillForm(entry) {
    const player = entry?.player || {};
    const assignment = typeof WKD.getPlayerTowerAssignment === 'function' ? WKD.getPlayerTowerAssignment(entry?.id || activePlayerId) : null;
    const shift = assignment?.shift || normalizeShift(player.shift || player.shiftLabel || 'both');
    const placement = assignment?.towerId || 'reserve';
    populatePlacementOptions(placement);
    setValue('playerEditName', player.name || '');
    setValue('playerEditAlliance', player.alliance || '');
    setValue('playerEditTier', normalizeTier(player.tier || 'T10'));
    setValue('playerEditRole', normalizeRole(player.role || 'Shooter'));
    setValue('playerEditMarch', player.march || '');
    setValue('playerEditRally', player.rally || '');
    setValue('playerEditShift', shift);
    setValue('playerEditLair', /^(1|true|yes|y|так|да)$/i.test(clean(player.lair || player.captureRegion || player.capture))); 
    setValue('playerEditCaptain', isCaptain(player.captain ?? player.captainReady));
    const placementRole = assignment?.role || (isCaptain(player.captain ?? player.captainReady) ? 'captain' : 'helper');
    setValue('playerEditPlacement', placement);
    setValue('playerEditPlacementRole', placementRole);
    const towerMarchField = field('playerEditTowerMarchField');
    const towerMarchAllowed = Boolean(assignment?.towerId && placementRole !== 'captain');
    if (towerMarchField) towerMarchField.hidden = !towerMarchAllowed;
    const towerMarch = towerMarchAllowed && typeof WKD.getPlayerTowerManualMarch === 'function'
      ? WKD.getPlayerTowerManualMarch(entry?.id || activePlayerId, assignment)
      : '';
    setValue('playerEditTowerMarch', towerMarch);
    refreshTowerMarchField();
  }

  function refreshTowerMarchField() {
    const towerMarchField = field('playerEditTowerMarchField');
    if (!towerMarchField) return;
    const towerId = clean(field('playerEditPlacement')?.value || 'reserve');
    const role = field('playerEditPlacementRole')?.value === 'captain' ? 'captain' : 'helper';
    towerMarchField.hidden = !(towerId && towerId !== 'reserve' && role !== 'captain');
  }

  function updateAccessState(entry) {
    const root = modal();
    const editable = canEdit(entry);
    const deletable = canDelete(entry);
    const info = sourceInfo();
    root?.classList.toggle('is-readonly', !editable);
    const saveBtn = field('playerEditSaveBtn');
    const deleteBtn = field('playerEditDeleteBtn');
    const reserveBtn = field('playerEditReserveBtn');
    if (saveBtn) { saveBtn.dataset.locked = editable ? '0' : '1'; saveBtn.disabled = !editable; }
    if (reserveBtn) { reserveBtn.dataset.locked = editable ? '0' : '1'; reserveBtn.disabled = !editable; }
    if (deleteBtn) { deleteBtn.dataset.locked = deletable ? '0' : '1'; deleteBtn.disabled = !deletable; }
    if (info.mode === 'region' && !entry?.player?.regionRegistrationId) {
      setStatus(t('playerEdit.profileRowReadonly', 'This row came from a player profile. Only region table requests can be edited here.'), 'error');
    } else if (info.mode === 'region' && !editable) {
      setStatus(t('playerManager.regionUpdateAccess', 'The region table can be edited by the consul or an officer of their region, a moderator, or an admin.'), 'error');
    } else {
      setStatus('');
    }
  }
  async function open(id, trigger = null) {
    const entry = findEntry(id);
    const root = modal();
    if (!entry || !root) return;
    activePlayerId = entry.id;
    activeTrigger = trigger || document.activeElement;
    populatePlacementOptions('reserve');
    fillForm(entry);
    updateAccessState(entry);
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
    document.documentElement.style.overflow = 'hidden';
    try {
      if (typeof WKD.ensureTowerPlanLoaded === 'function') {
        await WKD.ensureTowerPlanLoaded();
        if (activePlayerId === entry.id && root.classList.contains('is-open')) fillForm(entry);
      }
    } catch (_error) {
      populatePlacementOptions('reserve');
    }
    setTimeout(() => field('playerEditName')?.focus(), 30);
  }
  function close() {
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('wkd-modal-open');
      document.documentElement.style.overflow = '';
    }
    activePlayerId = '';
    try { activeTrigger?.focus?.(); } catch (_error) {}
  }
  function errorMessage(error) {
    const code = error?.message || String(error || '');
    if (code === 'region-update-access-denied') return t('playerManager.regionUpdateAccess', 'The region table can be edited by the consul or an officer of their region, a moderator, or an admin.');
    if (code === 'region-update-registration-only') return t('playerEdit.regionUpdateRegistrationOnly', 'This record came from a player profile. It cannot be changed as a base request.');
    if (code === 'region-delete-access-denied') return t('playerManager.regionDeleteAccess', 'Only the consul of their region, a moderator, or an admin can delete records from the base.');
    if (code === 'region-delete-registration-only') return t('playerEdit.regionDeleteRegistrationOnly', 'This record came from a player profile. It cannot be deleted as a base request.');
    if (code === 'region-plan-access-denied') return t('playerEdit.regionPlanAccessDenied', 'Only the consul or an officer of their region, a moderator, or an admin can edit the region turret plan.');
    if (code === 'auth-required') return t('playerManager.authRequired', 'You must sign in to use the region table.');
    return t('playerManager.saveFailed', 'Could not save the change. Check access rights.');
  }
  async function save() {
    if (saving) return;
    const entry = findEntry();
    if (!entry) return setStatus(t('playerEdit.notFound', 'Player record was not found.'), 'error');
    if (!canEdit(entry)) return updateAccessState(entry);
    const values = readValues();
    if (!values.name) return setStatus(t('playerEdit.nameRequired', 'Nickname cannot be empty.'), 'error');
    if (!values.march) return setStatus(t('playerEdit.marchRequired', 'Enter the march size.'), 'error');
    try {
      setBusy(true);
      const playerValues = { ...values };
      delete playerValues.towerId;
      delete playerValues.towerRole;
      delete playerValues.towerMarch;
      if (typeof WKD.updatePlayerInActiveSource === 'function') {
        await WKD.updatePlayerInActiveSource(entry.id, playerValues);
      } else {
        Object.assign(entry.player, playerValues);
        WKD.saveJson?.(WKD.storageKeys.players, getPlayers());
        WKD.renderPlayers?.();
      }
      if (typeof WKD.assignPlayerToTowerFromEditor === 'function') {
        await WKD.assignPlayerToTowerFromEditor(entry.id, { shift: values.shift, towerId: values.towerId, role: values.towerRole });
      }
      if (typeof WKD.setPlayerTowerManualMarch === 'function') {
        await WKD.setPlayerTowerManualMarch(entry.id, values.towerMarch, { shift: values.shift, towerId: values.towerId, role: values.towerRole });
      }
      setStatus(tv('playerEdit.savedName', 'Saved: {name}.', { name: values.name }), 'success');
      document.dispatchEvent(new CustomEvent('wkd:player-edit-saved', { detail: { id: entry.id, values } }));
      close();
    } catch (error) {
      console.error(error);
      setStatus(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function removeFromTower() {
    populatePlacementOptions('reserve');
    const placement = field('playerEditPlacement');
    if (placement) placement.value = 'reserve';
    setStatus(t('playerEdit.reserveAfterSave', 'The player will stay in reserve after you press Save.'), 'info');
  }
  async function remove() {
    if (saving) return;
    const entry = findEntry();
    if (!entry) return setStatus(t('playerEdit.notFound', 'Player record was not found.'), 'error');
    if (!canDelete(entry)) return updateAccessState(entry);
    const ok = await (WKD.confirmDialog?.({
      title: t('playerEdit.deleteTitle', 'Delete player?'),
      message: tv('playerEdit.deleteMessage', 'Record “{name}” will be removed from the table.', { name: entry.player.name || t('playerEdit.playerFallback', 'player') }),
      note: sourceInfo().mode === 'region' ? t('playerEdit.deleteRegionNote', 'The record will be deleted from the region table.') : t('playerEdit.deleteLocalNote', 'The record will be deleted from the local list.'),
      acceptText: t('playerEdit.deletePlayer', 'Delete player')
    }) ?? Promise.resolve(window.confirm(t('playerEdit.deleteTitle', 'Delete player?'))));
    if (!ok) return;
    try {
      setBusy(true);
      if (typeof WKD.deletePlayersFromActiveSource === 'function') {
        await WKD.deletePlayersFromActiveSource([entry.id]);
      } else {
        WKD.state.players = getPlayers().filter((player, index) => rowId(player, index) !== entry.id);
        WKD.saveJson?.(WKD.storageKeys.players, getPlayers());
        WKD.renderPlayers?.();
      }
      close();
    } catch (error) {
      console.error(error);
      setStatus(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  function bind() {
    document.addEventListener('click', event => {
      const editButton = event.target.closest('.placement-edit');
      if (editButton) {
        const row = editButton.closest('tr[data-player-id], tr[data-player-index]');
        const id = row?.dataset.playerId || rowId(getPlayers()[Number(row?.dataset.playerIndex)], Number(row?.dataset.playerIndex));
        if (id) {
          event.preventDefault();
          open(id, editButton);
        }
        return;
      }
      if (event.target.closest('[data-player-edit-close]')) {
        event.preventDefault();
        close();
      }
    });
    field('playerEditSaveBtn')?.addEventListener('click', event => { event.preventDefault(); save(); });
    ['playerEditPlacement', 'playerEditPlacementRole'].forEach(id => field(id)?.addEventListener('change', refreshTowerMarchField));
    field('playerEditReserveBtn')?.addEventListener('click', event => { event.preventDefault(); removeFromTower(); });
    field('playerEditDeleteBtn')?.addEventListener('click', event => { event.preventDefault(); remove(); });
    field('playerEditCaptain')?.addEventListener('change', () => {
      const role = field('playerEditPlacementRole');
      if (role) role.value = field('playerEditCaptain')?.checked ? 'captain' : 'helper';
    });
    document.addEventListener('wkd:tower-plan-updated', () => {
      const entry = findEntry();
      if (modal()?.classList.contains('is-open') && entry) fillForm(entry);
    });
    document.addEventListener('wkd:language-changed', () => {
      const entry = findEntry();
      if (!modal()?.classList.contains('is-open') || !entry) return;
      populatePlacementOptions(field('playerEditPlacement')?.value || 'reserve');
      fillForm(entry);
      updateAccessState(entry);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal()?.classList.contains('is-open')) {
        event.preventDefault();
        close();
      }
    });
  }
  WKD.initPlayerEditModal = () => {
    if (initialized || !modal()) return;
    initialized = true;
    bind();
  };
  WKD.openPlayerEditModal = open;
})();
