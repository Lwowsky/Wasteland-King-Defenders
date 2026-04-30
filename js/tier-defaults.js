(function(){
  const PNS = window.PNS = window.PNS || {};
  const DEFAULT_TIER_MIN_MARCH = {
    T14: 300000,
    T13: 250000,
    T12: 200000,
    T11: 150000,
    T10: 100000,
    T9: 80000,
    T8: 60000,
    T7: 50000,
    T6: 40000,
    T5: 30000,
    T4: 20000,
    T3: 15000,
    T2: 10000,
    T1: 5000
  };
  const TIER_ORDER_HIGH_TO_LOW = ['T14','T13','T12','T11','T10','T9','T8','T7','T6','T5','T4','T3','T2','T1'];
  const TIER_ORDER_LOW_TO_HIGH = TIER_ORDER_HIGH_TO_LOW.slice().reverse();

  function normalizeTier(value){
    try {
      if (typeof PNS.normalizeTierText === 'function') {
        const normalized = String(PNS.normalizeTierText(value || '') || '').toUpperCase();
        if (Object.prototype.hasOwnProperty.call(DEFAULT_TIER_MIN_MARCH, normalized)) return normalized;
      }
    } catch {}
    const text = String(value || '').toUpperCase().replace(/\s+/g, '');
    const match = text.match(/^T?([1-9]|1[0-4])$/) || text.match(/T\s*([1-9]|1[0-4])/i);
    if (!match) return '';
    const tier = `T${Number(match[1])}`;
    return Object.prototype.hasOwnProperty.call(DEFAULT_TIER_MIN_MARCH, tier) ? tier : '';
  }

  function defaultTierMinMarch(tier){
    const normalized = normalizeTier(tier);
    return normalized ? Number(DEFAULT_TIER_MIN_MARCH[normalized] || 0) || 0 : 0;
  }

  function makeDefaultTierMap(fillHidden = true){
    const out = {};
    TIER_ORDER_HIGH_TO_LOW.forEach((tier) => {
      out[tier] = fillHidden ? defaultTierMinMarch(tier) : 0;
    });
    return out;
  }

  function resolveTierLimit(value, tier){
    const raw = Number(value || 0) || 0;
    if (raw > 0) return Math.max(0, Math.floor(raw));
    return defaultTierMinMarch(tier);
  }

  Object.assign(PNS, {
    DEFAULT_TIER_MIN_MARCH,
    TIER_ORDER_HIGH_TO_LOW,
    TIER_ORDER_LOW_TO_HIGH,
    getDefaultTierMinMarch: defaultTierMinMarch,
    makeDefaultTierMinMarchMap: makeDefaultTierMap,
    resolveTierMinMarchValue: resolveTierLimit,
    normalizeTierForDefaults: normalizeTier
  });
})();