(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_style_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  const HREF = 'css/tower-calc-core.css';

  function hasCoreCss() {
    return !!document.querySelector(`link[href$="${HREF}"], link[data-pns-tower-calc-core="1"]`);
  }

  function ensureTowerCalcStyleCore() {
    if (hasCoreCss()) return true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    link.setAttribute('data-pns-tower-calc-core', '1');
    document.head.appendChild(link);
    return true;
  }

  PNS.ensureTowerCalcStyleCore = ensureTowerCalcStyleCore;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureTowerCalcStyleCore, { once: true });
  } else {
    ensureTowerCalcStyleCore();
  }
})();
