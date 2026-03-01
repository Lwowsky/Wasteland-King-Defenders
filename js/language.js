(() => {
  // щоб не біндити двічі
  if (window.__pnsLangBound) return;
  window.__pnsLangBound = true;

  const DEFAULT_LANG = 'uk';

  function closeAllLangMenus() {
    document.querySelectorAll('.lang.is-open').forEach((root) => {
      root.classList.remove('is-open');
      const btn = root.querySelector('.lang-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function getSavedLang() {
    try {
      return localStorage.getItem('pns_lang');
    } catch {
      return null;
    }
  }

  function setSavedLang(lang) {
    try {
      localStorage.setItem('pns_lang', lang);
    } catch {}
  }

  function applyLangToUI(lang) {
    const root = document.querySelector('.lang');
    if (!root) return;

    const item = root.querySelector(`.lang-item[data-lang="${lang}"]`);
    if (!item) return;

    const name = item.querySelector('.lang-name')?.textContent?.trim();
    const label = root.querySelector('.lang-label');
    if (label && name) label.textContent = name;

    root.querySelectorAll('.lang-item').forEach(x => x.setAttribute('aria-selected', 'false'));
    item.setAttribute('aria-selected', 'true');
  }

  function applySavedLang() {
    let lang = getSavedLang();

    // якщо ще нічого не вибирали — ставимо українську як дефолт
    if (!lang) {
      lang = DEFAULT_LANG;
      setSavedLang(lang);
    }

    applyLangToUI(lang);

    // якщо у тебе є реальна i18n логіка — можеш викликати тут:
    // if (window.setLanguage) window.setLanguage(lang);
  }

  // 1) Toggle меню
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;

    const root = btn.closest('.lang');
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const willOpen = !root.classList.contains('is-open');
    closeAllLangMenus();
    root.classList.toggle('is-open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  // 2) Select language
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.lang-item');
    if (!item) return;

    const root = item.closest('.lang');
    if (!root) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const lang = item.dataset.lang || DEFAULT_LANG;
    setSavedLang(lang);
    applyLangToUI(lang);
    closeAllLangMenus();

    // якщо у тебе є реальна i18n логіка — можеш викликати тут:
    // if (window.setLanguage) window.setLanguage(lang);
  });

  // 3) click outside -> close (не закриваємо, якщо клік всередині .lang)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.lang')) return;
    closeAllLangMenus();
  });

  // 4) Esc -> close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllLangMenus();
  });

  // 5) HTMX + старт
  document.addEventListener('htmx:afterSwap', applySavedLang);
  document.addEventListener('htmx:afterSettle', applySavedLang);
  document.addEventListener('DOMContentLoaded', applySavedLang);
})();