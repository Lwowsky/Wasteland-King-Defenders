# TECHNICAL DOCUMENTATION v124

## Змінені файли

- `admin.html`
- `js/pages/admin-page.js`
- `js/services/user-db.js`
- `js/services/usage-tracker.js`
- `js/services/notifications-d1.js`
- `js/services/d1-archive-cleanup.js`
- `js/services/region-table-cache.js`
- `js/services/public-stats-cache.js`
- `js/i18n-*.js`

## Адмінка → Гравці

Основний запит:

```js
query(
  collection(db, 'users'),
  where('profileComplete', '==', true),
  orderBy('createdAt', 'desc'),
  limit(11)
)
```

Якщо через старі документи результат порожній, запускається legacy fallback:

```js
query(collection(db, 'users'), limit(11))
```

Це потрібно, щоб старі профілі без `createdAt`, `regionAccess` або `allianceAccess` не зникали з адмінки.

## Cloudflare estimate

У `usage-tracker.js` додано локальний bucket:

```js
wkd.cloudflareUsageEstimate.day
```

Він рахує тільки дії, які пройшли через цей браузер:

- Worker request;
- D1 rows read;
- D1 rows written.

Це не офіційна Cloudflare billing-цифра. Реальну статистику можна підключити тільки серверно через Cloudflare GraphQL Analytics API або переглядати в Cloudflare Dashboard.

## Безпека токенів

Cloudflare API Token і Google service account credentials не можна вставляти у frontend. Якщо підключати реальні usage metrics, їх треба тримати тільки в Worker secrets / server secrets.
