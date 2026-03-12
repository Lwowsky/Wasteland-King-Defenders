(function () {
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};

  function normalizeShift(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'shift1' || s === 'shift2' || s === 'both' || s === 'all') return s;
    if (/\b1\b/.test(s) || /shift\s*1/.test(s)) return 'shift1';
    if (/\b2\b/.test(s) || /shift\s*2/.test(s)) return 'shift2';
    if (s === '') return 'both';
    return 'both';
  }

  function getScopedPickerRoot() {
    try {
      const scoped = state._towerPickerActiveScopeRoot;
      if (scoped && typeof scoped.querySelector === 'function' && document.contains(scoped)) return scoped;
    } catch {}
    try {
      const calcOpen = document.querySelector('#towerCalcModal.is-open .tower-picker-scope[data-calc-inline-scope]');
      if (calcOpen) return calcOpen;
    } catch {}
    try {
      const pickerOpen = document.querySelector('#towerPickerModal.is-open .tower-picker-scope');
      if (pickerOpen) return pickerOpen;
    } catch {}
    return null;
  }

  function readCheckbox(id) {
    try {
      const scopedRoot = getScopedPickerRoot();
      const scoped = scopedRoot?.querySelector?.('#' + id);
      if (scoped) return !!scoped.checked;
    } catch {}
    try {
      const modalScoped = document.querySelector('#towerPickerModal.is-open #' + id) || document.querySelector('#towerCalcModal.is-open #' + id);
      if (modalScoped) return !!modalScoped.checked;
    } catch {}
    try {
      const el = document.getElementById(id);
      if (el) return !!el.checked;
    } catch {}
    return null;
  }

  function sameTroopOnlyEnabled() {
    const live = readCheckbox('pickerNoMixTroops');
    if (typeof live === 'boolean') return live;
    if (typeof state.towerPickerNoMixTroops === 'boolean') return !!state.towerPickerNoMixTroops;
    return true;
  }

  function matchRegisteredShiftEnabled() {
    const ignoreLegacyToggle = readCheckbox('ignoreShiftAutoFillToggle');
    if (ignoreLegacyToggle === true) return false;
    const live = readCheckbox('pickerMatchRegisteredShift');
    if (typeof live === 'boolean') return live;
    if (typeof state.towerPickerMatchRegisteredShift === 'boolean') return !!state.towerPickerMatchRegisteredShift;
    return true;
  }

  function readCalcNoCrossShift() {
    try {
      const live = readCheckbox('towerCalcNoCrossShift');
      if (typeof live === 'boolean') return live;
    } catch {}
    try {
      const tc = state?.towerCalc;
      if (tc && typeof tc.noCrossShift === 'boolean') return !!tc.noCrossShift;
    } catch {}
    try {
      const raw = localStorage.getItem('pns_tower_calc_state');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data.noCrossShift === 'boolean') return !!data.noCrossShift;
      }
    } catch {}
    return true;
  }

  function noCrossShiftDupesEnabled() {
    return readCalcNoCrossShift();
  }

  function getShiftLabel(shiftKey) {
    return shiftKey === 'shift1' ? 'Зміна 1' : shiftKey === 'shift2' ? 'Зміна 2' : 'Обидві';
  }

  function getPlayerUseInShift(playerId, shiftKey) {
    const shift = normalizeShift(shiftKey);
    if (!playerId || (shift !== 'shift1' && shift !== 'shift2')) return null;

    const plan = state.shiftPlans?.[shift];
    const assignment = plan?.players?.[playerId] || null;
    if (!assignment || !assignment.baseId) return null;

    return {
      shift,
      label: getShiftLabel(shift),
      assignment: {
        baseId: assignment.baseId,
        kind: assignment.kind,
      },
    };
  }

  function getOtherShiftHitRaw(playerId, currentShift) {
    const cur = normalizeShift(currentShift || state.activeShift || 'all');
    if (cur !== 'shift1' && cur !== 'shift2') return null;
    const other = cur === 'shift1' ? 'shift2' : 'shift1';
    return getPlayerUseInShift(playerId, other);
  }

  function getOtherShiftBlocker(playerId, currentShift, kind = 'helper') {
    const roleKind = String(kind || '').toLowerCase();
    const raw = getOtherShiftHitRaw(playerId, currentShift);
    if (!raw) return null;

    // Important behavior parity with legacy calculator:
    // a player who is CAPTAIN in the other shift may still be HELPER here.
    if (roleKind === 'helper' && String(raw?.assignment?.kind || '').toLowerCase() === 'captain') {
      return null;
    }

    return raw;
  }

  function getTowerAssignmentPolicy(player, base, kind) {
    const roleKind = String(kind || '').toLowerCase();
    const currentShift = normalizeShift(state.activeShift || 'all');
    const otherShiftHitRaw = (roleKind === 'helper' && player && (currentShift === 'shift1' || currentShift === 'shift2'))
      ? getOtherShiftHitRaw(player.id, currentShift)
      : null;

    const noCrossShiftDupes = noCrossShiftDupesEnabled();
    const matchRegisteredShift = matchRegisteredShiftEnabled();
    const allowCrossShiftCaptainHelper = !!(
      roleKind === 'helper' &&
      otherShiftHitRaw &&
      String(otherShiftHitRaw?.assignment?.kind || '').toLowerCase() === 'captain'
    );
    const otherShiftBlocker = noCrossShiftDupes
      ? getOtherShiftBlocker(player?.id, currentShift, roleKind)
      : null;
    const allowCrossShiftReuse = !!(
      roleKind === 'helper' &&
      (allowCrossShiftCaptainHelper || (!noCrossShiftDupes && otherShiftHitRaw))
    );

    return {
      sameTroopOnly: sameTroopOnlyEnabled(),
      matchRegisteredShift,
      noCrossShiftDupes,
      otherShiftHit: otherShiftBlocker,
      otherShiftHitRaw,
      otherShiftBlocker,
      allowCrossShiftReuse,
      allowCrossShiftCaptainHelper,
      ignoreShiftMismatch: !matchRegisteredShift,
      normalizeShift,
      playerShift: normalizeShift(player?.shift || player?.shiftLabel || 'both'),
      baseShift: normalizeShift(base?.shift || currentShift || 'both'),
    };
  }

  function installPolicyExports() {
    PNS.normalizePlannerShift = normalizeShift;
    PNS.isTowerNoMixTroopsEnabled = sameTroopOnlyEnabled;
    PNS.isTowerMatchRegisteredShiftEnabled = matchRegisteredShiftEnabled;
    PNS.isTowerNoCrossShiftDupesEnabled = noCrossShiftDupesEnabled;
    PNS.getPlayerUseInShift = getPlayerUseInShift;
    PNS.getOtherShiftHitRaw = getOtherShiftHitRaw;
    PNS.getOtherShiftBlocker = getOtherShiftBlocker;
    // Keep legacy public name, but point it to the BLOCKER-aware behavior.
    PNS.isPlayerUsedInOtherShift = (playerId, currentShift) => getOtherShiftBlocker(playerId, currentShift, 'helper');
    PNS.getTowerAssignmentPolicy = getTowerAssignmentPolicy;

    if (PNS.ModalsShift) {
      PNS.ModalsShift.isPlayerUsedInOtherShift = PNS.isPlayerUsedInOtherShift;
      PNS.ModalsShift.getOtherShiftHitRaw = getOtherShiftHitRaw;
      PNS.ModalsShift.getOtherShiftBlocker = getOtherShiftBlocker;
    }
  }

  installPolicyExports();
  document.addEventListener('htmx:afterSwap', installPolicyExports);
  document.addEventListener('pns:dom:refreshed', installPolicyExports);
})();
