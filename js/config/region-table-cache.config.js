// Central config for the low-cost region table viewer.
// Keep this file small and public-safe. Do NOT put secrets here.
//
// enabled: false  -> the site uses the old Firebase table logic.
// enabled: true   -> the site tries Cloudflare Worker + D1 snapshot first.
// apiBaseUrl: ''  -> same domain, for example https://your-domain.com/api/...
// apiBaseUrl: 'https://api.example.com' -> separate Worker route.
export const regionTableCacheConfig = {
  enabled: false,
  apiBaseUrl: '',
  manualRefreshOnly: true,
  source: 'cloudflare-d1-snapshot'
};
