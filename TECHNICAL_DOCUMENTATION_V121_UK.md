# Technical Documentation V121

## Змінені файли

- `admin.html`
- `css/admin-page.css`
- `js/pages/admin-page.js`
- `js/services/user-db.js`
- `js/services/region-db.js`
- `worker.js`
- `js/i18n-uk.js`
- `js/i18n-en.js`
- `js/i18n-ru.js`
- `js/i18n-pl.js`
- `js/i18n-de.js`
- `js/i18n-ja.js`
- `js/i18n-zh.js`
- `js/i18n-ko.js`
- `js/i18n-vi.js`
- `js/i18n-ar.js`

## Admin limits access

В `admin-page.js` додано перевірку:

```js
function canUseLimitsPanel(user = currentUser, profile = currentProfile) {
  return Boolean(user && (isOwnerUser(user, profile) || String(profile?.role || '').toLowerCase() === 'admin'));
}
```

Це означає:
- owner email має доступ;
- роль `admin` має доступ;
- роль `moderator` не має доступу до вкладки `Ліміти`.

## D1 cleanup security

У `worker.js` endpoints:
- `/api/d1-cleanup/scan`
- `/api/d1-cleanup/clear`

тепер вимагають, щоб UID був у `REGION_TABLE_ADMIN_UIDS`.

## Players pagination logic

Пагінація рахує тільки main users:
- `ADMIN_PLAYERS_PAGE_SIZE = 10`;
- ферми додаються після основи через `farmRowsForUser()`;
- `pagedPlayersState()` спочатку бере 10 основних груп, потім розгортає їх у рядки.

## Limits UI

У вкладці `Ліміти` є 2 підвкладки:

### Firebase
- Firestore reads/day
- Firestore writes/day
- Firestore deletes/day
- 30-day local estimate for reads/writes/deletes
- Firestore storage
- Firestore outbound transfer
- Firebase archive cleanup

### Cloudflare
- Workers requests/day
- Workers CPU/request
- Static asset requests
- D1 rows read/day
- D1 rows written/day
- D1 storage/account
- D1 max database size
- D1 queries per Worker invocation
- D1 archive cleanup
