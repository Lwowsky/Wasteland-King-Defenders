(function(){
  function setupBasesPanelCollapse(){
    const panel=document.getElementById('basesSection') || document.querySelector('.bases-panel');
    const shell=panel?.querySelector('.bases-shell');
    const toggleBtn=document.getElementById('basesPanelToggleBtn');
    const content=document.getElementById('basesPanelContent');
    const settingsCard=document.getElementById('basesSettingsCard') || panel?.querySelector?.('[data-settings-card="1"]');
    if(!panel || !shell || !toggleBtn || !content || panel.dataset.basesCollapseBound === '1') return;
    panel.dataset.basesCollapseBound = '1';

    function getTurretCards(){
      return Array.from(panel.querySelectorAll('.bases-grid > .base-card:not([data-settings-card])'));
    }

    function applyTowerFocusAfterOpen(){
      const PNS = window.PNS || {};
      const state = PNS.state || {};
      try { state.towerViewMode = 'focus'; } catch {}
      try { PNS.ModalsShift?.applyTowerVisibilityMode?.(); } catch {}
      try { PNS.ModalsShift?.focusCurrentTower?.(); } catch {}
    }

    function syncExpandedState(isOpen){
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      shell.classList.toggle('is-open', !!isOpen);
      panel.classList.toggle('is-expanded', !!isOpen);
      panel.dataset.hideSettings = isOpen ? '0' : '1';
      panel.dataset.hideTurrets = isOpen ? '0' : '1';
      if (!isOpen) {
        content.hidden = true;
        content.style.visibility = '';
        return;
      }

      content.hidden = false;
      content.style.visibility = 'hidden';
      if (settingsCard) settingsCard.hidden = false;
      getTurretCards().forEach((card) => { card.hidden = false; });

      requestAnimationFrame(function(){
        applyTowerFocusAfterOpen();
        requestAnimationFrame(function(){
          content.style.visibility = '';
        });
      });
    }

    syncExpandedState(false);

    toggleBtn.addEventListener('click', function(){
      const next = toggleBtn.getAttribute('aria-expanded') !== 'true';
      syncExpandedState(next);
    });

    document.addEventListener('pns:bases-refresh', function(){
      if (toggleBtn.getAttribute('aria-expanded') === 'true') {
        requestAnimationFrame(function(){ syncExpandedState(true); });
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', setupBasesPanelCollapse, { once:true });
  } else {
    setupBasesPanelCollapse();
  }
})();
