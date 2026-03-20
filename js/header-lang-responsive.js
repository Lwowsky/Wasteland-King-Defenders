(function(){
  function setPlacement(){
    const header=document.querySelector('.app-header .header-inner');
    const brand=header?.querySelector('.brand');
    const lang=header?.querySelector('.lang');
    const burger=header?.querySelector('.burger-btn');
    const drawerGroup=document.querySelector('.drawer-lang-group');
    const root=document.documentElement;
    if(!header||!brand||!lang||!burger||!drawerGroup) return;

    const styles=getComputedStyle(header);
    const gap=parseFloat(styles.columnGap||styles.gap||'0')||14;
    const available=header.clientWidth||window.innerWidth||0;
    const brandBadge=brand.querySelector('.brand-badge');
    const brandText=brand.querySelector('.brand-text');
    const badgeWidth=brandBadge?.offsetWidth||0;
    const titleWidth=brandText?.scrollWidth||0;
    const brandWidth=brand.scrollWidth||brand.offsetWidth||0;
    const burgerWidth=burger.offsetWidth||56;

    const label=lang.querySelector('.lang-label');
    const caret=lang.querySelector('.lang-caret');
    const icon=lang.querySelector('.lang-ico');
    const fullLabelWidth=(label?.scrollWidth||90)+(caret?.offsetWidth||12)+(icon?.offsetWidth||42)+42;
    const compactWidth=(icon?.offsetWidth||42)+28;
    const centeredTitleMode=brandText && getComputedStyle(brandText).position==='absolute';
    const brandBaseWidth=centeredTitleMode ? badgeWidth + titleWidth + gap*2 + 40 : brandWidth + 16;
    const fullNeeded=brandBaseWidth + burgerWidth + fullLabelWidth + gap*3;
    const compactNeeded=brandBaseWidth + burgerWidth + compactWidth + gap*3;

    const canShowFull=window.innerWidth>860 && fullNeeded<=available;
    const canShowCompact=window.innerWidth>560 && compactNeeded<=available;
    const moveToDrawer=!canShowFull && !canShowCompact;
    const compactOnly=!moveToDrawer && !canShowFull;

    root.classList.toggle('lang-in-drawer',moveToDrawer);
    root.classList.toggle('lang-compact',compactOnly);
    drawerGroup.hidden=!moveToDrawer;
    if(!moveToDrawer) drawerGroup.removeAttribute('open');
    if(moveToDrawer){
      lang.classList.remove('is-open');
      const btn=lang.querySelector('.lang-btn');
      if(btn) btn.setAttribute('aria-expanded','false');
    }
  }
  let raf=0;
  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(setPlacement);
  }
  document.addEventListener('DOMContentLoaded',schedule);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('load',schedule);
  document.addEventListener('pns:i18n-applied',schedule);
  if(document.fonts?.ready) document.fonts.ready.then(schedule).catch(function(){});
  const ro = window.ResizeObserver ? new ResizeObserver(schedule) : null;
  document.addEventListener('DOMContentLoaded',function(){
    const header=document.querySelector('.app-header .header-inner');
    if(ro&&header) ro.observe(header);
  });
})();
