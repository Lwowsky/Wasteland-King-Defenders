# FIREBASE REAL USAGE SETUP v127

## Secrets
Потрібно додати в Cloudflare Worker:

```bash
cat firebase-monitoring-key.json | npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

Опційно, якщо хочеш окремо від `FIREBASE_PROJECT_ID`:

```bash
echo -n "wasteland-king-defender" | npx wrangler secret put GOOGLE_PROJECT_ID
```

## Deploy

```bash
npx wrangler deploy
```

## Перевірка

```bash
npx wrangler tail
```

Після цього на сайті:

```text
Адмінка → Ліміти → Firebase → Оновити
```

## Безпека
- JSON service account key не вставляти в frontend.
- Не кидати JSON key у чат.
- Не комітити JSON key у GitHub.
- Зберігати тільки як Cloudflare Worker secret.
