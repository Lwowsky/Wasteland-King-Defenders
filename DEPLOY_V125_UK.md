# DEPLOY v125 — що зробити після скачування

1. Розпакувати архів v125 у проєкт.
2. Перевірити, що secrets вже є:

```bash
npx wrangler secret list
```

3. Перевірити, що показує:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ANALYTICS_TOKEN
```

4. Задеплоїти Worker:

```bash
npx wrangler deploy
```

5. Запустити live logs:

```bash
npx wrangler tail
```

6. На сайті відкрити:

```text
Адмінка → Ліміти → Cloudflare → Оновити
```

7. Якщо зʼявилась помилка 403 або GraphQL permission error — перевірити Cloudflare token permissions:

```text
Analytics & Logs → Account Analytics → Read
```

8. Якщо хочеш бачити тільки один Worker, а не всі Workers акаунта, додай:

```bash
npx wrangler secret put CLOUDFLARE_WORKER_SCRIPT_NAME
```

І встав назву Worker script, наприклад:

```text
wasteland-king-defenders
```

Після цього знову:

```bash
npx wrangler deploy
```
