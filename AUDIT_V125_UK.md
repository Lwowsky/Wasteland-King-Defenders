# AUDIT v125 — Real Cloudflare usage endpoint

## Що змінено

- Додано безпечний Worker endpoint `GET /api/admin/usage/cloudflare`.
- Endpoint доступний тільки користувачам із `REGION_TABLE_ADMIN_UIDS` після перевірки Firebase ID token.
- Cloudflare API token і Account ID не віддаються у браузер і читаються тільки з Worker secrets:
  - `CLOUDFLARE_ANALYTICS_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Адмінка → Ліміти → Cloudflare тепер по кнопці `Оновити` пробує отримати реальні дані через Worker.
- Якщо реальні дані недоступні, адмінка не падає і показує локальну оцінку.
- Додано окремий frontend service `js/services/cloudflare-usage.js`.
- Оновлено переклади для UA, EN, RU, PL, DE, JA, ZH, KO, VI, AR.
- Оновлено cache-busting до `v=125`.

## Які реальні метрики підтягуються

- Workers requests за сьогодні UTC.
- Workers errors за сьогодні UTC.
- Workers subrequests за сьогодні UTC.
- D1 rows read за сьогодні UTC.
- D1 rows written за сьогодні UTC.
- D1 read queries / write queries за сьогодні UTC.
- D1 storage total та найбільша база, якщо `d1StorageAdaptiveGroups` доступний у GraphQL для акаунта.

## Безпека

- API token Cloudflare не зберігається у frontend.
- У браузер повертаються тільки числові метрики.
- Endpoint вимагає Firebase ID token.
- Endpoint додатково перевіряє UID у `REGION_TABLE_ADMIN_UIDS`.
- Moderator не отримує доступ до вкладки лімітів, якщо його UID не доданий в admin uid list.

## Перевірено

- `node --check` для всіх JS файлів.
- `node --check worker.js`.
- `console.log` у коді сайту/worker не додано.
- `onSnapshot` не додано.
