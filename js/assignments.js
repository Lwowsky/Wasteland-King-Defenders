(function () {
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

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
    if (!player || !base) return 'Player or base not found.';
    if (!PNS.ROLE_KEYS?.includes?.(player.role)) return `Unknown role for ${player.name}.`;

    const ignoreShiftAutoFill = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');
    if (
      kind === 'helper' &&
      !ignoreShiftAutoFill &&
      base.shift !== 'both' &&
      player.shift !== 'both' &&
      base.shift !== player.shift
    ) {
      return `Shift mismatch: ${player.shiftLabel} vs ${base.title.split('/')[0].trim()}.`;
    }

    if (kind === 'helper' && !base.captainId) {
      return `Set a captain first for "${base.title}".`;
    }

    const effectiveRole = (typeof PNS.getBaseRole === 'function') ? PNS.getBaseRole(base) : null;
    if (kind === 'helper' && effectiveRole && player.role !== effectiveRole) {
      return `Role mismatch: ${player.role} cannot go to ${effectiveRole} base.`;
    }

    if (kind === 'helper') {
      const helperCountAfter = base.helperIds.filter((id) => id !== player.id).length + 1;
      if (Number.isFinite(base.maxHelpers) && base.maxHelpers > 0 && helperCountAfter > base.maxHelpers) {
        return `Max helpers reached: ${helperCountAfter}/${base.maxHelpers}.`;
      }

      const captain = state.playerById.get(base.captainId);
      const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;

      const helpersSum = base.helperIds.reduce((sum, id) => {
        if (id === player.id) return sum;
        return sum + helperMarchForBase(base, state.playerById.get(id));
      }, 0);

      const totalAfter = (captain?.march || 0) + helpersSum + helperMarchForBase(base, player);
      if (limit && totalAfter > limit) {
        return `Over limit: ${PNS.formatNum(totalAfter)} > ${PNS.formatNum(limit)}.`;
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
      if (editorActionBtn) {
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
          if (!pid) { alert('Select player to remove from this tower'); return; }
          if (!removePlayerFromSpecificBase(baseId, pid)) alert('Selected player is not assigned to this tower.');
          return;
        }

        if (!pid) { alert('Select player first'); return; }
        assignPlayerToBase(pid, baseId, editorActionBtn.dataset.baseEditorAction);
        return;
      }
    });

    state._baseToolsDelegationBound = true;
  }

  function buildRowActions() {
    // Після partial swap / render DOM може бути новий:
    // state.players є, але actionCellEl можуть бути ще не проставлені - тоді просто пропускаємо.
    state.players.forEach((player) => {
      const cell = player.actionCellEl;
      if (!cell) return;

      cell.classList.remove('muted');
      cell.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.className = 'row-actions';

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Base for ${player.name}`);

      state.bases.forEach((base) => {
        const opt = document.createElement('option');
        opt.value = base.id;
        opt.textContent = base.title.split('/')[0].trim();
        select.appendChild(opt);
      });

      const btnCaptain = document.createElement('button');
      btnCaptain.type = 'button';
      btnCaptain.className = 'btn btn-xs';
      btnCaptain.textContent = 'Captain';
      btnCaptain.addEventListener('click', () => assignPlayerToBase(player.id, select.value, 'captain'));

      const btnHelper = document.createElement('button');
      btnHelper.type = 'button';
      btnHelper.className = 'btn btn-xs';
      btnHelper.textContent = 'Helper';
      btnHelper.addEventListener('click', () => assignPlayerToBase(player.id, select.value, 'helper'));

      const btnClear = document.createElement('button');
      btnClear.type = 'button';
      btnClear.className = 'btn btn-xs';
      btnClear.textContent = 'Clear';
      btnClear.addEventListener('click', () => {
        clearPlayerFromBase(player.id);
        if (typeof PNS.renderAll === 'function') PNS.renderAll();
      });

      wrap.append(select, btnCaptain, btnHelper, btnClear);

      const status = document.createElement('div');
      status.className = 'row-status';
      status.textContent = player.assignment ? 'Assigned' : 'Not assigned';

      cell.append(wrap, status);
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
  PNS.validateAssign = validateAssign;
  PNS.assignPlayerToBase = assignPlayerToBase;
  PNS.clearBase = clearBase;
  PNS.removePlayerFromSpecificBase = removePlayerFromSpecificBase;
  PNS.buildRowActions = buildRowActions;

  // NEW: init for partials
  PNS.assignmentsInit = assignmentsInit;
})();