import { resolveRegionFinalPlanShare } from '../services/region-db.js?v=47';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);

function codeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('s') || params.get('code') || '';
}
function setStatus(text, type = 'muted') {
  const box = $('#publicPlanStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function sanitizeFinalHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const sheet = template.content.querySelector('.board-sheet');
  if (!sheet) return '';
  sheet.querySelectorAll('script,iframe,object,embed,link,style').forEach(node => node.remove());
  sheet.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attr => {
      if (/^on/i.test(attr.name) || attr.name === 'srcdoc') node.removeAttribute(attr.name);
      if ((attr.name === 'href' || attr.name === 'src') && /^javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
    });
  });
  return sheet.outerHTML;
}
async function init() {
  const code = codeFromUrl();
  if (!code) {
    setStatus(t('finalPlan.sharedMissing', 'Секретне посилання неправильне або неповне.'), 'error');
    return;
  }
  try {
    const data = await resolveRegionFinalPlanShare(code);
    $('#publicPlanRegion') && ($('#publicPlanRegion').textContent = data.region ? `R${data.region}` : 'R—');
    const html = sanitizeFinalHtml(data.html || '');
    if (!html) throw new Error('empty-plan');
    $('#publicPlanBoard').innerHTML = html;
    setStatus(t('finalPlan.sharedReady', 'Фінальний план відкрито за секретним посиланням.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('finalPlan.sharedNotFound', 'Фінальний план не знайдено або посилання вже недійсне.'), 'error');
  }
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
