(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  function num(x) { return Number.isFinite(+x) ? +x : 0; }
  function uniqPush(arr, id) { if (!arr.includes(id)) arr.push(id); }

  function getBaseTierMinMarch(base, tierKey) {
    const k = String(tierKey || '').toUpperCase();
    return PNS.clampInt(base?.tierMinMarch?.[k], 0);
  }

  function passesBaseTierMinMarch(base, player) {
    if (!base || !player) return true;
    const cap = getBaseTierMinMarch(base, player.tier);
    if (!cap) return true;
    return num(player.march) <= cap;
  }

  function calcRallyLimit(captain) {
    // Rally size only (без +march)
    return num(captain?.rally) || 0;
  }

  function helpersSumMarch(base) {
    const ids = Array.isArray(base?.helperIds) ? base.helperIds : [];
    let s = 0;
    for (const id of ids) s += num(state.playerById.get(id)?.march);
    return s;
  }

  function autoFillDiagnostics(base, captain) {
    const free = (state.players || []).filter((p) => !p.assignment && p.id !== captain.id);
    const sameRole = free.filter((p) => p.role === captain.role);

    const byActiveShift = sameRole.filter((p) => PNS.matchesShift(p.shift, state.activeShift));
    const byBaseShift = byActiveShift.filter((p) => base.shift === 'both' || p.shift === 'both' || p.shift === base.shift);
    const passTierMin = byBaseShift.filter((p) => passesBaseTierMinMarch(base, p));

    const limit = calcRallyLimit(captain);
    const usedHelpers = helpersSumMarch(base);
    const room = limit ? Math.max(0, limit - num(captain.march) - usedHelpers) : Infinity;

    const fitRoom = room === Infinity
      ? passTierMin.length
      : passTierMin.filter((p) => num(p.march) <= room).length;

    return {
      free: free.length,
      sameRole: sameRole.length,
      byActiveShift: byActiveShift.length,
      byBaseShift: byBaseShift.length,
      passTierMin: passTierMin.length,
      fitRoom,
      room
    };
  }

  function autoFillBase(baseId) {
    const base = state.baseById?.get?.(baseId);
    if (!base) return { added: 0, reason: 'Base not found' };

    // нормалізуємо структуру
    if (!Array.isArray(base.helperIds)) base.helperIds = [];
    // прибираємо дублікати (важливо після повторних автозаповнень)
    base.helperIds = Array.from(new Set(base.helperIds));

    // maxHelpers дефолт
    const defaultMax = num(state.autoFillSettings?.maxHelpers) || 29;
    base.maxHelpers = num(base.maxHelpers) || defaultMax;

    if (!base.captainId) {
      const msg = `Set captain first for ${base.title.split('/')[0].trim()}`;
      alert(msg);
      return { added: 0, reason: msg };
    }

    const captain = state.playerById?.get?.(base.captainId);
    if (!captain) return { added: 0, reason: 'Captain not found' };

    // підтягуємо rule з UI (якщо існує)
    try {
      if (typeof PNS.setBaseTowerRule === 'function' && typeof PNS.readBaseEditorSettingsInputs === 'function') {
        PNS.setBaseTowerRule(base.id, PNS.readBaseEditorSettingsInputs(base), { persist: true, rerender: false });
      }
    } catch {}

    // UI role
    if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, captain.role);

    const beforeCount = base.helperIds.length;

    const limit = calcRallyLimit(captain);
    let room = limit
      ? Math.max(0, limit - num(captain.march) - helpersSumMarch(base))
      : Infinity;

    const ignoreShift = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');

    const commonCandidates = () => (state.players || [])
      .filter((p) => p && p.id !== captain.id)
      .filter((p) => !p.assignment)
      .filter((p) => p.role === captain.role)
      .filter((p) => ignoreShift ? true : PNS.matchesShift(p.shift, state.activeShift))
      .filter((p) => ignoreShift ? true : (base.shift === 'both' || p.shift === 'both' || p.shift === base.shift))
      .filter((p) => passesBaseTierMinMarch(base, p))
      .sort((a, b) =>
        (num(b.tierRank) - num(a.tierRank)) ||
        (num(b.march) - num(a.march)) ||
        String(a.name).localeCompare(String(b.name))
      );

    // важливо: validateAssign може бути ще не підвантажений
    const canValidate = typeof PNS.validateAssign === 'function';

    for (const p of commonCandidates()) {
      if (base.maxHelpers > 0 && base.helperIds.length >= base.maxHelpers) break;

      const pm = num(p.march);
      if (room !== Infinity && pm > room) continue;

      if (canValidate) {
        const err = PNS.validateAssign(p, base, 'helper');
        if (err) continue;
      }

      uniqPush(base.helperIds, p.id);
      p.assignment = { baseId: base.id, kind: 'helper' };
      if (room !== Infinity) room -= pm;
    }

    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    const added = base.helperIds.length - beforeCount;
    if (added <= 0) {
      let reason = '';
      const d = autoFillDiagnostics(base, captain);
      if (!d.sameRole) reason = `No free ${captain.role} players.`;
      else if (!ignoreShift && !d.byActiveShift) reason = `No ${captain.role} players for active filter (${state.activeShift}).`;
      else if (!ignoreShift && !d.byBaseShift) reason = `No ${captain.role} players match tower shift.`;
      else if (!d.passTierMin) reason = 'No candidates pass per-tier max march rules.';
      else if ((base.maxHelpers || 0) > 0 && base.helperIds.length >= base.maxHelpers) reason = `Max helpers reached (${base.maxHelpers}).`;
      else if (room !== Infinity && d.fitRoom === 0) reason = `No players fit remaining rally room (${PNS.formatNum?.(Math.max(0, d.room)) ?? Math.max(0, d.room)}).`;
      else reason = 'No eligible candidates after checks.';

      const debug = ` [free:${d.free}, role:${d.sameRole}, shift:${d.byActiveShift}, tower:${d.byBaseShift}, tierMin:${d.passTierMin}, fit:${d.fitRoom}]`;

      if (typeof PNS.setImportStatus === 'function') {
        PNS.setImportStatus(`Auto-fill: ${base.title.split('/')[0].trim()} → 0 added. ${reason}${debug}`, 'danger');
      }
      return { added: 0, reason };
    }

    if (typeof PNS.setImportStatus === 'function') {
      PNS.setImportStatus(`Auto-fill: ${base.title.split('/')[0].trim()} → +${added} helper(s).`, 'good');
    }
    return { added };
  }

  function autoFillAllVisibleBases() {
    let totalAdded = 0;
    let touched = 0;

    const visibleBases = (state.bases || []).filter((b) => PNS.matchesShift(b.shift, state.activeShift));

    visibleBases.forEach((b) => {
      if (b?.captainId) {
        touched++;
        const res = autoFillBase(b.id) || {};
        totalAdded += num(res.added);
      }
    });

    if (!touched) {
      const visible = visibleBases.length;
      if (typeof PNS.setImportStatus === 'function') {
        PNS.setImportStatus(
          `Auto-fill all: no visible bases with captain (visible bases: ${visible}). Set captain first.`,
          'danger'
        );
      }
      return;
    }

    if (typeof PNS.setImportStatus === 'function') {
      PNS.setImportStatus(
        `Auto-fill all: +${totalAdded} helper(s) across ${touched} base(s).`,
        totalAdded ? 'good' : 'danger'
      );
    }
  }

  PNS.getBaseTierMinMarch = getBaseTierMinMarch;
  PNS.passesBaseTierMinMarch = passesBaseTierMinMarch;

  PNS.autoFillDiagnostics = autoFillDiagnostics;
  PNS.autoFillBase = autoFillBase;
  PNS.autoFillAllVisibleBases = autoFillAllVisibleBases;

})();