/* ==== reset-confirm-dialog.js ==== */
/* Reset confirmation dialog helpers */
;(function(){
  const FLAG='__pns_reset_confirm_dialog_patch__';
  if(window[FLAG]) return;
  window[FLAG]=true;

  const PNS=window.PNS=window.PNS||{};
  const modalApi=PNS.modalOpenSafety=PNS.modalOpenSafety||{};
  const api=PNS.resetConfirm=PNS.resetConfirm||{};

  function modalLock(){
    try{
      (modalApi.modalLock||function(){
        const hasOpen=!!document.querySelector('.modal.is-open');
        if(document.documentElement){
          document.documentElement.classList.toggle('modal-open', hasOpen);
        }
        if(document.body){
          document.body.classList.toggle('modal-open', hasOpen);
        }
      })();
    }catch{}
  }

  function forceOverlayLock(){
    try{
      (modalApi.forceOverlayLock||function(){
        if(document.documentElement){
          document.documentElement.classList.add('modal-open');
        }
        if(document.body){
          document.body.classList.add('modal-open');
        }
      })();
    }catch{}
  }

  function notify(msg){
    try{ PNS.showToast?.(msg,'good'); return; }catch{}
    try{ PNS.showAlert?.(msg); return; }catch{}
    try{ console.log('[phase68]', msg); }catch{}
  }

  function showResetConfirm(opts, onConfirm){
    const title=String(opts?.title||((PNS.t&&PNS.t('confirm_action','Підтвердь дію'))||'Підтвердь дію'));
    const message=String(opts?.message||'');
    const note=String(opts?.note||'');
    const confirmText=String(opts?.confirmText||((PNS.t&&PNS.t('done','Готово'))||'Готово'));
    const cancelText=String(opts?.cancelText||((PNS.t&&PNS.t('cancel','Скасувати'))||'Скасувати'));
    const fallbackText=[title,message,note].filter(Boolean).join('\n\n');
    try{
      const render=(window.renderHtmlTemplate||PNS.renderHtmlTemplate);
      if(typeof render!=='function') throw new Error('renderHtmlTemplate missing');
      const overlay=document.createElement('div');
      overlay.className='pns-confirm-overlay';
      overlay.innerHTML=render('tpl-pns-confirm',{
        title:title,
        message:message,
        confirm_text:confirmText,
        cancel_text:cancelText
      });
      if(note){
        const noteHtml=render('tpl-pns-confirm-note',{note:note});
        const actions=overlay.querySelector('.pns-confirm-actions');
        if(actions) actions.insertAdjacentHTML('beforebegin', noteHtml);
      }
      const previousFocus=document.activeElement;
      let closed=false;
      const cleanup=()=>{
        if(closed) return;
        closed=true;
        try{ document.removeEventListener('keydown', onKey, true); }catch{}
        try{ overlay.remove(); }catch{}
        try{ modalLock(); }catch{}
        try{ previousFocus?.focus?.(); }catch{}
      };
      const onKey=(ev)=>{
        if(ev.key==='Escape'){
          ev.preventDefault();
          cleanup();
        }
      };
      overlay.addEventListener('click', function(ev){ if(ev.target===overlay) cleanup(); });
      overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', function(ev){ ev.preventDefault(); cleanup(); });
      overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', function(ev){ ev.preventDefault(); cleanup(); try{ onConfirm?.(); }catch(err){ console.warn('[phase68] confirm callback failed', err); } });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      forceOverlayLock();
      requestAnimationFrame(()=>{ try{ (overlay.querySelector('[data-confirm-ok]')||overlay.querySelector('[data-confirm-cancel]'))?.focus?.(); }catch{} });
      return true;
    }catch(err){
      console.warn('[phase68] custom confirm failed', err);
      try{ if(window.confirm(fallbackText)){ onConfirm?.(); return true; } }catch{}
      return false;
    }
  }

  api.notify=notify;
  api.showResetConfirm=showResetConfirm;
})();
