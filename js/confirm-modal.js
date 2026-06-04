window.WKD = window.WKD || {};
WKD.confirmDialog = options => new Promise(resolve => {
  const modal = WKD.$('#confirmModal');
  if (!modal) return resolve(window.confirm(options?.title || window.WKD_t?.('confirm.title') || 'Confirm action?'));
  const title = WKD.$('#confirmTitle', modal);
  const message = WKD.$('#confirmMessage', modal);
  const note = WKD.$('#confirmNote', modal);
  const icon = WKD.$('#confirmIcon', modal);
  const accept = WKD.$('#confirmAcceptBtn', modal);
  title.textContent = options?.title || window.WKD_t?.('confirm.title') || 'Confirm action?';
  message.textContent = options?.message || window.WKD_t?.('confirm.message') || 'This action cannot be undone.';
  note.textContent = options?.note || window.WKD_t?.('confirm.note') || 'Check the data before confirming.';
  icon.textContent = options?.icon || '⚠';
  accept.textContent = options?.acceptText || window.WKD_t?.('common.confirm') || 'Confirm';
  WKD.$$('[data-confirm-cancel]', modal).forEach(btn => { btn.textContent = btn.classList.contains('confirm-backdrop') ? btn.textContent : (window.WKD_t?.('common.cancel') || 'Cancel'); });
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  const finish = value => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    accept.removeEventListener('click', onAccept);
    WKD.$$('[data-confirm-cancel]', modal).forEach(btn => btn.removeEventListener('click', onCancel));
    resolve(value);
  };
  const onAccept = () => finish(true);
  const onCancel = () => finish(false);
  accept.addEventListener('click', onAccept);
  WKD.$$('[data-confirm-cancel]', modal).forEach(btn => btn.addEventListener('click', onCancel));
});
