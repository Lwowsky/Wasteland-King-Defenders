(function () {
  function setPlacement() {
    const root = document.documentElement;
    const drawerGroup = document.querySelector('.drawer-lang-group');
    const lang = document.querySelector('.app-header .lang');

    const w = window.innerWidth || 0;

    const moveToDrawer = w <= 560;
    const compactOnly = w > 560 && w < 769;

    root.classList.toggle('lang-in-drawer', moveToDrawer);
    root.classList.toggle('lang-compact', compactOnly);

    if (drawerGroup) {
      drawerGroup.hidden = !moveToDrawer;
      if (!moveToDrawer) drawerGroup.removeAttribute('open');
    }

    if (moveToDrawer && lang) {
      lang.classList.remove('is-open');
      const btn = lang.querySelector('.lang-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  function schedule() {
    requestAnimationFrame(setPlacement);
  }

  setPlacement();
  document.addEventListener('DOMContentLoaded', setPlacement);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', setPlacement);
})();