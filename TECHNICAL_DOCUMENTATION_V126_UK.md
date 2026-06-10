# TECHNICAL DOCUMENTATION v126

## Cloudflare usage cache

Реальні дані Cloudflare зберігаються в браузері в ключі:

```text
wkd.cloudflareRealUsageCache.v126
```

Це не secret і не API token. У кеші зберігаються тільки вже отримані агреговані цифри usage:

- Worker requests;
- Worker errors;
- Worker subrequests;
- D1 rows read;
- D1 rows written;
- D1 read/write queries;
- D1 storage;
- період UTC;
- час останнього оновлення.

API token залишається тільки в Cloudflare Worker secrets:

```text
CLOUDFLARE_ANALYTICS_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## Поведінка вкладки Cloudflare

1. Якщо кеш є — показує збережені реальні Cloudflare дані одразу.
2. Якщо кешу немає — показує тільки довідкові Cloudflare Free ліміти.
3. Кнопка `Оновити` викликає:

```text
GET /api/admin/usage/cloudflare
```

4. Після успішної відповіді дані записуються в localStorage.
5. Кнопка `Очистити кеш` видаляє локально збережені агреговані цифри Cloudflare.

## Безпека

- `CLOUDFLARE_ANALYTICS_TOKEN` не потрапляє в frontend.
- Frontend бачить тільки агреговані цифри usage.
- Endpoint `/api/admin/usage/cloudflare` має залишатися доступним тільки для Admin / Owner через Firebase ID token і перевірку UID у Worker.

## Змінені файли

```text
admin.html
js/pages/admin-page.js
js/services/cloudflare-usage.js
js/i18n-*.js
```
