# AUDIT v129 — Firebase local estimate + admin players fix

Зміни:
- прибрано автоматичний Firebase Cloud Monitoring API з адмінки та Worker, бо Google вимагає billing для timeSeries API;
- повернуто локальний орієнтовний лічильник Firebase reads/writes/deletes через usage-tracker;
- Cloudflare real usage залишено без змін;
- виправлено фільтр альянсу в адмінці: більше не занижує регістр і не ховає гравців з альянсом YYY;
- адмінка читає тільки сторінку з 10 основних гравців, ферми додаються під основою і не рахуються в 10;
- видалено js/services/firebase-usage.js та endpoint /api/admin/usage/firebase з worker.js.

Перевірка:
- console.log: 0;
- onSnapshot: 0;
- node --check для JS: OK;
- дублікати function declarations: 0.
