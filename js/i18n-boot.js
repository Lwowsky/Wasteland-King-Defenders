(function () {
  function normalizeLocale(value) {
    var lang = String(value || '').trim().toLowerCase();
    if (lang === 'ua') lang = 'uk';
    if (lang.indexOf('-') > -1) lang = lang.split('-')[0];
    if (lang.indexOf('_') > -1) lang = lang.split('_')[0];
    return /^(uk|en|ru|pl|de|ja|zh|ko|vi|ar)$/.test(lang) ? lang : '';
  }

  function detectBrowserLocale() {
    try {
      var candidates = [];
      if (Array.isArray(navigator.languages)) candidates = candidates.concat(navigator.languages);
      if (navigator.language) candidates.push(navigator.language);
      if (navigator.userLanguage) candidates.push(navigator.userLanguage);
      for (var i = 0; i < candidates.length; i += 1) {
        var normalized = normalizeLocale(candidates[i]);
        if (normalized) return normalized;
      }
    } catch (e) {}
    return '';
  }

  try {
    var saved = normalizeLocale(localStorage.getItem('pns_lang'));
    var lang = saved || detectBrowserLocale() || 'uk';
    document.documentElement.lang = lang;
    document.documentElement.dataset.locale = lang;
    document.documentElement.classList.add('i18n-pending');
  } catch (e) {
    document.documentElement.lang = 'uk';
    document.documentElement.dataset.locale = 'uk';
    document.documentElement.classList.add('i18n-pending');
  }
})();
