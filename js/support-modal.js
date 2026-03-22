(function(){
  const modal = document.getElementById('supportModal');
  const openBtn = document.getElementById('openSupportModalBtn');
  if (!modal || !openBtn) return;

  let lastTrigger = null;

  function syncLock(){
    try { window.PNS?.syncBodyModalLock?.(); } catch {}
  }

  function setActiveTab(target){
    modal.querySelectorAll('[data-support-tab-target]').forEach((button) => {
      const active = button.dataset.supportTabTarget === target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-support-tab-panel]').forEach((panel) => {
      const active = panel.dataset.supportTabPanel === target;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function closeModal(){
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    syncLock();
    try { lastTrigger?.focus?.(); } catch {}
  }

  function openModal(trigger){
    try { window.PNS?.closeModal?.(); } catch {}
    const contactModal = document.getElementById('contactModal');
    if (contactModal) {
      contactModal.classList.remove('is-open');
      contactModal.setAttribute('aria-hidden', 'true');
    }
    lastTrigger = trigger || document.activeElement;
    setActiveTab('uah');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    syncLock();
  }

  openBtn.addEventListener('click', function(ev){
    ev.preventDefault();
    openModal(openBtn);
  });

  modal.addEventListener('click', function(ev){
    const closeBtn = ev.target.closest('[data-support-modal-close]');
    if (closeBtn) {
      ev.preventDefault();
      closeModal();
      return;
    }
    const tabBtn = ev.target.closest('[data-support-tab-target]');
    if (tabBtn) {
      ev.preventDefault();
      setActiveTab(String(tabBtn.dataset.supportTabTarget || 'uah'));
    }
  });

  document.addEventListener('keydown', function(ev){
    if (ev.key === 'Escape' && modal.classList.contains('is-open')) {
      ev.preventDefault();
      closeModal();
    }
  });
})();
