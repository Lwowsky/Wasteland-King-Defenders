/* ==== modal-open-safety.js ==== */
/* Modal open safety and tower-calc fallback wiring */
;(function(){
  const FLAG='__pns_modal_open_safety_patch__';
  if(window[FLAG]) return;
  window[FLAG]=true;

  const PNS=window.PNS=window.PNS||{};
  const api=PNS.modalOpenSafety=PNS.modalOpenSafety||{};

  function modalLock(){
    try{
      const hasOpen=!!document.querySelector('.modal.is-open');
      if(document.documentElement){
        document.documentElement.classList.toggle('modal-open', hasOpen);
      }
      if(document.body){
        document.body.classList.toggle('modal-open', hasOpen);
      }
    }catch{}
  }

  function forceOverlayLock(){
    try{
      if(document.documentElement){
        document.documentElement.classList.add('modal-open');
      }
      if(document.body){
        document.body.classList.add('modal-open');
      }
    }catch{}
  }

  function renderTowerCalcSafe(){
    const modal=document.getElementById('towerCalcModal');
    try{ (window.renderTowerCalcModal||PNS.renderTowerCalcModal)?.(); }catch(e){ console.warn('[phase68] renderTowerCalcModal failed', e); }
    if(modal){
      try{ modal.classList.add('is-open'); }catch{}
      modalLock();
      try{ (window.calcApplyMainTabUI||PNS.calcApplyMainTabUI)?.(modal,'setup'); }catch{}
      try{
        const shift=String(PNS.state?.activeShift||'shift1').toLowerCase()==='shift2'?'shift2':'shift1';
        (window.calcApplyActiveTabUI||PNS.calcApplyActiveTabUI)?.(modal,shift);
      }catch{}
      try{ window.calcRenderInlineTowerSettings?.(modal); }catch{}
      try{ window.calcRenderLiveFinalBoard?.(modal); }catch{}
      try{ window.calcUpdateShiftStatsUI?.(modal); }catch{}
      try{ PNS.ModalsShift?.syncSettingsTowerPreview?.(); }catch{}
      return true;
    }
    return false;
  }

  function openTowerCalcSafe(ev){
    try{ ev?.preventDefault?.(); ev?.stopPropagation?.(); ev?.stopImmediatePropagation?.(); }catch{}
    const modal=document.getElementById('towerCalcModal');
    let opened=false;
    try{ (window.openTowerCalculatorModal||PNS.openTowerCalculatorModal||PNS.ModalsShift?.openTowerCalculatorModal)?.(); }catch(e){ console.warn('[phase68] openTowerCalculatorModal failed', e); }
    try{ opened=!!modal && modal.classList.contains('is-open'); }catch{}
    if(!opened) opened=renderTowerCalcSafe();
    if(!opened){
      try{ alert((PNS.t&&PNS.t('calc_window_not_loaded','Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.'))||'Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.'); }catch{}
    }
    return opened;
  }

  api.modalLock=modalLock;
  api.forceOverlayLock=forceOverlayLock;
  api.renderTowerCalcSafe=renderTowerCalcSafe;
  api.openTowerCalcSafe=openTowerCalcSafe;

  document.addEventListener('click', function(ev){
    const target=ev.target && ev.target.closest ? ev.target.closest('#openTowerCalcBtnMobile,[data-action="open-tower-calc"]') : null;
    if(target) openTowerCalcSafe(ev);
  }, true);
})();
