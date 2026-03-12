(function () {
  function refresh(root = document) {
    try { window.PNSI18N?.apply?.(root); } catch {}
  }

  ['DOMContentLoaded','htmx:afterSwap','htmx:afterSettle','players-table-rendered','players-table-data-changed','players-table-filters-changed','pns:assignment-changed','pns:i18n-changed'].forEach((evt) => {
    document.addEventListener(evt, () => refresh(document));
  });

  if (document.readyState !== 'loading') refresh(document);
})();
