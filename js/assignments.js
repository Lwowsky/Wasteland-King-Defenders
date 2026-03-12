(function () {
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);
  const roleLabel = (value, plural = false) => (typeof PNS.roleLabel === 'function' ? PNS.roleLabel(value, plural) : String(value || ''));
  const shiftLabel = (value) => (typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(value) : String(value || ''));

  function setRowStatus(player, text, level = '') {
    const status = player?.actionCellEl?.querySelector?.('.row-status');
    if (!status) return;
    status.textContent = text || '';
    status.className = 'row-status' + (level ? ` ${level}` : '');
  }

  function helperMarchForBase(base, player) {
    if (!player) return 0;
    if (typeof PNS.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
    return Number(player.march || 0) || 0;
  }

  function sameTroopOnlyEnabled() {
    try {
      if (typeof PNS.getTowerAssignmentPolicy === 'function') {
        return !!PNS.getTowerAssignmentPolicy(null, null, 'helper').sameTroopOnly;
      }
    } catch {}
    try {
      if (typeof PNS.isTowerNoMixTroopsEnabled === 'function') return !!PNS.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function noCrossShiftDupesEnabled() {
    try {
      if (typeof PNS.getTowerAssignmentPolicy === 'function') {
        return !!PNS.getTowerAssignmentPolicy(null, null, 'helper').noCrossShiftDupes;
      }
    } catch {}
    try {
      if (typeof PNS.isTowerNoCrossShiftDupesEnabled === 'function') return !!PNS.isTowerNoCrossShiftDupesEnabled();
    } catch {}
    return true;
  }

  function readAssignmentPolicy(player, base, kind) {
    try {
      if (typeof PNS.getTowerAssignmentPolicy === 'function') {
        return PNS.getTowerAssignmentPolicy(player, base, kind) || {};
      }
    } catch {}
    return {};
  }

  function canUsePlayerAcrossShifts(player, base, kind) {
    if (kind !== 'helper' || !player || !base) return false;
    const policy = readAssignmentPolicy(player, base, kind);
    return !!policy.allowCrossShiftReuse;
  }

  function persistAfterTowerChange(meta = {}) {
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: meta })); } catch {}
  }

  function clearPlayerFromBase(playerId) {
    const player = state.playerById.get(playerId);
    if (!player || !player.assignment) return;
    const base = state.baseById.get(player.assignment.baseId);
    if (!base) {
      player.assignment = null;
      return;
    }

    if (player.assignment.kind === 'captain' && base.captainId === player.id) {
      base.captainId = null;
      base.helperIds.forEach((id) => {
        const hp = state.playerById.get(id);
        if (hp) hp.assignment = null;
      });
      base.helperIds = [];
      if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, null);
    }

    if (player.assignment.kind === 'helper') {
      base.helperIds = base.helperIds.filter((id) => id !== player.id);
      try {
        if (player.towerMarchOverrideByBase && typeof player.towerMarchOverrideByBase === 'object') {
          delete player.towerMarchOverrideByBase[base.id];
        }
        delete player.towerMarchOverride;
      } catch {}
    }

    player.assignment = null;
  }

  function validateAssign(player, base, kind) {
    if (!player || !base) return t('player_or_turret_not_found', 'Гравця або турель не знайдено.');
    if (!PNS.ROLE_KEYS?.includes?.(player.role)) return `${t('troop_type_unknown_for', 'Не вдалося визначити тип військ для')} ${player.name}.`;

    const policy = readAssignmentPolicy(player, base, kind);
    const allowCrossShiftReuse = !!policy.allowCrossShiftReuse;
    const ignoreShiftMismatch = !!policy.ignoreShiftMismatch;
    if (
      kind === 'helper' &&
      !ignoreShiftMismatch &&
      !allowCrossShiftReuse &&
      base.shift !== 'both' &&
      player.shift !== 'both' &&
      base.shift !== player.shift
    ) {
      return `${t('shift_mismatch', 'Невідповідність зміни')}: ${shiftLabel(player.shiftLabel || player.shift)} vs ${String(base.title || '').split('/')[0].trim()}.`;
    }

    if (kind === 'helper' && !base.captainId) {
      return `${t('place_captain_first', 'Спочатку постав капітана в турель')} «${base.title}».`;
    }

    const effectiveRole = (typeof PNS.getBaseRole === 'function') ? PNS.getBaseRole(base) : null;
    if (kind === 'helper' && (policy.sameTroopOnly ?? sameTroopOnlyEnabled()) && effectiveRole && player.role !== effectiveRole) {
      return `${t('troop_mismatch', 'Невідповідність типу військ')}: ${roleLabel(player.role)} ${t('cannot_be_assigned_to', 'не може бути призначений у турель типу')} ${roleLabel(effectiveRole)}.`;
    }

    if (kind === 'helper' && (policy.noCrossShiftDupes ?? noCrossShiftDupesEnabled())) {
      const curShift = String(state.activeShift || '').toLowerCase();
      if (curShift === 'shift1' || curShift === 'shift2') {
        const hit = policy.otherShiftBlocker
          || policy.otherShiftHit
          || (typeof PNS.getOtherShiftBlocker === 'function' ? PNS.getOtherShiftBlocker(player.id, curShift, kind) : null)
          || (typeof PNS.isPlayerUsedInOtherShift === 'function' ? PNS.isPlayerUsedInOtherShift(player.id, curShift) : null);
        if (hit) return `${t('already_assigned_in', 'Гравець уже призначений у')} ${hit.label || shiftLabel(hit.shift) || t('other_shift', 'іншій зміні')}.`;
      }
    }

    if (kind === 'helper') {
      const helperCountAfter = base.helperIds.filter((id) => id !== player.id).length + 1;
      if (Number.isFinite(base.maxHelpers) && base.maxHelpers > 0 && helperCountAfter > base.maxHelpers) {
        return `${t('helpers_limit_full', 'Ліміт помічників заповнений')}: ${helperCountAfter}/${base.maxHelpers}.`;
      }

      const captain = state.playerById.get(base.captainId);
      const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;

      const helpersSum = base.helperIds.reduce((sum, id) => {
        if (id === player.id) return sum;
        return sum + helperMarchForBase(base, state.playerById.get(id));
      }, 0);

      const totalAfter = (captain?.march || 0) + helpersSum + helperMarchForBase(base, player);
      if (limit && totalAfter > limit) {
        return `${t('limit_exceeded', 'Перевищено ліміт')}: ${PNS.formatNum(totalAfter)} > ${PNS.formatNum(limit)}.`;
      }
    }

    return '';
  }

  function assignPlayerToBase(playerId, baseId, kind) {
    const player = state.playerById.get(playerId);
    const base = state.baseById.get(baseId);
    if (!player || !base) return;

    const err = validateAssign(player, base, kind);
    if (err) {
      setRowStatus(player, err, 'danger');
      alert(err);
      return;
    }

    clearPlayerFromBase(player.id);

    if (kind === 'captain') {
      const prevRole = (typeof PNS.getBaseRole === 'function') ? PNS.getBaseRole(base) : null;

      if (base.captainId && base.captainId !== player.id) {
        const prev = state.playerById.get(base.captainId);
        if (prev) prev.assignment = null;
      }

      base.captainId = player.id;
      player.assignment = { baseId: base.id, kind: 'captain' };
      try {
        if (player.towerMarchOverrideByBase && typeof player.towerMarchOverrideByBase === 'object') delete player.towerMarchOverrideByBase[base.id];
        delete player.towerMarchOverride;
      } catch {}
      if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, player.role);

      if (prevRole && prevRole !== player.role) {
        base.helperIds.forEach((hid) => {
          const hp = state.playerById.get(hid);
          if (hp) hp.assignment = null;
        });
        base.helperIds = [];
      }

      const captainLimit = player.rally || player.march || 0;
      let helperSum = 0;
      const kept = [];

      // NOTE: base.helperIds вже міг бути очищений вище, але залишаємо алгоритм безпечним.
      for (const hid of base.helperIds) {
        const hp = state.playerById.get(hid);
        if (!hp) continue;

        if (hp.role !== player.role) { hp.assignment = null; continue; }

        const hpEff = helperMarchForBase(base, hp);
        if (helperSum + hpEff + (player.march || 0) <= captainLimit) {
          helperSum += hpEff;
          kept.push(hid);
        } else {
          hp.assignment = null;
        }
      }
      base.helperIds = kept;

    } else {
      if (!base.helperIds.includes(player.id)) base.helperIds.push(player.id);
      player.assignment = { baseId: base.id, kind: 'helper' };
    }

    if (typeof PNS.renderAll === 'function') PNS.renderAll();
    persistAfterTowerChange({ type: 'assign', baseId: base.id, playerId: player.id, kind });
  }

  function clearBase(baseId, helpersOnly = false) {
    const base = state.baseById.get(baseId);
    if (!base) return;

    if (!helpersOnly && base.captainId) {
      const cp = state.playerById.get(base.captainId);
      if (cp) cp.assignment = null;
      base.captainId = null;
      if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, null);
    }

    base.helperIds.forEach((id) => {
      const hp = state.playerById.get(id);
      if (hp) {
        hp.assignment = null;
        try {
          if (hp.towerMarchOverrideByBase && typeof hp.towerMarchOverrideByBase === 'object') {
            delete hp.towerMarchOverrideByBase[base.id];
          }
          if (hp.assignment?.baseId === base.id) delete hp.towerMarchOverride;
          else delete hp.towerMarchOverride; // legacy global override should not survive clear
        } catch {}
      }
    });
    base.helperIds = [];

    if (typeof PNS.renderAll === 'function') PNS.renderAll();
    persistAfterTowerChange({ type: 'clear-base', baseId: base.id, helpersOnly: !!helpersOnly });
  }

  function removePlayerFromSpecificBase(baseId, playerId) {
    const base = state.baseById.get(baseId);
    const p = state.playerById.get(playerId);
    if (!base || !p) return false;

    if (base.captainId === p.id) {
      clearBase(baseId, false);
      return true;
    }

    if (base.helperIds.includes(p.id)) {
      base.helperIds = base.helperIds.filter((id) => id !== p.id);
      try {
        if (p.towerMarchOverrideByBase && typeof p.towerMarchOverrideByBase === 'object') delete p.towerMarchOverrideByBase[base.id];
        delete p.towerMarchOverride;
      } catch {}
      p.assignment = null;
      if (typeof PNS.renderAll === 'function') PNS.renderAll();
      persistAfterTowerChange({ type: 'remove', baseId, playerId: p.id });
      return true;
    }

    return false;
  }

  function bindBaseToolsDelegationOnce() {
    if (state._baseToolsDelegationBound) return;

    document.addEventListener('click', (e) => {
      const autoBtn = e.target.closest('[data-base-autofill]');
      if (autoBtn) {
        e.preventDefault();
        if (typeof PNS.autoFillBase === 'function') PNS.autoFillBase(autoBtn.dataset.baseAutofill);
        return;
      }

      const helpersBtn = e.target.closest('[data-base-clear-helpers]');
      if (helpersBtn) {
        e.preventDefault();
        clearBase(helpersBtn.dataset.baseClearHelpers, true);
        return;
      }

      const allBtn = e.target.closest('[data-base-clear-all]');
      if (allBtn) {
        e.preventDefault();
        clearBase(allBtn.dataset.baseClearAll, false);
        return;
      }

      const removeBtn = e.target.closest('[data-base-remove-player]');
      if (removeBtn) {
        e.preventDefault();
        removePlayerFromSpecificBase(removeBtn.dataset.baseRemovePlayer, removeBtn.dataset.playerId);
        return;
      }

      const editorActionBtn = e.target.closest('[data-base-editor-action]');
      const legacyBaseEditorEnabled = typeof PNS.isLegacyBaseEditorEnabled === 'function'
        ? !!PNS.isLegacyBaseEditorEnabled()
        : (typeof PNS.shouldRenderLegacyBaseEditor === 'function' ? !!PNS.shouldRenderLegacyBaseEditor() : false);
      if (editorActionBtn && legacyBaseEditorEnabled) {
        e.preventDefault();
        const baseId = editorActionBtn.dataset.baseId;
        const base = state.baseById.get(baseId);
        const editor = base?.cardEl ? base.cardEl.querySelector('.base-editor') : null;
        const sel = editor ? editor.querySelector(`select[data-base-editor-select="${baseId}"]`) : null;
        const pid = sel?.value || '';

        if (!base) return;

        if (editorActionBtn.dataset.baseEditorAction === 'manualsave') {
          if (typeof PNS.saveManualPlayerFromBaseEditor === 'function') {
            PNS.saveManualPlayerFromBaseEditor(baseId);
          }
          return;
        }

        if (editorActionBtn.dataset.baseEditorAction === 'remove') {
          if (!pid) { alert(t('select_player_to_remove', 'Вибери гравця, якого треба прибрати з цієї турелі')); return; }
          if (!removePlayerFromSpecificBase(baseId, pid)) alert(t('selected_player_not_assigned', 'Вибраний гравець не призначений до цієї турелі.'));
          return;
        }

        if (!pid) { alert(t('choose_player_first', 'Спочатку вибери гравця')); return; }
        assignPlayerToBase(pid, baseId, editorActionBtn.dataset.baseEditorAction);
        return;
      }
    });

    state._baseToolsDelegationBound = true;
  }

  function getShiftAssignment(player, shiftKey) {
    const shift = String(shiftKey || '').toLowerCase();
    if (shift !== 'shift1' && shift !== 'shift2') return null;

    if (String(state.activeShift || '').toLowerCase() === shift) {
      return player?.assignment ? { ...player.assignment } : null;
    }

    const plan = state.shiftPlans?.[shift] || null;
    const assignment = plan?.players?.[player?.id] || null;
    return assignment ? { ...assignment } : null;
  }

  function getPlacementSummary(player, shiftKey) {
    const shift = String(shiftKey || '').toLowerCase();
    const shiftLabel = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : (shift === 'shift1' ? t('shift1', 'Зміна 1') : t('shift2', 'Зміна 2'));
    const assignment = getShiftAssignment(player, shift);
    if (!assignment?.baseId) {
      return {
        shift,
        shiftLabel,
        assigned: false,
        title: t('reserve', 'Резерв'),
        detail: t('not_assigned', 'Не призначено'),
      };
    }

    const base = state.baseById?.get?.(assignment.baseId) || null;
    const baseName = String(base?.title || t('turret', 'Турель')).split('/')[0].trim() || t('turret', 'Турель');
    return {
      shift,
      shiftLabel,
      assigned: true,
      title: baseName,
      detail: assignment.kind === 'captain' ? t('captain', 'Капітан') : t('helper', 'Помічник'),
    };
  }

  function buildPlacementHtml(player) {
    const activeShift = String(state.activeShift || '').toLowerCase();
    const itemsHtml = ['shift1', 'shift2'].map((shiftKey) => {
      const summary = getPlacementSummary(player, shiftKey);
      const classes = [
        'player-placement-item',
        summary.assigned ? 'is-assigned' : 'is-reserve',
        activeShift === shiftKey ? 'is-active' : '',
      ].filter(Boolean).join(' ');

      return `
        <div class="${classes}">
          <span class="player-placement-shift">${summary.shiftLabel}</span>
          <div class="player-placement-main">
            <strong>${PNS.escapeHtml(summary.title)}</strong>
            <small>${PNS.escapeHtml(summary.detail)}</small>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="player-placement-card">
        <div class="player-placement-grid">${itemsHtml}</div>
        <button type="button" class="btn btn-xs btn-placement-edit" data-edit-player-placement="${PNS.escapeHtml(String(player.id || ''))}">✎ ${PNS.escapeHtml(t('edit', 'Редагувати'))}</button>
        <div class="row-status"></div>
      </div>`;
  }

  function buildRowActions() {
    state.players.forEach((player) => {
      const cell = player.actionCellEl;
      if (!cell) return;

      cell.classList.remove('muted');
      cell.innerHTML = buildPlacementHtml(player);

      const editBtn = cell.querySelector('[data-edit-player-placement]');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (PNS.ModalsShift?.openRosterPlayerEditModal) {
            PNS.ModalsShift.openRosterPlayerEditModal(player.id);
            return;
          }
          const firstBaseId = state.bases?.[0]?.id || '';
          if (firstBaseId && PNS.ModalsShift?.openTowerPlayerEditModal) {
            PNS.ModalsShift.openTowerPlayerEditModal(firstBaseId, player.id);
          }
        });
      }
    });

    bindBaseToolsDelegationOnce();
  }

  // ======= PUBLIC init for partials / rebind =======
  // Викликай після htmx:afterSwap або після render table.
  function assignmentsInit() {
    // Немає сенсу, якщо ще не створені дані
    if (!state || !Array.isArray(state.players) || !Array.isArray(state.bases)) return;
    buildRowActions();
  }

  // exports
  PNS.setRowStatus = setRowStatus;
  PNS.clearPlayerFromBase = clearPlayerFromBase;
  PNS.validateAssignCore = validateAssign;
  PNS.assignPlayerToBaseCore = assignPlayerToBase;
  PNS.validateAssign = validateAssign;
  PNS.assignPlayerToBase = assignPlayerToBase;
  PNS.clearBase = clearBase;
  PNS.removePlayerFromSpecificBase = removePlayerFromSpecificBase;
  PNS.buildRowActions = buildRowActions;

  // NEW: init for partials
  PNS.assignmentsInit = assignmentsInit;
})();