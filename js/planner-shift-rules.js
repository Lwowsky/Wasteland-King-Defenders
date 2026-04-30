/* ==== planner-shift-rules.js ==== */
/* Planner shift rules, cross-shift usage checks, assignment policies */
(function(){const e=window.PNS=window.PNS||{},t=e.state=e.state||{};function a(e){try{const a=String(window.PNS?.normalizeShiftValue?.(e)||"").toLowerCase();if(/^shift[1-4]$/.test(a)||"both"===a||"all"===a)return a}catch{}const t=String(e||"").trim().toLowerCase();return/^shift[1-4]$/.test(t)||"both"===t||"all"===t?t:/\b4\b/.test(t)||/shift\s*4/.test(t)?"shift4":/\b3\b/.test(t)||/shift\s*3/.test(t)?"shift3":/\b2\b/.test(t)||/shift\s*2/.test(t)?"shift2":/\b1\b/.test(t)||/shift\s*1/.test(t)?"shift1":"both"}function r(e){try{const a=function(){try{const e=t._towerPickerActiveScopeRoot;if(e&&"function"==typeof e.querySelector&&document.contains(e))return e}catch{}try{const e=document.querySelector("#towerCalcModal.is-open .tower-picker-scope[data-calc-inline-scope]");if(e)return e}catch{}try{}catch{}return null}()?.querySelector?.("#"+e);if(a)return!!a.checked}catch{}try{const t=document.querySelector("#towerCalcModal.is-open #"+e);if(t)return!!t.checked}catch{}try{const t=document.getElementById(e);if(t)return!!t.checked}catch{}return null}function n(){const e=r("pickerNoMixTroops");return"boolean"==typeof e?e:"boolean"!=typeof t.towerPickerNoMixTroops||!!t.towerPickerNoMixTroops}function o(){const e=r("pickerMatchRegisteredShift");return"boolean"==typeof e?e:"boolean"!=typeof t.towerPickerMatchRegisteredShift||!!t.towerPickerMatchRegisteredShift}function i(){return function(){try{const e=t?.towerCalc;if(e&&"boolean"==typeof e.noCrossShift)return!!e.noCrossShift}catch{}try{const e=localStorage.getItem("pns_tower_calc_state");if(e){const t=JSON.parse(e);if(t&&"boolean"==typeof t.noCrossShift)return!!t.noCrossShift}}catch{}return!0}()}function s(e){return"shift1"===e?"Зміна 1":"shift2"===e?"Зміна 2":"Всі"}function l(e,r){const n=a(r);if(!e||"shift1"!==n&&"shift2"!==n)return null;const o=t.shiftPlans?.[n]?.players?.[e]||null;return o&&o.baseId?{shift:n,label:s(n),assignment:{baseId:o.baseId,kind:o.kind}}:null}function c(e,r){const n=a(r||t.activeShift||"all");return"shift1"!==n&&"shift2"!==n?null:l(e,"shift1"===n?"shift2":"shift1")}function d(e,t,a="helper"){const r=String(a||"").toLowerCase(),n=c(e,t);return!n||"helper"===r&&"captain"===String(n?.assignment?.kind||"").toLowerCase()?null:n}function u(e,r,s){const l=String(s||"").toLowerCase(),u=a(t.activeShift||"all"),p="helper"!==l||!e||"shift1"!==u&&"shift2"!==u?null:c(e.id,u),h=i(),f=o(),m=!("helper"!==l||!p||"captain"!==String(p?.assignment?.kind||"").toLowerCase()),y=h?d(e?.id,u,l):null,_=!("helper"!==l||!(m||!h&&p));return{sameTroopOnly:n(),matchRegisteredShift:f,noCrossShiftDupes:h,otherShiftHit:y,otherShiftHitRaw:p,otherShiftBlocker:y,allowCrossShiftReuse:_,allowCrossShiftCaptainHelper:m,ignoreShiftMismatch:!f,normalizeShift:a,playerShift:a(e?.shift||e?.shiftLabel||"both"),baseShift:a(r?.shift||u||"both")}}function p(){e.normalizePlannerShift=a,e.isTowerNoMixTroopsEnabled=n,e.isTowerMatchRegisteredShiftEnabled=o,e.isTowerNoCrossShiftDupesEnabled=i,e.getPlayerUseInShift=l,e.getOtherShiftHitRaw=c,e.getOtherShiftBlocker=d,e.isPlayerUsedInOtherShift=(e,t)=>d(e,t,"helper"),e.getTowerAssignmentPolicy=u,e.ModalsShift&&(e.ModalsShift.isPlayerUsedInOtherShift=e.isPlayerUsedInOtherShift,e.ModalsShift.getOtherShiftHitRaw=c,e.ModalsShift.getOtherShiftBlocker=d)}p(),document.addEventListener("pns:dom:refreshed",p)}());

;


/* v29 shift policy override: supports shift1..shift4 and registered shift raw values */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};
  const normalize = (value) => {
    try {
      const n = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(value) : value;
      const s = String(n || '').toLowerCase();
      if (/^shift[1-4]$/.test(s) || s === 'both' || s === 'all') return s;
    } catch {}
    const s = String(value || '').toLowerCase();
    if (/^shift[1-4]$/.test(s) || s === 'both' || s === 'all') return s;
    if (/\b1\b|shift\s*1|зміна\s*1|смена\s*1|перша|первая/.test(s)) return 'shift1';
    if (/\b2\b|shift\s*2|зміна\s*2|смена\s*2|друга|вторая/.test(s)) return 'shift2';
    if (/\b3\b|shift\s*3|зміна\s*3|смена\s*3|третя|третья/.test(s)) return 'shift3';
    if (/\b4\b|shift\s*4|зміна\s*4|смена\s*4|четверта|четвертая/.test(s)) return 'shift4';
    return 'both';
  };
  const label = (shift) => typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : (shift === 'both' ? 'Всі' : `Зміна ${String(shift).replace('shift','')}`);
  const getPlayerRegisteredShift = (player) => {
    const raw = player?.registeredShiftRaw || player?.raw?.shift_availability || player?.registeredShift || player?.registeredShiftLabel || player?.shift || player?.shiftLabel || 'both';
    try {
      if (raw && typeof PNS.applyImportShiftRule === 'function') {
        const mapped = String(PNS.applyImportShiftRule(raw) || '').toLowerCase();
        if (/^shift[1-4]$/.test(mapped) || mapped === 'both') return mapped;
      }
    } catch {}
    return normalize(raw);
  };
  const getUseInShift = (playerId, shift) => {
    const s = normalize(shift);
    if (!/^shift[1-4]$/.test(s)) return null;
    const plan = state.shiftPlans?.[s]?.players?.[playerId] || null;
    return plan && plan.baseId ? { shift: s, label: label(s), assignment: { baseId: plan.baseId, kind: plan.kind } } : null;
  };
  const getOther = (playerId, currentShift, kind = 'helper') => {
    const cur = normalize(currentShift || state.activeShift || 'all');
    if (!/^shift[1-4]$/.test(cur)) return null;
    for (const s of ['shift1','shift2','shift3','shift4']) {
      if (s === cur) continue;
      const hit = getUseInShift(playerId, s);
      if (!hit) continue;
      if (String(kind).toLowerCase() === 'helper' && String(hit.assignment?.kind || '').toLowerCase() === 'captain') continue;
      return hit;
    }
    return null;
  };
  const readToggle = (id, fallback) => {
    try { const el = document.querySelector('#towerCalcModal.is-open #' + id) || document.getElementById(id); if (el) return !!el.checked; } catch {}
    return fallback;
  };
  PNS.normalizePlannerShift = normalize;
  PNS.getPlayerUseInShift = getUseInShift;
  PNS.getOtherShiftHitRaw = (id, shift) => getOther(id, shift, 'captain');
  PNS.getOtherShiftBlocker = getOther;
  PNS.isPlayerUsedInOtherShift = (id, shift) => getOther(id, shift, 'helper');
  PNS.getTowerAssignmentPolicy = function(player, base, kind = 'helper') {
    const sameTroopOnly = readToggle('pickerNoMixTroops', typeof state.towerPickerNoMixTroops === 'boolean' ? state.towerPickerNoMixTroops : true);
    const matchRegisteredShift = readToggle('pickerMatchRegisteredShift', typeof state.towerPickerMatchRegisteredShift === 'boolean' ? state.towerPickerMatchRegisteredShift : true);
    const noCrossShiftDupes = readToggle('pickerNoCrossShiftDupes', typeof state.towerPickerNoCrossShiftDupes === 'boolean' ? state.towerPickerNoCrossShiftDupes : false);
    const active = normalize(state.activeShift || base?.shift || 'shift1');
    const playerShift = getPlayerRegisteredShift(player);
    const baseShift = normalize(base?.shift || active || 'both');
    const other = noCrossShiftDupes && player?.id ? getOther(player.id, active, kind) : null;
    return {
      sameTroopOnly,
      matchRegisteredShift,
      noCrossShiftDupes,
      otherShiftHit: other,
      otherShiftHitRaw: other,
      otherShiftBlocker: other,
      allowCrossShiftReuse: false,
      allowCrossShiftCaptainHelper: false,
      ignoreShiftMismatch: !matchRegisteredShift,
      normalizeShift: normalize,
      playerShift,
      baseShift,
    };
  };
  if (PNS.ModalsShift) {
    PNS.ModalsShift.isPlayerUsedInOtherShift = PNS.isPlayerUsedInOtherShift;
    PNS.ModalsShift.getOtherShiftHitRaw = PNS.getOtherShiftHitRaw;
    PNS.ModalsShift.getOtherShiftBlocker = PNS.getOtherShiftBlocker;
  }
})();
