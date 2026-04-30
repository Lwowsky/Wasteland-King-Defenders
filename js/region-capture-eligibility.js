/* Region capture auto-eligibility rules */
(function(){
  const PNS = window.PNS = window.PNS || {};
  const SETTINGS_KEY = 'pns_import_region_shift_settings_v1';
  const ACTIVE_REGION_KEY = 'pns_tower_calc_active_region_v1';
  const REGION_PLANS_KEY = 'pns_layout_region_shift_plans_store_v1';
  const CAPTURE_REGIONS = new Set(['region2', 'region3']);

  function normalizeText(value){
    return String(value ?? '')
      .normalize ? String(value ?? '').normalize('NFKC').toLowerCase().trim() : String(value ?? '').toLowerCase().trim();
  }

  function normalizeShift(value, fallback = ''){
    try {
      const normalized = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(value) : value;
      const text = String(normalized || '').toLowerCase().trim();
      if (/^shift[1-4]$/.test(text)) return text;
    } catch {}
    const text = String(value || '').toLowerCase().trim();
    if (/^shift[1-4]$/.test(text)) return text;
    if (/^[1-4]$/.test(text)) return `shift${text}`;
    return /^shift[1-4]$/.test(String(fallback || '').toLowerCase()) ? String(fallback).toLowerCase() : '';
  }

  function readJson(key, fallback){
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function getSettings(){
    return readJson(SETTINGS_KEY, {}) || {};
  }

  function activeRegion(){
    try {
      const settings = getSettings();
      const region = localStorage.getItem(ACTIVE_REGION_KEY) || settings.activeRegion || 'region1';
      return ['region1','region2','region3'].includes(region) ? region : 'region1';
    } catch {
      return 'region1';
    }
  }

  function isCaptureRegion(region){
    return CAPTURE_REGIONS.has(String(region || '').toLowerCase());
  }

  function getEnabledCaptureRegions(){
    const settings = getSettings();
    return Array.from(CAPTURE_REGIONS).filter((region) => !!settings?.regions?.[region]?.enabled);
  }

  function isAnyCaptureRegionEnabled(){
    return getEnabledCaptureRegions().length > 0;
  }

  function getSelectedShiftCount(region = activeRegion()){
    try {
      const settings = getSettings();
      const targetRegion = ['region1','region2','region3'].includes(String(region || '').toLowerCase())
        ? String(region || '').toLowerCase()
        : activeRegion();
      const regionSettings = settings?.regions?.[targetRegion] || settings?.regions?.region1 || {};
      const shifts = regionSettings?.shifts || {};
      const selected = ['1', '2', '3', '4'].find((key) => !!shifts[key]) || '2';
      return Math.max(1, Math.min(4, Number(selected) || 2));
    } catch {
      return 2;
    }
  }

  function shouldIgnoreRegisteredShiftForRegion(region = activeRegion()){
    const targetRegion = String(region || activeRegion()).toLowerCase();
    return isCaptureRegion(targetRegion) && getSelectedShiftCount(targetRegion) <= 1;
  }

  function looksLikeCaptureHeader(key){
    const text = normalizeText(key)
      .replace(/ё/g, 'е')
      .replace(/[\s\n\r\t]+/g, ' ');
    return /capture.*region|another region|other region|захоп.*регі|захват.*регион|другого региона|другой регион|іншого регіону|иного региона|別の地域|地域.*捕獲/.test(text);
  }

  function isPositive(value){
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    try {
      if (typeof PNS.normalizeYesNo === 'function') return !!PNS.normalizeYesNo(raw);
    } catch {}
    const text = normalizeText(raw).replace(/ё/g, 'е');
    if (/^(no|нет|ні|не|false|0|off|n|いいえ|不是|否|아니오|아니)$/i.test(text)) return false;
    if (/^(yes|да|так|true|1|on|y|готов|готовий|готовы|готова|готовий|はい|是|예|네)$/i.test(text)) return true;
    return /yes|да|так|готов|ready|participat|беру|можу|can|はい|是|예|네/.test(text) && !/нет|ні|no|not|не готов/.test(text);
  }

  function captureRawValue(player){
    if (!player) return '';
    const direct = [
      player.captureOtherRegion,
      player.captureRegion,
      player.otherRegionCapture,
      player.lairLevel,
      player.customFields?.lair_level,
      player.customFields?.capture_other_region,
      player.customFields?.capture_region,
    ].find(value => String(value ?? '').trim());
    if (String(direct ?? '').trim()) return direct;

    const custom = player.customFields && typeof player.customFields === 'object' ? player.customFields : {};
    for (const [key, value] of Object.entries(custom)) {
      if (String(value ?? '').trim() && looksLikeCaptureHeader(key)) return value;
    }

    const raw = player.raw && typeof player.raw === 'object' ? player.raw : {};
    for (const [key, value] of Object.entries(raw)) {
      if (String(value ?? '').trim() && looksLikeCaptureHeader(key)) return value;
    }
    return '';
  }

  function playerAllowsCapture(player){
    return isPositive(captureRawValue(player));
  }

  function collectPlanPlayerIds(plan){
    const ids = new Set();
    const players = plan?.players && typeof plan.players === 'object' ? plan.players : {};
    Object.entries(players).forEach(([id, assignment]) => {
      if (id && assignment?.baseId) ids.add(String(id));
    });
    const bases = plan?.bases && typeof plan.bases === 'object' ? plan.bases : {};
    Object.values(bases).forEach(base => {
      const captainId = String(base?.captainId || '');
      if (captainId) ids.add(captainId);
      (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach(id => {
        if (id) ids.add(String(id));
      });
    });
    return ids;
  }

  function usedInOtherCaptureRegion(playerId, shiftKey, region = activeRegion()){
    const id = String(playerId || '');
    const shift = normalizeShift(shiftKey);
    if (!id || !shift || !isCaptureRegion(region)) return false;
    const store = readJson(REGION_PLANS_KEY, {}) || {};
    const otherRegions = Array.from(CAPTURE_REGIONS).filter(other => other !== region);
    return otherRegions.some(other => collectPlanPlayerIds(store?.[other]?.[shift] || null).has(id));
  }

  function canAutoUsePlayerInRegion(player, region, shiftKey){
    const targetRegion = String(region || activeRegion()).toLowerCase();
    const captureEnabled = isAnyCaptureRegionEnabled();
    if (!isCaptureRegion(targetRegion)) {
      return !(captureEnabled && playerAllowsCapture(player));
    }
    if (!playerAllowsCapture(player)) return false;
    const shift = normalizeShift(shiftKey);
    if (shift && usedInOtherCaptureRegion(player?.id, shift, targetRegion)) return false;
    return true;
  }

  function canAutoUsePlayerInActiveRegion(player, shiftKey){
    return canAutoUsePlayerInRegion(player, activeRegion(), shiftKey);
  }

  Object.assign(PNS, {
    isCaptureRegionAutoEligible: playerAllowsCapture,
    canAutoUsePlayerInRegion,
    canAutoUsePlayerInActiveRegion,
    isAnyCaptureRegionEnabled,
    getCaptureRegionShiftCount: getSelectedShiftCount,
    shouldIgnoreRegisteredShiftForRegion,
    shouldIgnoreRegisteredShiftForActiveRegion: () => shouldIgnoreRegisteredShiftForRegion(activeRegion()),
    isPlayerUsedInOtherCaptureRegion: usedInOtherCaptureRegion,
    getCaptureRegionRawValue: captureRawValue,
  });
})();
