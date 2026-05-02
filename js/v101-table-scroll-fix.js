(function(){
  function ensurePlayersTableScroll(){
    const table = document.getElementById('playersDataTable');
    if (!table || table.closest('.v101-players-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'v101-players-scroll players-table-wrap';
    wrapper.style.maxWidth = '100%';
    wrapper.style.width = '100%';
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'visible';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
  function refresh(){
    try { ensurePlayersTableScroll(); } catch {}
  }
  document.addEventListener('DOMContentLoaded', refresh);
  ['players-table-data-changed','pns:dom:refreshed','pns:i18n-applied','pns:import-shift-rules-applied'].forEach(name => {
    document.addEventListener(name, () => setTimeout(refresh, 30));
  });
  setTimeout(refresh, 200);
  setTimeout(refresh, 1000);
})();