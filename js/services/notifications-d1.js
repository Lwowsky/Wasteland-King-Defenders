import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=173';

function cleanText(value = '', max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function cleanRegion(value = '') { return cleanText(value, 20).replace(/[^0-9]/g, '').slice(0, 8); }
function cleanTag(value = '') { return Array.from(cleanText(value, 40).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
function apiUrl(path = '') {
  const base = cleanText(regionTableCacheConfig?.apiBaseUrl || '', 240).replace(/\/+$/, '');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return base ? `${base}${safePath}` : safePath;
}
async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try { return await user.getIdToken(false); } catch { return ''; }
}
export function isNotificationsD1Enabled() { return Boolean(regionTableCacheConfig?.enabled); }
async function requestJson(path, user, options = {}) {
  if (!isNotificationsD1Enabled()) throw new Error('notifications-d1-disabled');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `notifications-d1-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  const returnedRows = Array.isArray(data?.rows) ? data.rows.length : (data?.summary ? 1 : data?.notification || data?.sent || data?.campaign ? 1 : 0);
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? returnedRows) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? (options.method && options.method !== 'GET' ? 1 : 0)) || 0
  });
  return data || {};
}
function normalizeNotification(row = {}) {
  return {
    id: cleanText(row.id || '', 140),
    type: cleanText(row.type || 'notice', 80),
    title: cleanText(row.title || '', 160),
    message: cleanText(row.message || row.summary || '', 800),
    region: cleanRegion(row.region),
    alliance: cleanTag(row.alliance),
    actorUid: cleanText(row.actorUid || '', 160),
    actorName: cleanText(row.actorName || '', 160),
    actorRole: cleanText(row.actorRole || 'player', 40),
    actorRoleText: cleanText(row.actorRoleText || '', 80),
    actorPhotoURL: cleanText(row.actorPhotoURL || '', 300),
    targetType: cleanText(row.targetType || 'player', 40),
    targetLabel: cleanText(row.targetLabel || '', 160),
    replyToId: cleanText(row.replyToId || '', 140),
    replyToTitle: cleanText(row.replyToTitle || '', 160),
    replyToActorName: cleanText(row.replyToActorName || '', 160),
    replyToCreatedAtMs: Number(row.replyToCreatedAtMs) || 0,
    createdAtMs: Number(row.createdAtMs) || 0,
    readAtMs: Number(row.readAtMs) || 0,
    unread: row.unread !== false,
    archived: row.archived === true,
    source: row.source || 'd1-account'
  };
}
function normalizeSummary(summary = {}) {
  return {
    id: 'summary',
    unreadTotal: Math.max(0, Number(summary.unreadTotal) || 0),
    campaignSeenAtMs: Math.max(0, Number(summary.campaignSeenAtMs) || 0),
    lastTitle: cleanText(summary.lastTitle || '', 160),
    lastMessage: cleanText(summary.lastMessage || '', 500),
    lastRegion: cleanRegion(summary.lastRegion),
    lastAlliance: cleanTag(summary.lastAlliance),
    lastActorUid: cleanText(summary.lastActorUid || '', 160),
    lastActorName: cleanText(summary.lastActorName || '', 160),
    lastActorRole: cleanText(summary.lastActorRole || '', 40),
    lastTargetType: cleanText(summary.lastTargetType || '', 40),
    lastNotificationAtMs: Number(summary.lastNotificationAtMs) || 0,
    updatedAtMs: Number(summary.updatedAtMs) || 0,
    source: 'cloudflare-d1-notifications'
  };
}
function normalizeSent(row = {}) {
  return {
    id: cleanText(row.id || '', 140),
    type: cleanText(row.type || 'sent_message', 80),
    title: cleanText(row.title || '', 160),
    message: cleanText(row.message || '', 800),
    region: cleanRegion(row.region),
    alliance: cleanTag(row.alliance),
    targetType: cleanText(row.targetType || 'player', 40),
    targetLabel: cleanText(row.targetLabel || '', 160),
    recipientCount: Math.max(0, Number(row.recipientCount) || 0),
    recipientPreview: cleanText(row.recipientPreview || '', 400),
    replyToId: cleanText(row.replyToId || '', 140),
    replyToTitle: cleanText(row.replyToTitle || '', 160),
    replyToActorName: cleanText(row.replyToActorName || '', 160),
    replyToCreatedAtMs: Number(row.replyToCreatedAtMs) || 0,
    createdAtMs: Number(row.createdAtMs) || 0,
    archived: row.archived === true,
    source: row.source || 'd1-sent'
  };
}
function normalizeCampaign(row = {}) {
  return {
    id: cleanText(row.id || '', 140),
    type: cleanText(row.type || 'region_campaign', 80),
    source: 'campaign',
    region: cleanRegion(row.region),
    cycleId: cleanText(row.cycleId || '', 120),
    actorUid: cleanText(row.actorUid || '', 160),
    actorName: cleanText(row.actorName || '', 160),
    actorRole: cleanText(row.actorRole || 'player', 40),
    actorRoleText: cleanText(row.actorRoleText || '', 80),
    targetType: cleanText(row.targetType || 'region', 40),
    targetLabel: cleanText(row.targetLabel || '', 160),
    alliance: cleanTag(row.alliance),
    campaignGroupId: cleanText(row.campaignGroupId || '', 140),
    title: cleanText(row.title || '', 160),
    message: cleanText(row.message || row.summary || '', 800),
    titleKey: cleanText(row.titleKey || '', 180),
    messageKey: cleanText(row.messageKey || '', 180),
    createdAtMs: Number(row.createdAtMs) || 0,
    expiresAtMs: Number(row.expiresAtMs) || 0,
    unread: row.unread !== false
  };
}


function cleanAllianceExact(value = '') {
  return Array.from(cleanText(value, 40).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}
function normalizeDirectory(row = {}) {
  return {
    uid: cleanText(row.uid || '', 160),
    farmId: cleanText(row.farmId || row.farm_id || 'main', 80) || 'main',
    nickname: cleanText(row.nickname || row.gameNick || row.game_nick || '', 120),
    gameNick: cleanText(row.gameNick || row.game_nick || row.nickname || '', 120),
    email: cleanText(row.email || '', 180),
    displayName: cleanText(row.displayName || row.display_name || '', 160),
    photoURL: cleanText(row.photoURL || row.photo_url || '', 300),
    region: cleanRegion(row.region),
    alliance: cleanAllianceExact(row.alliance),
    role: cleanText(row.role || 'player', 40).toLowerCase(),
    accountRole: cleanText(row.accountRole || row.account_role || row.role || 'player', 40).toLowerCase(),
    rank: cleanText(row.rank || '', 20).toLowerCase(),
    shk: cleanText(row.shk || '', 20),
    farmCount: Math.max(0, Number(row.farmCount || row.farm_count) || 0),
    updatedAtMs: Number(row.updatedAtMs || row.updated_at_ms) || 0,
    source: row.source || 'cloudflare-d1-directory'
  };
}
function directoryQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}
export async function upsertNotificationDirectoryD1(user, rows = []) {
  const cleanRows = (Array.isArray(rows) ? rows : []).map(normalizeDirectory).filter(row => row.uid && row.nickname).slice(0, 20);
  if (!cleanRows.length) return { ok: true, indexed: 0, rowsWritten: 0 };
  return requestJson('/api/notification-directory/upsert', user, {
    method: 'POST',
    body: JSON.stringify({ rows: cleanRows })
  });
}
export async function searchNotificationDirectoryD1(user, params = {}) {
  const data = await requestJson(`/api/notification-directory${directoryQuery(params)}`, user);
  return Array.isArray(data.rows) ? data.rows.map(normalizeDirectory) : [];
}
export async function countNotificationDirectoryD1(user, params = {}) {
  const data = await requestJson(`/api/notification-directory/count${directoryQuery(params)}`, user);
  return Math.max(0, Number(data.count) || 0);
}
export async function listNotificationDirectoryRegionsD1(user) {
  const data = await requestJson('/api/notification-directory/regions', user);
  return Array.isArray(data.rows) ? data.rows.map(row => ({
    region: cleanRegion(row.region),
    count: Math.max(0, Number(row.count) || 0)
  })).filter(row => row.region) : [];
}

export async function readNotificationBellD1(user, regions = [], { sinceMs = 0, limit = 5, games = [], mode = 'dot' } = {}) {
  const safeRegions = [...new Set((Array.isArray(regions) ? regions : []).map(cleanRegion).filter(Boolean))].slice(0, 10);
  const safeGames = (Array.isArray(games) ? games : []).map(game => ({
    region: cleanRegion(game?.region),
    alliance: cleanTag(game?.alliance),
    role: cleanText(game?.role || 'player', 40).toLowerCase(),
    accountRole: cleanText(game?.accountRole || game?.role || 'player', 40).toLowerCase()
  })).filter(game => game.region).slice(0, 20);
  const params = new URLSearchParams();
  if (safeRegions.length) params.set('regions', safeRegions.join(','));
  if (safeGames.length) params.set('games', JSON.stringify(safeGames));
  params.set('sinceMs', String(Math.max(0, Number(sinceMs) || 0)));
  params.set('limit', String(Math.max(1, Math.min(20, Number(limit) || 5))));
  params.set('mode', mode === 'preview' ? 'preview' : 'dot');
  const data = await requestJson(`/api/notifications/bell?${params.toString()}`, user);
  return {
    summary: normalizeSummary(data.summary || {}),
    rows: Array.isArray(data.rows) ? data.rows.map(normalizeCampaign) : [],
    hasCampaignUnread: Boolean(data.hasCampaignUnread),
    mode: data.mode || mode || 'dot'
  };
}

export async function readNotificationSummaryD1(user) {
  const data = await requestJson('/api/notifications/summary', user);
  return normalizeSummary(data.summary || {});
}
export async function setNotificationSummaryD1(user, values = {}) {
  const data = await requestJson('/api/notifications/summary', user, { method: 'POST', body: JSON.stringify(values || {}) });
  return normalizeSummary(data.summary || values || {});
}
export async function listNotificationsD1(user, { limit = 50, includeUnread = true } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.max(1, Math.min(100, Number(limit) || 50))));
  params.set('includeUnread', includeUnread ? '1' : '0');
  const data = await requestJson(`/api/notifications?${params.toString()}`, user);
  return Array.isArray(data.rows) ? data.rows.map(normalizeNotification) : [];
}
export async function createNotificationD1(user, targetUid, values = {}) {
  const data = await requestJson('/api/notifications', user, { method: 'POST', body: JSON.stringify({ ...(values || {}), targetUid }) });
  return normalizeNotification(data.notification || {});
}
export async function patchNotificationD1(user, id, values = {}) {
  return requestJson('/api/notifications/update', user, { method: 'POST', body: JSON.stringify({ id, ...(values || {}) }) });
}
export async function markNotificationsReadD1(user, ids = []) {
  return requestJson('/api/notifications/mark-read', user, { method: 'POST', body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids] }) });
}
export async function deleteNotificationsD1(user, ids = []) {
  return requestJson('/api/notifications/delete', user, { method: 'POST', body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids] }) });
}
export async function listSentMessagesD1(user, { limit = 50 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.max(1, Math.min(100, Number(limit) || 50))));
  const data = await requestJson(`/api/notifications/sent?${params.toString()}`, user);
  return Array.isArray(data.rows) ? data.rows.map(normalizeSent) : [];
}
export async function createSentMessageD1(user, values = {}) {
  const data = await requestJson('/api/notifications/sent', user, { method: 'POST', body: JSON.stringify(values || {}) });
  return normalizeSent(data.sent || {});
}
export async function patchSentMessageD1(user, id, values = {}) {
  return requestJson('/api/notifications/sent/update', user, { method: 'POST', body: JSON.stringify({ id, ...(values || {}) }) });
}
export async function deleteSentMessagesD1(user, ids = []) {
  return requestJson('/api/notifications/sent/delete', user, { method: 'POST', body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids] }) });
}
export async function createNotificationCampaignD1(user, values = {}) {
  const data = await requestJson('/api/notification-campaigns', user, { method: 'POST', body: JSON.stringify(values || {}) });
  return normalizeCampaign(data.campaign || {});
}
export async function listNotificationCampaignsD1(user, regions = [], { sinceMs = 0, limit = 30 } = {}) {
  const safeRegions = [...new Set((Array.isArray(regions) ? regions : []).map(cleanRegion).filter(Boolean))].slice(0, 10);
  if (!safeRegions.length) return [];
  const params = new URLSearchParams();
  params.set('regions', safeRegions.join(','));
  params.set('sinceMs', String(Math.max(0, Number(sinceMs) || 0)));
  params.set('limit', String(Math.max(1, Math.min(80, Number(limit) || 30))));
  const data = await requestJson(`/api/notification-campaigns?${params.toString()}`, user);
  return Array.isArray(data.rows) ? data.rows.map(normalizeCampaign) : [];
}
