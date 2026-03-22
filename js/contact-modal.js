(function(){
  const modal = document.getElementById('contactModal');
  const openBtn = document.getElementById('openContactModalBtn');
  const form = document.getElementById('contactModalForm');
  const status = document.getElementById('contactModalStatus');
  const firstField = document.getElementById('contactNameInput');
  if (!modal || !openBtn || !form) return;
  const isDisabled = openBtn.hasAttribute('disabled') || openBtn.dataset.contactDisabled === '1';

  let lastTrigger = null;

  function syncLock(){
    try { window.PNS?.syncBodyModalLock?.(); } catch {}
  }

  function closeModal(){
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    syncLock();
    try { lastTrigger?.focus?.(); } catch {}
  }

  function openModal(trigger){
    if (isDisabled) return;
    try { window.PNS?.closeModal?.(); } catch {}
    const supportModal = document.getElementById('supportModal');
    if (supportModal) {
      supportModal.classList.remove('is-open');
      supportModal.setAttribute('aria-hidden', 'true');
    }
    lastTrigger = trigger || document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    syncLock();
    setTimeout(() => {
      try { firstField?.focus?.(); } catch {}
    }, 30);
  }

  openBtn.addEventListener('click', function(ev){
    ev.preventDefault();
    if (isDisabled) return;
    openModal(openBtn);
  });

  modal.addEventListener('click', function(ev){
    if (ev.target.closest('[data-contact-modal-close]')) {
      ev.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', function(ev){
    if (ev.key === 'Escape' && modal.classList.contains('is-open')) {
      ev.preventDefault();
      closeModal();
    }
  });

  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    const t = (key, fallback) => window.PNS?.t?.(key, fallback) || fallback;
    if (status) {
      status.textContent = t('contact_submit_done', 'Форму збережено локально. Підключення пошти можна додати пізніше.');
      status.classList.add('is-visible');
    }
  });
})();
