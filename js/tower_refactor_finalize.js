(function () {
  'use strict';
  const PNS = window.PNS = window.PNS || {};
  try { PNS.runTowerCalcCompatBoot?.(); } catch (e) { console.warn('[tower_refactor_finalize shim]', e); }
})();
