# Налаштування безпечного кешу статистики через GitHub Actions

## Що додано у v83

Ця версія робить статистику дешевшою для Firebase:

- `stats.html` більше не читає всіх гравців автоматично.
- Сторінка спочатку читає файл `public-cache/stats-summary.json`.
- Коли гравець змінює профіль або ферму, сайт створює маленький запис у `statsChanges`.
- GitHub Actions кожні 10 хвилин читає тільки необроблені `statsChanges` і оновлює `public-cache/stats-summary.json`.
- 1 раз на день GitHub Actions робить повний контрольний перерахунок.

## Що НЕ потрапляє в public-cache

У `public-cache/stats-summary.json` не записуються:

- email;
- UID у списку гравців;
- повідомлення;
- приватні ролі;
- логи;
- секретні коди;
- коментарі гравців.

Там тільки агреговані цифри: кількість гравців, ферм, регіонів, альянсів, рангів, ШК.

## Що треба зробити один раз

### 1. Залити v83 на GitHub

Заміни файли сайту на версію v83 і зроби push у GitHub.

### 2. Оновити Firestore rules

У терміналі в папці проєкту:

```bash
firebase deploy --only firestore:rules
```

Це потрібно, бо v83 додає правила для `statsChanges`, `statsIndex`, `statsMeta`.

### 3. Створити Firebase service account key

1. Відкрий Firebase Console.
2. Вибери свій проєкт.
3. Натисни ⚙️ Project settings.
4. Вкладка Service accounts.
5. Натисни Generate new private key.
6. Скачай JSON-файл.

Цей файл не можна додавати в сайт і не можна пушити на GitHub як звичайний файл.

### 4. Додати ключ у GitHub Secrets

1. Відкрий свій репозиторій на GitHub.
2. Settings.
3. Secrets and variables.
4. Actions.
5. New repository secret.
6. Name:

```text
FIREBASE_SERVICE_ACCOUNT
```

7. Value: встав увесь JSON із Firebase service account key.
8. Save.

### 5. Запустити GitHub Action вручну перший раз

1. GitHub repo.
2. Actions.
3. Update public stats cache.
4. Run workflow.

Після успішного запуску GitHub сам оновить файл:

```text
public-cache/stats-summary.json
```

### 6. Перевірити сайт

1. Відкрий `stats.html`.
2. Має написати, що статистика завантажена з public cache.
3. Детальний список гравців не має вантажитись автоматично.
4. Якщо треба список — натисни “Показати список”. Це вже буде читати Firebase.

## Як це працює після налаштування

### Гравець змінив профіль

```text
profile save
→ users/{uid}
→ publicPlayers/{uid}
→ statsChanges/{changeId}
```

### GitHub Actions

```text
кожні 10 хвилин
→ читає необроблені statsChanges
→ читає тільки змінених гравців
→ оновлює stats-summary.json
```

### Статистика

```text
3000 гравців відкрили stats.html
→ читають public-cache/stats-summary.json
→ 0 Firestore reads для перегляду статистики
```

## Якщо статистика не оновилась

Перевір:

1. Чи зробив `firebase deploy --only firestore:rules`.
2. Чи є secret `FIREBASE_SERVICE_ACCOUNT` у GitHub.
3. GitHub → Actions → Update public stats cache → чи немає червоної помилки.
4. Чи файл `public-cache/stats-summary.json` оновився після action.

## Важливо

`public-cache/stats-summary.json` — публічний файл. Туди не можна додавати персональні дані. У v83 туди записуються тільки загальні цифри.
