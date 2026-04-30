/* ==== tower-autofill-metrics.js ==== */
/* Tower autofill metrics */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;
  const AF = PNS.Autofill || {};
  const { num, getTowerEffectiveMarch, getTowerRallyCapacity, isEligiblePlayer, isNoMixTroopsEnabled, isMatchRegisteredShiftEnabled, getBaseShift } = AF;

  function getAssignedHelpersMarch(base){
    const helperIds = Array.isArray(base?.helperIds) ? base.helperIds : [];
    let total = 0;
    for (const helperId of helperIds) {
      total += getTowerEffectiveMarch(base, state.playerById.get(helperId));
    }
    return total;
  }

  function collectAutofillStats(base, captain){
    const matchRegisteredShift = isMatchRegisteredShiftEnabled();
    const baseShift = getBaseShift(base);
    const freePlayers = (state.players || []).filter(player => !player.assignment && player.id !== captain.id);
<<<<<<< HEAD
    const sameRole = isNoMixTroopsEnabled() ? freePlayers.filter(player => player.role === captain.role) : freePlayers.slice();
    const byActiveShift = matchRegisteredShift ? sameRole.filter(player => PNS.matchesShift(player.shift, baseShift)) : sameRole.slice();
    const byBaseShift = matchRegisteredShift ? byActiveShift.filter(player => base.shift === 'both' || player.shift === 'both' || player.shift === base.shift) : byActiveShift.slice();
=======
    const ignoreRegisteredShiftForRegion = typeof PNS.shouldIgnoreRegisteredShiftForActiveRegion === 'function'
      ? !!PNS.shouldIgnoreRegisteredShiftForActiveRegion()
      : false;
    const sameRole = isNoMixTroopsEnabled() ? freePlayers.filter(player => player.role === captain.role) : freePlayers.slice();
    const getRegisteredPlayerShift = (player) => {
      const raw = player?.registeredShiftRaw || player?.raw?.shift_availability || player?.registeredShift || player?.registeredShiftLabel || player?.shift || player?.shiftLabel || 'both';
      try { return String(typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(raw) : raw).toLowerCase(); }
      catch { return String(raw || 'both').toLowerCase(); }
    };
    const byActiveShift = (matchRegisteredShift && !ignoreRegisteredShiftForRegion) ? sameRole.filter(player => PNS.matchesShift(getRegisteredPlayerShift(player), baseShift)) : sameRole.slice();
    const byBaseShift = (matchRegisteredShift && !ignoreRegisteredShiftForRegion) ? byActiveShift.filter(player => base.shift === 'both' || getRegisteredPlayerShift(player) === 'both' || getRegisteredPlayerShift(player) === base.shift) : byActiveShift.slice();
>>>>>>> 4f53fe0 (update)
    const passTierMin = byBaseShift.filter(player => isEligiblePlayer(0, player));
    const rallyRoom = getTowerRallyCapacity(captain)
      ? Math.max(0, getTowerRallyCapacity(captain) - num(captain.march) - getAssignedHelpersMarch(base))
      : Infinity;
    const fitRoom = rallyRoom === Infinity ? passTierMin.length : passTierMin.filter(player => num(player.march) <= rallyRoom).length;

    return {
      free: freePlayers.length,
      sameRole: sameRole.length,
      byActiveShift: byActiveShift.length,
      byBaseShift: byBaseShift.length,
      passTierMin: passTierMin.length,
      fitRoom,
      room: rallyRoom,
    };
  }

  PNS.Autofill = Object.assign(PNS.Autofill || {}, {
    getAssignedHelpersMarch,
    collectAutofillStats,
  });
})();
