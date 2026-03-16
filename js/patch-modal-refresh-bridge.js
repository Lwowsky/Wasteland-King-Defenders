/* ==== patch-modal-refresh-bridge.js ==== */
/* Modal refresh bridge and template alias patch */
;(function(){
  const P=window.PNS=window.PNS||{};
  function ensureTemplateAlias(){
    if(typeof window.renderHtmlTemplate!=='function' && typeof P.renderHtmlTemplate==='function'){
      window.renderHtmlTemplate=function(id,data){ return P.renderHtmlTemplate(id,data); };
    }
  }
  ensureTemplateAlias();
  function later(ms,fn){ try{ setTimeout(fn,ms); }catch(e){} }
  function calcModal(){ return document.getElementById('towerCalcModal'); }
  function boardModal(){ return document.getElementById('board-modal'); }
  function activeShift(){ const s=String(window.PNS?.state?.activeShift||'shift1').toLowerCase(); return s==='shift2'?'shift2':'shift1'; }
  function refreshStatusPlayers(){ ensureTemplateAlias(); try{ P.towerCalcRefreshStatusPlayersUi?.(calcModal()); }catch(e){} }
  function refreshCalcPreview(){ ensureTemplateAlias(); try{ window.calcRenderLiveFinalBoard?.(calcModal()); }catch(e){} }
  function refreshBoard(){ ensureTemplateAlias(); try{ window.renderStandaloneFinalBoard?.(boardModal()); }catch(e){} try{ P.renderBoard?.(); }catch(e){} try{ P.syncBoardLanguageSelects?.(); }catch(e){} try{ P.ensureBoardLanguagePickerHosts?.(); }catch(e){} }
  function openTowerCalcTab(tab, baseId){
    ensureTemplateAlias();
    try{ window.openTowerCalculatorModal?.(); }catch(e){}
    const modal=calcModal();
    if(!modal) return;
    try{ window.calcApplyMainTabUI?.(modal, tab||'setup'); }catch(e){}
    if(tab==='towers'){
      const shift=activeShift();
      try{ window.calcApplyActiveTabUI?.(modal, shift); }catch(e){}
      try{ window.calcSetInlineSelectedBaseId?.(shift, String(baseId||'')); }catch(e){}
      try{ window.calcRenderInlineTowerSettings?.(modal); }catch(e){}
      later(30,()=>{ try{ window.calcApplyMainTabUI?.(modal,'towers'); }catch(e){} try{ window.calcApplyActiveTabUI?.(modal,shift); }catch(e){} try{ window.calcSetInlineSelectedBaseId?.(shift, String(baseId||'')); }catch(e){} try{ window.calcRenderInlineTowerSettings?.(modal); }catch(e){} });
    } else if(tab==='overflow') {
      later(0, refreshStatusPlayers); later(50, refreshStatusPlayers);
    } else if(tab==='preview') {
      later(0, refreshCalcPreview); later(50, refreshCalcPreview);
    }
  }
  function maybeBaseIdFromEditButton(btn){
    if(!btn) return '';
    const direct=String(btn.dataset.baseId||'');
    if(direct) return direct;
    const card=btn.closest('.base-card,[data-base-id],[data-baseid]');
    return String(card?.dataset?.baseId||card?.dataset?.baseid||'');
  }
  document.addEventListener('click', function(ev){
    ensureTemplateAlias();
    const emptyCaptainEdit = ev.target.closest?.('[data-captain-edit-btn][data-mode="pick"], [data-captain-edit-btn]:not([data-edit-assigned-player])');
    if(emptyCaptainEdit){
      ev.preventDefault();
      try{ ev.stopPropagation(); ev.stopImmediatePropagation?.(); }catch(e){}
      openTowerCalcTab('towers', maybeBaseIdFromEditButton(emptyCaptainEdit));
      return;
    }
    const openCalc = ev.target.closest?.('#openTowerCalcBtnMobile,[data-action="open-tower-calc"]');
    if(openCalc){ later(20, refreshStatusPlayers); later(20, refreshCalcPreview); later(80, refreshStatusPlayers); later(80, refreshCalcPreview); }
    const overflowTab = ev.target.closest?.('[data-calc-main-tab="overflow"]');
    if(overflowTab){ later(0, refreshStatusPlayers); later(40, refreshStatusPlayers); }
    const previewTab = ev.target.closest?.('[data-calc-main-tab="preview"]');
    if(previewTab){ later(0, refreshCalcPreview); later(40, refreshCalcPreview); }
    const openBoard = ev.target.closest?.('#openBoardBtnMobile,#openBoardFromSettingsColBtn,[data-action="open-board"]');
    if(openBoard){ later(0, refreshBoard); later(40, refreshBoard); }
    const boardLang = ev.target.closest?.('[data-open-board-lang-picker],[data-board-lang-option],[data-calc-board-lang-option],[data-board-lang-mode],[data-calc-board-lang-mode],[data-close-board-lang-picker],[data-confirm-ok],[data-board-lang-dialog-done]');
    if(boardLang){ later(0, refreshBoard); later(0, refreshCalcPreview); later(60, refreshBoard); later(60, refreshCalcPreview); }
  }, true);
  document.addEventListener('change', function(ev){
    ensureTemplateAlias();
    if(ev.target.closest?.('[data-board-lang-option],[data-calc-board-lang-option],[data-board-lang-mode],[data-calc-board-lang-mode]')){
      later(0, refreshBoard); later(0, refreshCalcPreview); later(60, refreshBoard); later(60, refreshCalcPreview);
    }
    if(ev.target.closest?.('[data-calc-main-tab="overflow"]')){ later(0, refreshStatusPlayers); later(40, refreshStatusPlayers); }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ ensureTemplateAlias(); later(120, refreshBoard); later(120, refreshCalcPreview); later(120, refreshStatusPlayers); });
})();

;
