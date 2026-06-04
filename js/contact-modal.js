window.WKD = window.WKD || {};

(() => {
  const modal = () => document.getElementById('contactModal');
  const form = () => document.getElementById('contactModalForm');
  const statusEl = () => document.getElementById('contactModalStatus');
  const firstField = () => document.getElementById('contactNameInput');
  let lastTrigger = null;

  const t = (key, fallback) => (typeof window.WKD_t === 'function' ? window.WKD_t(key) : fallback) || fallback;
  const syncBody = () => {
    const anyOpen = Boolean(document.querySelector('.modal.is-open, .tower-final-lang-modal.is-open, .confirm-modal.is-open'));
    document.body.classList.toggle('wkd-modal-open', anyOpen);
  };
  const setStatus = (message, kind = '') => {
    const status = statusEl();
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-visible', Boolean(message));
    status.dataset.statusKind = kind;
  };

  WKD.openContactModal = trigger => {
    const root = modal();
    if (!root) return;
    lastTrigger = trigger || document.activeElement;
    setStatus('', '');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    syncBody();
    window.setTimeout(() => { try { firstField()?.focus?.(); } catch (_error) {} }, 30);
  };

  WKD.closeContactModal = () => {
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    syncBody();
    try { lastTrigger?.focus?.(); } catch (_error) {}
  };

  WKD.initContactModal = () => {
    const root = modal();
    if (!root) return;
    document.querySelectorAll('#openContactModalBtn,[data-contact-modal-open]').forEach(btn => {
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.classList.remove('is-disabled');
    });

    const contactForm = form();
    if (contactForm && contactForm.dataset.contactSubmitReady !== '1') {
      contactForm.dataset.contactSubmitReady = '1';
      contactForm.addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const payload = {
          name: document.getElementById('contactNameInput')?.value || '',
          nickname: document.getElementById('contactNicknameInput')?.value || '',
          region: document.getElementById('contactRegionInput')?.value || '',
          alliance: document.getElementById('contactAllianceInput')?.value || '',
          email: document.getElementById('contactEmailInput')?.value || '',
          message: document.getElementById('contactMessageInput')?.value || '',
          website: document.getElementById('contactWebsiteInput')?.value || '',
          language: window.WKD_CURRENT_LANG || document.documentElement.lang || '',
          page: location.href
        };
        if (String(payload.website || '').trim()) return;
        if (!String(payload.message).trim()) {
          setStatus(t('contact.required', 'Напиши повідомлення перед відправкою.'), 'error');
          return;
        }
        try {
          if (submitBtn) submitBtn.disabled = true;
          setStatus(t('contact.sending', 'Надсилаємо повідомлення…'), 'pending');
          const response = await fetch('https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let data = null;
          try { data = await response.json(); } catch (_error) {}
          if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'send_failed');
          setStatus(t('contact.done', 'Повідомлення надіслано. Дякуємо!'), 'success');
          contactForm.reset();
        } catch (_error) {
          setStatus(t('contact.error', 'Не вдалося надіслати повідомлення. Спробуй ще раз пізніше.'), 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  };

  if (!document.documentElement.dataset.contactDelegationReady) {
    document.documentElement.dataset.contactDelegationReady = '1';
    document.addEventListener('click', event => {
      const openBtn = event.target.closest('#openContactModalBtn,[data-contact-modal-open]');
      if (openBtn) {
        event.preventDefault();
        WKD.initContactModal?.();
        WKD.openContactModal?.(openBtn);
        return;
      }
      const root = modal();
      if (!root?.classList.contains('is-open')) return;
      const closeBtn = event.target.closest('[data-contact-modal-close]');
      if (closeBtn && root.contains(closeBtn)) {
        event.preventDefault();
        WKD.closeContactModal?.();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !modal()?.classList.contains('is-open')) return;
      event.preventDefault();
      WKD.closeContactModal?.();
    });
  }

  document.addEventListener('wkd:partials-ready', () => WKD.initContactModal?.());
})();
