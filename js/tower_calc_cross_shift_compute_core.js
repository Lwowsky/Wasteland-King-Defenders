(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_cross_shift_compute_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  function normalizeShift(value) {
    try { return PNS.towerCalcNormalizeShift?.(value) || PNS.normalizePlannerShift?.(value) || fallbackNormalize(value); } catch {}
    return fallbackNormalize(value);
  }

  function fallbackNormalize(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'shift1' || s === '1' || s === 's1') return 'shift1';
    if (s === 'shift2' || s === '2' || s === 's2') return 'shift2';
    return 'both';
  }

  function getPlayerById(playerId) {
    if (!playerId) return null;
    try {
      const state = PNS.state || {};
      return state.playerById?.get?.(playerId)
        || (Array.isArray(state.players) ? state.players.find((p) => String(p?.id || '') === String(playerId)) : null)
        || PNS.towerCalcGetPlayerById?.(playerId)
        || null;
    } catch {}
    return null;
  }

  function getCalcStateSafe() {
    try { return window.getCalcState?.() || {}; } catch { return {}; }
  }

  function syncWrappedExport(fn) {
    try { if (PNS.ModalsShift) PNS.ModalsShift.computeTowerCalcResults = fn; } catch {}
    return fn;
  }

  function buildWrappedCompute(orig) {
    const wrapped = function (...args) {
      const restore = [];
      try {
        const tc = getCalcStateSafe();
        const caps1 = new Set((Array.isArray(tc.shift1) ? tc.shift1 : []).map((r) => String(r?.captainId || '')).filter(Boolean));
        const caps2 = new Set((Array.isArray(tc.shift2) ? tc.shift2 : []).map((r) => String(r?.captainId || '')).filter(Boolean));
        const all = new Set([...caps1, ...caps2]);
        all.forEach((id) => {
          const p = getPlayerById(id);
          if (!p) return;
          const in1 = caps1.has(id);
          const in2 = caps2.has(id);
          if ((in1 && in2) || (!in1 && !in2)) return;
          restore.push([p, p.shift, p.shiftLabel, p.rowEl?.dataset?.shift || '']);
          p.shift = 'both';
          p.shiftLabel = 'Обидві';
          if (p.rowEl) {
            p.rowEl.dataset.shift = 'both';
            const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
            if (cell) cell.textContent = 'Обидві';
          }
        });
      } catch {}

      try {
        return orig.apply(this, args);
      } finally {
        for (const item of restore) {
          const [p, shift, shiftLabel, ds] = item;
          try {
            p.shift = shift;
            p.shiftLabel = shiftLabel;
            if (p.rowEl) {
              p.rowEl.dataset.shift = ds || normalizeShift(shift || shiftLabel || 'both');
              const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
              if (cell) {
                const norm = normalizeShift(shift || 'both');
                cell.textContent = shiftLabel || (norm === 'shift1' ? 'Зміна 1' : norm === 'shift2' ? 'Зміна 2' : 'Обидві');
              }
            }
          } catch {}
        }
      }
    };
    wrapped.__pnsCaptainCrossShiftComputeWrapped = true;
    wrapped.__tcv19Wrapped = true;
    wrapped.__tcv19Original = orig;
    wrapped.__pnsCaptainCrossShiftComputeOriginal = orig;
    return wrapped;
  }

  function ensureWrapped() {
    const current = window.computeTowerCalcResults;
    if (typeof current !== 'function') return false;
    if (current.__pnsCaptainCrossShiftComputeWrapped) {
      syncWrappedExport(current);
      return true;
    }
    const wrapped = buildWrappedCompute(current);
    window.computeTowerCalcResults = wrapped;
    syncWrappedExport(wrapped);
    return true;
  }

  let retryTimer = 0;
  let retryCount = 0;
  function scheduleEnsure(delay) {
    clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      const ok = ensureWrapped();
      retryCount += 1;
      if (!ok && retryCount < 60) scheduleEnsure(250);
    }, delay == null ? 0 : delay);
    return true;
  }

  function install() {
    return ensureWrapped() || scheduleEnsure(60);
  }

  PNS.installTowerCalcCrossShiftComputeCore = install;
  PNS.ensureTowerCalcCrossShiftComputeWrapped = ensureWrapped;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
  window.addEventListener('load', install, { once: true });
  document.addEventListener('htmx:afterSwap', () => scheduleEnsure(60));
  document.addEventListener('pns:dom:refreshed', () => scheduleEnsure(60));
})();
