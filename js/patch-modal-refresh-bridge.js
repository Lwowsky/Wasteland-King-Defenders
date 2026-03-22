/* ==== patch-modal-refresh-bridge.js ==== */
/* Conservative refresh bridge: no click interception, no forced tab switching */
;(function(){
  const P = window.PNS = window.PNS || {};
  if (window.__pns_patch_modal_refresh_bridge_v3__) return;
  window.__pns_patch_modal_refresh_bridge_v3__ = true;

  function ensureTemplateAlias(){
    if(typeof window.renderHtmlTemplate !== 'function' && typeof P.renderHtmlTemplate === 'function'){
      window.renderHtmlTemplate = function(id, data){ return P.renderHtmlTemplate(id, data); };
    }
  }
  function later(ms, fn){ try { setTimeout(fn, ms); } catch(e) {} }
  function calcModal(){ return document.getElementById('towerCalcModal'); }
  function boardModal(){ return document.getElementById('board-modal'); }
  function refreshCalcPreview(){ ensureTemplateAlias(); try { window.calcRenderLiveFinalBoard?.(calcModal()); } catch(e) {} }
  function refreshBoard(){
    ensureTemplateAlias();
    try { window.renderStandaloneFinalBoard?.(boardModal()); } catch(e) {}
    try { P.renderBoard?.(); } catch(e) {}
    try { P.syncBoardLanguageSelects?.(); } catch(e) {}
    try { P.ensureBoardLanguagePickerHosts?.(); } catch(e) {}
  }

  ensureTemplateAlias();

  document.addEventListener('click', function(ev){
    ensureTemplateAlias();
    const previewTab = ev.target.closest?.('[data-calc-main-tab="preview"]');
    if(previewTab){ later(40, refreshCalcPreview); return; }

    const openCalc = ev.target.closest?.('#openTowerCalcBtnMobile,[data-action="open-tower-calc"]');
    if(openCalc){ later(60, refreshCalcPreview); return; }

    const openBoard = ev.target.closest?.('#openBoardBtnMobile,#openBoardFromSettingsColBtn,[data-action="open-board"]');
    if(openBoard){ later(30, refreshBoard); return; }

    const boardLang = ev.target.closest?.('[data-open-board-lang-picker],[data-board-lang-option],[data-calc-board-lang-option],[data-board-lang-mode],[data-calc-board-lang-mode],[data-close-board-lang-picker],[data-confirm-ok],[data-board-lang-dialog-done]');
    if(boardLang){ later(30, refreshBoard); later(30, refreshCalcPreview); later(100, refreshBoard); later(100, refreshCalcPreview); }
  }, true);

  document.addEventListener('change', function(ev){
    ensureTemplateAlias();
    if(ev.target.closest?.('[data-board-lang-option],[data-calc-board-lang-option],[data-board-lang-mode],[data-calc-board-lang-mode]')){
      later(30, refreshBoard);
      later(30, refreshCalcPreview);
      later(100, refreshBoard);
      later(100, refreshCalcPreview);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){
    ensureTemplateAlias();
    later(120, refreshBoard);
    later(120, refreshCalcPreview);
  });

  window.addEventListener('load', function(){
    later(80, refreshBoard);
    later(80, refreshCalcPreview);
  }, { once: true });
})();
