(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  function getBaseTierMinMarch(base, tierKey) {
    const k = String(tierKey || '').toUpperCase();
    return PNS.clampInt(base?.tierMinMarch?.[k], 0);
  }

  // Per-tier value now works as "MAX march contribution" for helper in this tower.
  // 0 = no cap (use full march)
  function getTowerEffectiveMarch(base, player) {
    if (!player) return 0;
    const raw = Number(player.march || 0) || 0;
    const cap = getBaseTierMinMarch(base, player.tier);
    if (!cap) return raw;
    return Math.min(raw, cap);
  }

  function passesBaseTierMinMarch(base, player) {
    // Backward-compatible name; tier rule is now a cap, not a minimum filter.
    return !!player;
  }

  function autoFillDiagnostics(base, captain) {
    const free = state.players.filter((p) => !p.assignment && p.id !== captain.id);
    const sameRole = free.filter((p) => p.role === captain.role);
    const byActiveShift = sameRole.filter((p) => PNS.matchesShift(p.shift, state.activeShift));
    const byBaseShift = byActiveShift.filter((p) => base.shift === 'both' || p.shift === 'both' || p.shift === base.shift);
    const passTierMin = byBaseShift.filter((p) => passesBaseTierMinMarch(base, p));
    const limit = ((captain.rally || 0) + (captain.march || 0)) || captain.march || 0;
    const usedHelpers = base.helperIds.reduce((s,id)=>s+getTowerEffectiveMarch(base, state.playerById.get(id)),0);
    const room = limit ? Math.max(0, limit - (captain.march || 0) - usedHelpers) : Infinity;
    const fitRoom = room === Infinity ? passTierMin.length : passTierMin.filter((p) => getTowerEffectiveMarch(base, p) <= room).length;
    return { free: free.length, sameRole: sameRole.length, byActiveShift: byActiveShift.length, byBaseShift: byBaseShift.length, passTierMin: passTierMin.length, fitRoom, room };
  }

  function autoFillBase(baseId) {
    const base = state.baseById.get(baseId);
    if (!base) return { added: 0, reason: 'Base not found' };
    if (!base.captainId) {
      const msg = `Set captain first for ${base.title.split('/')[0].trim()}`;
      alert(msg);
      return { added: 0, reason: msg };
    }
    const captain = state.playerById.get(base.captainId);
    if (!captain) return { added: 0, reason: 'Captain not found' };

    try { if (typeof PNS.setBaseTowerRule === 'function') PNS.setBaseTowerRule(base.id, PNS.readBaseEditorSettingsInputs(base), { persist: true, rerender: false }); } catch {}
    PNS.applyBaseRoleUI(base, captain.role);

    const beforeCount = base.helperIds.length;
    const limit = ((captain.rally || 0) + (captain.march || 0)) || captain.march || 0;
    let room = limit ? Math.max(0, limit - (captain.march || 0) - base.helperIds.reduce((s,id)=>s+getTowerEffectiveMarch(base, state.playerById.get(id)),0)) : Infinity;
    const ignoreShift = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');

    const commonCandidates = () => state.players
      .filter((p) => p.id !== captain.id)
      .filter((p) => !p.assignment)
      .filter((p) => p.role === captain.role)
      .filter((p) => ignoreShift ? true : PNS.matchesShift(p.shift, state.activeShift))
      .filter((p) => ignoreShift ? true : (base.shift === 'both' || p.shift === 'both' || p.shift === base.shift))
      .filter((p) => passesBaseTierMinMarch(base, p))
      .sort((a,b) => (b.tierRank||0)-(a.tierRank||0) || (b.march||0)-(a.march||0) || String(a.name).localeCompare(String(b.name)));

    for (const p of commonCandidates()) {
      if (base.maxHelpers > 0 && base.helperIds.length >= base.maxHelpers) break;
      const effectiveMarch = getTowerEffectiveMarch(base, p);
      if (room !== Infinity && effectiveMarch > room) continue;
      const err = PNS.validateAssign(p, base, 'helper');
      if (err) continue;
      base.helperIds.push(p.id);
      p.assignment = { baseId: base.id, kind: 'helper' };
      if (room !== Infinity) room -= effectiveMarch;
    }

    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    const added = base.helperIds.length - beforeCount;
    if (added <= 0) {
      let reason = '';
      const d = autoFillDiagnostics(base, captain);
      if (!d.sameRole) reason = `No free ${captain.role} players.`;
      else if (!ignoreShift && !d.byActiveShift) reason = `No ${captain.role} players for active filter (${state.activeShift}).`;
      else if (!ignoreShift && !d.byBaseShift) reason = `No ${captain.role} players match tower shift.`;
      else if (!d.passTierMin) reason = 'No candidates after per-tier cap rules.';
      else if ((base.maxHelpers || 0) > 0 && base.helperIds.length >= base.maxHelpers) reason = `Max helpers reached (${base.maxHelpers}).`;
      else if (room !== Infinity && d.fitRoom === 0) reason = `No players fit remaining rally room (${PNS.formatNum(Math.max(0, d.room))}).`;
      else reason = 'No eligible candidates after checks.';
      const debug = ` [free:${d.free}, role:${d.sameRole}, shift:${d.byActiveShift}, tower:${d.byBaseShift}, tierMin:${d.passTierMin}, fit:${d.fitRoom}]`;
      if (typeof PNS.setImportStatus === 'function') PNS.setImportStatus(`Auto-fill: ${base.title.split('/')[0].trim()} → 0 added. ${reason}${debug}`, 'danger');
      return { added: 0, reason };
    }
    if (typeof PNS.setImportStatus === 'function') PNS.setImportStatus(`Auto-fill: ${base.title.split('/')[0].trim()} → +${added} helper(s).`, 'good');
    return { added };
  }

  function autoFillAllVisibleBases() {
    let totalAdded = 0;
    let touched = 0;
    state.bases.filter((b) => PNS.matchesShift(b.shift, state.activeShift)).forEach((b) => {
      if (b.captainId) {
        touched++;
        const res = autoFillBase(b.id) || {};
        totalAdded += Number(res.added || 0);
      }
    });
    if (!touched) {
      const visible = state.bases.filter((b) => PNS.matchesShift(b.shift, state.activeShift)).length;
      if (typeof PNS.setImportStatus === 'function') PNS.setImportStatus(`Auto-fill all: no visible bases with captain (visible bases: ${visible}). Set captain first.`, 'danger');
      return;
    }
    if (typeof PNS.setImportStatus === 'function') PNS.setImportStatus(`Auto-fill all: +${totalAdded} helper(s) across ${touched} base(s).`, totalAdded ? 'good' : 'danger');
  }

  PNS.getBaseTierMinMarch = getBaseTierMinMarch;
  PNS.getTowerEffectiveMarch = getTowerEffectiveMarch;
  PNS.passesBaseTierMinMarch = passesBaseTierMinMarch;

  PNS.autoFillDiagnostics = autoFillDiagnostics;
  PNS.autoFillBase = autoFillBase;
  PNS.autoFillAllVisibleBases = autoFillAllVisibleBases;

})();