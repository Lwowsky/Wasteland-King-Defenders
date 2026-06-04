window.WKD = window.WKD || {};
WKD.$ = (selector, root = document) => root.querySelector(selector);
WKD.$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
WKD.escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
WKD.formatNumber = value => value ? new Intl.NumberFormat('en-US').format(value) : '—';
WKD.clean = value => String(value ?? '').trim();
WKD.showNotice = text => {
  const old = WKD.$('.notice');
  if (old) old.remove();
  const note = document.createElement('div');
  note.className = 'notice';
  note.textContent = text;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 2800);
};
