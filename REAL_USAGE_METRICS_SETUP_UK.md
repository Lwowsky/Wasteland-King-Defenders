# v124 — Підключення реальних Firebase / Cloudflare лімітів безпечно

## Головне правило

Не вставляй Cloudflare API Token, Google service account JSON або будь-який секрет у HTML/JS сайту. Все, що лежить у frontend, видно через DevTools.

Реальні цифри треба брати так:

Адмінка → Firebase Auth ID token → Cloudflare Worker → перевірка UID адміна → секрети Worker → Cloudflare GraphQL / Google Cloud Monitoring → відповідь тільки з цифрами.

## Cloudflare реальні дані

### Що можна показати
- Worker requests за день.
- D1 rows read за день.
- D1 rows written за день.
- D1 storage / database size.

### Кроки

1. Зайди в Cloudflare Dashboard.
2. Відкрий My Profile → API Tokens.
3. Створи API Token з мінімальними правами для Analytics Read.
4. Обмеж токен тільки потрібним Account / Zone.
5. У Worker додай secret:

```bash
wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN
wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

6. У Worker зроби endpoint, наприклад:

```text
GET /api/admin/usage/cloudflare
```

7. Endpoint має:
- перевірити Firebase ID token з Authorization header;
- перевірити UID у `REGION_TABLE_ADMIN_UIDS`;
- викликати Cloudflare GraphQL Analytics API;
- повернути тільки готові цифри: requests, rowsRead, rowsWritten, storageBytes.

## Firebase реальні дані

### Найбезпечніший варіант
Дивитись вручну у Firebase Console → Firestore → Usage.

### Автоматичний варіант
Через Google Cloud Monitoring API.

1. У Google Cloud Console відкрий проект Firebase.
2. Увімкни Cloud Monitoring API.
3. Створи Service Account тільки для читання метрик.
4. Дай роль Monitoring Viewer або мінімальний custom role з `monitoring.timeSeries.list`.
5. Створи key JSON для service account.
6. Додай його у Cloudflare Worker як secret:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
wrangler secret put GOOGLE_PROJECT_ID
```

7. У Worker зроби endpoint:

```text
GET /api/admin/usage/firebase
```

8. Endpoint має:
- перевірити Firebase ID token;
- дозволити тільки Admin / Owner;
- через service account отримати OAuth access token;
- запитати Cloud Monitoring metrics:
  - `firestore.googleapis.com/document/read_ops_count`
  - `firestore.googleapis.com/document/write_ops_count`
  - `firestore.googleapis.com/document/delete_ops_count`
- повернути тільки reads/writes/deletes за день.

## Чому не можна напряму у frontend

Якщо токен поставити в `admin-page.js`, будь-хто з доступом до адмінки або навіть через DevTools зможе його побачити. Тому всі secrets мають бути тільки у Worker secrets.

## Що вже є у v124

- Локальна оцінка лімітів з браузера.
- Детальна статистика з `public-cache/*.json` без Firestore reads.
- Структура адмінки вже готова, щоб пізніше додати реальні endpoint-и.
