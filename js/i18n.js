window.WKD_LANGUAGES = [
  { id: 'uk', code: 'UK', name: 'Українська', icon: 'img/lang/lang-uk.svg' },
  { id: 'en', code: 'EN', name: 'English', icon: 'img/lang/lang-en.svg' },
  { id: 'ru', code: 'RU', name: 'Русский', icon: 'img/lang/lang-ru.svg' },
  { id: 'pl', code: 'PL', name: 'Polski', icon: 'img/lang/lang-pl.svg' },
  { id: 'de', code: 'DE', name: 'Deutsch', icon: 'img/lang/lang-de.svg' },
  { id: 'ja', code: 'JA', name: '日本語', icon: 'img/lang/lang-ja.svg' },
  { id: 'zh', code: 'ZH', name: '中文', icon: 'img/lang/lang-zh.svg' },
  { id: 'ko', code: 'KO', name: '한국어', icon: 'img/lang/lang-ko.svg' },
  { id: 'vi', code: 'VI', name: 'Tiếng Việt', icon: 'img/lang/lang-vi.svg' },
  { id: 'ar', code: 'AR', name: 'العربية', icon: 'img/lang/lang-ar.svg' }
];
window.WKD_TRANSLATIONS = window.WKD_TRANSLATIONS || {};
window.WKD_browserLang = () => {
  const supported = new Set((window.WKD_LANGUAGES || []).map(lang => lang.id));
  const raw = String(navigator.language || navigator.userLanguage || '').toLowerCase();
  const base = raw.split('-')[0];
  if (base === 'ua') return 'uk';
  return supported.has(base) ? base : 'en';
};
window.WKD_normalizeLang = lang => {
  const supported = new Set((window.WKD_LANGUAGES || []).map(item => item.id));
  const id = String(lang || '').trim().toLowerCase();
  if (id === 'ua') return 'uk';
  return supported.has(id) ? id : '';
};
window.WKD_CURRENT_LANG = window.WKD_normalizeLang(localStorage.getItem('wkd.lang')) || window.WKD_browserLang() || 'en';
window.WKD_activeLang = () => {
  const stored = window.WKD_normalizeLang(localStorage.getItem('wkd.lang'));
  const current = window.WKD_normalizeLang(window.WKD_CURRENT_LANG);
  const next = stored || current || window.WKD_browserLang() || 'en';
  window.WKD_CURRENT_LANG = next;
  return next;
};
window.WKD_humanizeI18nKey = key => {
  const raw = String(key || '').trim();
  if (!raw) return '';
  const last = raw.split('.').filter(Boolean).pop() || raw;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, ch => ch.toUpperCase());
};
window.WKD_t = key => {
  const lang = window.WKD_activeLang ? window.WKD_activeLang() : (window.WKD_CURRENT_LANG || 'en');
  const value = (window.WKD_TRANSLATIONS[lang] && window.WKD_TRANSLATIONS[lang][key]) || (window.WKD_TRANSLATIONS.en && window.WKD_TRANSLATIONS.en[key]) || (window.WKD_TRANSLATIONS.uk && window.WKD_TRANSLATIONS.uk[key]);
  return value || window.WKD_humanizeI18nKey(key);
};
window.WKD_tv = (key, vars = {}, fallback = '') => {
  let text = window.WKD_t(key);
  if (!text || text === key) text = fallback || key;
  Object.entries(vars || {}).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
window.WKD_I18N_TEXT_NODE_KEYS = window.WKD_I18N_TEXT_NODE_KEYS || new WeakMap();
window.WKD_applyI18n = (root = document) => {
  const scope = root || document;
  const queryWithRoot = selector => {
    if (scope === document || scope === document.documentElement) return [...document.querySelectorAll(selector)];
    const out = [];
    if (scope.matches?.(selector)) out.push(scope);
    scope.querySelectorAll?.(selector)?.forEach(el => out.push(el));
    return out;
  };
  queryWithRoot('[data-i18n]').forEach(el => { el.textContent = window.WKD_t(el.dataset.i18n); });
  queryWithRoot('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', window.WKD_t(el.dataset.i18nPlaceholder)); });
  queryWithRoot('[data-i18n-title]').forEach(el => { el.setAttribute('title', window.WKD_t(el.dataset.i18nTitle)); });
  queryWithRoot('[data-i18n-aria-label]').forEach(el => { el.setAttribute('aria-label', window.WKD_t(el.dataset.i18nAriaLabel)); });

  const autoText = window.WKD_I18N_AUTO_TEXT || {};
  const autoAttr = window.WKD_I18N_AUTO_ATTR || {};
  const nodeKeys = window.WKD_I18N_TEXT_NODE_KEYS;
  const rootNode = scope === document ? document.documentElement : scope;
  const skipSelector = 'script,style,noscript,.lang-menu,.drawer-lang-menu,.lang-name,.lang-code,.board-sheet,.wkd-final-share-stack,#publicPlanBoard,#publicRegionTableBody,#towerStatusBody,#publicPlayersBody,#registeredPlayersBody,#regionRegistrationsBody,#playersTableBody,[data-no-auto-i18n]';
  if (rootNode && Object.keys(autoText).length && document.createTreeWalker) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(skipSelector)) return NodeFilter.FILTER_REJECT;
        const value = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
        return (nodeKeys.has(node) || (value && autoText[value])) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const raw = String(node.nodeValue || '');
      const compact = raw.replace(/\s+/g, ' ').trim();
      const key = nodeKeys.get(node) || autoText[compact];
      if (!key) return;
      nodeKeys.set(node, key);
      const translated = window.WKD_t(key);
      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      node.nodeValue = leading + translated + trailing;
    });
  }
  if (rootNode && Object.keys(autoAttr).length) {
    rootNode.querySelectorAll?.('[placeholder], [title], [aria-label]')?.forEach(el => {
      ['placeholder', 'title', 'aria-label'].forEach(attr => {
        const keyAttr = `data-wkd-i18n-${attr.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-key`;
        const value = String(el.getAttribute(attr) || '').replace(/\s+/g, ' ').trim();
        const key = el.getAttribute(keyAttr) || autoAttr[value];
        if (key) {
          el.setAttribute(keyAttr, key);
          el.setAttribute(attr, window.WKD_t(key));
        }
      });
    });
  }
  document.documentElement.lang = window.WKD_CURRENT_LANG || 'en';
  document.dispatchEvent(new CustomEvent('wkd:i18n-applied', { detail: { lang: window.WKD_CURRENT_LANG } }));
};

window.WKD_startI18nObserver = () => {
  if (window.WKD_I18N_OBSERVER_STARTED || !window.MutationObserver || !document.body) return;
  window.WKD_I18N_OBSERVER_STARTED = true;
  let scheduled = false;
  const pendingRoots = new Set();
  const heavySelector = '.board-sheet,.wkd-final-share-stack,#publicPlanBoard,#publicRegionTableBody,#towerStatusBody,#publicPlayersBody,#registeredPlayersBody,#regionRegistrationsBody,#playersTableBody,[data-no-auto-i18n]';
  const shouldSkip = node => {
    if (!node) return true;
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !el || Boolean(el.matches?.(heavySelector) || el.closest?.(heavySelector));
  };
  const addRoot = node => {
    if (!node || shouldSkip(node)) return;
    const root = node.nodeType === 1 ? node : node.parentElement;
    if (root && root !== document.body && root !== document.documentElement) pendingRoots.add(root);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.slice(0, 40).forEach(root => window.WKD_applyI18n?.(root));
    });
  };
  const observer = new MutationObserver(mutations => {
    let hasAdded = false;
    mutations.forEach(item => {
      if (item.type !== 'childList' || !item.addedNodes.length) return;
      item.addedNodes.forEach(node => { addRoot(node); hasAdded = true; });
    });
    if (hasAdded && pendingRoots.size) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
document.addEventListener('DOMContentLoaded', () => { window.WKD_startI18nObserver?.(); });
document.addEventListener('wkd:partials-ready', () => { window.WKD_startI18nObserver?.(); window.WKD_applyI18n?.(); });
