(function () {
  try {
    var lang = localStorage.getItem('pns_lang') || 'uk';
    if (!/^(uk|ua|en|ru)$/.test(lang)) lang = 'uk';
    if (lang === 'ua') lang = 'uk';
    document.documentElement.lang = lang;
    document.documentElement.dataset.locale = lang;
    document.documentElement.classList.add('i18n-pending');
  } catch (e) {
    document.documentElement.lang = 'uk';
    document.documentElement.dataset.locale = 'uk';
    document.documentElement.classList.add('i18n-pending');
  }
})();
