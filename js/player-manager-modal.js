window.WKD = window.WKD || {};

(function () {
  let initialized = false;
  let activeId = '';
  let activeTab = 'players';
  let activeAllianceTab = 'region';
  let activePane = 'list';
  let activeMode = localStorage.getItem('wkd.players.sourceMode') === 'region' ? 'region' : 'local';
  let rows = [];
  let regionAllianceRecords = [];
  let selectedColorTag = '';
  let busy = false;
  const metricSort = { march: 'desc', rally: 'desc' };
  const colorBuilderKey = 'wkd.allianceColorBuilder.offset';
  const localColorKey = 'wkd.allianceColors.local.v1';

  const $ = selector => document.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => WKD.escapeHtml ? WKD.escapeHtml(value) : String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const allianceTag3 = value => WKD.allianceTag3 ? WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const clean = value => WKD.clean ? WKD.clean(value) : String(value ?? '').trim();
  const sourceKey = 'wkd.players.sourceMode';
  const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
  const tv = (key, fallback = '', vars = {}) => {
    let text = t(key, fallback);
    Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  };
  function locale() {
    const lang = window.WKD_CURRENT_LANG || document.documentElement.lang || navigator.language || 'en';
    const map = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
    return map[String(lang).toLowerCase()] || lang || 'en-US';
  }

  function modal() { return $('#playerManagerModal'); }
  function field(id) { return document.getElementById(id); }
  function rowId(player = {}, index = 0) { return String(player._rowId || player.id || player.uid || `pm-${index}`); }
  function isOpen() { return modal()?.classList.contains('is-open'); }
  function toNumber(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; }
  function normalizeTier(value) { const m = String(value || '').match(/T?\s*(\d{1,2})/); return m ? `T${Math.max(1, Math.min(14, Number(m[1]) || 10))}` : 'T10'; }
  function normalizeShift(value) { const raw = String(value || '').toLowerCase(); if (/4/.test(raw)) return 'shift4'; if (/3/.test(raw)) return 'shift3'; if (/2/.test(raw)) return 'shift2'; if (/1/.test(raw)) return 'shift1'; if (/both|all|всі|обидві|обе/.test(raw)) return 'both'; return ['shift1','shift2','shift3','shift4','both'].includes(value) ? value : 'both'; }
  function shiftLabel(shift) { const key = normalizeShift(shift); return t(`shift.${key}`, ({ shift1: 'Shift 1', shift2: 'Shift 2', shift3: 'Shift 3', shift4: 'Shift 4', both: 'Both' })[key] || 'Both'); }
  function normalizeRole(value) { const text = String(value || '').toLowerCase(); if (/fighter|бійц|боєц|боец|воїн|воин/.test(text)) return 'Fighter'; if (/rider|наїз|наезд|кавал/.test(text)) return 'Rider'; if (/shooter|стріл|стрел|shoot/.test(text)) return 'Shooter'; return ['Fighter','Rider','Shooter'].includes(value) ? value : 'Fighter'; }
  function roleLabel(role) { return ({ Fighter: t('troop.fighter', 'Fighter'), Rider: t('troop.rider', 'Rider'), Shooter: t('troop.shooter', 'Shooter') })[normalizeRole(role)] || t('troop.fighter', 'Fighter'); }
  function boolText(value) { return value === true || /^(1|true|yes|так|да|y)$/i.test(String(value || '').trim()) || /готов|ready|can|мож/.test(String(value || '').toLowerCase()) ? 'yes' : 'no'; }
  function clampLairLevel(value) {
    const n = toNumber(value);
    return n ? Math.max(1, Math.min(70, n)) : '';
  }
  function yesNoText(value) { return boolText(value) === 'yes' ? t('common.yes', 'Yes') : t('common.no', 'No'); }
  function normalizePlayer(player = {}, index = 0) {
    return {
      ...player,
      _rowId: rowId(player, index),
      name: clean(player.name || player.nickname),
      alliance: allianceTag3(player.alliance),
      role: normalizeRole(player.role || player.troopType || player.troopLabel),
      tier: normalizeTier(player.tier || player.rank),
      march: toNumber(player.march ?? player.marchSize),
      rally: toNumber(player.rally ?? player.rallySize),
      captain: boolText(player.captain ?? player.captainReady) === 'yes',
      shift: normalizeShift(player.shift || player.shiftLabel || player.registeredShift),
      lair: yesNoText(player.lair ?? player.captureRegion ?? player.capture),
      lairLevel: clampLairLevel(player.lairLevel || player.denLevel),
      source: player.source || 'excel'
    };
  }
  function currentInfo() {
    if (activeMode === 'region' && WKD.playerManagerRegion?.getSourceInfo) return WKD.playerManagerRegion.getSourceInfo('region');
    return { mode: 'local', label: t('playerManager.localList', 'local list'), canUpdate: true, canDelete: true, canViewRegion: Boolean(WKD.playerManagerRegion) };
  }
  function canEdit() { const info = currentInfo(); return info.mode !== 'region' || Boolean(info.canUpdate); }
  function canDelete() { const info = currentInfo(); return info.mode !== 'region' || Boolean(info.canDelete); }
  function getLocalRows() {
    const stored = WKD.loadJson?.(WKD.storageKeys.players, []) || [];
    return (Array.isArray(stored) ? stored : []).map(normalizePlayer).filter(player => player.name);
  }
  function saveLocalRows(list) {
    const cleanRows = (Array.isArray(list) ? list : []).map(normalizePlayer).filter(player => player.name);
    WKD.saveJson?.(WKD.storageKeys.players, cleanRows);
    if (activeMode === 'local') {
      if (typeof WKD.setPlayers === 'function') WKD.setPlayers(cleanRows, { persist: true, normalized: true, eventSource: 'player-manager-local' });
      else WKD.state.players = cleanRows;
    }
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'player-manager-local', persist: true } }));
  }
  async function loadRows(force = false) {
    setStatus(activeMode === 'region' ? t('playerManager.loadingRegion', 'Loading region table...') : '', 'info');
    if (activeMode === 'region') {
      if (!WKD.playerManagerRegion?.loadRegionRows || !WKD.playerManagerRegion.getSourceInfo?.('region')?.canViewRegion) {
        rows = [];
        updateSourceUi(t('playerManager.regionUnavailable', 'Region is unavailable on this page.'), 'error');
        return rows;
      }
      const result = await WKD.playerManagerRegion.loadRegionRows(force).catch(error => {
        console.warn('[WKD] player manager region load failed:', error);
        return { rows: [], error };
      });
      rows = (result.rows || []).map(normalizePlayer).filter(player => player.name);
      regionAllianceRecords = await (WKD.playerManagerRegion?.loadRegionAlliances?.(force) || Promise.resolve([])).catch(() => []);
      if (typeof WKD.setPlayers === 'function') WKD.setPlayers(rows, { persist: false, normalized: true, eventSource: 'player-manager-region' });
      updateSourceUi();
      return rows;
    }
    rows = getLocalRows();
    regionAllianceRecords = [];
    updateSourceUi();
    return rows;
  }
  function visibleRows() {
    const query = clean(field('playerManagerSearchInput')?.value).toLowerCase();
    let list = rows.slice();
    if (query) list = list.filter(player => `${player.name} ${player.alliance} ${player.tier} ${roleLabel(player.role)} ${shiftLabel(player.shift)}`.toLowerCase().includes(query));
    return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uk'));
  }
  function getPlayer(id = activeId) {
    const wanted = String(id || '');
    const index = rows.findIndex((player, i) => rowId(player, i) === wanted);
    return index >= 0 ? { player: rows[index], index, id: rowId(rows[index], index) } : null;
  }
  function setStatus(text = '', type = 'info') {
    const box = field('playerManagerStatus');
    if (!box) return;
    box.textContent = text;
    box.classList.toggle('player-manager-status-error', type === 'error');
    box.classList.toggle('player-manager-status-success', type === 'success');
  }
  function setBusy(value) {
    busy = Boolean(value);
    ['playerManagerSaveBtn','playerManagerDeleteBtn','playerManagerNewBtn'].forEach(id => { const btn = field(id); if (btn) btn.disabled = busy || btn.dataset.locked === '1'; });
  }
  function formatNumber(value) { return (Number(value) || 0).toLocaleString(locale()); }
  function updateSourceUi(message = '', type = 'info') {
    const info = currentInfo();
    const title = field('playerManagerSourceTitle');
    const hint = field('playerManagerSourceHint');
    if (title) title.textContent = activeMode === 'region' ? tv('playerManager.regionTable', 'Region table {region}', { region: info.region ? `R${info.region}` : '' }).trim() : t('playerManager.localList', 'Local list');
    if (hint) {
      hint.textContent = message || (activeMode === 'region'
        ? (info.canUpdate ? t('playerManager.regionActive', 'Region list is active.') : t('playerManager.readOnly', 'View only.'))
        : t('playerManager.localActive', 'Local list is active.'));
      hint.classList.toggle('player-manager-status-error', type === 'error');
    }
    $$('[data-player-manager-source]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.playerManagerSource === activeMode);
      if (btn.dataset.playerManagerSource === 'region') btn.disabled = !WKD.playerManagerRegion || !info.canViewRegion;
    });
    const root = modal();
    root?.classList.toggle('is-readonly', !canEdit());
    const deleteBtn = field('playerManagerDeleteBtn');
    const saveBtn = field('playerManagerSaveBtn');
    const newBtn = field('playerManagerNewBtn');
    if (saveBtn) { saveBtn.dataset.locked = canEdit() ? '0' : '1'; saveBtn.disabled = !canEdit(); }
    if (newBtn) { newBtn.dataset.locked = canEdit() ? '0' : '1'; newBtn.disabled = !canEdit(); }
    if (deleteBtn) { deleteBtn.dataset.locked = canDelete() ? '0' : '1'; deleteBtn.disabled = !canDelete() || !activeId; }
  }
  function updateTierOptions(selected = '') {
    const select = field('playerManagerTier');
    if (!select) return;
    const fromSettings = Array.isArray(WKD.state?.visibleTiers) ? WKD.state.visibleTiers : [];
    const fromPlayers = rows.map(player => normalizeTier(player.tier)).filter(Boolean);
    const tiers = [...new Set([...fromSettings, ...fromPlayers, ...(WKD.defaultVisibleTiers || [])])].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
    select.innerHTML = tiers.map(tier => `<option value="${esc(tier)}">${esc(tier)}</option>`).join('');
    select.value = tiers.includes(normalizeTier(selected)) ? normalizeTier(selected) : (tiers[0] || 'T10');
  }
  function normTag(value) { return clean(value); }
  function hueFromValue(value) { const n = Number(value); return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : null; }
  function makeNeonColor(hue, seed = 0) {
    const h = hueFromValue(hue) ?? 132;
    const sat = 76 + (Math.abs(seed) % 16);
    const light = 46 + (Math.abs(seed >> 3) % 10);
    const accentHue = (h + 18 + (Math.abs(seed >> 8) % 26)) % 360;
    return {
      hue: h,
      bg: `linear-gradient(135deg,hsla(${h},${sat}%,${light}%,.24),hsla(${accentHue},${Math.min(96, sat + 8)}%,${Math.min(70, light + 12)}%,.15))`,
      border: `hsla(${accentHue},${Math.min(98, sat + 10)}%,${Math.min(78, light + 18)}%,.86)`,
      glow: `hsla(${h},${Math.min(98, sat + 10)}%,${Math.min(68, light + 10)}%,.28)`,
      accent: `hsl(${accentHue},${Math.min(98, sat + 12)}%,${Math.min(82, light + 20)}%)`
    };
  }
  function localColorMap() {
    try { return JSON.parse(localStorage.getItem(localColorKey) || '{}') || {}; }
    catch { return {}; }
  }
  function saveLocalColorMap(map = {}) { localStorage.setItem(localColorKey, JSON.stringify(map)); }
  function regionAllianceRecord(tag) {
    const wanted = normTag(tag);
    return regionAllianceRecords.find(item => normTag(item.tag || item.id) === wanted) || null;
  }
  function customColorHue(tag) {
    const wanted = normTag(tag);
    if (!wanted) return null;
    if (activeMode === 'region') {
      const direct = hueFromValue(regionAllianceRecord(wanted)?.colorHue);
      if (direct !== null) return direct;
      return hueFromValue(window.WKD?.regionAllianceColorMap?.[wanted]);
    }
    return hueFromValue(localColorMap()[wanted]);
  }
  function hasCustomColor(tag) { return customColorHue(tag) !== null; }
  function canEditAllianceColor(tag) {
    const wanted = normTag(tag || selectedColorTag);
    if (!wanted) return false;
    if (activeMode !== 'region') return true;
    return Boolean(WKD.playerManagerRegion?.canEditAllianceColor?.(wanted));
  }
  async function saveAllianceColor(tag, hue) {
    const wanted = normTag(tag || selectedColorTag);
    if (!wanted) return setStatus(t('playerManager.selectAllianceColor', 'Choose an alliance for the color.'), 'error');
    if (!canEditAllianceColor(wanted)) return setStatus(t('playerManager.colorAccess', 'The color can be changed by the region consul or an R5/R4 officer of their alliance.'), 'error');
    const nextHue = hueFromValue(hue);
    try {
      setBusy(true);
      if (activeMode === 'region') {
        await WKD.playerManagerRegion?.saveAllianceColor?.(wanted, nextHue === null ? null : { colorHue: nextHue, colorMode: 'manual' });
        regionAllianceRecords = await (WKD.playerManagerRegion?.loadRegionAlliances?.(true) || Promise.resolve(regionAllianceRecords));
      } else {
        const map = localColorMap();
        if (nextHue === null) delete map[wanted];
        else map[wanted] = nextHue;
        saveLocalColorMap(map);
      }
      selectedColorTag = wanted;
      document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { tag: wanted, hue: nextHue, source: activeMode } }));
      if (typeof WKD.renderPlayers === 'function') WKD.renderPlayers();
      renderAlliances();
      renderAllianceColorBuilder();
      setStatus(nextHue === null ? tv('playerManager.colorAuto', 'Color {tag} returned to auto.', { tag: wanted }) : tv('playerManager.colorSaved', 'Color {tag} saved.', { tag: wanted }), 'success');
    } catch (error) {
      console.error(error);
      setStatus(errorMessage(error), 'error');
    } finally { setBusy(false); }
  }
  function textLength(value) { return Array.from(clean(value)).length; }
  function isAllianceInvalid(value) { const len = textLength(value); return len !== 3; }
  function hashNumber(value) {
    const text = String(value || 'empty');
    let hash = 2166136261;
    for (const ch of text) {
      hash ^= ch.codePointAt(0) || 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  function colorOffset() { return toNumber(localStorage.getItem(colorBuilderKey)); }
  function allianceColor(tag, index = 0) {
    const value = normTag(tag || 'empty');
    const base = hashNumber(value);
    const manualHue = customColorHue(value);
    const hue = manualHue !== null ? manualHue : (base + colorOffset() + Math.round(index * 137.508)) % 360;
    return makeNeonColor(hue, base);
  }
  function allianceBadge(tag, index = 0) {
    const value = clean(tag);
    const color = allianceColor(value || '—', index);
    if (window.WKD?.Badges?.alliance) {
      return window.WKD.Badges.alliance(value, {
        preserve: true,
        strict3: true,
        className: 'player-manager-alliance-badge',
        hue: color.hue,
        styleVars: {
          '--ally-bg': color.bg,
          '--ally-border': color.border,
          '--ally-glow': color.glow,
          '--ally-accent': color.accent
        },
        title: value || '—'
      });
    }
    const invalid = isAllianceInvalid(value);
    const empty = !value;
    const style = `--ally-hue:${color.hue};--ally-bg:${color.bg};--ally-border:${color.border};--ally-glow:${color.glow};--ally-accent:${color.accent};`;
    const label = empty ? '—' : value;
    return `<span class="alliance-badge player-manager-alliance-badge ${invalid ? 'is-invalid' : 'is-valid'} ${empty ? 'is-empty' : ''}" style="${esc(style)}" title="${esc(label)}"><span class="badge-dot"></span><span>${esc(label)}</span></span>`;
  }
  function getAllianceGroups() {
    const map = new Map();
    rows.forEach(player => {
      const key = normTag(player.alliance);
      if (!key) return;
      if (!map.has(key)) map.set(key, { tag: key, count: 0, invalid: false });
      map.get(key).count += 1;
    });
    regionAllianceRecords.forEach(item => {
      const key = normTag(item.tag || item.id);
      if (key && !map.has(key)) map.set(key, { tag: key, count: 0, invalid: false });
    });
    const groups = [...map.values()];
    groups.forEach(group => { group.invalid = isAllianceInvalid(group.tag); });
    groups.sort((a, b) => Number(b.invalid) - Number(a.invalid) || a.tag.localeCompare(b.tag, locale(), { numeric: true, sensitivity: 'variant' }));
    return groups;
  }
  function sampleAllianceTags() {
    return ['T95','NAG','B&G','HAX','SUN','T`M','ZLO','WBJ','WWW','196','ALEKS','K37','Korolek','-noname-','-{XoMaK}-','..ღMppღ..','_Rider_','Shooter','FIGHT','OBIDVI','MARSH','RAID','VIKING','GROM'];
  }
  function renderAllianceColorBuilder() {
    const preview = field('playerManagerAllianceColorPreview');
    const countBox = field('playerManagerAllianceColorCount');
    const palette = field('playerManagerAlliancePalette');
    const picked = field('playerManagerColorPicked');
    const autoBtn = field('playerManagerAllianceAutoColorBtn');
    const resetBtn = field('playerManagerAllianceResetColorBtn');
    if (!preview) return;
    const groups = getAllianceGroups();
    const source = groups.length ? groups : sampleAllianceTags().map(tag => ({ tag, count: 0, invalid: isAllianceInvalid(tag), sample: true }));
    const list = source.slice(0, 80);
    if (!selectedColorTag || !list.some(group => normTag(group.tag) === normTag(selectedColorTag))) selectedColorTag = normTag(list[0]?.tag || '');
    preview.innerHTML = list.map((group, index) => {
      const tag = normTag(group.tag);
      const color = allianceColor(tag, index);
      const manual = hasCustomColor(tag);
      return `<button class="player-manager-color-item ${tag === selectedColorTag ? 'is-selected' : ''} ${manual ? 'has-manual-color' : ''}" type="button" data-player-manager-color-tag="${esc(tag)}" style="--ally-accent:${esc(color.accent)}">
        ${allianceBadge(tag, index)}<small class="player-manager-color-state">${manual ? t('playerManager.savedColor', 'Saved color') : t('playerManager.randomColor', 'Random color')}</small>
      </button>`;
    }).join('');
    if (countBox) countBox.textContent = tv('playerManager.alliancesCount', '{count} alliances', { count: list.length });
    if (picked) {
      const canPick = canEditAllianceColor(selectedColorTag);
      picked.innerHTML = selectedColorTag
        ? `${allianceBadge(selectedColorTag, list.findIndex(group => normTag(group.tag) === selectedColorTag))}`
        : t('playerManager.chooseAlliance', 'Choose an alliance on the right');
      picked.classList.toggle('is-locked', Boolean(selectedColorTag) && !canPick);
    }
    if (autoBtn) autoBtn.disabled = !canEditAllianceColor(selectedColorTag);
    if (resetBtn) resetBtn.disabled = !canEditAllianceColor(selectedColorTag) || !hasCustomColor(selectedColorTag);
    if (palette) {
      const hues = [132,182,212,260,292,330,0,26,42,58,82,148,166,202];
      palette.innerHTML = hues.map((hue, index) => {
        const shifted = (hue + colorOffset() + index * 3) % 360;
        const disabled = !canEditAllianceColor(selectedColorTag) ? ' disabled' : '';
        return `<button class="player-manager-color-swatch" type="button" data-player-manager-color-hue="${shifted}" style="--swatch:hsl(${shifted},88%,56%)" aria-label="${esc(t('playerManager.chooseColor', 'Choose color'))}"${disabled}></button>`;
      }).join('');
    }
  }
  async function confirmAllianceLength(value) {
    const len = textLength(value);
    if (len === 3) return true;
    const message = t('playerManager.allianceLengthMessage', 'In the game, the alliance tag has 3 characters. Save this name anyway?');
    if (WKD.confirmDialog) return WKD.confirmDialog({ title: t('playerManager.allianceLengthTitle', 'Check alliance tag'), message, acceptText: t('common.save', 'Save'), cancelText: t('common.cancel', 'Cancel') });
    return window.confirm(message);
  }
  function updateAllianceOptions() {
    const list = field('playerManagerAllianceOptions');
    if (!list) return;
    const alliances = [...new Set(rows.map(player => allianceTag3(player.alliance)).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale()));
    list.innerHTML = alliances.map(tag => `<option value="${esc(tag)}"></option>`).join('');
  }
  function renderList() {
    const box = field('playerManagerList');
    if (!box) return;
    const list = visibleRows();
    box.innerHTML = list.length ? list.map((player, index) => {
      const id = rowId(player, rows.indexOf(player));
      return `<button class="player-manager-row ${id === activeId ? 'is-active' : ''}" type="button" data-player-manager-id="${esc(id)}">
        <span><strong>${esc(player.name)}</strong><small>${esc(player.alliance || '—')} · ${esc(roleLabel(player.role))} · ${esc(player.tier)} · ${esc(shiftLabel(player.shift))}</small></span>
        <span class="player-manager-origin">${esc(player.source === 'regionForm' ? t('playerManager.sourceBase', 'Base') : (player.source === 'manual' ? t('playerManager.sourceManual', 'Manual') : t('playerManager.sourceImport', 'Import')))}</span>
      </button>`;
    }).join('') : `<div class="empty-cell">${esc(t('playerManager.noPlayers', 'No players found.'))}</div>`;
  }
  function renderAlliances() {
    const box = field('playerManagerAllianceList');
    if (!box) return;
    const groups = getAllianceGroups();
    box.innerHTML = groups.length ? groups.map((group, index) => {
      const encoded = encodeURIComponent(group.tag);
      const statusText = group.invalid ? t('playerManager.needsThree', '3 characters needed') : t('playerManager.ok', 'OK');
      const stateClass = group.invalid ? 'is-invalid' : 'is-ok';
      return `<div class="player-manager-alliance-row ${stateClass}" data-alliance-old="${esc(group.tag)}" data-alliance-encoded="${esc(encoded)}">
        <div class="player-manager-alliance-current">
          ${allianceBadge(group.tag, index)}
          <span class="player-manager-alliance-meta"><small><span class="player-manager-alliance-count">${tv('playerManager.playersCount', 'Players: {count}', { count: group.count })}</span><span class="player-manager-alliance-status">· ${esc(statusText)}</span></small></span>
        </div>
        <input value="${esc(group.tag)}" maxlength="12" placeholder="${esc(t('playerManager.newTag', 'New tag'))}" aria-label="${esc(t('playerManager.newTagAria', 'New alliance name'))}" />
        <button class="btn btn-sm" type="button" data-player-manager-alliance-save>${esc(t('playerManager.replace', 'Replace'))}</button>
      </div>`;
    }).join('') : `<div class="empty-cell">${esc(t('playerManager.noAlliances', 'No alliances.'))}</div>`;
    renderAllianceColorBuilder();
  }
  function renderMetric(type = 'march') {
    const box = field(type === 'march' ? 'playerManagerMarchList' : 'playerManagerRallyList');
    if (!box) return;
    const dir = metricSort[type] === 'asc' ? 1 : -1;
    const list = rows.slice().sort((a, b) => (toNumber(a[type]) - toNumber(b[type])) * dir);
    box.innerHTML = list.length ? list.map((player, index) => {
      const id = rowId(player, rows.indexOf(player));
      const other = type === 'march' ? 'rally' : 'march';
      return `<div class="player-manager-metric-row" data-player-manager-id="${esc(id)}" data-metric="${esc(type)}">
        <div class="player-manager-metric-name"><strong>${esc(player.name)}</strong><small>${esc(player.alliance || '—')} · ${esc(roleLabel(player.role))} · ${esc(player.tier)} · ${esc(shiftLabel(player.shift))}</small></div>
        <div class="player-manager-metric-current"><small>${type === 'march' ? t('playerManager.marchSize', 'March size') : t('playerManager.rallySize', 'Rally size')}</small>${formatNumber(player[type])}</div>
        <input value="${esc(toNumber(player[type]) || '')}" inputmode="numeric" type="number" min="0" />
        <button class="btn btn-sm" type="button" data-player-manager-metric-save>${esc(t('common.save', 'Save'))}</button>
        <small class="player-manager-metric-current">${type === 'march' ? t('playerManager.rallySize', 'Rally size') : t('playerManager.marchSize', 'March size')}<br>${formatNumber(player[other])}</small>
      </div>`;
    }).join('') : `<div class="empty-cell">${esc(t('playerManager.noPlayersShort', 'No players.'))}</div>`;
  }
  function setValue(id, value) { const el = field(id); if (el) el.value = value ?? ''; }
  function fillForm(id) {
    const entry = getPlayer(id);
    activeId = entry?.id || '';
    updateTierOptions(entry?.player?.tier || 'T10');
    updateAllianceOptions();
    setValue('playerManagerId', activeId);
    setValue('playerManagerName', entry?.player?.name || '');
    setValue('playerManagerAlliance', entry?.player?.alliance || '');
    setValue('playerManagerMarch', entry?.player?.march || '');
    setValue('playerManagerRally', entry?.player?.rally || '');
    setValue('playerManagerRole', normalizeRole(entry?.player?.role || 'Fighter'));
    setValue('playerManagerTier', normalizeTier(entry?.player?.tier || 'T10'));
    setValue('playerManagerShift', normalizeShift(entry?.player?.shift || 'both'));
    setValue('playerManagerCaptain', boolText(entry?.player?.captain ?? entry?.player?.captainReady));
    setValue('playerManagerLair', boolText(entry?.player?.lair ?? entry?.player?.captureRegion) === 'yes');
    setValue('playerManagerLairLevel', clampLairLevel(entry?.player?.lairLevel || entry?.player?.denLevel));
    const title = field('playerManagerFormTitle');
    if (title) title.textContent = entry ? entry.player.name : t('playerManager.newPlayer', 'New player');
    const del = field('playerManagerDeleteBtn');
    if (del) del.disabled = !activeId || !canDelete();
    renderList();
    setPane('form');
  }
  function resetForm() { activeId = ''; fillForm(''); setStatus(''); const title = field('playerManagerFormTitle'); if (title) title.textContent = t('playerManager.newPlayer', 'New player'); }
  function readForm() {
    return {
      name: clean(field('playerManagerName')?.value),
      alliance: allianceTag3(field('playerManagerAlliance')?.value),
      march: toNumber(field('playerManagerMarch')?.value),
      rally: toNumber(field('playerManagerRally')?.value),
      role: normalizeRole(field('playerManagerRole')?.value),
      tier: normalizeTier(field('playerManagerTier')?.value),
      shift: normalizeShift(field('playerManagerShift')?.value),
      captain: field('playerManagerCaptain')?.value === 'yes',
      captainReady: field('playerManagerCaptain')?.value === 'yes',
      lair: field('playerManagerLair')?.checked ? t('common.yes', 'Yes') : t('common.no', 'No'),
      lairLevel: clampLairLevel(field('playerManagerLairLevel')?.value),
      source: activeMode === 'region' ? 'regionForm' : 'manual'
    };
  }
  async function savePlayer() {
    if (busy) return;
    if (!canEdit()) return setStatus(t('playerManager.noEditRights', 'You do not have permission to edit this source.'), 'error');
    const values = readForm();
    if (!values.name) return setStatus(t('playerManager.enterName', 'Enter player nickname.'), 'error');
    if (!values.alliance) return setStatus(t('playerManager.enterAlliance', 'Enter alliance.'), 'error');
    if (isAllianceInvalid(values.alliance) && !(await confirmAllianceLength(values.alliance))) return;
    try {
      setBusy(true);
      if (activeMode === 'region') {
        const result = await WKD.playerManagerRegion.updateRegionPlayer(activeId, values);
        await loadRows(true);
        activeId = rowId(result.player);
      } else {
        const id = activeId || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const index = rows.findIndex((player, i) => rowId(player, i) === id);
        const player = normalizePlayer({ ...(index >= 0 ? rows[index] : {}), ...values, _rowId: id, id, source: 'manual' });
        if (index >= 0) rows[index] = player;
        else rows.push(player);
        activeId = id;
        saveLocalRows(rows);
      }
      setStatus(tv('playerManager.playerSaved', 'Saved: {name}.', { name: values.name }), 'success');
      await refresh();
      fillForm(activeId);
    } catch (error) {
      console.error(error);
      setStatus(errorMessage(error), 'error');
    } finally { setBusy(false); }
  }
  async function deletePlayer() {
    if (!activeId || busy) return;
    if (!canDelete()) return setStatus(t('playerManager.noDeleteRights', 'You do not have permission to delete from this source.'), 'error');
    const entry = getPlayer(activeId);
    const ok = await (WKD.confirmDialog?.({ title: t('playerManager.deleteTitle', 'Delete player?'), message: tv('playerManager.deleteMessage', 'Record “{name}” will be deleted.', { name: entry?.player?.name || t('role.player', 'player') }), acceptText: t('playerEdit.deletePlayer', 'Delete player') }) ?? Promise.resolve(window.confirm(t('playerManager.deleteTitle', 'Delete player?'))));
    if (!ok) return;
    try {
      setBusy(true);
      if (activeMode === 'region') {
        await WKD.playerManagerRegion.deleteRegionPlayers([activeId]);
        await loadRows(true);
      } else {
        rows = rows.filter((player, i) => rowId(player, i) !== activeId);
        saveLocalRows(rows);
      }
      resetForm();
      await refresh();
    } catch (error) {
      console.error(error);
      setStatus(errorMessage(error), 'error');
    } finally { setBusy(false); }
  }
  async function saveAlliance(row) {
    const oldTag = allianceTag3(row?.dataset.allianceOld);
    const next = allianceTag3(row?.querySelector('input')?.value);
    if (!next) return setStatus(t('playerManager.enterAllianceName', 'Enter a new alliance name.'), 'error');
    if (oldTag === next) return setStatus(t('playerManager.allianceNotChanged', 'Alliance name did not change.'), 'error');
    if (isAllianceInvalid(next) && !(await confirmAllianceLength(next))) return;
    try {
      setBusy(true);
      const targets = rows.filter(player => allianceTag3(player.alliance) === oldTag);
      for (const player of targets) await updateOne(rowId(player, rows.indexOf(player)), { ...player, alliance: next });
      await refresh(true);
      setStatus(tv('playerManager.allianceReplaced', 'Alliance {old} replaced with {next}.', { old: oldTag, next }), 'success');
    } catch (error) { console.error(error); setStatus(errorMessage(error), 'error'); }
    finally { setBusy(false); }
  }
  async function saveMetric(row) {
    const id = row?.dataset.playerManagerId || '';
    const metric = row?.dataset.metric || 'march';
    const value = toNumber(row?.querySelector('input')?.value);
    const entry = getPlayer(id);
    if (!entry) return;
    try {
      setBusy(true);
      await updateOne(id, { ...entry.player, [metric]: value });
      await refresh(true);
      setStatus(t('playerManager.saved', 'Saved.'), 'success');
    } catch (error) { console.error(error); setStatus(errorMessage(error), 'error'); }
    finally { setBusy(false); }
  }
  async function updateOne(id, values) {
    if (activeMode === 'region') return WKD.playerManagerRegion.updateRegionPlayer(id, values);
    const index = rows.findIndex((player, i) => rowId(player, i) === id);
    if (index >= 0) rows[index] = normalizePlayer({ ...rows[index], ...values });
    saveLocalRows(rows);
    return { updated: index >= 0 };
  }
  async function refresh(force = false) {
    await loadRows(force);
    renderList(); renderAlliances(); renderMetric('march'); renderMetric('rally'); updateTierOptions(field('playerManagerTier')?.value || 'T10'); updateAllianceOptions(); updateSourceUi();
  }
  function errorMessage(error) {
    const code = error?.message || String(error || '');
    if (code.includes('region-update-access')) return t('playerManager.regionUpdateAccess', 'The region table can be edited by the consul or an officer of their region, a moderator, or an admin.');
    if (code.includes('region-delete-access')) return t('playerManager.regionDeleteAccess', 'Only the consul of their region, a moderator, or an admin can delete records from the base.');
    if (code.includes('auth-required')) return t('playerManager.authRequired', 'You must sign in to use the region table.');
    if (code.includes('profile-region')) return t('playerManager.profileRegion', 'Fill in your profile and region in the account.');
    if (code.includes('registration-invalid')) return t('playerManager.registrationInvalid', 'Check nickname, alliance, troop type, tier, and shift.');
    if (code.includes('alliance-color-access')) return t('playerManager.colorAccess', 'The color can be changed by the region consul or an R5/R4 officer of their alliance.');
    return t('playerManager.saveFailed', 'Could not save the change. Check access rights.');
  }
  function setAllianceTab(tab) {
    activeAllianceTab = tab === 'colors' ? 'colors' : 'region';
    $$('[data-player-manager-alliance-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.playerManagerAllianceTab === activeAllianceTab));
    $$('[data-player-manager-alliance-pane]').forEach(pane => { pane.hidden = pane.dataset.playerManagerAlliancePane !== activeAllianceTab; });
    if (activeAllianceTab === 'colors') renderAllianceColorBuilder();
  }
  function setTab(tab) {
    activeTab = ['players','alliances','march','rally'].includes(tab) ? tab : 'players';
    $$('[data-player-manager-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.playerManagerTab === activeTab));
    const panels = {
      players: field('playerManagerForm'),
      alliances: field('playerManagerAlliancePanel'),
      march: field('playerManagerMarchPanel'),
      rally: field('playerManagerRallyPanel')
    };
    Object.entries(panels).forEach(([key, el]) => { if (el) el.hidden = key !== activeTab; });
    const formTop = field('playerManagerFormTop');
    const newBtn = field('playerManagerNewBtn');
    if (formTop) formTop.hidden = activeTab !== 'players';
    if (newBtn) newBtn.hidden = activeTab !== 'players';
    if (activeTab === 'alliances') setAllianceTab(activeAllianceTab);
    if (activeTab !== 'players') setPane('form');
  }
  function setPane(pane) {
    activePane = pane === 'form' ? 'form' : 'list';
    const root = modal();
    root?.classList.toggle('is-pane-list', activePane === 'list');
    root?.classList.toggle('is-pane-form', activePane === 'form');
    $$('[data-player-manager-pane]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.playerManagerPane === activePane));
  }
  async function open() {
    const root = modal();
    if (!root) return;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('drawer-open');
    $('#drawer')?.classList.remove('is-open');
    $('#burgerBtn')?.classList.remove('is-open');
    $('#drawer')?.setAttribute('aria-hidden', 'true');
    $('#burgerBtn')?.setAttribute('aria-expanded', 'false');
    document.body.classList.add('wkd-modal-open');
    document.documentElement.style.overflow = 'hidden';
    setPane('list');
    setTab(activeTab);
    await refresh(false);
    if (!activeId) resetForm(); else fillForm(activeId);
    setTimeout(() => field('playerManagerSearchInput')?.focus(), 30);
  }
  function close() {
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('wkd-modal-open');
      document.documentElement.style.overflow = '';
    }
  }
  function bind() {
    document.addEventListener('click', event => {
      const openBtn = event.target.closest('[data-open-player-manager]');
      if (openBtn) { event.preventDefault(); open(); return; }
      if (event.target.closest('[data-player-manager-close]')) { event.preventDefault(); close(); return; }
      const row = event.target.closest('[data-player-manager-id]');
      if (row && row.classList.contains('player-manager-row')) { event.preventDefault(); fillForm(row.dataset.playerManagerId); return; }
      const tab = event.target.closest('[data-player-manager-tab]');
      if (tab) { event.preventDefault(); setTab(tab.dataset.playerManagerTab); return; }
      const allianceTab = event.target.closest('[data-player-manager-alliance-tab]');
      if (allianceTab) { event.preventDefault(); setAllianceTab(allianceTab.dataset.playerManagerAllianceTab); return; }
      const colorItem = event.target.closest('[data-player-manager-color-tag]');
      if (colorItem) { event.preventDefault(); selectedColorTag = normTag(colorItem.dataset.playerManagerColorTag); renderAllianceColorBuilder(); return; }
      const colorSwatch = event.target.closest('[data-player-manager-color-hue]');
      if (colorSwatch) { event.preventDefault(); saveAllianceColor(selectedColorTag, colorSwatch.dataset.playerManagerColorHue); return; }
      if (event.target.closest('#playerManagerAllianceAutoColorBtn')) { event.preventDefault(); saveAllianceColor(selectedColorTag, Math.floor(Math.random() * 360)); return; }
      if (event.target.closest('#playerManagerAllianceResetColorBtn')) { event.preventDefault(); saveAllianceColor(selectedColorTag, null); return; }
      if (event.target.closest('#playerManagerRegeneratePaletteBtn')) { event.preventDefault(); localStorage.setItem(colorBuilderKey, String((colorOffset() + 37) % 360)); renderAllianceColorBuilder(); return; }
      const pane = event.target.closest('[data-player-manager-pane]');
      if (pane) { event.preventDefault(); setPane(pane.dataset.playerManagerPane); return; }
      const source = event.target.closest('[data-player-manager-source]');
      if (source) { event.preventDefault(); switchSource(source.dataset.playerManagerSource); return; }
      const allianceSave = event.target.closest('[data-player-manager-alliance-save]');
      if (allianceSave) { event.preventDefault(); saveAlliance(allianceSave.closest('.player-manager-alliance-row')); return; }
      const metricSave = event.target.closest('[data-player-manager-metric-save]');
      if (metricSave) { event.preventDefault(); saveMetric(metricSave.closest('.player-manager-metric-row')); return; }
      const sort = event.target.closest('[data-player-manager-sort]');
      if (sort) { event.preventDefault(); const type = sort.dataset.playerManagerSort; metricSort[type] = metricSort[type] === 'desc' ? 'asc' : 'desc'; sort.textContent = metricSort[type] === 'desc' ? t('playerManager.sortDesc', 'Largest first') : t('playerManager.sortAsc', 'Smallest first'); renderMetric(type); return; }
    });
    field('playerManagerSearchInput')?.addEventListener('input', renderList);
    field('playerManagerNewBtn')?.addEventListener('click', event => { event.preventDefault(); resetForm(); setTab('players'); setPane('form'); });
    field('playerManagerForm')?.addEventListener('submit', event => { event.preventDefault(); savePlayer(); });
    field('playerManagerDeleteBtn')?.addEventListener('click', event => { event.preventDefault(); deletePlayer(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(); } });
    document.addEventListener('wkd:players-updated', event => { if (!isOpen()) return; const source = event.detail?.source || ''; if (!source.startsWith('player-manager')) refresh(false); });
    document.addEventListener('wkd:player-manager-auth-ready', () => { if (isOpen()) refresh(true); else updateSourceUi(); });
    document.addEventListener('wkd:language-changed', () => { if (isOpen()) refresh(false); else updateSourceUi(); });
  }
  async function switchSource(mode) {
    activeMode = mode === 'region' ? 'region' : 'local';
    localStorage.setItem(sourceKey, activeMode);
    WKD.playerManagerRegion?.setMode?.(activeMode);
    document.dispatchEvent(new CustomEvent('wkd:source-mode-request', { detail: { mode: activeMode, forceRegion: true } }));
    activeId = '';
    await refresh(true);
    resetForm();
  }
  WKD.renderPlayerManagerAllianceBadge = allianceBadge;
  WKD.getPlayerManagerAllianceColor = allianceColor;
  WKD.renderAllianceBadge = allianceBadge;
  WKD.getAllianceColor = allianceColor;
  WKD.initPlayerManagerModal = () => {
    if (initialized || !modal()) return;
    initialized = true;
    bind();
    updateSourceUi();
  };
  WKD.openPlayerManagerModal = open;
  document.addEventListener('wkd:partials-ready', () => WKD.initPlayerManagerModal?.());
})();
