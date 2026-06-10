# TECHNICAL DOCUMENTATION v125

## Новий Worker endpoint

```text
GET /api/admin/usage/cloudflare
Authorization: Bearer <Firebase ID token>
```

## Вимоги до Worker secrets

Перед деплоєм мають існувати:

```bash
npx wrangler secret list
```

Очікувано:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ANALYTICS_TOKEN
```

Опціонально можна додати змінну/secret:

```text
CLOUDFLARE_WORKER_SCRIPT_NAME
```

Якщо її немає, endpoint показує Workers usage по всіх Workers в акаунті.

## Деплой

```bash
npx wrangler deploy
```

## Перевірка логів

```bash
npx wrangler tail
```

Потім на сайті:

```text
Адмінка → Ліміти → Cloudflare → Оновити
```

## Можливі помилки

### `cloudflare_token_missing`

Не доданий secret:

```bash
npx wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN
```

### `cloudflare_account_id_missing`

Не доданий secret:

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

### `admin_required`

Firebase UID користувача не входить у `REGION_TABLE_ADMIN_UIDS` у `wrangler.jsonc` або Worker vars.

### `cloudflare_usage_unavailable`

GraphQL не повернув жодної метрики. Перевірити:

- token має `Account Analytics Read`;
- Account ID правильний;
- Worker задеплоєний після додавання secrets;
- у `wrangler tail` немає GraphQL errors.

## Що НЕ зроблено у v125

- Firebase real usage через Google Cloud Monitoring ще не підключався. Це окрема версія.
- Cloudflare API token не вставлявся в frontend і не додавався в GitHub.
