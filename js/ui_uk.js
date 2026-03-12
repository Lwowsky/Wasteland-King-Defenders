(function () {
  function refresh(root = document) {
    try { window.PNSI18N?.apply?.(root); } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => refresh(document));
  document.addEventListener('pns:i18n-changed', () => refresh(document));
  document.addEventListener('htmx:afterSwap', (e) => refresh(e?.target || document));
  document.addEventListener('htmx:afterSettle', (e) => refresh(e?.target || document));

  if (document.readyState !== 'loading') refresh(document);
})();
