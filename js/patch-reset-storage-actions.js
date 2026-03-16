/* ==== reset-storage-actions.js ==== */
/* Reset storage actions and reset-button wiring */
;(function(){
  const FLAG='__pns_reset_storage_actions_patch__';
  if(window[FLAG]) return;
  window[FLAG]=true;

  const PNS=window.PNS=window.PNS||{};
  const api=PNS.resetStorageActions=PNS.resetStorageActions||{};
  const confirmApi=PNS.resetConfirm=PNS.resetConfirm||{};

  function removeMatching(prefix){
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i+=1){
        const k=localStorage.key(i);
        if(k && k.indexOf(prefix)===0) keys.push(k);
      }
      keys.forEach(k=>{ try{ localStorage.removeItem(k); }catch{} });
    }catch{}
  }


  function resetRuntimeStateToDefaults(){
    try{
      const state=PNS.state=PNS.state||{};
      state.showAllColumns=false;
      state.activeShift='shift1';
      state.players=[];
      state.playerById=new Map();
      state.topFilters={search:'',role:'all',shift:'all',status:'all'};
      state.visibleOptionalColumns=[];
      state.fieldLabelOverrides={};
      state.importData={headers:[],rows:[],mapping:{},loaded:false,customOptionalDefs:[]};
      state.shiftPlans={shift1:null,shift2:null};
      state._shiftPlansLoadedFromLS=true;
      state.towerCalc={};
      state.towerCalcLastResults=null;
      (state.bases||[]).forEach(base=>{
        if(!base) return;
        base.captainId=null;
        base.helperIds=[];
        base.role=null;
        try{ PNS.applyBaseRoleUI?.(base,null); }catch{}
      });
    }catch{}
  }

  function clearAllPersistentStorage(){
    try{ localStorage.clear(); }catch{}
    try{ sessionStorage.clear(); }catch{}
    try{ removeMatching('pns_'); }catch{}
    try{ removeMatching('pns-'); }catch{}
    try{ removeMatching('pns'); }catch{}
    try{ removeMatching('__pns'); }catch{}
  }

  function refreshAfterReset(){
    try{ PNS.loadFieldLabelOverrides?.(); }catch{}
    try{ PNS.loadVisibleOptionalColumns?.(); }catch{}
    try{ PNS.renderImportUI?.(); }catch{}
    try{ PNS.applyColumnVisibility?.(PNS.state?.showAllColumns); }catch{}
    try{ PNS.renderPlayersTableFromState?.(); }catch{}
    try{ PNS.buildRowActions?.(); }catch{}
    try{ PNS.renderAll?.(); }catch{}
    try{ window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); }catch{}
    try{ window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); }catch{}
    try{ window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); }catch{}
  }

  function resetColumns(ev){
    try{ ev?.preventDefault?.(); ev?.stopPropagation?.(); ev?.stopImmediatePropagation?.(); }catch{}
    return (confirmApi.showResetConfirm||function(){return false;})({
      title:'Скинути дані колонок?',
      message:'Колонки та їхні налаштування буде повернуто до заводського стану.',
      note:'Буде очищено шаблони імпорту, видимі колонки та перевизначення назв колонок.',
      confirmText:'Скинути колонки',
      cancelText:'Скасувати'
    }, ()=>{
      const K=PNS.KEYS||{};
      [K.KEY_IMPORT_TEMPLATES,K.KEY_IMPORT_VISIBLE_COLUMNS,K.KEY_FIELD_LABEL_OVERRIDES].filter(Boolean).forEach(k=>{ try{ localStorage.removeItem(k); }catch{} });
      removeMatching('pns_layout_import_custom_');
      try{
        PNS.state.fieldLabelOverrides={};
        PNS.state.visibleOptionalColumns=[];
        PNS.state.importData=PNS.state.importData||{headers:[],rows:[],mapping:{},loaded:false};
        PNS.state.importData.mapping={};
        PNS.state.importData.customOptionalDefs=[];
      }catch{}
      refreshAfterReset();
      try{ confirmApi.notify?.('Дані колонок скинуто.'); }catch{}
    });
  }

  function resetTables(ev){
    try{ ev?.preventDefault?.(); ev?.stopPropagation?.(); ev?.stopImmediatePropagation?.(); }catch{}
    return (confirmApi.showResetConfirm||function(){return false;})({
      title:'Скинути дані таблиць?',
      message:'Буде очищено таблицю гравців, призначення і плани змін.',
      note:'Після цього список гравців, призначення в турелі та плани змін доведеться завантажити або зібрати заново.',
      confirmText:'Скинути таблиці',
      cancelText:'Скасувати'
    }, ()=>{
      const K=PNS.KEYS||{};
      [K.KEY_ASSIGNMENTS_STORE,K.KEY_ASSIGNMENT_PRESETS,K.KEY_TOP_FILTERS,K.KEY_SHIFT_FILTER,K.KEY_SHOW_ALL,
        'pns_layout_shift_plans_store_v1','pns_tower_calc_state','pns_layout_players_snapshot_v1','pns_layout_towers_snapshot_v1','pns_layout_tower_march_overrides_v1']
        .filter(Boolean).forEach(k=>{ try{ localStorage.removeItem(k); }catch{} });
      try{ PNS.clearPlayersSnapshot?.(); }catch{}
      try{ PNS.clearTowersSnapshot?.(); }catch{}
      try{ PNS.clearTowerMarchOverrides?.(); }catch{}
      try{
        const state=PNS.state||{};
        state.players=[];
        state.playerById=new Map();
        state.shiftPlans={shift1:null,shift2:null};
        state._shiftPlansLoadedFromLS=true;
        state.activeShift='shift1';
        state.towerCalcLastResults=null;
        (state.bases||[]).forEach(base=>{ if(base){ base.captainId=null; base.helperIds=[]; base.role=null; try{ PNS.applyBaseRoleUI?.(base,null); }catch{} } });
        try{ localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({shift1:null,shift2:null})); }catch{}
      }catch{}
      refreshAfterReset();
      try{ confirmApi.notify?.('Дані таблиць скинуто.'); }catch{}
    });
  }

  function resetAllStorage(ev){
    try{ ev?.preventDefault?.(); ev?.stopPropagation?.(); ev?.stopImmediatePropagation?.(); }catch{}
    return (confirmApi.showResetConfirm||function(){return false;})({
      title:'Повністю скинути LocalStorage?',
      message:'Усі збережені дані сайту буде видалено і застосунок повернеться до заводських налаштувань.',
      note:'Цю дію не можна скасувати. Будуть очищені таблиці, колонки, шаблони імпорту, налаштування та інший локально збережений стан.',
      confirmText:'Скинути все',
      cancelText:'Скасувати'
    }, ()=>{
      try{ PNS.setPersistenceSuppressed?.(true); }catch{}
      try{ window.__PNS_FACTORY_RESET_ACTIVE=true; }catch{}
      clearAllPersistentStorage();
      resetRuntimeStateToDefaults();
      refreshAfterReset();
      setTimeout(()=>{
        clearAllPersistentStorage();
        try{ history.replaceState(null,'',window.location.pathname+window.location.search); }catch{}
        try{ window.location.reload(); }catch(_e){ try{ window.location.replace(window.location.pathname+window.location.search); }catch{} }
      },30);
    });
  }

  api.removeMatching=removeMatching;
  api.refreshAfterReset=refreshAfterReset;
  api.resetColumns=resetColumns;
  api.resetTables=resetTables;
  api.resetAllStorage=resetAllStorage;

  document.addEventListener('click', function(ev){
    const target=ev.target && ev.target.closest ? ev.target.closest('#resetAllStorageBtn,#resetColumnDataBtn,#resetTableDataBtn') : null;
    if(!target) return;
    if(target.id==='resetAllStorageBtn') resetAllStorage(ev);
    else if(target.id==='resetColumnDataBtn') resetColumns(ev);
    else if(target.id==='resetTableDataBtn') resetTables(ev);
  }, true);
})();
