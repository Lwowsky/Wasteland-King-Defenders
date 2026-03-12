(() => {
  if (window.__pnsLangBound) return;
  window.__pnsLangBound = true;

  const DEFAULT_LANG = 'uk';
  const supported = new Set(['uk', 'en', 'ru']);

  function normalizeLang(lang) {
    const value = String(lang || '').trim().toLowerCase();
    return supported.has(value) ? value : DEFAULT_LANG;
  }

  function closeAllLangMenus() {
    document.querySelectorAll('.lang.is-open').forEach((root) => {
      root.classList.remove('is-open');
      const btn = root.querySelector('.lang-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function currentLang() {
    try {
      return normalizeLang(window.PNSI18N?.locale || localStorage.getItem('pns_lang') || document.documentElement.dataset.locale || DEFAULT_LANG);
    } catch {
      return normalizeLang(document.documentElement.dataset.locale || DEFAULT_LANG);
    }
  }

  function applyLangToUI(lang) {
    const root = document.querySelector('.lang');
    if (!root) return;
    const safe = normalizeLang(lang);
    const item = root.querySelector(`.lang-item[data-lang="${safe}"]`);
    if (!item) return;

    const name = item.querySelector('.lang-name')?.textContent?.trim();
    const label = root.querySelector('.lang-label');
    if (label && name) label.textContent = name;

    root.querySelectorAll('.lang-item').forEach((x) => x.setAttribute('aria-selected', String(x === item)));
  }

  function applyLanguage(lang, opts = {}) {
    const safe = normalizeLang(lang);
    if (typeof window.PNS?.setLocale === 'function') {
      window.PNS.setLocale(safe, { persist: opts.persist !== false, rerender: opts.rerender !== false });
    } else {
      try { localStorage.setItem('pns_lang', safe); } catch {}
      document.documentElement.lang = safe;
      document.documentElement.dataset.locale = safe;
    }
    applyLangToUI(safe);
  }

  function applySavedLang() {
    applyLanguage(currentLang(), { rerender: false });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;

    const root = btn.closest('.lang');
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();

    const willOpen = !root.classList.contains('is-open');
    closeAllLangMenus();
    root.classList.toggle('is-open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    const item = e.target.closest('.lang-item');
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    applyLanguage(item.dataset.lang || DEFAULT_LANG, { rerender: true });
    closeAllLangMenus();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang')) closeAllLangMenus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllLangMenus();
  });

  document.addEventListener('pns:i18n-applied', () => applyLangToUI(currentLang()));
  document.addEventListener('pns:i18n-changed', (e) => applyLangToUI(e?.detail?.locale || currentLang()));
  document.addEventListener('DOMContentLoaded', applySavedLang);

  if (document.readyState !== 'loading') applySavedLang();
})();
