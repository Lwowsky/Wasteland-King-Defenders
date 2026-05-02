(function(){
  const PNS = window.PNS = window.PNS || {};
  function q(sel, root=document){ try { return root.querySelector(sel); } catch { return null; } }
  function currentPreviewShift(){
    try {
      const state = typeof window.getCalcState === 'function' ? window.getCalcState() : (PNS.state?.towerCalc || {});
      const shift = String(state?.previewShift || PNS.state?.activeShift || 'shift1').toLowerCase();
      return /^shift[1-4]$/.test(shift) ? shift : 'shift1';
    } catch { return 'shift1'; }
  }
  async function shareCalcPreview(){
    const modal = document.getElementById('towerCalcModal') || document;
    const sheet = q('#towerCalcBoardPreviewSheet .board-sheet', modal) || q('#towerCalcBoardPreviewSheet', modal);
    const statusEl = q('#towerCalcPreviewStatus', modal);
    if (typeof window.shareBoardAsImage === 'function') {
      return await window.shareBoardAsImage({ sheet, shift: currentPreviewShift(), statusEl });
    }
    return false;
  }
  const oldCalcShare = window.calcSharePreviewBoard;
  window.calcSharePreviewBoard = async function(){
    if (typeof oldCalcShare === 'function') {
      try {
        const ok = await oldCalcShare.apply(this, arguments);
        if (ok) return true;
      } catch {}
    }
    return await shareCalcPreview();
  };
  window.shareBoardPreview = async function(){ return await window.calcSharePreviewBoard(); };

  document.addEventListener('click', function(ev){
    const btn = ev.target.closest?.('[data-calc-preview-share]');
    if (!btn) return;
    const modal = document.getElementById('towerCalcModal');
    if (!modal || !modal.contains(btn)) return;
    ev.preventDefault();
    ev.stopPropagation();
    try { ev.stopImmediatePropagation?.(); } catch {}
    window.calcSharePreviewBoard();
  }, true);
})();