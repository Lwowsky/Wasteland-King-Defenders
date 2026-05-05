(function(){
  const modal = document.getElementById('contactModal');
  const openBtn = document.getElementById('openContactModalBtn');
  const form = document.getElementById('contactModalForm');
  const status = document.getElementById('contactModalStatus');
  const firstField = document.getElementById('contactNameInput');
  if (!modal || !openBtn || !form) return;
  openBtn.disabled = false;
  openBtn.removeAttribute('disabled');
  openBtn.removeAttribute('aria-disabled');
  openBtn.classList.remove('is-disabled');

  function isDisabled(){
    return openBtn.hasAttribute('disabled') || openBtn.dataset.contactDisabled === '1' || openBtn.getAttribute('aria-disabled') === 'true';
  }

  function t(key, fallback) {
    return window.PNS?.t?.(key, fallback) || fallback;
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-visible', !!message);
    status.dataset.statusKind = kind || '';
  }

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
    if (isDisabled()) return;
    try { window.PNS?.closeModal?.(); } catch {}
    const supportModal = document.getElementById('supportModal');
    if (supportModal) {
      supportModal.classList.remove('is-open');
      supportModal.setAttribute('aria-hidden', 'true');
    }
    lastTrigger = trigger || document.activeElement;
    setStatus('', '');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    syncLock();
    setTimeout(() => {
      try { firstField?.focus?.(); } catch {}
    }, 30);
  }

  openBtn.addEventListener('click', function(ev){
    ev.preventDefault();
    if (isDisabled()) return;
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

  form.addEventListener('submit', async function(ev){
    ev.preventDefault();
    const t = (key, fallback) => window.PNS?.t?.(key, fallback) || fallback;
    if (status) {
      status.textContent = t('contact_submit_done', 'Форму збережено локально. Підключення пошти можна додати пізніше.');
      status.classList.add('is-visible');
    }
  });
})();
