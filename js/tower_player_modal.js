(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  function getTierCapForBase(base, tier) {
    const key = String(tier || '').toUpperCase();
    const v = Number(base?.tierMinMarch?.[key] || 0) || 0;
    return v > 0 ? v : 0;
  }

  function getPlayerCurrentTowerMarch(base, player, isCaptain) {
    if (!player) return 0;
    const raw = Number(player.march || 0) || 0;
    if (isCaptain) return raw;
    try {
      const ov = PNS.getTowerMarchOverride?.(base?.id, player?.id, state.activeShift);
      if (Number.isFinite(ov) && ov > 0) return ov;
    } catch {}
    try {
      if (typeof PNS.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
      if (typeof PNS.getEffectiveTowerMarch === 'function') return Number(PNS.getEffectiveTowerMarch(base, player)) || 0;
    } catch {}
    const cap = getTierCapForBase(base, player.tier);
    return cap > 0 ? Math.min(raw, cap) : raw;
  }

  function normalizeEditableShift(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'shift2') return 'shift2';
    return 'shift1';
  }

  function getPlanAssignment(playerId, shiftKey) {
    const shift = normalizeEditableShift(shiftKey);
    if (!playerId) return null;

    if (String(state.activeShift || '').toLowerCase() === shift) {
      const player = state.playerById?.get?.(playerId);
      return player?.assignment ? { ...player.assignment } : null;
    }

    const plan = state.shiftPlans?.[shift] || null;
    const assignment = plan?.players?.[playerId] || null;
    return assignment ? { ...assignment } : null;
  }

  function getPreferredRosterShift(playerId) {
    const activeShift = String(state.activeShift || '').toLowerCase();
    if (activeShift === 'shift1' || activeShift === 'shift2') return activeShift;
    if (getPlanAssignment(playerId, 'shift1')?.baseId) return 'shift1';
    if (getPlanAssignment(playerId, 'shift2')?.baseId) return 'shift2';
    return 'shift1';
  }

  function getBaseLabel(baseId) {
    const base = state.baseById?.get?.(baseId) || null;
    return String(base?.title || t('turret', 'Турель')).split('/')[0].trim() || t('turret', 'Турель');
  }

  function ensureModal() {
    let modal = document.getElementById('towerPlayerEditModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'towerPlayerEditModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-tower-player-edit></div>
      <div class="modal-card" role="dialog" aria-modal="true" style="width:min(640px, calc(100vw - 24px));">
        <div class="modal-head">
          <div>
            <h2>${t('edit_player_title', 'Редагування гравця')}</h2>
            <p class="muted" id="tpeSubtitle">${t('player_edit_subtitle', 'Зміна даних / видалення з турелі')}</p>
          </div>
          <button class="btn btn-icon" type="button" data-close-tower-player-edit>✕</button>
        </div>
        <div class="modal-grid" style="grid-template-columns:minmax(0,1fr);">
          <section class="panel subpanel stack" style="max-width:100%;">
            <div class="placement-editor stack compact">
              <div>
                <strong>${t('where_place_player', 'Куди поставити гравця')}</strong>
                <div class="muted small" id="tpePlacementCopy">${t('choose_shift_turret_role_or_reserve', 'Обери зміну, турель і роль для гравця або залиш його в резерві.')}</div>
              </div>
              <div class="placement-editor-grid">
                <label class="placement-editor-field">
                  <span>${t('shift', 'Зміна')}</span>
                  <select id="tpePlacementShift" style="color:#eef3ff">
                    <option value="shift1">${t('shift1', 'Зміна 1')}</option>
                    <option value="shift2">${t('shift2', 'Зміна 2')}</option>
                  </select>
                </label>
                <label class="placement-editor-field">
                  <span>${t('turret', 'Турель')}</span>
                  <select id="tpePlacementBase" style="color:#eef3ff"></select>
                </label>
                <label class="placement-editor-field">
                  <span>${t('role_in_turret', 'Роль у турелі')}</span>
                  <select id="tpePlacementKind" style="color:#eef3ff">
                    <option value="helper">${t('helper', 'Помічник')}</option>
                    <option value="captain">${t('captain', 'Капітан')}</option>
                  </select>
                </label>
              </div>
              <div id="tpePlacementHint" class="muted small"></div>
            </div>

            <input id="tpeName" placeholder="${t('nickname', 'Нік')}" style="color:#eef3ff" />
            <input id="tpeAlly" placeholder="${t('ally', 'Альянс')}" style="color:#eef3ff" />
            <select id="tpeRole" style="color:#eef3ff">
              <option value="Shooter">${t('shooter', 'Стрілець')}</option><option value="Fighter">${t('fighter', 'Боєць')}</option><option value="Rider">${t('rider', 'Наїзник')}</option>
            </select>
            <input id="tpeTier" placeholder="T14" style="color:#eef3ff" />
            <input id="tpeMarch" type="number" min="0" placeholder="${t('march', 'Марш')}" style="color:#eef3ff" />
            <input id="tpeRally" type="number" min="0" placeholder="${t('rally_size', 'Розмір ралі')}" style="color:#eef3ff" />
            <div id="tpeCapHint" class="muted small"></div>
            <div class="row gap wrap">
              <button class="btn btn-primary" type="button" id="tpeSaveBtn">${t('save', 'Зберегти')}</button>
              <button class="btn" type="button" id="tpeRemoveBtn">${t('remove_from_turret', 'Прибрати з турелі')}</button>
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function populatePlacementBaseOptions(modal, selectedBaseId = '') {
    if (!modal) return;
    const baseSelect = modal.querySelector('#tpePlacementBase');
    if (!baseSelect) return;

    const options = [`<option value="">${t('reserve', 'Резерв')}</option>`];
    (state.bases || []).forEach((base) => {
      const label = getBaseLabel(base.id);
      options.push(`<option value="${PNS.escapeHtml(String(base.id || ''))}">${PNS.escapeHtml(label)}</option>`);
    });
    baseSelect.innerHTML = options.join('');

    const hasSelected = selectedBaseId && Array.from(baseSelect.options).some((opt) => opt.value === selectedBaseId);
    baseSelect.value = hasSelected ? selectedBaseId : '';
  }

  function updatePlacementHint(modal) {
    if (!modal) return;
    const hint = modal.querySelector('#tpePlacementHint');
    if (!hint) return;

    const shift = normalizeEditableShift(modal.querySelector('#tpePlacementShift')?.value || state.activeShift || 'shift1');
    const baseId = String(modal.querySelector('#tpePlacementBase')?.value || '');
    const kind = String(modal.querySelector('#tpePlacementKind')?.value || 'helper');
    const shiftLabel = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : (shift === 'shift2' ? 'Зміна 2' : 'Зміна 1');

    modal.dataset.baseId = baseId;
    modal.dataset.kind = kind;

    if (!baseId) {
      hint.textContent = `${t('reserve', 'Резерв')} · ${shiftLabel}.`;
      return;
    }

    const action = kind === 'captain' ? t('captain_as_role', 'капітаном') : t('helper_as_role', 'помічником');
    hint.textContent = `${shiftLabel} · ${getBaseLabel(baseId)} · ${action}.`;
  }

  function syncPlacementFromSelectedShift(modal) {
    if (!modal) return;
    const playerId = modal.dataset.playerId || '';
    const shift = normalizeEditableShift(modal.querySelector('#tpePlacementShift')?.value || state.activeShift || 'shift1');
    const assignment = getPlanAssignment(playerId, shift);
    const selectedBaseId = assignment?.baseId || '';
    const selectedKind = assignment?.kind === 'captain' ? 'captain' : 'helper';

    populatePlacementBaseOptions(modal, selectedBaseId);
    const kindSelect = modal.querySelector('#tpePlacementKind');
    if (kindSelect) kindSelect.value = selectedKind;

    const removeBtn = modal.querySelector('#tpeRemoveBtn');
    if (removeBtn) {
      const rosterMode = modal.dataset.mode === 'roster';
      const sameAsActive = normalizeEditableShift(state.activeShift || 'shift1') === shift;
      removeBtn.hidden = rosterMode || !sameAsActive || !assignment?.baseId;
      removeBtn.textContent = t('remove_from_turret', 'Прибрати з турелі');
    }

    updatePlacementHint(modal);
  }

  function closeTowerPlayerEditModal() {
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    if (!document.querySelector('#towerPickerModal.is-open')) {
      MS.syncBodyModalLock?.();
    }
  }

  function updateModalCapUI(modal) {
    if (!modal) return;
    const mode = modal.dataset.mode || 'tower';
    const baseId = modal.querySelector('#tpePlacementBase')?.value || modal.dataset.baseId || '';
    const playerId = modal.dataset.playerId || '';
    const base = baseId ? state.baseById?.get?.(baseId) : null;
    const p = playerId ? state.playerById?.get?.(playerId) : null;
    const kind = String(modal.querySelector('#tpePlacementKind')?.value || modal.dataset.kind || 'helper');
    const tierInp = modal.querySelector('#tpeTier');
    const marchInp = modal.querySelector('#tpeMarch');
    const hint = modal.querySelector('#tpeCapHint');
    const tier = (typeof PNS.normalizeTierText === 'function')
      ? PNS.normalizeTierText(tierInp?.value || p?.tier || 'T10')
      : String(tierInp?.value || p?.tier || 'T10').toUpperCase();
    const cap = (kind !== 'captain' && base) ? getTierCapForBase(base, tier) : 0;

    if (marchInp) marchInp.removeAttribute('max');

    if (!hint) return;
    if (mode === 'roster') {
      hint.textContent = t('roster_edit_hint', 'Редагування зі списку: марш і ралі оновлюються в картці гравця.');
      return;
    }
    if (kind === 'captain') {
      hint.textContent = t('captain_tier_limit_note', 'Капітан: обмеження за тіром не застосовується.');
      return;
    }
    if (!base) {
      hint.textContent = t('choose_turret_for_limit', 'Оберіть турель, щоб побачити підказку по ліміту маршу.');
      return;
    }
    if (cap > 0) {
      hint.textContent = `${t('autofill_limit_for_tier', 'Ліміт автозаповнення для')} ${tier}: ${Number(cap).toLocaleString('en-US')} ${t('manual_value_tower_shift_note', '(ручне значення можна задати лише для цієї турелі / цієї зміни).')}`;
    } else {
      hint.textContent = `${tier}: ${t('auto_tier_limits', 'автоматично')} / 0 = ${t('no_limit', 'без обмежень')}.`;
    }
  }

  function fillPlayerFields(modal, player, marchValue, forceRallyVisible = false) {
    modal.querySelector('#tpeName').value = player?.name || '';
    modal.querySelector('#tpeAlly').value = player?.alliance || '';
    modal.querySelector('#tpeRole').value = player?.role || 'Fighter';
    modal.querySelector('#tpeTier').value = player?.tier || 'T10';
    modal.querySelector('#tpeMarch').value = player ? String(Number(marchValue || 0) || '') : '';

    const rallyInp = modal.querySelector('#tpeRally');
    if (rallyInp) {
      rallyInp.value = player ? String(Number(player.rally || 0) || '') : '';
      rallyInp.style.display = forceRallyVisible ? '' : 'none';
      rallyInp.disabled = !forceRallyVisible;
    }
  }


  function refreshTowerPlayerEditModalTexts(modal) {
    if (!modal) return;
    const mode = modal.dataset.mode || 'tower';
    const playerId = modal.dataset.playerId || '';
    const baseId = modal.dataset.baseId || '';
    const shiftSelect = modal.querySelector('#tpePlacementShift');
    const kindSelect = modal.querySelector('#tpePlacementKind');
    const placementBase = modal.querySelector('#tpePlacementBase');
    const nameInp = modal.querySelector('#tpeName');
    const allyInp = modal.querySelector('#tpeAlly');
    const marchInp = modal.querySelector('#tpeMarch');
    const rallyInp = modal.querySelector('#tpeRally');
    const saveBtn = modal.querySelector('#tpeSaveBtn');
    const removeBtn = modal.querySelector('#tpeRemoveBtn');
    const title = modal.querySelector('.modal-head h2');
    const subtitle = modal.querySelector('#tpeSubtitle');
    const placementCopy = modal.querySelector('#tpePlacementCopy');
    const fields = modal.querySelectorAll('.placement-editor-field > span');
    const roleOptions = modal.querySelectorAll('#tpeRole option');
    const kindOptions = modal.querySelectorAll('#tpePlacementKind option');
    if (title) title.textContent = t('edit_player_title', 'Редагування гравця');
    if (fields[0]) fields[0].textContent = t('shift', 'Зміна');
    if (fields[1]) fields[1].textContent = t('turret', 'Турель');
    if (fields[2]) fields[2].textContent = t('role_in_turret', 'Роль у турелі');
    if (shiftSelect?.options?.[0]) shiftSelect.options[0].textContent = t('shift1', 'Зміна 1');
    if (shiftSelect?.options?.[1]) shiftSelect.options[1].textContent = t('shift2', 'Зміна 2');
    if (kindOptions?.[0]) kindOptions[0].textContent = t('helper', 'Помічник');
    if (kindOptions?.[1]) kindOptions[1].textContent = t('captain', 'Капітан');
    if (placementBase?.options?.length) {
      const first = placementBase.options[0];
      if (first && first.value === '') first.textContent = t('reserve', 'Резерв');
    }
    if (nameInp) nameInp.placeholder = t('nickname', 'Нік');
    if (allyInp) allyInp.placeholder = t('ally', 'Альянс');
    if (marchInp) marchInp.placeholder = t('march', 'Марш');
    if (rallyInp) rallyInp.placeholder = t('rally_size', 'Розмір ралі');
    if (roleOptions?.[0]) roleOptions[0].textContent = t('shooter', 'Стрілець');
    if (roleOptions?.[1]) roleOptions[1].textContent = t('fighter', 'Боєць');
    if (roleOptions?.[2]) roleOptions[2].textContent = t('rider', 'Наїзник');
    if (saveBtn) saveBtn.textContent = t('save', 'Зберегти');
    if (removeBtn) removeBtn.textContent = t('remove_from_turret', 'Прибрати з турелі');

    if (mode === 'roster') {
      if (subtitle) subtitle.textContent = t('choose_turret_role_shift_or_reserve', 'Обери турель, роль і зміну для гравця або залиш його в резерві.');
      if (placementCopy) placementCopy.textContent = t('roster_edit_apply_selected_shift', 'Редагування зі списку гравців: зміни застосовуються до вибраної зміни.');
    } else {
      const base = state.baseById?.get?.(baseId);
      const isCaptain = !!(playerId && base && base.captainId === playerId);
      const towerName = getBaseLabel(baseId);
      if (subtitle) subtitle.textContent = isCaptain ? `${t('captain', 'Капітан')} · ${towerName}` : `${t('helper_in_turret', 'Помічник у турелі')} · ${towerName}`;
      if (placementCopy) placementCopy.textContent = t('quick_move_player', 'Можна швидко перенести гравця в іншу турель або в іншу зміну.');
    }
    updatePlacementHint(modal);
    updateModalCapUI(modal);
  }

  function openTowerPlayerEditModal(baseId, playerId) {
    const base = state.baseById?.get?.(baseId);
    if (!base) return;

    const p = playerId ? state.playerById?.get?.(playerId) : null;
    const isCaptain = !!(playerId && base.captainId === playerId);
    const modal = ensureModal();

    modal.dataset.mode = 'tower';
    modal.dataset.baseId = String(baseId || '');
    modal.dataset.playerId = String(playerId || '');
    modal.dataset.kind = isCaptain ? 'captain' : 'helper';

    const activeEditableShift = normalizeEditableShift(state.activeShift || 'shift1');
    const placementShift = modal.querySelector('#tpePlacementShift');
    if (placementShift) placementShift.value = activeEditableShift;
    populatePlacementBaseOptions(modal, baseId);
    const placementKind = modal.querySelector('#tpePlacementKind');
    if (placementKind) placementKind.value = isCaptain ? 'captain' : 'helper';

    const currentInTower = getPlayerCurrentTowerMarch(base, p, isCaptain);
    fillPlayerFields(modal, p, currentInTower, isCaptain);
    refreshTowerPlayerEditModalTexts(modal);

    const removeBtn = modal.querySelector('#tpeRemoveBtn');
    if (removeBtn) removeBtn.hidden = !playerId;

    updatePlacementHint(modal);
    updateModalCapUI(modal);

    modal.classList.add('is-open');
    MS.syncBodyModalLock?.();
  }

  function openRosterPlayerEditModal(playerId) {
    const player = state.playerById?.get?.(playerId);
    if (!player) return;

    const modal = ensureModal();
    modal.dataset.mode = 'roster';
    modal.dataset.playerId = String(playerId || '');
    modal.dataset.baseId = '';
    modal.dataset.kind = 'helper';

    const preferredShift = getPreferredRosterShift(playerId);
    const placementShift = modal.querySelector('#tpePlacementShift');
    if (placementShift) placementShift.value = preferredShift;

    fillPlayerFields(modal, player, player.march, true);
    syncPlacementFromSelectedShift(modal);
    refreshTowerPlayerEditModalTexts(modal);

    modal.classList.add('is-open');
    MS.syncBodyModalLock?.();
  }

  function persistPlayerAndBoardState() {
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
  }

  function saveTowerPlayerEditModal() {
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal) return;

    const mode = modal.dataset.mode || 'tower';
    const playerId = modal.dataset.playerId || '';
    const targetShift = normalizeEditableShift(modal.querySelector('#tpePlacementShift')?.value || state.activeShift || 'shift1');
    const targetBaseId = String(modal.querySelector('#tpePlacementBase')?.value || '');
    const targetKind = String(modal.querySelector('#tpePlacementKind')?.value || 'helper') === 'captain' ? 'captain' : 'helper';
    const targetBase = targetBaseId ? state.baseById?.get?.(targetBaseId) : null;

    const name = String(modal.querySelector('#tpeName')?.value || '').trim();
    const ally = String(modal.querySelector('#tpeAlly')?.value || '').trim();
    const role = (typeof PNS.normalizeRole === 'function')
      ? PNS.normalizeRole(modal.querySelector('#tpeRole')?.value || 'Fighter')
      : String(modal.querySelector('#tpeRole')?.value || 'Fighter');
    const tier = (typeof PNS.normalizeTierText === 'function')
      ? PNS.normalizeTierText(modal.querySelector('#tpeTier')?.value || 'T10')
      : String(modal.querySelector('#tpeTier')?.value || 'T10').toUpperCase();
    const march = Number(modal.querySelector('#tpeMarch')?.value || 0) || 0;
    const rally = Number(modal.querySelector('#tpeRally')?.value || 0) || 0;

    if (!name || !march) { alert(t('enter_nick_and_march', 'Вкажи нік і марш')); return; }

    let p = playerId ? state.playerById?.get?.(playerId) : null;
    if (p) {
      p.name = name;
      p.alliance = ally;
      p.role = role;
      p.tier = tier;
      if (typeof PNS.tierRank === 'function') p.tierRank = PNS.tierRank(tier);

      if (mode === 'roster') {
        p.march = march;
        p.rally = rally;
      } else if (targetKind === 'captain') {
        p.march = march;
        p.rally = rally;
        try { if (targetBase) PNS.clearTowerMarchOverride?.(targetBase.id, p.id, targetShift); } catch {}
      } else if (targetBase) {
        try { PNS.setTowerMarchOverride?.(targetBase.id, p.id, march, targetShift); } catch {}
      }
    } else {
      p = {
        id: `m_${Date.now()}_${Math.floor(Math.random() * 1e5)}`,
        name,
        playerExternalId: '',
        alliance: ally,
        role,
        tier,
        tierRank: (typeof PNS.tierRank === 'function' ? PNS.tierRank(tier) : 0),
        march,
        rally,
        captainReady: false,
        shift: targetShift,
        shiftLabel: (PNS.formatShiftLabelForCell ? PNS.formatShiftLabelForCell(targetShift) : targetShift),
        lairLevel: '',
        secondaryRole: '',
        secondaryTier: '',
        troop200k: '',
        notes: t('manual_addition_note', 'Ручне додавання'),
        raw: null,
        rowEl: null,
        actionCellEl: null,
        assignment: null
      };
      state.players.push(p);
      state.playerById?.set?.(p.id, p);
    }

    if (String(state.activeShift || '').toLowerCase() !== targetShift) {
      MS.applyShiftFilter?.(targetShift);
    }

    if (targetBaseId && targetBase) {
      const err = typeof PNS.validateAssign === 'function' ? PNS.validateAssign(p, targetBase, targetKind) : '';
      if (err) {
        try { PNS.setRowStatus?.(p, err, 'danger'); } catch {}
        alert(err);
        return;
      }
      try { PNS.assignPlayerToBase?.(p.id, targetBase.id, targetKind); } catch {}
      if (mode === 'roster' && targetKind === 'helper') {
        try { PNS.clearTowerMarchOverride?.(targetBase.id, p.id, targetShift); } catch {}
      }
    } else {
      try { if (p.assignment) PNS.clearPlayerFromBase?.(p.id); } catch {}
    }

    persistPlayerAndBoardState();
    modal.classList.remove('is-open');
    if (!document.querySelector('#towerPickerModal.is-open')) MS.syncBodyModalLock?.();

    try { MS.refreshTowerPickerModalList?.(); } catch {}
    try { MS.updateTowerPickerDetail?.(); } catch {}

    try {
      document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: { baseId: targetBase?.id || '', playerId: p.id, shift: targetShift } }));
    } catch {}
  }

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'tpeTier') updateModalCapUI(document.getElementById('towerPlayerEditModal'));
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    const modal = document.getElementById('towerPlayerEditModal');
    if (!t || !modal) return;
    if (t.id === 'tpeTier') {
      updateModalCapUI(modal);
      return;
    }
    if (t.id === 'tpePlacementShift') {
      syncPlacementFromSelectedShift(modal);
      updateModalCapUI(modal);
      return;
    }
    if (t.id === 'tpePlacementBase' || t.id === 'tpePlacementKind') {
      updatePlacementHint(modal);
      updateModalCapUI(modal);
    }
  });


  document.addEventListener('pns:i18n-changed', () => {
    const modal = document.getElementById('towerPlayerEditModal');
    if (modal) refreshTowerPlayerEditModalTexts(modal);
  });

  Object.assign(MS, {
    getTierCapForBase,
    openTowerPlayerEditModal,
    openRosterPlayerEditModal,
    closeTowerPlayerEditModal,
    saveTowerPlayerEditModal,
  });
})();
