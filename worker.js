const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

function clean(value, max = MAX_FIELD_LENGTH) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeTelegramContact(value) {
  const text = clean(value, 120);
  return text || 'Не вказано';
}

async function handleContact(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const token = clean(env.TELEGRAM_BOT_TOKEN, 300);
  const chatId = clean(env.TELEGRAM_CHAT_ID, 120);

  if (!token || !chatId) {
    return json({ ok: false, error: 'telegram_not_configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // Honeypot. If a bot fills this hidden field, pretend success and do not send anything.
  if (clean(body.website, 100)) {
    return json({ ok: true });
  }

  const name = clean(body.name, 120);
  const nickname = clean(body.nickname, 120);
  const region = clean(body.region, 120);
  const alliance = clean(body.alliance, 40);
  const email = clean(body.email, 160);
  const message = clean(body.message, MAX_MESSAGE_LENGTH);
  const language = clean(body.language, 40);

  if (!message) {
    return json({ ok: false, error: 'message_required' }, 400);
  }

  const country = request.cf?.country || 'unknown';

  const telegramText = [
    '📩 Нове повідомлення з сайту Wasteland King Defenders',
    '',
    `👤 Імʼя: ${name || 'Не вказано'}`,
    `🎮 Нік: ${nickname || 'Не вказано'}`,
    `🛡 Альянс: ${alliance || 'Не вказано'}`,
    `🌍 Регіон: ${region || 'Не вказано'}`,
    `📧 Email/контакт: ${normalizeTelegramContact(email)}`,
    `🌐 Мова сайту: ${language || 'Не вказано'}`,
    `📍 Країна: ${country}`,
    '',
    '💬 Повідомлення:',
    message,
  ].filter(Boolean).join('\n');

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: telegramText,
      disable_web_page_preview: true,
    }),
  });

  let telegramData = null;
  try {
    telegramData = await telegramResponse.json();
  } catch {}

  if (!telegramResponse.ok || telegramData?.ok !== true) {
    return json({
      ok: false,
      error: 'telegram_send_failed',
      telegram_status: telegramResponse.status,
      telegram_description: clean(telegramData?.description || '', 200),
    }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    const formMatch = url.pathname.match(/^\/f\/(\d{1,8})\/([A-Za-z0-9_-]{6,80})$/);
    if (formMatch) {
      return Response.redirect(`${url.origin}/region-form.html?r=${encodeURIComponent(formMatch[1])}&s=${encodeURIComponent(formMatch[2])}`, 302);
    }

    const planMatch = url.pathname.match(/^\/plan\/([A-Za-z0-9_-]{6,120})$/);
    if (planMatch) {
      return Response.redirect(`${url.origin}/public-plan.html?s=${encodeURIComponent(planMatch[1])}`, 302);
    }

    const regionTableMatch = url.pathname.match(/^\/rt\/([A-Za-z0-9_-]{6,120})$/);
    if (regionTableMatch) {
      return Response.redirect(`${url.origin}/public-region-table.html?s=${encodeURIComponent(regionTableMatch[1])}`, 302);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
