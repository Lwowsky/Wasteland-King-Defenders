/* ==== tower-march-utils.js ==== */
/* Tower march helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

  const t = (key, fallback = "") => typeof PNS.t === "function" ? PNS.t(key, fallback) : fallback;
  const num = value => Number.isFinite(+value) ? +value : 0;
  const pushUnique = (arr, value) => { if (!arr.includes(value)) arr.push(value); };
  const isEligiblePlayer = (_base, player) => !!player;

  function towerLabel(base){
    return String(base?.title || t("turret", "Турель")).split("/")[0].trim() || t("turret", "Турель");
  }

  function isNoMixTroopsEnabled(){
    try {
      if (typeof PNS.isTowerNoMixTroopsEnabled === "function") return !!PNS.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function isMatchRegisteredShiftEnabled(){
    try {
      if (typeof PNS.isTowerMatchRegisteredShiftEnabled === "function") return !!PNS.isTowerMatchRegisteredShiftEnabled();
    } catch {}
    return true;
  }

  function getBaseShift(base){
    const baseShift = String(base?.shift || "").toLowerCase();
    if (baseShift === "shift1" || baseShift === "shift2") return baseShift;
    const activeShift = String(state.activeShift || "").toLowerCase();
    return activeShift === "shift1" || activeShift === "shift2" ? activeShift : "shift1";
  }

  function getTierMinMarch(base, tier){
    const normalizedTier = String(tier || "").toUpperCase();
    return PNS.clampInt(base?.tierMinMarch?.[normalizedTier], 0);
  }

  function getTowerEffectiveMarch(base, player){
    if (!player) return 0;
    const baseMarch = num(player.march);
    try {
      if (base?.captainId && player?.id && String(base.captainId) === String(player.id)) return baseMarch;
    } catch {}
    try {
      const override = PNS.getTowerMarchOverride?.(base?.id, player?.id, state.activeShift);
      if (Number.isFinite(override) && override >= 0) return Math.max(0, Number(override) || 0);
    } catch {}
    const tierMin = getTierMinMarch(base, player.tier);
    return tierMin > 0 ? Math.min(baseMarch, tierMin) : baseMarch;
  }

  function getTowerRallyCapacity(player){
    return num(player?.rally) + num(player?.march) || num(player?.march) || 0;
  }

  PNS.Autofill = Object.assign(PNS.Autofill || {}, {
    t,
    num,
    pushUnique,
    towerLabel,
    isEligiblePlayer,
    isNoMixTroopsEnabled,
    isMatchRegisteredShiftEnabled,
    getBaseShift,
    getTierMinMarch,
    getTowerEffectiveMarch,
    getTowerRallyCapacity,
  });
})();
