# DEPLOY v126

1. Розпакуй архів v126 у проєкт.
2. Перевір, що secrets уже є:

```bash
npx wrangler secret list
```

Мають бути:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ANALYTICS_TOKEN
```

3. Задеплой Worker:

```bash
npx wrangler deploy
```

4. Задеплой статичні файли сайту на GitHub Pages / Cloudflare Pages.
5. Відкрий сайт і перевір:

```text
Адмінка → Ліміти → Cloudflare
```

- До натискання `Оновити` має показувати кешовані реальні дані або довідкові ліміти.
- Після натискання `Оновити` має показати свіжі реальні дані Cloudflare.
- Після `Очистити кеш` має зникнути кеш і залишитись довідкові ліміти.
