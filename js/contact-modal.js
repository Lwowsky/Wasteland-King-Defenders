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

    const submitBtn = form.querySelector('button[type="submit"]');
    const payload = {
      name: document.getElementById('contactNameInput')?.value || '',
      nickname: document.getElementById('contactNicknameInput')?.value || '',
      region: document.getElementById('contactRegionInput')?.value || '',
      alliance: document.getElementById('contactAllianceInput')?.value || '',
      email: document.getElementById('contactEmailInput')?.value || '',
      message: document.getElementById('contactMessageInput')?.value || '',
      website: document.getElementById('contactWebsiteInput')?.value || '',
      language: document.documentElement.lang || '',
      page: location.href,
    };

    if (!String(payload.message).trim()) {
      setStatus(t('contact_submit_error_required', 'Напиши повідомлення перед відправкою.'), 'error');
      return;
    }

    try {
      if (submitBtn) submitBtn.disabled = true;
      setStatus(t('contact_submit_sending', 'Надсилаємо повідомлення…'), 'pending');

      const endpoints = [];
      const sameOriginEndpoint = '/api/contact';
      const fallbackEndpoint = window.CONTACT_API_URL || 'https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/contact';
      endpoints.push(sameOriginEndpoint);
      if (fallbackEndpoint && fallbackEndpoint !== sameOriginEndpoint) endpoints.push(fallbackEndpoint);

      let sent = false;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          let data = null;
          try { data = await response.json(); } catch {}

          if (response.ok && data?.ok === true) {
            sent = true;
            break;
          }

          lastError = new Error(data?.telegram_description || data?.error || `send_failed_${response.status}`);

          // If the API exists and Telegram/config returned an error, do not retry another URL.
          if (response.status !== 404 && response.status !== 405) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!sent) {
        try { console.warn('[contact] send failed:', lastError); } catch {}
        throw lastError || new Error('send_failed');
      }

      setStatus(t('contact_submit_done', 'Повідомлення надіслано. Дякуємо!'), 'success');
      form.reset();
    } catch (error) {
      setStatus(t('contact_submit_error', 'Не вдалося надіслати повідомлення. Спробуй ще раз пізніше.'), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
