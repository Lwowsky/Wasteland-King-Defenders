# Деплой v128

1. Замінити файли сайту файлами з архіву v128.
2. Перевірити, що у Worker secrets є:

```bash
npx wrangler secret list
```

Має бути:

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_PROJECT_ID
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ANALYTICS_TOKEN
```

3. Деплой Worker:

```bash
npx wrangler deploy
```

4. Перевірка логів:

```bash
npx wrangler tail
```

5. На сайті відкрити:

```text
Адмінка → Ліміти → Firebase → Оновити
```

Якщо є помилка, вона буде показана у вкладці Firebase. Типові причини:

- `google_service_account_missing` — не доданий `GOOGLE_SERVICE_ACCOUNT_JSON`.
- `google_project_id_missing` — не доданий `GOOGLE_PROJECT_ID`.
- `invalid_grant` або OAuth error — JSON ключ вставлений неправильно або не від того service account.
- `Permission denied` — service account не має ролі `Monitoring Viewer` у Firebase/Google Cloud проекті.
- Нульові показники без помилки — Cloud Monitoring ще не має свіжих точок або за період сьогодні не було операцій; метрики можуть зʼявлятися із затримкою до кількох хвилин.
