import { formatUserDate, getUserProfile, makePublicPlayer, roleLabel } from '../services/user-db.js';
import { watchAuth } from '../services/firebase-service.js';
import { troopLabel } from '../services/region-db.js?v=115';
import { localizedCountry } from '../services/country-utils.js';

const $ = selector => document.querySelector(selector);
let players = [];
let statsSummaryCache = null;
let detailsLoaded = false;
let allianceColorCache = new Map();
let sortState = { key: 'region', dir: 'asc' };
let statsReady = false;
let activeModalPlayer = null;
let activeModalTab = 'profile';
let currentUser = null;
let liveStatsPatchReady = false;

function t(key, fallback = '') {
  const value = window.WKD_t ? window.WKD_t(key) : '';
  return (!value || value === key) ? (fallback || key) : value;
}
function tv(key, fallback = '', vars = {}) {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
}
function locale() {
  const lang = window.WKD_CURRENT_LANG || document.documentElement.lang || navigator.language || 'en';
  const map = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
  return map[String(lang).toLowerCase()] || lang || 'en-US';
}


const PUBLIC_STATS_CACHE_URL = 'public-cache/stats-summary.json';
const PUBLIC_STATS_PLAYERS_URL = 'public-cache/stats-players.json';
const STATS_SUMMARY_CACHE_KEY = 'wkd.publicStatsSummary.v96.disabled';
const STATS_PLAYERS_CACHE_KEY = 'wkd.publicStatsPlayers.v96.disabled';

function readSummaryCache() { return null; }
function writeSummaryCache(_data) {}
function readPlayersCache() { return null; }
function writePlayersCache(_data) {}
function mapSize(value) {
  return value && typeof value === 'object' ? Object.keys(value).filter(key => Number(value[key]) > 0).length : 0;
}
function summaryNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function formatSummaryUpdatedAt(value) {
  if (!value) return t('common.unknown', 'Unknown');
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale()) : String(value);
}
async function fetchPublicStatsSummary({ force = false } = {}) {
  if (!force) {
    const cached = readSummaryCache();
    if (cached) return cached;
  }
  const url = `${PUBLIC_STATS_CACHE_URL}${force ? `?t=${Date.now()}` : ''}`;
  const response = await fetch(url, { cache: force ? 'no-store' : 'no-cache' });
  if (!response.ok) throw new Error(`stats-summary-${response.status}`);
  const data = await response.json();
  writeSummaryCache(data);
  return data;
}
async function fetchPublicStatsPlayers({ force = false } = {}) {
  if (!force) {
    const cached = readPlayersCache();
    if (cached) return cached;
  }
  const url = `${PUBLIC_STATS_PLAYERS_URL}${force ? `?t=${Date.now()}` : ''}`;
  const response = await fetch(url, { cache: force ? 'no-store' : 'no-cache' });
  if (!response.ok) throw new Error(`stats-players-${response.status}`);
  const data = await response.json();
  const list = Array.isArray(data) ? data : [];
  writePlayersCache(list);
  return list;
}


function playerIdentityKey(player = {}) {
  return [player.nickname || player.gameNick || '', player.region || '', player.alliance || '']
    .map(value => String(value || '').trim().toLowerCase())
    .join('|');
}

function mergeLivePublicPlayer(livePlayer = null) {
  if (!livePlayer?.nickname) return false;
  const liveKey = playerIdentityKey(livePlayer);
  const index = players.findIndex(item => {
    if (item.uid && livePlayer.uid && item.uid === livePlayer.uid) return true;
    return playerIdentityKey(item) === liveKey;
  });
  const merged = index >= 0
    ? { ...players[index], ...livePlayer, publicKey: players[index].publicKey || players[index].uid || livePlayer.publicKey || livePlayer.uid || liveKey }
    : { ...livePlayer, publicKey: livePlayer.publicKey || livePlayer.uid || liveKey };
  if (index >= 0) players[index] = merged;
  else players.unshift(merged);
  return true;
}

async function refreshCurrentUserLiveStats({ rerender = true } = {}) {
  if (!currentUser?.uid || !detailsLoaded) return;
  try {
    const profile = await getUserProfile(currentUser.uid);
    if (!profile?.profileComplete) return;
    const livePlayer = makePublicPlayer({ ...profile, uid: currentUser.uid });
    if (mergeLivePublicPlayer(livePlayer) && rerender) {
      renderStats();
      renderPlayers();
      if (activeModalPlayer) {
        const activeKey = activeModalPlayer.publicKey || activeModalPlayer.uid || playerIdentityKey(activeModalPlayer);
        const fresh = players.find(item => (item.publicKey || item.uid || playerIdentityKey(item)) === activeKey) || livePlayer;
        openPlayerModal(fresh, activeModalTab);
      }
    }
  } catch (error) {
    console.warn('[WKD] live current user stats patch failed:', error);
  }
}

function hasUsableStatsSummary(summary = {}) {
  if (!summary || typeof summary !== 'object') return false;
  const generated = Boolean(summary.generatedAt || summary.updatedAt || summary.lastFullRebuildDate);
  const total = Number(summary.totalRows ?? summary.totalPlayers ?? 0) || 0;
  return generated || total > 0;
}
function isPublicStatsJsonEmpty(summary = {}, publicPlayers = []) {
  const total = Number(summary?.totalRows ?? summary?.totalPlayers ?? 0) || 0;
  const listCount = Array.isArray(publicPlayers) ? publicPlayers.length : 0;
  return total <= 0 && listCount <= 0 && !hasUsableStatsSummary(summary);
}
function isPublicPlayersJsonMissing(summary = {}, publicPlayers = []) {
  const total = Number(summary?.totalRows ?? summary?.totalPlayers ?? 0) || 0;
  const listCount = Array.isArray(publicPlayers) ? publicPlayers.length : 0;
  return total > 0 && listCount <= 0;
}
function renderSummaryStats(summary = statsSummaryCache) {
  if (!hasUsableStatsSummary(summary)) return false;
  setPlayersCounterLabel();
  const includeFarms = includeFarmRows();
  const values = includeFarms
    ? [
        summaryNumber(summary.totalRows ?? (summary.totalPlayers + summary.totalFarms)),
        mapSize(summary.regionsWithFarms || summary.regions),
        mapSize(summary.alliancesWithFarms || summary.alliances),
        summaryNumber(summary.leadersWithFarms ?? summary.leaders)
      ]
    : [
        summaryNumber(summary.totalPlayers),
        mapSize(summary.regions),
        mapSize(summary.alliances),
        summaryNumber(summary.leaders)
      ];
  $('#publicStats')?.querySelectorAll('.admin-stat-card b').forEach((card, index) => { card.textContent = values[index] ?? 0; });
  const updated = formatSummaryUpdatedAt(summary.generatedAt || summary.updatedAt);
  const mode = includeFarms ? t('stats.playersAndFarms', 'Players and farms') : t('stats.players', 'Players');
  setSummary(tv('stats.publicCacheSummary', '{mode}: {count}. Updated: {updated}', { mode, count: values[0], updated }));
  return true;
}
function renderListNotLoaded() {
  const body = $('#publicPlayersBody');
  if (!body) return;
  body.innerHTML = `<tr><td colspan="8" class="stats-empty-note">${escapeHtml(t('stats.listNotLoaded', 'The public player JSON is not loaded yet. Check public-cache/stats-players.json.'))}</td></tr>`;
}
async function loadSummaryOnly(options = {}) {
  const force = Boolean(options?.force);
  setStatus(t('stats.loadingSummary', 'Loading public statistics cache...'), 'muted');
  try {
    const [summary, publicPlayers] = await Promise.all([
      fetchPublicStatsSummary({ force }),
      fetchPublicStatsPlayers({ force })
    ]);
    statsSummaryCache = hasUsableStatsSummary(summary) ? summary : null;
    players = Array.isArray(publicPlayers) ? publicPlayers : [];
    detailsLoaded = true;
    await refreshCurrentUserLiveStats({ rerender: false });
    renderStats();
    renderPlayers();
    if (isPublicStatsJsonEmpty(summary, publicPlayers)) {
      setSummary(t('stats.cacheEmpty', 'Public JSON cache is empty. Check or replace public-cache/stats-players.json.'));
      setStatus(t('stats.cacheEmpty', 'Public JSON cache is empty. Check or replace public-cache/stats-players.json.'), 'warning');
      return;
    }
    if (isPublicPlayersJsonMissing(summary, publicPlayers)) {
      renderListNotLoaded();
      setStatus(t('stats.playersJsonMismatch', 'stats-summary.json has numbers, but stats-players.json is empty. Replace the local public-cache with the latest generated JSON files.'), 'warning');
      return;
    }
    setStatus(t('stats.cacheUpdated', 'Statistics loaded from public JSON cache.'), 'success');
  } catch (error) {
    console.warn('[WKD] public stats JSON failed:', error);
    statsSummaryCache = null;
    detailsLoaded = false;
    players = [];
    renderStats();
    renderListNotLoaded();
    setStatus(t('stats.cacheFailed', 'Public statistics JSON files are not available. Check public-cache/stats-summary.json and stats-players.json.'), 'error');
  }
}

function allianceTag3(value) { return window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}


function normTag(value) { return String(value || '').trim(); }
function normRegion(value) { return String(value || '').trim().replace(/[^0-9]/g, ''); }
function hashHue(value) {
  const text = String(value || 'empty');
  let hash = 2166136261;
  for (const ch of text) { hash ^= ch.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) >>> 0; }
  return hash % 360;
}
function allianceHue(region, alliance) {
  const key = `${normRegion(region)}:${normTag(alliance)}`;
  const custom = allianceColorCache.get(key);
  return Number.isFinite(custom) ? custom : ((hashHue(`${region}:${alliance}`) % 360) + 360) % 360;
}
function allianceBadge(region, alliance) { const tag = normTag(alliance) || '—'; const hue = allianceHue(region, tag); return window.WKD?.Badges?.alliance ? window.WKD.Badges.alliance(tag, { hue, region }) : `<span class="alliance-badge"><span>${escapeHtml(tag)}</span></span>`; }

function rankCode(value) {
  if (window.WKD?.Badges?.rankCode) return window.WKD.Badges.rankCode(value);
  const match = String(value || 'P1').trim().toUpperCase().match(/[PRР]\s*([1-5])/i);
  return match ? `P${match[1]}` : 'P1';
}
function rankBadge(value, { profile = false } = {}) { return window.WKD?.Badges?.rank ? window.WKD.Badges.rank(value) : `<span class="rank-badge">${escapeHtml(rankCode(value))}</span>`; }
function shkBadge(value, { profile = false } = {}) { return window.WKD?.Badges?.shk ? window.WKD.Badges.shk(value) : `<span class="shk-badge">${escapeHtml(value || '—')}</span>`; }

function extraInfoItemsHtml(wasteland = null) {
  if (!wasteland) return '';
  return `${textLine(t('stats.lairLevel', 'Lair level'), wasteland.lairLevel)}
    ${textLine(t('playerEdit.troopType', 'Troop type'), troopLabel(wasteland.troopType || ''))}
    ${textLine(t('playerEdit.tier', 'Tier'), wasteland.tier)}
    ${textLine(t('playerEdit.march', 'March size'), formatNumber(wasteland.marchSize))}
    ${textLine(t('playerEdit.rally', 'Rally size'), formatNumber(wasteland.rallySize))}`;
}
function setStatus(text, type = 'muted') {
  const box = $('#statsStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function setSummary(text) {
  const box = $('#statsSummary');
  if (box) box.textContent = text;
}

function includeFarmRows() {
  return Boolean($('#statsIncludeFarmsToggle')?.checked);
}

function mainNick(player = {}) {
  return player.nickname || player.gameNick || '—';
}

function farmRowsForPlayer(player = {}) {
  if (!includeFarmRows() || !player.profileVisibility?.showFarmsInfo || !Array.isArray(player.farms)) return [];
  const main = mainNick(player);
  return player.farms
    .filter(farm => farm && (farm.nickname || farm.region || farm.alliance))
    .map((farm, index) => ({
      ...farm,
      uid: player.publicKey || player.uid || player.id || '',
      publicKey: player.publicKey || '',
      rowId: `${player.publicKey || player.uid || player.id || 'player'}::${farm.farmKey || farm.farmId || farm.id || index}`,
      isFarmRow: true,
      mainNickname: main,
      mainRegion: player.region || '',
      farmIndex: index,
      farmId: farm.farmId || farm.id || '',
      country: player.country || '',
      countryCode: player.countryCode || '',
      photoURL: player.photoURL || '',
      createdAt: player.createdAt || null,
      updatedAt: player.updatedAt || null,
      profileVisibility: player.profileVisibility || {},
      farmCount: player.farmCount ?? 0
    }));
}

function displayRows() {
  return players.flatMap(player => [{
    ...player,
    rowId: player.publicKey || player.uid || player.id || '',
    isFarmRow: false,
    mainNickname: mainNick(player)
  }, ...farmRowsForPlayer(player)]);
}

function sortValue(player, key) {
  if (key === 'createdAt') return player.createdAt?.toMillis?.() || 0;
  if (key === 'farmCount') return Number(player.farmCount || 0);
  if (key === 'accountType') return player.isFarmRow ? 'farm' : 'main';
  return player[key] ?? '';
}

function sortPlayers(a, b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  return String(sortValue(a, sortState.key)).localeCompare(String(sortValue(b, sortState.key)), locale(), { numeric: true }) * dir;
}

function filteredPlayers() {
  const nick = String($('#statsNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#statsAllianceSearch')?.value || '').trim().toLowerCase();
  const region = String($('#statsRegionSearch')?.value || '').trim().toLowerCase();
  const role = $('#statsRoleFilter')?.value || 'all';
  const rows = $('#statsRowsFilter')?.value || '10';
  const visible = displayRows()
    .filter(player => role === 'all' || (player.role || 'player') === role)
    .filter(player => {
      const userNick = String(player.nickname || player.gameNick || '').toLowerCase();
      const main = String(player.mainNickname || '').toLowerCase();
      const userAlliance = String(player.alliance || '').toLowerCase();
      const userRegion = String(player.region || '').toLowerCase();
      return (!nick || userNick.includes(nick) || main.includes(nick))
        && (!alliance || userAlliance.includes(alliance))
        && (!region || userRegion.includes(region));
    })
    .sort(sortPlayers);
  if (rows === 'all') return visible;
  return visible.slice(0, Number(rows) || 10);
}

function setPlayersCounterLabel() {
  const label = $('#publicStats .admin-stat-card:first-child span');
  if (!label) return;
  const key = includeFarmRows() ? 'stats.playersAndFarms' : 'stats.players';
  label.dataset.i18n = key;
  label.textContent = t(key, includeFarmRows() ? 'Players and farms' : 'Players');
}

function renderStats() {
  if (statsSummaryCache && renderSummaryStats(statsSummaryCache)) return;
  setPlayersCounterLabel();
  const rows = displayRows();
  const regions = new Set(rows.map(player => player.region).filter(Boolean));
  const alliances = new Set(rows.map(player => player.alliance).filter(Boolean));
  const leaders = rows.filter(player => ['admin', 'moderator', 'consul', 'officer'].includes(player.role)).length;
  const values = [rows.length, regions.size, alliances.size, leaders];
  $('#publicStats')?.querySelectorAll('.admin-stat-card b').forEach((card, index) => { card.textContent = values[index] ?? 0; });
  setSummary(tv(includeFarmRows() ? 'stats.summaryRows' : 'stats.summaryPlayers', includeFarmRows() ? '{count} rows' : '{count} players', { count: rows.length }));
}

function rowTemplate(player) {
  const nick = player.nickname || player.gameNick || '—';
  const uid = player.publicKey || player.uid || player.id || player.rowId || '';
  const isFarm = Boolean(player.isFarmRow);
  const labels = {
    nickname: escapeHtml(t('account.nickname', 'Nickname')),
    region: escapeHtml(t('account.region', 'Region')),
    farms: escapeHtml(t('stats.farmsCount', 'Farms')),
    alliance: escapeHtml(t('account.alliance', 'Alliance')),
    rank: escapeHtml(t('account.rank', 'Rank')),
    shk: escapeHtml(t('account.shk', 'HQ')),
    role: escapeHtml(t('account.role', 'Role')),
    registered: escapeHtml(t('stats.registeredAt', 'Registered'))
  };
  const subLine = isFarm
    ? `${t('account.farm', 'Farm')} · ${t('account.mainPlayer', 'Main player')}: ${player.mainNickname || '—'}`
    : (includeFarmRows() ? `${t('account.mainPlayer', 'Main player')} · ${tv('stats.farmCountShort', '{count} farms', { count: player.farmCount ?? 0 })}` : '');
  return `<tr class="${isFarm ? 'is-farm-row' : 'is-main-row'}">
    <td data-label="${labels.nickname}"><button class="stats-player-link" type="button" data-player-id="${escapeHtml(uid)}" data-farm-row="${isFarm ? '1' : '0'}" data-farm-index="${isFarm ? escapeHtml(String(player.farmIndex ?? 0)) : ''}"><strong>${escapeHtml(nick)}</strong>${subLine ? `<small class="${isFarm ? 'stats-farm-owner' : ''}">${escapeHtml(subLine)}</small>` : ''}</button></td>
    <td data-label="${labels.region}"><span class="region-badge">${escapeHtml(player.region || '—')}</span></td>
    <td data-label="${labels.farms}"><span class="farm-count-badge">${escapeHtml(isFarm ? t('account.farm', 'Farm') : (player.farmCount ?? 0))}</span></td>
    <td data-label="${labels.alliance}">${allianceBadge(player.region, player.alliance)}</td>
    <td data-label="${labels.rank}">${rankBadge(player.rank)}</td>
    <td data-label="${labels.shk}">${shkBadge(player.shk)}</td>
    <td data-label="${labels.role}"><span class="role-badge role-${escapeHtml(player.role || 'player')}">${escapeHtml(roleLabel(player.role || 'player'))}</span></td>
    <td data-label="${labels.registered}">${formatUserDate(player.createdAt)}</td>
  </tr>`;
}

function renderPlayers() {
  const body = $('#publicPlayersBody');
  if (!body) return;
  if (!detailsLoaded) {
    renderListNotLoaded();
    return;
  }
  const visible = filteredPlayers();
  if (!visible.length) {
    body.innerHTML = `<tr><td colspan="8">${escapeHtml(t('stats.noPlayersFound', 'No players found.'))}</td></tr>`;
    return;
  }
  body.innerHTML = visible.map(rowTemplate).join('');
}

function textLine(label, value) {
  return `<div class="stats-info-line"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '—')}</b></div>`;
}

function formatNumber(value) {
  const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && number > 0 ? number.toLocaleString(locale()) : (value || '—');
}

function extraInfoHtml(wasteland = null) {
  if (!wasteland) {
    return `<div class="stats-empty-note">${escapeHtml(t('stats.extraHidden', 'The player hid extra region-form information.'))}</div>`;
  }
  return `<div class="stats-info-grid">${extraInfoItemsHtml(wasteland)}</div>`;
}

function profilePanel(player) {
  return `<section class="stats-modal-panel is-active" data-stats-panel="profile">
    <div class="stats-profile-card">
      <img src="${escapeHtml(player.photoURL || 'img/logo.webp')}" alt="Avatar" />
      <div class="stats-profile-main">
        <h3>${escapeHtml(player.nickname || player.gameNick || '—')}</h3>
        <div class="stats-profile-badges">
          ${rankBadge(player.rank, { profile: true })}
          ${shkBadge(player.shk, { profile: true })}
          <span class="role-badge role-${escapeHtml(player.role || 'player')}">${escapeHtml(roleLabel(player.role || 'player'))}</span>
        </div>
      </div>
    </div>
    <div class="stats-info-grid">
      ${textLine(t('account.region', 'Region'), player.region)}
      ${textLine(t('account.country', 'Country'), localizedCountry(player.country || '', player.countryCode || ''))}
      ${textLine(t('account.alliance', 'Alliance'), player.alliance)}
      ${textLine(t('account.rank', 'Rank'), String(player.rank || '').toUpperCase())}
      ${textLine(t('account.shk', 'HQ'), player.shk)}
      ${textLine(t('stats.farmsCount', 'Farms'), player.farmCount ?? 0)}
      ${textLine(t('stats.registeredAt', 'Registered'), formatUserDate(player.createdAt))}
      ${textLine(t('stats.updatedAt', 'Updated'), formatUserDate(player.updatedAt))}
    </div>
  </section>`;
}

function extraPanel(player) {
  return `<section class="stats-modal-panel" data-stats-panel="extra" hidden>
    <h3>${escapeHtml(t('stats.extraInfo', 'Extra information'))}</h3>
    ${extraInfoHtml(player.wastelandProfile)}
  </section>`;
}

function farmCard(farm, index, showExtra) {
  const role = farm.role || 'player';
  const waste = farm.wastelandProfile || {};
  const meta = [farm.alliance, farm.rank ? String(farm.rank).toUpperCase() : '', farm.shk ? `${t('account.shk', 'HQ')} ${farm.shk}` : ''].filter(Boolean).join(' · ');
  return `<article class="stats-farm-card" data-stats-farm-index="${index}">
    <div class="stats-farm-head">
      <div class="stats-farm-title"><b>${escapeHtml(farm.nickname || `${t('stats.farm', 'Farm')} ${index + 1}`)}</b>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</div>
      <span class="role-badge stats-farm-role role-${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
    </div>
    <div class="stats-info-grid stats-farm-short-grid ${showExtra ? '' : 'is-single'}">
      ${textLine(t('account.region', 'Region'), farm.region ? `R${farm.region}` : '—')}
      ${showExtra ? extraInfoItemsHtml(farm.wastelandProfile) : ''}
    </div>
  </article>`;
}

function farmsPanel(player) {
  const farms = Array.isArray(player.farms) ? player.farms : [];
  const showFarms = Boolean(player.profileVisibility?.showFarmsInfo);
  const showExtra = Boolean(player.profileVisibility?.showWastelandInfo);
  const content = showFarms && farms.length
    ? farms.map((farm, index) => farmCard(farm, index, showExtra)).join('')
    : `<div class="stats-empty-note">${escapeHtml(tv('stats.farmsHidden', 'The player hid farm information. Farm count: {count}.', { count: player.farmCount ?? 0 }))}</div>`;
  return `<section class="stats-modal-panel" data-stats-panel="farms" hidden>
    <h3>${escapeHtml(t('stats.accountFarms', 'Account farms'))}</h3>
    ${content}
  </section>`;
}

function activateModalTab(tab = 'profile') {
  activeModalTab = tab;
  document.querySelectorAll('.stats-modal-tab').forEach(button => {
    const active = button.dataset.statsTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-stats-panel]').forEach(panel => {
    const active = panel.dataset.statsPanel === tab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

function openPlayerModal(player, tab = 'profile', farmIndex = -1) {
  activeModalPlayer = player;
  const modal = $('#playerStatsModal');
  const body = $('#playerStatsModalBody');
  if (!modal || !body) return;
  $('#playerStatsModalTitle').textContent = player.nickname || player.gameNick || t('stats.modalTitle', 'Профіль гравця');
  $('#playerStatsModalLead').textContent = tv('stats.regionLine', 'Region {region} · {alliance} · {rank}', { region: player.region || '—', alliance: player.alliance || '—', rank: String(player.rank || '').toUpperCase() || '—' });
  const roleBadge = $('#playerStatsModalRole');
  if (roleBadge) {
    roleBadge.removeAttribute('data-i18n');
    roleBadge.textContent = roleLabel(player.role || 'player');
    roleBadge.className = `role-badge role-${player.role || 'player'}`;
  }
  body.innerHTML = profilePanel(player) + extraPanel(player) + farmsPanel(player);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  activateModalTab(tab);
  if (tab === 'farms' && Number(farmIndex) >= 0) {
    window.setTimeout(() => {
      const card = body.querySelector(`[data-stats-farm-index="${Number(farmIndex)}"]`);
      card?.classList.add('is-target-farm');
      card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);
  }
}

function closePlayerModal() {
  const modal = $('#playerStatsModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  activeModalPlayer = null;
}

function bindControls() {
  $('#refreshStatsBtn')?.addEventListener('click', () => loadSummaryOnly({ force: true }));
  $('#statsNickSearch')?.addEventListener('input', renderPlayers);
  $('#statsAllianceSearch')?.addEventListener('input', renderPlayers);
  $('#statsRegionSearch')?.addEventListener('input', renderPlayers);
  $('#statsRoleFilter')?.addEventListener('change', renderPlayers);
  $('#statsRowsFilter')?.addEventListener('change', renderPlayers);
  $('#statsIncludeFarmsToggle')?.addEventListener('change', () => { renderStats(); renderPlayers(); });
  $('#publicPlayersBody')?.addEventListener('click', event => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    const player = players.find(item => (item.publicKey || item.uid || item.id || '') === button.dataset.playerId);
    if (player) openPlayerModal(player, button.dataset.farmRow === '1' ? 'farms' : 'profile', button.dataset.farmIndex || -1);
  });
  document.querySelectorAll('#publicPlayersTable [data-sort]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    sortState = { key, dir: sortState.key === key && sortState.dir === 'asc' ? 'desc' : 'asc' };
    renderPlayers();
  }));
  document.querySelectorAll('[data-close-stats-modal]').forEach(button => button.addEventListener('click', closePlayerModal));
  document.querySelectorAll('.stats-modal-tab').forEach(button => button.addEventListener('click', () => activateModalTab(button.dataset.statsTab)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeModalPlayer) closePlayerModal();
  });
}

async function initStatsPage() {
  if (statsReady || !$('#publicPlayersBody')) return;
  statsReady = true;
  bindControls();
  await watchAuth(user => {
    currentUser = user;
    if (liveStatsPatchReady) refreshCurrentUserLiveStats().catch(console.error);
  }).catch?.(() => null);
  liveStatsPatchReady = true;
  await loadSummaryOnly().catch(error => {
    console.error(error);
    setStatus(t('stats.loadFailed', 'Could not load statistics. Try again.'), 'error');
  });
}

document.addEventListener('wkd:partials-ready', initStatsPage);
document.addEventListener('DOMContentLoaded', () => setTimeout(initStatsPage, 0));

document.addEventListener('wkd:language-changed', () => {
  if (!statsReady) return;
  renderStats();
  renderPlayers();
  if (activeModalPlayer) openPlayerModal(activeModalPlayer);
});
