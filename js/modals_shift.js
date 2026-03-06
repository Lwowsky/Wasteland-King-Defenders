// Split loader for modals/shift logic.
// Keeps backward compatibility with existing <script src="modals_shift.js"> include.
(function () {
  if (window.__PNS_MODALS_SHIFT_SPLIT_BOOTSTRAPPED__) {
    try { window.PNS?.ModalsShift?.initIfReady?.(); } catch {}
    return;
  }
  window.__PNS_MODALS_SHIFT_SPLIT_BOOTSTRAPPED__ = true;

  const files = [
    'shift_plans.js',
    'tower_focus.js',
    'modals_core.js',
    'modals_preview.js',
    'tower_player_modal.js',
    'tower_picker.js',
    'tower_calc.js',
    'modals_bootstrap.js',
  ];

  function getBaseUrl() {
    const cs = document.currentScript;
    if (cs?.src) return cs.src.slice(0, cs.src.lastIndexOf('/') + 1);
    const scripts = Array.from(document.scripts || []);
    const s = scripts.reverse().find(x => /modals_shift\.js(?:\?|#|$)/.test(x.src || ''));
    return s?.src ? s.src.slice(0, s.src.lastIndexOf('/') + 1) : '';
  }

  function loadSequential(list, baseUrl, onDone, onError) {
    let i = 0;
    const next = () => {
      if (i >= list.length) { onDone?.(); return; }
      const src = (baseUrl || '') + list[i++];
      if (Array.from(document.scripts).some(s => (s.src || '').split(/[?#]/)[0] === src.split(/[?#]/)[0])) {
        next();
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = next;
      el.onerror = () => onError?.(src);
      document.head.appendChild(el);
    };
    next();
  }

  const baseUrl = getBaseUrl();
  loadSequential(
    files,
    baseUrl,
    () => {
      try { window.PNS?.ModalsShift?.initIfReady?.(); } catch (e) { console.warn('[PNS] modals_shift split init failed', e); }
    },
    (src) => {
      console.warn('[PNS] Failed to load split modals file:', src);
      console.warn('[PNS] If needed, temporarily switch back to modals_shift.legacy.js');
    }
  );
})();
