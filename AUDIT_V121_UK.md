# AUDIT V121 — Admin Limits & Players Pagination

## Що змінено

### Адмінка → вкладка “Ліміти”
- Блок лімітів винесено з основної адмінки в окрему вкладку `Ліміти`.
- Вкладка показується тільки власнику/адміну.
- Модератор більше не бачить вкладку `Ліміти` і не може запускати очищення через UI.
- Усередині вкладки додано 2 підвкладки:
  - `Firebase` — Firestore лічильник, Firebase архіви, очищення старих public-документів.
  - `Cloudflare` — довідкові ліміти Workers/D1 і очищення D1 архіву.

### Доступ до очищення
- Firebase archive cleanup у клієнтському сервісі тепер вимагає owner/admin, не moderator.
- `cleanupOldPublicDocuments` тепер вимагає owner/admin, не moderator.
- D1 cleanup endpoints у Worker тепер перевіряють `REGION_TABLE_ADMIN_UIDS` перед scan/clear.

### Ліміти
- Firebase Firestore ліміти виправлені як денні ліміти Spark: reads/writes/deletes за день.
- Місячні Firestore reads/writes/deletes позначені як 30-денна оцінка сайту, не офіційна місячна квота.
- Додано Cloudflare Workers Free і D1 Free довідкові картки.

### Гравці в адмінці
- За замовчуванням список іде від найновіших гравців.
- Пагінація рахує тільки основних гравців: 10 основ на сторінку.
- Якщо увімкнено “Основи + ферми”, ферми показуються разом із власником і не забирають місце з 10 основних гравців.
- Додано кнопки Назад / Вперед.

### Переклади
- Нові тексти додано для мов: UK, EN, RU, PL, DE, JA, ZH, KO, VI, AR.

## Перевірка
- `node --check js/pages/admin-page.js` — OK
- `node --check js/services/user-db.js` — OK
- `node --check js/services/region-db.js` — OK
- `node --check worker.js` — OK
- `node --check js/i18n-*.js` — OK
