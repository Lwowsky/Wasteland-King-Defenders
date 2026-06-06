window.WKD = window.WKD || {};

WKD.initHeader = () => {
  const { $, $$, showNotice } = WKD;
  const drawer = $('#drawer');
  const burger = $('#burgerBtn');
  const close = $('#drawerClose');
  const backdrop = $('#drawerBackdrop');
  const langBtn = $('#langBtn');
  const langMenu = $('#langMenu');
  const drawerLangBtn = $('#drawerLangBtn');
  const drawerLangMenu = $('#drawerLangMenu');
  const accountBtn = $('#accountBtn');
  const accountMenu = $('#accountMenu');
  const drawerAccountBtn = $('#drawerAccountBtn');
  const drawerAccountMenu = $('#drawerAccountMenu');
  if (!drawer || !burger || !close || !backdrop || !langBtn || !langMenu) return;
  if (document.documentElement.dataset.wkdHeaderReady === '1') {
    renderLanguages();
    return;
  }
  document.documentElement.dataset.wkdHeaderReady = '1';

  const closeAccountMenu = () => {
    accountMenu?.classList.remove('is-open');
    accountBtn?.setAttribute('aria-expanded', 'false');
  };
  const closeDrawerAccountMenu = () => {
    drawerAccountMenu?.classList.remove('is-open');
    drawerAccountBtn?.setAttribute('aria-expanded', 'false');
  };
  const closeLangMenus = () => {
    langMenu.classList.remove('is-open');
    langBtn.setAttribute('aria-expanded', 'false');
    drawerLangMenu?.classList.remove('is-open');
    drawerLangBtn?.setAttribute('aria-expanded', 'false');
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    burger.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
    closeLangMenus();
    closeDrawerAccountMenu();
  };
  const openDrawer = () => {
    closeAccountMenu();
    closeLangMenus();
    closeDrawerAccountMenu();
    drawer.classList.add('is-open');
    burger.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  };
  const openImport = () => {
    closeDrawer();
    if (typeof WKD.openImportModal === 'function') {
      WKD.openImportModal();
      return;
    }
    window.location.href = 'index.html#import';
  };

  burger.addEventListener('click', () => drawer.classList.contains('is-open') ? closeDrawer() : openDrawer());
  close.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  $('#drawerImportBtn')?.addEventListener('click', openImport);

  if (drawerAccountBtn && drawerAccountMenu) {
    drawerAccountBtn.addEventListener('click', event => {
      event.stopPropagation();
      closeLangMenus();
      const isOpen = drawerAccountMenu.classList.toggle('is-open');
      drawerAccountBtn.setAttribute('aria-expanded', String(isOpen));
    });
    drawerAccountMenu.addEventListener('click', event => event.stopPropagation());
  }

  if (accountBtn && accountMenu) {
    accountBtn.addEventListener('click', event => {
      event.stopPropagation();
      closeLangMenus();
      const isOpen = accountMenu.classList.toggle('is-open');
      accountBtn.setAttribute('aria-expanded', String(isOpen));
    });
    accountMenu.addEventListener('click', event => event.stopPropagation());
  }

  $$('[data-scroll]').forEach(button => button.addEventListener('click', () => {
    closeDrawer();
    const target = $(button.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.location.href = 'index.html#playersPanel';
  }));
  function isHomePage() {
    const name = String(window.location.pathname || '').split('/').pop().toLowerCase();
    return !name || name === 'index.html';
  }
  function openToolWithRetry(button, type, attempt = 0) {
    const isFinal = type === 'final';
    const hash = isFinal ? '#final-plan' : '#tower-planner';
    const fn = isFinal ? WKD.openFinalPlanModal : WKD.openTowerPlanner;
    if (typeof fn === 'function') {
      closeDrawer();
      fn(button);
      return;
    }
    if (!isHomePage()) {
      closeDrawer();
      window.location.href = `index.html${hash}`;
      return;
    }
    document.dispatchEvent(new CustomEvent(isFinal ? 'wkd:open-final-plan' : 'wkd:open-tower-planner', { detail: { trigger: button } }));
    if (attempt < 12) {
      window.setTimeout(() => openToolWithRetry(button, type, attempt + 1), 80);
      return;
    }
    closeDrawer();
    showNotice(isFinal ? 'Фінальний план ще завантажується. Спробуй ще раз через секунду.' : 'Розподіл по турелях ще завантажується. Спробуй ще раз через секунду.');
  }

  $$('[data-open-player-manager]').forEach(button => button.addEventListener('click', event => {
    if (typeof WKD.openPlayerManagerModal === 'function') return;
    event.preventDefault();
    closeDrawer();
    window.location.href = isHomePage() ? '#playersPanel' : 'index.html#playersPanel';
  }));

  $$('[data-disabled-note]').forEach(button => button.addEventListener('click', event => {
    const note = button.dataset.disabledNote || '';
    if (/Фінальний план/i.test(note)) {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
      openToolWithRetry(button, 'final');
      return;
    }
    if (/Розподіл по турелях/i.test(note)) {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
      openToolWithRetry(button, 'tower');
      return;
    }
    showNotice(note || 'Цей блок додамо пізніше.');
  }));

  renderLanguages();

  langBtn.addEventListener('click', event => {
    event.stopPropagation();
    closeAccountMenu();
    drawerLangMenu?.classList.remove('is-open');
    drawerLangBtn?.setAttribute('aria-expanded', 'false');
    const isOpen = langMenu.classList.toggle('is-open');
    langBtn.setAttribute('aria-expanded', String(isOpen));
  });

  drawerLangBtn?.addEventListener('click', event => {
    event.stopPropagation();
    closeAccountMenu();
    langMenu.classList.remove('is-open');
    langBtn.setAttribute('aria-expanded', 'false');
    const isOpen = drawerLangMenu.classList.toggle('is-open');
    drawerLangBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', () => {
    closeAccountMenu();
    closeLangMenus();
    closeDrawerAccountMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeDrawer();
    if (typeof WKD.closeImportModal === 'function') WKD.closeImportModal();
    closeAccountMenu();
    closeLangMenus();
    closeDrawerAccountMenu();
  });
};

function getLanguages() {
  return window.WKD_LANGUAGES || [{ id: 'uk', code: 'UK', name: 'Українська', icon: 'img/lang/lang-uk.svg' }];
}

function getActiveLang() {
  return (typeof window.WKD_normalizeLang === 'function' && window.WKD_normalizeLang(localStorage.getItem('wkd.lang')))
    || window.WKD_CURRENT_LANG
    || (typeof window.WKD_browserLang === 'function' ? window.WKD_browserLang() : 'en');
}

function setLanguage(langId) {
  const { $, $$, showNotice } = WKD;
  const langs = getLanguages();
  const normalized = typeof window.WKD_normalizeLang === 'function' ? window.WKD_normalizeLang(langId) : langId;
  const active = langs.find(lang => lang.id === normalized) || langs.find(lang => lang.id === 'en') || langs[0];
  window.WKD_CURRENT_LANG = active.id;
  localStorage.setItem('wkd.lang', active.id);

  $('#currentLangLabel') && ($('#currentLangLabel').textContent = active.name);
  $('#drawerCurrentLangLabel') && ($('#drawerCurrentLangLabel').textContent = active.name);

  $$('.lang-item').forEach(item => {
    const selected = item.dataset.lang === active.id;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-selected', String(selected));
  });

  if (typeof window.WKD_applyI18n === 'function') window.WKD_applyI18n();
  document.dispatchEvent(new CustomEvent('wkd:language-changed', { detail: { lang: active.id } }));
  showNotice?.(window.WKD_t ? window.WKD_t('common.languageChanged') : 'Language changed');
}

function languageButton(lang, activeId) {
  return `
    <button class="lang-item ${lang.id === activeId ? 'is-active' : ''}" type="button" role="option" data-lang="${lang.id}" aria-selected="${lang.id === activeId}">
      <span class="lang-flag"><img src="${lang.icon}" alt="" width="40" height="40"></span>
      <span class="lang-name">${lang.name}</span>
      <span class="lang-code">${lang.code}</span>
    </button>`;
}

function renderLanguages() {
  const { $, $$ } = WKD;
  const langs = getLanguages();
  const activeId = getActiveLang();
  const html = langs.map(lang => languageButton(lang, activeId)).join('');

  ['#langMenu', '#drawerLangMenu'].forEach(selector => {
    const menu = $(selector);
    if (!menu) return;
    menu.innerHTML = html;
    $$('.lang-item', menu).forEach(item => item.addEventListener('click', event => {
      event.stopPropagation();
      setLanguage(item.dataset.lang || 'uk');
      $('#langMenu')?.classList.remove('is-open');
      $('#langBtn')?.setAttribute('aria-expanded', 'false');
      $('#drawerLangMenu')?.classList.remove('is-open');
      $('#drawerLangBtn')?.setAttribute('aria-expanded', 'false');
    }));
  });

  const active = langs.find(lang => lang.id === activeId) || langs[0];
  $('#currentLangLabel') && ($('#currentLangLabel').textContent = active.name);
  $('#drawerCurrentLangLabel') && ($('#drawerCurrentLangLabel').textContent = active.name);
}
