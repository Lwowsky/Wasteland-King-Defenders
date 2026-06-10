# AUDIT v126 — Cloudflare usage cache cleanup

## Що змінено

- Прибрано показ локальної оцінки Cloudflare у вкладці `Адмінка → Ліміти → Cloudflare`.
- Якщо реальні Cloudflare дані вже були отримані раніше, вони зберігаються в `localStorage` і показуються одразу при відкритті вкладки.
- Кнопка `Оновити` робить новий запит до Worker endpoint `/api/admin/usage/cloudflare`, отримує свіжі реальні цифри й перезаписує локальний кеш.
- Якщо кешу ще немає, вкладка показує тільки довідкові Cloudflare Free ліміти без фейкової локальної оцінки.
- Кнопка `Скинути оцінку` для Cloudflare замінена на `Очистити кеш`.
- У Cloudflare usage-картках велике число тепер показує `використано`, а не `залишилось`, щоб не плутати.
- Переклади додані/оновлені для UA, EN, RU, PL, DE, JA, ZH, KO, VI, AR.

## Економія лімітів

- Просте відкриття вкладки `Cloudflare` більше не робить автоматичний API-запит, якщо є кеш.
- Офіційні Cloudflare дані оновлюються тільки вручну через кнопку `Оновити`.
- Один клік `Оновити` використовує приблизно 1 Worker request і GraphQL subrequest, але не використовує Firestore reads/writes і не читає D1 rows напряму.

## Перевірено

- `node --check js/pages/admin-page.js`
- `node --check js/services/cloudflare-usage.js`
- `node --check js/i18n-*.js`
- `console.log` у production JS не додано.
- `onSnapshot` не додано.
