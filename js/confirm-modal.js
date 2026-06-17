window.WKD = window.WKD || {};
WKD.confirmDialog = options => new Promise(resolve => {
  const modal = WKD.$('#confirmModal');
  if (!modal) return resolve(window.confirm(options?.title || window.WKD_t?.('confirm.title') || 'Confirm action?'));
  const title = WKD.$('#confirmTitle', modal);
  const message = WKD.$('#confirmMessage', modal);
  const note = WKD.$('#confirmNote', modal);
  const icon = WKD.$('#confirmIcon', modal);
  const accept = WKD.$('#confirmAcceptBtn', modal);
  const inputWrap = WKD.$('#confirmInputWrap', modal);
  const inputLabel = WKD.$('#confirmInputLabel', modal);
  const input = WKD.$('#confirmInput', modal);
  const inputHint = WKD.$('#confirmInputHint', modal);

  title.textContent = options?.title || window.WKD_t?.('confirm.title') || 'Confirm action?';
  message.textContent = options?.message || window.WKD_t?.('confirm.message') || 'This action cannot be undone.';
  const noteText = options?.note === '' ? '' : (options?.note || window.WKD_t?.('confirm.note') || 'Check the data before confirming.');
  note.textContent = noteText;
  note.hidden = noteText === '';
  icon.textContent = options?.icon || '⚠';
  accept.removeAttribute('data-i18n');
  accept.textContent = options?.acceptText || window.WKD_t?.('common.confirm') || 'Confirm';
  accept.className = options?.acceptClass || 'btn btn-danger-solid';

  const requiredText = String(options?.confirmText || '').trim();
  if (inputWrap && input && inputLabel && inputHint) {
    if (requiredText) {
      inputWrap.hidden = false;
      inputLabel.textContent = options?.inputLabel || window.WKD_t?.('confirm.typeToConfirm') || 'Type confirmation';
      input.placeholder = options?.inputPlaceholder || requiredText;
      input.value = '';
      inputHint.textContent = options?.inputHint || window.WKD_t?.('confirm.typeToConfirmHint') || 'Type the required word to confirm the action.';
      accept.disabled = true;
    } else {
      inputWrap.hidden = true;
      input.value = '';
      input.placeholder = '';
      accept.disabled = false;
    }
  }

  WKD.$$('[data-confirm-cancel]', modal).forEach(btn => {
    if (!btn.classList.contains('confirm-backdrop')) btn.removeAttribute('data-i18n');
    btn.textContent = btn.classList.contains('confirm-backdrop') ? btn.textContent : (options?.cancelText || window.WKD_t?.('common.cancel') || 'Cancel');
  });
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  const syncConfirmState = () => {
    if (!requiredText || !input) {
      accept.disabled = false;
      return;
    }
    accept.disabled = input.value.trim() !== requiredText;
  };

  const finish = value => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    accept.removeEventListener('click', onAccept);
    WKD.$$('[data-confirm-cancel]', modal).forEach(btn => btn.removeEventListener('click', onCancel));
    input?.removeEventListener('input', onInput);
    if (inputWrap) inputWrap.hidden = true;
    if (input) {
      input.value = '';
      input.placeholder = '';
    }
    accept.disabled = false;
    resolve(value);
  };
  const onAccept = () => finish(true);
  const onCancel = () => finish(false);
  const onInput = () => syncConfirmState();
  accept.addEventListener('click', onAccept);
  WKD.$$('[data-confirm-cancel]', modal).forEach(btn => btn.addEventListener('click', onCancel));
  input?.addEventListener('input', onInput);
  syncConfirmState();
  if (requiredText && input) setTimeout(() => input.focus(), 10);
});


WKD.actionDoneDialog = async options => {
  const goHome = await WKD.confirmDialog({
    title: options?.title || window.WKD_t?.('common.done') || 'Done',
    message: options?.message || '',
    note: options?.note ?? '',
    icon: options?.icon || '✅',
    acceptText: options?.acceptText || window.WKD_t?.('common.goHome') || 'Go to main page',
    cancelText: options?.cancelText || window.WKD_t?.('common.continue') || window.WKD_t?.('common.stayHere') || 'Continue',
    acceptClass: options?.acceptClass || 'btn btn-success-solid'
  });
  if (goHome) window.location.href = options?.href || 'index.html';
  return goHome;
};
