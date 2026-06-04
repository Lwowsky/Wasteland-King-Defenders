(() => {
  function activateTab(name) {
    document.querySelectorAll('[data-profile-tab]').forEach(button => {
      const active = button.dataset.profileTab === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-profile-panel]').forEach(panel => {
      const active = panel.dataset.profilePanel === name;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function initProfileTabs() {
    document.querySelectorAll('[data-profile-tab]').forEach(button => {
      button.addEventListener('click', () => activateTab(button.dataset.profileTab));
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'region') activateTab('region');
  }

  document.addEventListener('wkd:partials-ready', initProfileTabs);
  document.addEventListener('DOMContentLoaded', () => setTimeout(initProfileTabs, 0));
})();
