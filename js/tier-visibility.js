(function(){
  const PNS = window.PNS = window.PNS || {};
  const KEY = 'pns_visible_tiers_v2';
  const FIXED_TIERS = ['T14','T13','T12','T11','T10','T9','T8'];
  const DEFAULT_ACTIVE_TIERS = ['T14','T13','T12','T11','T10','T9'];
  const ADDABLE_TIERS = ['T7','T6','T5','T4','T3','T2','T1'];
  const ALL_TIERS = ['T14','T13','T12','T11','T10','T9','T8','T7','T6','T5','T4','T3','T2','T1'];
  const DEFAULT = [
    ...DEFAULT_ACTIVE_TIERS.map(tier => ({ tier, enabled:true, fixed:true })),
    { tier:'T8', enabled:false, fixed:true }
  ];

  const t = (key, fallback='') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback || key);

  function normalizeTier(value){
    if (typeof PNS.normalizeTierText === 'function') {
      try {
        const normalized = String(PNS.normalizeTierText(value || '') || '').toUpperCase();
        if (ALL_TIERS.includes(normalized)) return normalized;
      } catch {}
    }
    const text = String(value || '').toUpperCase().replace(/\s+/g,'');
    const match = text.match(/^T?([1-9]|1[0-4])$/) || text.match(/(?:^|[^A-Z0-9])T?\s*([1-9]|1[0-4])(?:$|[^A-Z0-9])/i);
    if (!match) return '';
    const tier = `T${Number(match[1])}`;
    return ALL_TIERS.includes(tier) ? tier : '';
  }

  function normalizeList(list){
    const seen = new Set();
    const source = Array.isArray(list) ? list : [];
    const byTier = new Map();
    for (const item of source) {
      const tier = normalizeTier(item?.tier);
      if (!tier || seen.has(tier)) continue;
      seen.add(tier);
      byTier.set(tier, { tier, enabled:item?.enabled !== false, fixed:FIXED_TIERS.includes(tier) });
    }
    for (const item of DEFAULT) {
      if (!byTier.has(item.tier)) byTier.set(item.tier, { ...item });
    }
    return ALL_TIERS.filter(tier => byTier.has(tier)).map(tier => {
      const item = byTier.get(tier);
      return { tier, enabled:item.enabled !== false, fixed:FIXED_TIERS.includes(tier) };
    });
  }

  function read(){
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem('pns_visible_extra_tiers_v1');
      const list = normalizeList(raw ? JSON.parse(raw) : DEFAULT);
      const optional = ['T8', ...ADDABLE_TIERS];
      const enabledOptional = optional.filter(tier => list.some(item => item.tier === tier && item.enabled !== false));
      if (enabledOptional.length >= 5) {
        return list.map(item => optional.includes(item.tier) ? { ...item, enabled:false } : item);
      }
      return list;
    } catch {
      return normalizeList(DEFAULT);
    }
  }

  function write(list){
    try { localStorage.setItem(KEY, JSON.stringify(normalizeList(list))); } catch {}
  }

  function enabledSet(){
    return new Set(read().filter(item => item.enabled).map(item => item.tier));
  }

  function visibleTiers(){
    const set = enabledSet();
    return ALL_TIERS.filter(tier => set.has(tier));
  }

  function tiersFromPlayers(players){
    const found = new Set();
    (Array.isArray(players) ? players : []).forEach(player => {
      const tier = normalizeTier(player?.tier || player?.troopTier || player?.raw?.troop_tier || player?.raw?.tier || '');
      if (tier) found.add(tier);
      const secondary = normalizeTier(player?.secondaryTier || player?.raw?.secondary_tier || '');
      if (secondary) found.add(secondary);
    });
    return found;
  }

  function autoEnableTiersFromPlayers(players, options = {}){
    const found = tiersFromPlayers(players);
    if (!found.size && options.requireFound) return read();

    if (options.mode === 'import') {
      const next = [
        ...DEFAULT_ACTIVE_TIERS.map(tier => ({ tier, enabled:true, fixed:true })),
        { tier:'T8', enabled:found.has('T8'), fixed:true }
      ];
      ADDABLE_TIERS.forEach(tier => {
        if (found.has(tier)) next.push({ tier, enabled:true, fixed:false });
      });
      write(next);
    } else {
      const list = read();
      const byTier = new Map(list.map(item => [item.tier, { ...item }]));
      found.forEach(tier => {
        if (byTier.has(tier)) {
          byTier.set(tier, { ...byTier.get(tier), enabled:true, fixed:FIXED_TIERS.includes(tier) });
        } else if (ADDABLE_TIERS.includes(tier)) {
          byTier.set(tier, { tier, enabled:true, fixed:false });
        }
      });
      write(ALL_TIERS.filter(tier => byTier.has(tier)).map(tier => byTier.get(tier)));
    }

    try { render(); } catch { try { apply(); } catch {} }
    return read();
  }

  function enableTier(tier){
    const normalized = normalizeTier(tier);
    if (!normalized) return read();
    return autoEnableTiersFromPlayers([{ tier: normalized }], { mode:'append' });
  }

  function makeTierInput(tier, attrName){
    const inputClass = attrName === 'data-calc-tier-target' ? ' class="input-w-92"' : '';
    const name = attrName === 'data-calc-tier-target' ? ` name="calc-tier-target_${tier}"` : '';
    const defaultValue = typeof PNS.getDefaultTierMinMarch === 'function' ? PNS.getDefaultTierMinMarch(tier) : 0;
    return `${tier} <input${inputClass} ${attrName}="${tier}" min="0"${name} step="1000" type="number" value="${defaultValue}"/>`;
  }

  function ensureCalcInputs(){
    const row = document.getElementById('towerCalcTierTargetRow');
    if(row){
      ALL_TIERS.forEach(tier => {
        if(!row.querySelector(`[data-calc-tier-target="${tier}"]`)){
          const label = document.createElement('label');
          label.dataset.tierVisibilityTier = tier;
          label.innerHTML = makeTierInput(tier, 'data-calc-tier-target');
          row.appendChild(label);
        }
      });
    }
  }

  function ensureInlineTowerInputs(){
    document.querySelectorAll('.tower-picker-tier-grid, .tower-tier-grid, .tier-limit-grid, .tower-calc-tier-grid, [data-tier-limits-grid]').forEach(grid => {
      ALL_TIERS.forEach(tier => {
        if(!grid.querySelector(`[data-v4-tier="${tier}"]`)){
          const label = document.createElement('label');
          label.dataset.tierVisibilityTier = tier;
          label.innerHTML = makeTierInput(tier, 'data-v4-tier');
          grid.appendChild(label);
        }
      });
    });

    document.querySelectorAll('[data-v4-tier], [data-calc-tier-target], [data-picker-tier]').forEach(input => {
      const label = input.closest('label');
      if(label && !label.dataset.tierVisibilityTier){
        label.dataset.tierVisibilityTier = String(input.dataset.v4Tier || input.dataset.calcTierTarget || '').toUpperCase();
      }
    });
  }

  function apply(){
    ensureCalcInputs();
    ensureInlineTowerInputs();
    const visible = enabledSet();
    document.querySelectorAll('[data-v4-tier], [data-calc-tier-target], [data-picker-tier]').forEach(input => {
      const tier = normalizeTier(input.dataset.v4Tier || input.dataset.calcTierTarget || input.dataset.pickerTier || '');
      if(!tier) return;
      const label = input.closest('label') || input;
      const isVisible = visible.has(tier);
      label.dataset.tierVisibilityTier = tier;
      label.dataset.extraTierHidden = isVisible ? '0' : '1';
      label.hidden = !isVisible;
      label.style.display = isVisible ? '' : 'none';
    });
  }

  function render(){
    const listHost = document.getElementById('tierVisibilityList');
    const select = document.getElementById('tierVisibilityAddSelect');
    const addBtn = document.getElementById('tierVisibilityAddBtn');
    if(!listHost || !select){ apply(); return; }

    const list = read();
    const used = new Set(list.map(item => item.tier));
    select.innerHTML = ADDABLE_TIERS.filter(tier => !used.has(tier)).map(tier => `<option value="${tier}">${tier}</option>`).join('');
    if(addBtn) addBtn.disabled = !select.options.length;

    listHost.innerHTML = list.map(item => {
      const canRemove = !FIXED_TIERS.includes(item.tier);
      return `<div class="tier-visibility-item" data-tier-visibility-row="${item.tier}">
        <label><input type="checkbox" data-tier-visibility-check="${item.tier}" ${item.enabled ? 'checked' : ''}/> <strong>${item.tier}</strong></label>
        ${canRemove ? `<button class="tier-visibility-remove" type="button" data-tier-visibility-remove="${item.tier}" aria-label="${t('delete','Видалити')}">×</button>` : ''}
      </div>`;
    }).join('');

    try { window.PNSI18N?.apply?.(document.getElementById('tierVisibilityPanel')); } catch {}
    apply();
    try { document.dispatchEvent(new CustomEvent('pns:tier-visibility-changed')); } catch {}
  }

  function addTier(){
    const select = document.getElementById('tierVisibilityAddSelect');
    const tier = normalizeTier(select?.value || '');
    if(!ADDABLE_TIERS.includes(tier)) return;
    const list = read();
    if(!list.some(item => item.tier === tier)) list.push({ tier, enabled:true, fixed:false });
    write(list);
    render();
  }

  document.addEventListener('click', event => {
    if(event.target?.closest?.('#tierVisibilityAddBtn')){
      event.preventDefault();
      addTier();
      return;
    }
    const remove = event.target?.closest?.('[data-tier-visibility-remove]');
    if(remove){
      event.preventDefault();
      const tier = normalizeTier(remove.dataset.tierVisibilityRemove || '');
      if(FIXED_TIERS.includes(tier)) return;
      write(read().filter(item => item.tier !== tier));
      render();
    }
  }, true);

  document.addEventListener('change', event => {
    const checkbox = event.target?.closest?.('[data-tier-visibility-check]');
    if(!checkbox) return;
    const tier = normalizeTier(checkbox.dataset.tierVisibilityCheck || '');
    write(read().map(item => item.tier === tier ? { ...item, enabled:!!checkbox.checked } : item));
    apply();
  }, true);

  let applyTimer = 0;
  const scheduleApply = () => {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 40);
  };
  try { new MutationObserver(scheduleApply).observe(document.body, { childList:true, subtree:true }); } catch {}

  Object.assign(PNS, {
    getVisibleTierConfig: read,
    getVisibleTierSet: enabledSet,
    getVisibleTierOrder: visibleTiers,
    applyTierVisibility: apply,
    renderTierVisibility: render,
    autoEnableTiersFromPlayers,
    enableTierVisibilityForTier: enableTier,
    normalizeVisibleTier: normalizeTier
  });

  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 80));
  setTimeout(render, 200);
})();