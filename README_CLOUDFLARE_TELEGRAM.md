# Cloudflare Workers + Telegram contact form

Форма "Написати нам" відправляє POST на `/api/contact`. Worker бере секрети з Cloudflare і відправляє повідомлення в Telegram.

## Команди

```bash
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler deploy
```

## Локальний запуск

Створи файл `.dev.vars` біля `wrangler.jsonc`:

```ini
TELEGRAM_BOT_TOKEN=1234567890:AA...
TELEGRAM_CHAT_ID=123456789
```

Потім:

```bash
npm run dev
```

Не завантажуй `.dev.vars` у публічний репозиторій.
