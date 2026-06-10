import { resolveRegionFinalPlanShare } from '../services/region-db.js?v=127';
import { readShareCode, keepShareCodeInUrl, makePublicShareUrl } from '../core/share-links.js?v=89';

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
let currentShare = null;
let currentCode = '';
let ready = false;

function codeFromUrl() {
  return readShareCode('finalPlan', {
    blockedPathNames: ['p', 'public-plan'],
    pathRegex: /\/plan\/([A-Za-z0-9_-]{6,120})\/?$/
  });
}
function publicLink() {
  const code = currentCode || codeFromUrl();
  return code ? makePublicShareUrl('./public-plan.html', code) : window.location.href;
}
function setStatus(text, type = 'muted') {
  const box = $('#publicPlanStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function notify(text, type = 'success') {
  if (window.WKD?.showNotice) window.WKD.showNotice(text);
  else setStatus(text, type);
}
function sanitizeFinalHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  const sheets = [...template.content.querySelectorAll('.board-sheet')];
  if (!sheets.length) return '';
  const cleanSheets = sheets.slice(0, 6).map(sheet => {
    const copy = sheet.cloneNode(true);
    copy.querySelectorAll('script,iframe,object,embed,link,style').forEach(node => node.remove());
    copy.querySelectorAll('*').forEach(node => {
      [...node.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || attr.name === 'srcdoc') node.removeAttribute(attr.name);
        if ((attr.name === 'href' || attr.name === 'src') && /^javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
    });
    return copy.outerHTML;
  });
  return `<div class="wkd-final-share-stack" data-no-auto-i18n="1">${cleanSheets.join('')}</div>`;
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
function textContent() {
  return String(currentShare?.text || $('#publicPlanBoard')?.innerText || '').trim();
}
function downloadTxt() {
  const text = textContent();
  downloadBlob(`wasteland-final-plan-${Date.now()}.txt`, new Blob([text], { type: 'text/plain;charset=utf-8' }));
  notify(t('finalPlan.txtDownloaded', 'TXT завантажено.'));
}
async function sheetToPngBlob(sheet) {
  if (typeof window.html2canvas !== 'function' && typeof window.WKD?.ensureHtml2Canvas === 'function') await window.WKD.ensureHtml2Canvas();
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas-missing');
  const canvas = await window.html2canvas(sheet, { backgroundColor: '#eef2f8', scale: 3, useCORS: true });
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
async function pngFiles() {
  const sheets = $$('.board-sheet', $('#publicPlanBoard'));
  const files = [];
  let index = 1;
  for (const sheet of sheets) {
    const blob = await sheetToPngBlob(sheet);
    if (blob) files.push(new File([blob], `wasteland-final-plan-${index++}.png`, { type: 'image/png' }));
  }
  return files;
}
async function downloadPng() {
  const board = $('#publicPlanBoard');
  const sheets = $$('.board-sheet', board);
  if (!board || !sheets.length) return notify(t('finalPlan.sharedNotFound', 'Фінальний план не знайдено або посилання вже недійсне.'), 'error');
  const target = sheets.length === 1 ? sheets[0] : board;
  const blob = await sheetToPngBlob(target);
  if (blob) downloadBlob(`wasteland-final-plan-${Date.now()}.png`, blob);
  notify(t('finalPlan.pngDownloaded', 'PNG завантажено.'));
}
async function copyLink() {
  const link = publicLink();
  try { await navigator.clipboard.writeText(link); notify(t('finalPlan.linkCopied', 'Секретне посилання скопійовано.')); }
  catch { window.prompt(t('common.copyLinkPrompt', 'Скопіюй посилання:'), link); }
}
async function sharePlan() {
  const link = publicLink();
  const text = textContent();
  const title = currentShare?.title || 'Wasteland final plan';
  const files = [];
  try { files.push(...await pngFiles()); } catch (error) { console.warn('[WKD] public plan png share skipped:', error); }
  try { files.push(new File([text], 'wasteland-final-plan.txt', { type: 'text/plain' })); } catch (_error) {}
  const payload = { title, text: `${link}\n\n${text}`.trim(), url: link };
  if (files.length && navigator.canShare?.({ files })) payload.files = files;
  if (navigator.share) {
    try { await navigator.share(payload); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  await copyLink();
}
function bindActions() {
  $('#publicPlanDownloadPngBtn')?.addEventListener('click', () => downloadPng().catch(error => { console.error(error); notify(t('finalPlan.pngFailed', 'Не вдалося завантажити PNG.'), 'error'); }));
  $('#publicPlanDownloadTxtBtn')?.addEventListener('click', downloadTxt);
  $('#publicPlanCopyLinkBtn')?.addEventListener('click', () => copyLink().catch(console.error));
  $('#publicPlanShareBtn')?.addEventListener('click', () => sharePlan().catch(error => { console.error(error); notify(t('finalPlan.shareLinkFailed', 'Не вдалося створити секретне посилання.'), 'error'); }));
}
async function init() {
  if (ready) return;
  ready = true;
  bindActions();
  const code = codeFromUrl();
  currentCode = code;
  keepShareCodeInUrl('finalPlan', code);
  if (!code) {
    setStatus(t('finalPlan.sharedMissing', 'Секретне посилання неправильне або неповне.'), 'error');
    return;
  }
  try {
    const data = await resolveRegionFinalPlanShare(code);
    currentShare = data;
    $('#publicPlanRegion') && ($('#publicPlanRegion').textContent = data.region ? `R${data.region}` : 'R—');
    const html = sanitizeFinalHtml(data.html || '');
    if (!html) throw new Error('empty-plan');
    const board = $('#publicPlanBoard');
    if (board) {
      board.setAttribute('data-no-auto-i18n', '1');
      board.innerHTML = '';
      await new Promise(resolve => requestAnimationFrame(resolve));
      board.innerHTML = html;
    }
    $('#publicPlanActions') && ($('#publicPlanActions').hidden = false);
    setStatus(t('finalPlan.sharedReady', 'Фінальний план відкрито за секретним посиланням.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('finalPlan.sharedNotFound', 'Фінальний план не знайдено або посилання вже недійсне.'), 'error');
  }
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState !== 'loading') window.setTimeout(init, 0);
else document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
