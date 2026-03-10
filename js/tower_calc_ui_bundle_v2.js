(function () {
  'use strict';
  const PNS = window.PNS = window.PNS || {};
  try { PNS.runTowerCalcCompatBoot?.(); } catch (e) { console.warn('[tower_calc_ui_bundle_v2 shim]', e); }
})();
