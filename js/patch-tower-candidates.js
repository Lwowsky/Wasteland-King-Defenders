/* ==== patch-tower-candidates.js ==== */
/* Tower candidates hotfix patch */
;(function(){
  const FLAG='__pns_phase68_tower_candidates_hotfix__';
  if(window[FLAG]) return;
  window[FLAG]=true;

  function normShift(v, fallback='shift1'){
    const raw = String(v ?? '').trim();
    const s = raw.toLowerCase();
    if(s === 'both' || s === 'обидві' || s === 'обе' || s === 'обидва') return 'both';
    if(s === 'shift2' || s === '2' || /shift\s*2/.test(s) || /зміна\s*2/.test(s) || /смена\s*2/.test(s) || /second/.test(s) || /друга/.test(s) || /вторая/.test(s)) return 'shift2';
    if(s === 'shift1' || s === '1' || /shift\s*1/.test(s) || /зміна\s*1/.test(s) || /смена\s*1/.test(s) || /first/.test(s) || /перша/.test(s) || /первая/.test(s)) return 'shift1';
    return fallback === 'shift2' ? 'shift2' : fallback === 'both' ? 'both' : 'shift1';
  }
  function tierRank(P, tier){
    try{ if(typeof P.tierRank==='function') return Number(P.tierRank(tier))||0; }catch{}
    const m=String(tier||'').toUpperCase().match(/T\s*(\d+)/);
    return m ? Number(m[1])||0 : 0;
  }
  function byName(a,b){
    return String(a?.name||'').localeCompare(String(b?.name||''), 'uk');
  }
  function getActiveShift(state){
    const tc = state?.towerCalc || {};
    return normShift(tc.activeTab || state?.activeShift || 'shift1');
  }

  function install(){
    const P = window.PNS;
    if(!P) return;
    const ModalsShift = P.ModalsShift = P.ModalsShift || {};
    const state = P.state || (P.state = {});

    ModalsShift.eligibleCaptainsForBase = function(baseLike, scopeLike){
      const baseId = String(baseLike?.id || baseLike || '');
      const base = state.baseById?.get?.(baseId) || baseLike || null;
      const players = Array.isArray(state.players) ? state.players.slice() : [];
      const activeShift = getActiveShift(state);
      const explicitScope = normShift(scopeLike || '', '');
      const baseShift = normShift(base?.shift || '', '');
      const targetShift = explicitScope || baseShift || activeShift;
      const onlyCaptains = state.towerPickerOnlyCaptains !== false;
      const respectPlayerShift = state.towerPickerMatchRegisteredShift !== false;
      const currentCaptainId = String(base?.captainId || '');
      const validate = typeof P.validateAssignCore === 'function'
        ? P.validateAssignCore
        : (typeof P.validateAssign === 'function' ? P.validateAssign : null);
      const normalizeShiftValue = typeof P.normalizeShiftValue === 'function'
        ? P.normalizeShiftValue
        : (v => normShift(v, targetShift));

      function getPlayerShift(player){
        const raw = player?.registeredShift ?? player?.registeredShiftRaw ?? player?.registeredShiftLabel ?? player?.shift ?? player?.shiftLabel ?? '';
        const normalized = String(normalizeShiftValue(raw) || '').toLowerCase();
        if(normalized === 'both') return 'both';
        return normShift(normalized || raw || targetShift, targetShift);
      }

      const eligible = players.filter((player)=>{
        if(!player || !player.id || !player.name) return false;
        const playerId = String(player.id || '');
        const isCurrentCaptain = playerId === currentCaptainId;
        if(respectPlayerShift && !isCurrentCaptain){
          const playerShift = getPlayerShift(player);
          if(playerShift !== 'both' && playerShift !== targetShift) return false;
        }
        if(validate){
          try{
            const err = validate(player, base, 'captain');
            if(err) return false;
          }catch{}
        }
        return true;
      });

      const readyEligible = eligible.filter((player)=>{
        return !!player.captainReady || String(player.id) === currentCaptainId;
      });

      const picked = onlyCaptains ? readyEligible : eligible;

      return picked.sort((a,b)=>{
        const aCurrent = String(a?.id||'') === currentCaptainId ? 1 : 0;
        const bCurrent = String(b?.id||'') === currentCaptainId ? 1 : 0;
        if(bCurrent !== aCurrent) return bCurrent - aCurrent;

        const aReady = a?.captainReady ? 1 : 0;
        const bReady = b?.captainReady ? 1 : 0;
        if(bReady !== aReady) return bReady - aReady;

        const aShift = getPlayerShift(a);
        const bShift = getPlayerShift(b);
        const aShiftScore = aShift === targetShift ? 1 : aShift === 'both' ? 0.5 : 0;
        const bShiftScore = bShift === targetShift ? 1 : bShift === 'both' ? 0.5 : 0;
        if(bShiftScore !== aShiftScore) return bShiftScore - aShiftScore;

        const aMarch = Number(a?.march||0) || 0;
        const bMarch = Number(b?.march||0) || 0;
        if(bMarch !== aMarch) return bMarch - aMarch;

        const aTier = tierRank(P, a?.tier);
        const bTier = tierRank(P, b?.tier);
        if(bTier !== aTier) return bTier - aTier;

        return byName(a,b);
      });
    };

    try{
      const modal = document.getElementById('towerCalcModal');
      if(modal && modal.classList.contains('is-open') && typeof P.patchTowerCalcCompatBoot === 'function'){
        P.patchTowerCalcCompatBoot(modal);
      }
    }catch{}
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  window.addEventListener('load', install, {once:true});
  document.addEventListener('pns:assignment-changed', install);
  document.addEventListener('pns:dom:refreshed', install);
})();
