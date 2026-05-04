(function(){
  function shouldScroll(){
    return (window.innerWidth || document.documentElement.clientWidth || 0) <= 1200;
  }
  function isShowAll(table){
    return !!table.closest('.table-wrap')?.classList?.contains('is-show-all-columns');
  }
  function desiredOverflow(table){
    return (shouldScroll() || isShowAll(table)) ? 'auto' : 'hidden';
  }
  function ensurePlayersTableScroll(){
    const table = document.getElementById('playersDataTable');
    if (!table) return;
    const existing = table.closest('.v101-players-scroll');
    if (existing) {
      existing.style.overflowX = desiredOverflow(table);
      existing.style.overflowY = 'visible';
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'v101-players-scroll players-table-wrap';
    wrapper.style.maxWidth = '100%';
    wrapper.style.width = '100%';
    wrapper.style.overflowX = desiredOverflow(table);
    wrapper.style.overflowY = 'visible';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
  function refresh(){
    try { ensurePlayersTableScroll(); } catch {}
  }
  document.addEventListener('DOMContentLoaded', refresh);
  window.addEventListener('resize', refresh, { passive:true });
  ['players-table-data-changed','pns:dom:refreshed','pns:i18n-applied','pns:import-shift-rules-applied'].forEach(name => {
    document.addEventListener(name, () => setTimeout(refresh, 30));
  });
  setTimeout(refresh, 200);
  setTimeout(refresh, 1000);
})();
