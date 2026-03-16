/* Shared compat stubs for legacy split entrypoints.
 * Keeps legacy flags available without loading many separate no-op files.
 * Original stub files remain in js/ for backward-safe direct references.
 */
;(function(){
  window.__pnsFinalPlanBoardCompat = true;
  window.__pnsTowerSettingsCompat = true;
  window.__pnsAssignmentsCompat = true;
  window.__pnsAutofillCompat = true;
  window.__pnsBoardRenderCompat = true;
  window.__pnsImportCoreCompat = true;
  window.__pnsImportMappingCompat = true;
  window.__pnsImportLoadersCompat = true;
  window.__pnsImportSessionCompat = true;

  const PNS = window.PNS = window.PNS || {};
  PNS.patchBundleCompat = PNS.patchBundleCompat || { phase: 167, sharedStub: true };
}());
