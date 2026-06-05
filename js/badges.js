window.WKD = window.WKD || {};
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
  const normalize = value => String(value ?? '').trim();
  const normalizeAlliance = value => Array.from(normalize(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
  const hashHue = value => {
    let hash = 2166136261;
    for (const ch of String(value || 'empty')) {
      hash ^= ch.codePointAt(0) || 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return ((hash % 360) + 360) % 360;
  };
  const tierNumber = value => Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
  const troopLabel = value => {
    const key = normalize(value).toLowerCase();
    if (key === 'fighter') return t('troop.fighter', 'Бійці');
    if (key === 'rider') return t('troop.rider', 'Наїзники');
    if (key === 'shooter') return t('troop.shooter', 'Стрільці');
    return value || '—';
  };
  const troopClass = value => {
    const key = normalize(value).toLowerCase();
    return ['fighter', 'rider', 'shooter'].includes(key) ? key : 'custom';
  };
  const roleLabel = value => {
    const key = normalize(value).toLowerCase() || 'player';
    const map = { admin: 'Адмін', moderator: 'Модератор', consul: 'Консул', officer: 'Офіцер', player: 'Гравець' };
    return t(`role.${key}`, map[key] || key);
  };
  const shkTier = value => {
    const n = tierNumber(value);
    if (!n) return 0;
    if (n <= 3) return 1;
    if (n <= 6) return 2;
    if (n <= 9) return 3;
    if (n <= 12) return 4;
    if (n <= 15) return 5;
    if (n <= 18) return 6;
    if (n <= 21) return 7;
    if (n <= 25) return 8;
    if (n <= 29) return 9;
    if (n <= 33) return 10;
    if (n <= 37) return 11;
    if (n <= 39) return 12;
    if (n <= 43) return 13;
    return 14;
  };

  const Badges = {
    esc,
    hashHue,
    alliance(tag, options = {}) {
      const safe = normalizeAlliance(tag) || '—';
      const hue = Number.isFinite(Number(options.hue)) ? Number(options.hue) : hashHue(`${options.region || ''}:${safe}`);
      return `<span class="alliance-badge" style="--ally-hue:${hue}"><span class="badge-dot"></span><span>${esc(safe)}</span></span>`;
    },
    tier(tier = '') {
      const safe = normalize(tier).toUpperCase() || '—';
      const number = tierNumber(safe);
      return `<span class="tier-badge tier-badge--t${number || 'unknown'}" data-tier-level="${number}"><span class="badge-dot"></span><span>${esc(safe)}</span></span>`;
    },
    troop(type = '', label = '') {
      return `<span class="tag ${esc(troopClass(type))}">${esc(label || troopLabel(type))}</span>`;
    },
    captain(value) {
      return `<span class="captain-badge ${value ? 'yes' : 'no'}">${value ? esc(t('common.yes', 'Так')) : esc(t('common.no', 'Ні'))}</span>`;
    },
    shift(shift = '', label = '') {
      const cls = normalize(shift).toLowerCase() || 'shift';
      return `<span class="shift-badge ${esc(cls)}">${esc(label || shift || '—')}</span>`;
    },
    role(role = 'player') {
      const key = normalize(role).toLowerCase() || 'player';
      return `<span class="role-badge role-${esc(key)}">${esc(roleLabel(key))}</span>`;
    },
    rank(rank = '') {
      const code = normalize(rank).toUpperCase() || 'P1';
      return `<span class="rank-badge rank-${esc(code.toLowerCase())}" title="${esc(t('account.rank', 'Ранг'))} ${esc(code)}"><span class="admin-badge-dot"></span><b>${esc(code)}</b></span>`;
    },
    shk(value = '') {
      const n = tierNumber(value);
      const tier = shkTier(n);
      if (!n) return `<span class="shk-badge shk-tier-0">—</span>`;
      return `<span class="shk-badge shk-tier-${tier}" title="T${tier} · ${esc(t('account.shk', 'ШК'))} ${esc(n)}"><span class="admin-badge-dot"></span><b>${esc(n)}</b></span>`;
    },
    sortButton(field, label = 'Sort') {
      return `<button class="sort-btn" type="button" data-region-sort="${esc(field)}" aria-label="${esc(label)}">↓</button>`;
    }
  };

  window.WKD.Badges = Badges;
  window.WKD.allianceBadge = Badges.alliance;
  window.WKD.tierBadge = Badges.tier;
  window.WKD.troopBadge = Badges.troop;
  window.WKD.captainBadge = Badges.captain;
  window.WKD.shiftBadge = Badges.shift;
  window.WKD.roleBadge = Badges.role;
  window.WKD.rankBadge = Badges.rank;
  window.WKD.shkBadge = Badges.shk;
})();
