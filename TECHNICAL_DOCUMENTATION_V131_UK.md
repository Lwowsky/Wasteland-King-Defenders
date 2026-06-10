# TECHNICAL DOCUMENTATION v131

## Нова колекція

`adminUsersIndex/{uid}` — приватний легкий індекс для адмінки.

Основні поля:

- `uid`
- `email`
- `nickname`, `gameNick`
- `region`, `alliance`, `allianceKey`
- `rank`, `shk`, `role`
- `gameProfile`
- `farms`
- `farmCount`
- `regionKeys`, `allianceKeys`
- `searchPrefixes`
- `createdAtMs`, `updatedAtMs`

## Читання

Адмінка відкриває список гравців через `listRegisteredUsersPage()`:

- без фільтрів: `adminUsersIndex` + `orderBy(createdAtMs, desc)` + `limit(11)`;
- пошук по ніку/email: `searchPrefixes array-contains <prefix>` + `limit(11)`;
- регіон/альянс/роль: серверні `where` + `limit(11)` там, де Firestore дозволяє;
- fallback для старих документів: маленьке читання `users`, максимум 50–100 документів, і self-heal запис у `adminUsersIndex`.

## Запис

Індекс оновлюється при:

- `updateUserByAdmin()`;
- `updateFarmByAdmin()`;
- `approveRoleRequest()`;
- ручному натисканні **Оновити індекс**.

## Ліміти

Після побудови індексу:

- відкриття першої сторінки: приблизно 10–11 reads;
- пошук за ніком: приблизно 1–11 reads;
- фільтр регіон/альянс: приблизно 1–11 reads;
- натискання **Редагувати**: без додаткового read, бо рядок уже містить потрібні поля для форми;
- **Зберегти**: приблизно 3–5 writes, бо оновлюються `users`, `adminUsersIndex`, `publicPlayers`, `regions/{region}/players` і службовий marker.

## Безпека

`adminUsersIndex` містить email, тому `firestore.rules` дозволяє читання/запис тільки:

- Owner;
- Admin;
- Moderator.

Consul/Officer/Player/Guest не мають доступу до цієї колекції.
