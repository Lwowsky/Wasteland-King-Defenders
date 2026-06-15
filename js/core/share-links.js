const MAX_CODE_LEN = 120;
const SHARE_TTL_MS = 10 * 60 * 1000;

const TYPE_KEYS = {
  regionTable: ['wkd:share:regionTable', 'wkd:share:regionTable:last', 'wkd.lastRegionTableShareCode'],
  finalPlan: ['wkd:share:finalPlan', 'wkd:share:finalPlan:last', 'wkd.lastFinalPlanShareCode'],
  regionForm: ['wkd:share:regionForm', 'wkd:share:regionForm:last', 'wkd.regionForm.shortCode']
};

export function cleanShareCode(value = '') {
  return String(value || '').trim().replace(/^#/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, MAX_CODE_LEN);
}

function storageForKey(key = '') {
  return key.endsWith(':last') ? window.localStorage : window.sessionStorage;
}

function readStoredKey(key) {
  try {
    const raw = storageForKey(key).getItem(key);
    if (!raw) return '';
    if (!raw.trim().startsWith('{')) return cleanShareCode(raw);
    const data = JSON.parse(raw);
    const code = cleanShareCode(data.code || '');
    const at = Number(data.at) || 0;
    return code && (!at || Date.now() - at <= SHARE_TTL_MS) ? code : '';
  } catch (_error) {
    return '';
  }
}

function readWindowName(type) {
  try {
    const raw = String(window.name || '').trim();
    if (!raw) return '';
    const data = raw.startsWith('{') ? JSON.parse(raw) : null;
    if (!data || data.app !== 'wkd' || data.type !== type) return '';
    const at = Number(data.at) || 0;
    return (!at || Date.now() - at <= SHARE_TTL_MS) ? cleanShareCode(data.code || '') : '';
  } catch (_error) {
    return '';
  }
}

function codeFromUrlString(urlText = '', options = {}) {
  try {
    const url = new URL(urlText, window.location.href);
    const fromQuery = cleanShareCode(url.searchParams.get('s') || url.searchParams.get('code') || url.searchParams.get('link') || '');
    if (fromQuery) return fromQuery;
    const hashText = String(url.hash || '').replace(/^#/, '').replace(/^\?/, '');
    const hashParams = new URLSearchParams(hashText);
    const fromHashParams = cleanShareCode(hashParams.get('s') || hashParams.get('code') || hashParams.get('link') || '');
    if (fromHashParams) return fromHashParams;
    const fromHash = cleanShareCode(hashText.includes('/') ? hashText.split('/').pop() : hashText);
    if (fromHash) return fromHash;
    const pathMatch = options.pathRegex ? String(url.pathname || '').match(options.pathRegex) : null;
    if (pathMatch?.[1]) return cleanShareCode(pathMatch[1]);
    const parts = String(url.pathname || '').split('/').filter(Boolean);
    const last = cleanShareCode(parts[parts.length - 1] || '');
    const blocked = options.blockedPathNames || [];
    if (last && !blocked.some(name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.html)?$`, 'i').test(last))) return last;
  } catch (_error) {}
  return '';
}

export function rememberShareCode(type, codeValue, extra = {}) {
  const code = cleanShareCode(codeValue);
  if (!code) return '';
  const item = JSON.stringify({ app: 'wkd', type, code, at: Date.now(), ...extra });
  (TYPE_KEYS[type] || []).forEach(key => {
    try { storageForKey(key).setItem(key, item); } catch (_error) {}
  });
  try { window.name = item; } catch (_error) {}
  return code;
}

export function readShareCode(type, options = {}) {
  const direct = codeFromUrlString(window.location.href, options);
  if (direct) return rememberShareCode(type, direct, options.extra || {});
  const referrer = codeFromUrlString(document.referrer || '', options);
  if (referrer) return rememberShareCode(type, referrer, options.extra || {});
  const named = readWindowName(type);
  if (named) return rememberShareCode(type, named, options.extra || {});
  for (const key of (TYPE_KEYS[type] || [])) {
    const stored = readStoredKey(key);
    if (stored) return rememberShareCode(type, stored, options.extra || {});
  }
  return '';
}

function isLocalDevBase(base = window.location.href) {
  try {
    const url = new URL(base, window.location.href);
    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) || url.protocol === 'file:';
  } catch (_error) {
    return false;
  }
}

function makeQueryShareUrl(target, codeValue, base = window.location.href) {
  const code = cleanShareCode(codeValue);
  const url = new URL(target, base);
  if (code) url.searchParams.set('s', code);
  url.hash = '';
  return url.toString();
}

export function makePublicShareUrl(target, codeValue, base = window.location.href) {
  const code = cleanShareCode(codeValue);
  const url = new URL(target, base);
  if (!code) return url.toString();
  const path = String(url.pathname || '').toLowerCase();
  const localDev = isLocalDevBase(base);
  if (path.endsWith('/public-plan.html') || path.endsWith('/p.html')) {
    return localDev ? makeQueryShareUrl('public-plan.html', code, base) : new URL(`./p/${encodeURIComponent(code)}`, base).toString();
  }
  if (path.endsWith('/public-region-table.html') || path.endsWith('/rt.html')) {
    return localDev ? makeQueryShareUrl('public-region-table.html', code, base) : new URL(`./rt/${encodeURIComponent(code)}`, base).toString();
  }
  if (path.endsWith('/region-form.html') || path.endsWith('/f.html')) {
    return localDev ? makeQueryShareUrl('region-form.html', code, base) : new URL(`./f/${encodeURIComponent(code)}`, base).toString();
  }
  return makeQueryShareUrl(target, code, base);
}

export function keepShareCodeInUrl(type, codeValue) {
  const code = cleanShareCode(codeValue);
  if (!code || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.get('s')) url.searchParams.set('s', code);
    const hashCode = cleanShareCode(String(url.hash || '').replace(/^#/, '').split('/').pop() || '');
    if (hashCode === code) url.hash = '';
    window.history.replaceState(window.history.state, document.title, url.toString());
    rememberShareCode(type, code);
  } catch (_error) {}
}
