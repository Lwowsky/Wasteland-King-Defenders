# AUDIT v128 — Firebase real usage UI fix

## Зміни

- Firebase вкладка більше не показує локальну оцінку як використані дані.
- Якщо реальні Firebase дані вже були отримані, вони читаються з локального кешу браузера без нового Worker/API запиту.
- Кнопка `Оновити` робить реальний запит до Worker endpoint `/api/admin/usage/firebase`, зберігає успішну відповідь локально і показує використано / залишилось / ліміт.
- Якщо запит не вдався, помилка тепер показується прямо у вкладці Firebase, а не тільки у верхньому статусі адмінки.
- Worker Firebase usage endpoint тепер використовує стабільніші Cloud Monitoring metric candidates:
  - `firestore.googleapis.com/document/read_ops_count` з fallback на `document/read_count`;
  - `write_ops_count` з fallback на `write_count`;
  - `delete_ops_count` з fallback на `delete_count`;
  - `storage/data_and_index_storage_bytes`;
  - `network/active_connections`;
  - `network/snapshot_listeners`;
  - `rules/evaluation_count` з фільтром `DENY`.
- Додано aggregation для Cloud Monitoring: `ALIGN_SUM/REDUCE_SUM` для лічильників і `ALIGN_MAX/REDUCE_MAX` для gauge-метрик.
- Прибрано імпорт старої локальної Firebase estimate логіки з `admin-page.js`.
- Оновлено cache-busting до `v=128`.

## Перевірка

- `node --check` для Worker, admin-page, usage services і всіх i18n файлів — OK.
- `console.log` — не знайдено.
- `onSnapshot` — не знайдено.
- Дублікати i18n ключів — не знайдено.
- Дублікати function declarations у JS — не знайдено.
