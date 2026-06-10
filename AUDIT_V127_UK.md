# AUDIT v127 — Firebase real usage + cleanup

## Що зроблено
- Додано реальні Firebase/Firestore usage metrics через Cloud Monitoring API:
  - `/api/admin/usage/firebase`
  - `js/services/firebase-usage.js`
  - вкладка `Адмінка → Ліміти → Firebase → Оновити`
- Дані кешуються у браузері в `wkd.firebaseRealUsageCache.v128`.
- Firebase API secrets не потрапляють у frontend.
- Оновлення Firebase usage доступне тільки Admin UID через Firebase ID token + `REGION_TABLE_ADMIN_UIDS`.
- Прибрано стару Cloudflare local estimate логіку з відображення. `usage-tracker.js` більше не тримає локальні Cloudflare квоти як UI-джерело.
- Прибрано дублікати i18n ключів у `i18n-*.js`.

## Перевірка дублікатів
- Duplicate i18n keys: 0
- Duplicate function declarations: 0
- `console.log`: 0
- `onSnapshot`: 0

## Чому код виріс
Новий Firebase real usage — це не кнопка, а повний безпечний flow:
- Service Account JWT signing у Worker.
- OAuth access token для Google API.
- Cloud Monitoring `timeSeries.list` запити.
- Новий endpoint `/api/admin/usage/firebase`.
- Frontend cache + UI.
- Переклади на всі мови.

## Ліміти кліку Firebase Оновити
Один клік:
- Cloudflare Worker requests: приблизно 1
- Google OAuth request: 1 тільки коли token cache протух або перший запуск після деплою
- Cloud Monitoring API calls: до 7
- Firestore reads/writes/deletes: 0
- D1 rows read/write: 0
