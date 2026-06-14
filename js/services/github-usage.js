import { regionTableCacheConfig } from '../config/region-table-cache.config.js';

function cleanText(value = '', max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function apiUrl(path = '') {
  const base = cleanText(regionTableCacheConfig?.apiBaseUrl || '', 240).replace(/\/+$/, '');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return base ? `${base}${safePath}` : safePath;
}

async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try { return await user.getIdToken(false); } catch { return ''; }
}

const GITHUB_USAGE_CACHE_KEY = 'wkd.githubUsageCache.v203';

function numberValue(value = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function percent(used = 0, limit = 0) {
  const safeLimit = numberValue(limit);
  if (!safeLimit) return 0;
  return Math.max(0, Math.min(100, (numberValue(used) / safeLimit) * 100));
}

function usageRow(used = 0, limit = 0) {
  const safeUsed = numberValue(used);
  const safeLimit = numberValue(limit);
  return { used: safeUsed, limit: safeLimit, remaining: Math.max(0, safeLimit - safeUsed), percent: percent(safeUsed, safeLimit) };
}

function normalize(data = {}) {
  const repo = data.repo || {};
  const pages = data.pages || {};
  const actions = data.actions || {};
  const limits = data.limits || {};
  return {
    ok: data.ok !== false,
    real: Boolean(data.real),
    source: cleanText(data.source || 'github-static-limits', 100),
    generatedAt: cleanText(data.generatedAt || new Date().toISOString(), 80),
    cachedAt: cleanText(data.cachedAt || '', 80),
    fromCache: Boolean(data.fromCache),
    repo: {
      owner: cleanText(repo.owner || '', 80),
      name: cleanText(repo.name || '', 120),
      fullName: cleanText(repo.fullName || repo.full_name || '', 180),
      defaultBranch: cleanText(repo.defaultBranch || repo.default_branch || '', 120),
      visibility: cleanText(repo.visibility || '', 40),
      private: Boolean(repo.private),
      htmlUrl: cleanText(repo.htmlUrl || repo.html_url || '', 260),
      sizeKb: numberValue(repo.sizeKb ?? repo.size),
      pushedAt: cleanText(repo.pushedAt || repo.pushed_at || '', 80),
      updatedAt: cleanText(repo.updatedAt || repo.updated_at || '', 80)
    },
    pages: {
      status: cleanText(pages.status || '', 80),
      htmlUrl: cleanText(pages.htmlUrl || pages.html_url || '', 260),
      cname: cleanText(pages.cname || '', 180),
      protectedDomainState: cleanText(pages.protectedDomainState || pages.protected_domain_state || '', 80),
      sourceBranch: cleanText(pages.sourceBranch || '', 120),
      sourcePath: cleanText(pages.sourcePath || '', 160),
      buildType: cleanText(pages.buildType || pages.build_type || '', 80)
    },
    actions: {
      enabled: actions.enabled !== false,
      totalRuns: numberValue(actions.totalRuns || actions.total_count),
      latestStatus: cleanText(actions.latestStatus || '', 80),
      latestConclusion: cleanText(actions.latestConclusion || '', 80),
      latestName: cleanText(actions.latestName || '', 160),
      latestRunNumber: numberValue(actions.latestRunNumber || 0),
      latestUrl: cleanText(actions.latestUrl || '', 260),
      latestCreatedAt: cleanText(actions.latestCreatedAt || '', 80),
      latestUpdatedAt: cleanText(actions.latestUpdatedAt || '', 80),
      latestDurationMs: numberValue(actions.latestDurationMs || 0),
      recentRuns: Array.isArray(actions.recentRuns) ? actions.recentRuns.slice(0, 10).map(row => ({
        id: cleanText(row.id || '', 80),
        name: cleanText(row.name || '', 160),
        status: cleanText(row.status || '', 80),
        conclusion: cleanText(row.conclusion || '', 80),
        runNumber: numberValue(row.runNumber || row.run_number),
        htmlUrl: cleanText(row.htmlUrl || row.html_url || '', 260),
        createdAt: cleanText(row.createdAt || row.created_at || '', 80),
        updatedAt: cleanText(row.updatedAt || row.updated_at || '', 80)
      })) : []
    },
    limits: {
      actionsMinutesMonth: usageRow(actions.minutesUsed || 0, limits.actionsMinutesMonth || 2000),
      pagesSiteSizeBytes: usageRow((repo.sizeKb || 0) * 1024, limits.pagesSiteSizeBytes || 1024 * 1024 * 1024),
      pagesBandwidthMonthBytes: usageRow(0, limits.pagesBandwidthMonthBytes || 100 * 1024 * 1024 * 1024),
      pagesBuildsHour: usageRow(0, limits.pagesBuildsHour || 10),
      actionsCacheBytes: usageRow(actions.cacheBytes || 0, limits.actionsCacheBytes || 10 * 1024 * 1024 * 1024)
    },
    partialErrors: Array.isArray(data.partialErrors) ? data.partialErrors.map(item => ({
      source: cleanText(item?.source || '', 80),
      error: cleanText(item?.error || '', 180)
    })).filter(item => item.error) : []
  };
}

function readCache() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(GITHUB_USAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GITHUB_USAGE_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

export function getCachedGitHubUsage() {
  const cached = readCache();
  if (!cached) return null;
  return normalize({ ...cached, fromCache: true });
}

export function clearCachedGitHubUsage() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(GITHUB_USAGE_CACHE_KEY); } catch {}
}

export async function fetchGitHubUsage(user) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl('/api/admin/usage/github'), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `github-usage-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const normalized = normalize(data || {});
  writeCache({ ...normalized, fromCache: false, cachedAt: new Date().toISOString() });
  return normalized;
}
