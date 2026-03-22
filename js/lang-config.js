(function(){
  const locales = ['en','uk','ru','pl','de','ja','zh','ko','vi','ar'];
  const meta = {
    uk: { code: 'UK', name: 'Українська', icon: 'img/lang/lang-uk.svg', dir: 'ltr' },
    en: { code: 'EN', name: 'English', icon: 'img/lang/lang-en.svg', dir: 'ltr' },
    ru: { code: 'RU', name: 'Русский', icon: 'img/lang/lang-ru.svg', dir: 'ltr' },
    pl: { code: 'PL', name: 'Polski', icon: 'img/lang/lang-pl.svg', dir: 'ltr' },
    de: { code: 'DE', name: 'Deutsch', icon: 'img/lang/lang-de.svg', dir: 'ltr' },
    ja: { code: 'JA', name: '日本語', icon: 'img/lang/lang-ja.svg', dir: 'ltr' },
    zh: { code: 'ZH', name: '中文', icon: 'img/lang/lang-zh.svg', dir: 'ltr' },
    ko: { code: 'KO', name: '한국어', icon: 'img/lang/lang-ko.svg', dir: 'ltr' },
    vi: { code: 'VI', name: 'Tiếng Việt', icon: 'img/lang/lang-vi.svg', dir: 'ltr' },
    ar: { code: 'AR', name: 'العربية', icon: 'img/lang/lang-ar.svg', dir: 'rtl' }
  };

  function normalizeLocale(locale){
    const value = String(locale || '').trim().toLowerCase();
    if (value === 'ua') return 'uk';
    return locales.includes(value) ? value : 'uk';
  }

  function getSupportedLocales(){
    return locales.slice();
  }

  function getLanguageMeta(locale){
    const normalized = normalizeLocale(locale);
    return Object.assign({ code: normalized.toUpperCase(), name: normalized.toUpperCase(), icon: '', dir: 'ltr' }, meta[normalized] || {}, { locale: normalized });
  }

  function getLanguageLabel(locale){
    return getLanguageMeta(locale).name;
  }

  function getLanguageIcon(locale){
    return getLanguageMeta(locale).icon;
  }

  window.PNS_LANGS = { locales, meta, normalizeLocale, getSupportedLocales, getLanguageMeta, getLanguageLabel, getLanguageIcon };
  window.PNS = window.PNS || {};
  Object.assign(window.PNS, { getSupportedLocales, getLanguageMeta, getLanguageLabel, getLanguageIcon, normalizeLocale });
})();
