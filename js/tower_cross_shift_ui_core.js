(function(){
  // phase 17: moved into the main core runtime layer
  const HOTFIX_KEY = '__tcv22_hotfix__';
  if (window[HOTFIX_KEY]) return;
  window[HOTFIX_KEY] = true;


  function q(sel, root=document){ try { return root.querySelector(sel); } catch { return null; } }
  function qa(sel, root=document){ try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } }
  function normShift(v){
    const s = String(v || '').toLowerCase();
    if (s === 'shift1' || s === '1' || s === 's1') return 'shift1';
    if (s === 'shift2' || s === '2' || s === 's2') return 'shift2';
    return 'both';
  }

  function persistAfter(meta={}) {
    const PNS = window.PNS;
    const state = PNS?.state;
    if (!PNS || !state) return;
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: meta })); } catch {}
  }

  function helperMarchForBase(base, player) {
    const PNS = window.PNS;
    if (!player) return 0;
    try {
      if (typeof PNS?.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
    } catch {}
    return Number(player.march || 0) || 0;
  }

  function sameTroopOnlyEnabled() {
    const PNS = window.PNS;
    try {
      if (typeof PNS?.isTowerNoMixTroopsEnabled === 'function') return !!PNS.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function noCrossShiftDupesEnabled() {
    const PNS = window.PNS;
    try {
      if (typeof PNS?.isTowerNoCrossShiftDupesEnabled === 'function') return !!PNS.isTowerNoCrossShiftDupesEnabled();
    } catch {}
    return true;
  }

  function getOtherShiftHit(playerId, currentShift) {
    const PNS = window.PNS;
    const MS = PNS?.ModalsShift || {};
    const cur = String(currentShift || PNS?.state?.activeShift || '').toLowerCase();
    const other = cur === 'shift1' ? 'shift2' : 'shift1';
    if (!(other === 'shift1' || other === 'shift2')) return null;
    try {
      const fn = PNS?.isPlayerUsedInShift || MS.isPlayerUsedInShift;
      if (typeof fn === 'function') return fn(playerId, other);
    } catch {}
    try {
      const fn = MS.isPlayerUsedInOtherShift || PNS?.isPlayerUsedInOtherShift;
      if (typeof fn === 'function') return fn(playerId, cur);
    } catch {}
    return null;
  }

  function installCrossShiftCaptainUsage() {
    const PNS = window.PNS;
    const MS = PNS?.ModalsShift || {};
    if (!PNS) return;

    const wrappedOther = function(playerId, currentShift) {
      const cur = String(currentShift || PNS?.state?.activeShift || '').toLowerCase();
      const other = cur === 'shift1' ? 'shift2' : 'shift1';
      const hit = getOtherShiftHit(playerId, cur);
      if (hit && String(hit?.assignment?.kind || '').toLowerCase() === 'captain') return null;
      return hit;
    };
    PNS.isPlayerUsedInOtherShift = wrappedOther;
    try { MS.isPlayerUsedInOtherShift = wrappedOther; } catch {}

    const origAssign = PNS.assignPlayerToBase;
    if (typeof origAssign === 'function' && !origAssign.__tcv22Wrapped) {
      const patched = function(playerId, baseId, kind) {
        if (String(kind || '').toLowerCase() !== 'helper') return origAssign.apply(this, arguments);
        const state = PNS.state || {};
        const player = state.playerById?.get?.(playerId);
        const base = state.baseById?.get?.(baseId);
        if (!player || !base) return origAssign.apply(this, arguments);

        const activeShift = String(state.activeShift || '').toLowerCase();
        const otherHit = getOtherShiftHit(playerId, activeShift);
        const isCaptainOtherShift = !!(otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain');

        if (!isCaptainOtherShift) return origAssign.apply(this, arguments);

        const playerShift = normShift(player.shift || player.shiftLabel || 'both');
        const baseShift = normShift(base.shift || activeShift || 'both');
        const ignoreShiftAutoFill = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');

        // Власна валідація для кейсу "капітан в іншому shift як helper тут"
        let err = '';
        if (!PNS.ROLE_KEYS?.includes?.(player.role)) err = `Не вдалося визначити тип військ для ${player.name}.`;
        else if (!ignoreShiftAutoFill && baseShift !== 'both' && playerShift !== 'both' && playerShift !== baseShift) {
          // дозволяємо цей mismatch лише якщо він капітан в іншому shift
          err = '';
        }
        if (!err && !base.captainId) err = `Спочатку постав капітана в турель «${base.title}».`;
        const effectiveRole = (typeof PNS.getBaseRole === 'function') ? PNS.getBaseRole(base) : null;
        if (!err && sameTroopOnlyEnabled() && effectiveRole && player.role !== effectiveRole) err = `Тип військ не підходить: ${player.role} не можна поставити в турель типу ${effectiveRole}.`;
        if (!err && noCrossShiftDupesEnabled()) {
          const hit = wrappedOther(player.id, activeShift);
          if (hit) err = `Гравець уже призначений у ${hit.label || hit.shift || 'іншій зміні'}.`;
        }
        if (!err) {
          const helperCountAfter = (base.helperIds || []).filter((id) => id !== player.id).length + 1;
          if (Number.isFinite(base.maxHelpers) && base.maxHelpers > 0 && helperCountAfter > base.maxHelpers) err = `Ліміт помічників заповнений: ${helperCountAfter}/${base.maxHelpers}.`;
        }
        if (!err) {
          const captain = state.playerById?.get?.(base.captainId);
          const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;
          const helpersSum = (base.helperIds || []).reduce((sum, id) => {
            if (id === player.id) return sum;
            return sum + helperMarchForBase(base, state.playerById?.get?.(id));
          }, 0);
          const totalAfter = Number(captain?.march || 0) + helpersSum + helperMarchForBase(base, player);
          if (limit && totalAfter > limit) err = `Перевищено ліміт: ${PNS.formatNum?.(totalAfter) || totalAfter} > ${PNS.formatNum?.(limit) || limit}.`;
        }
        if (err) {
          try { PNS.setRowStatus?.(player, err, 'danger'); } catch {}
          alert(err);
          return;
        }

        try { PNS.clearPlayerFromBase?.(player.id); } catch {}
        base.helperIds = Array.isArray(base.helperIds) ? base.helperIds : [];
        if (!base.helperIds.includes(player.id)) base.helperIds.push(player.id);
        player.assignment = { baseId: base.id, kind: 'helper' };
        try { if (typeof PNS.renderAll === 'function') PNS.renderAll(); } catch {}
        persistAfter({ type: 'assign', baseId: base.id, playerId: player.id, kind: 'helper', crossShiftCaptain: true });
      };
      patched.__tcv22Wrapped = true;
      patched.__tcv22Original = origAssign;
      PNS.assignPlayerToBase = patched;
    }
  }

  function interceptBaseEditorAndRowActions() {
    if (document.__tcv22ClickBound) return;
    document.__tcv22ClickBound = true;
    document.addEventListener('click', function(e) {
      const PNS = window.PNS;
      const state = PNS?.state || {};

      const legacyBaseEditorEnabled = typeof PNS?.isLegacyBaseEditorEnabled === 'function'
        ? !!PNS.isLegacyBaseEditorEnabled()
        : (typeof PNS?.shouldRenderLegacyBaseEditor === 'function' ? !!PNS.shouldRenderLegacyBaseEditor() : false);

      const editorBtn = legacyBaseEditorEnabled ? e.target.closest?.('[data-base-editor-action="helper"]') : null;
      if (editorBtn) {
        const baseId = editorBtn.dataset.baseId;
        const base = state.baseById?.get?.(baseId);
        const editor = base?.cardEl ? base.cardEl.querySelector('.base-editor') : null;
        const sel = editor ? editor.querySelector(`select[data-base-editor-select="${baseId}"]`) : null;
        const pid = sel?.value || '';
        const otherHit = pid ? getOtherShiftHit(pid, state.activeShift) : null;
        if (otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          PNS.assignPlayerToBase?.(pid, baseId, 'helper');
          return;
        }
      }

      const helperBtn = e.target.closest?.('.row-actions button');
      if (helperBtn && /^helper$/i.test((helperBtn.textContent || '').trim())) {
        const actionCell = helperBtn.closest('td[data-field="actions"]');
        const player = (state.players || []).find((p) => p?.actionCellEl === actionCell);
        const select = actionCell?.querySelector('select');
        const baseId = select?.value || '';
        const otherHit = player?.id ? getOtherShiftHit(player.id, state.activeShift) : null;
        if (player && baseId && otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          PNS.assignPlayerToBase?.(player.id, baseId, 'helper');
          return;
        }
      }
    }, true);
  }


  function run(){
    try { window.PNS?.ensureTowerCalcPresentationStyles?.(); } catch {}
    /* moved to tower_assignment_policy.js */
    interceptBaseEditorAndRowActions();
    try { window.PNS?.towerCalcNormalizeApplyModeUi?.(document); } catch {}
  }

  run();
  document.addEventListener('htmx:afterSwap', run);
  document.addEventListener('players-table-rendered', run);
  document.addEventListener('pns:assignment-changed', run);
  let tries = 0;
  const iv = setInterval(() => {
    run();
    tries += 1;
    if (tries > 40) clearInterval(iv);
  }, 500);
})();
