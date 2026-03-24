(function(){
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};
  const modal = document.getElementById('duplicateNickModal');
  if (!modal) return;

  const list = document.getElementById('duplicateNickModalList');
  const meta = document.getElementById('duplicateNickModalMeta');
  const hint = document.getElementById('duplicateNickModalHint');
  const shiftBadge = document.getElementById('duplicateNickModalShift');
  const status = document.getElementById('duplicateNickModalStatus');
  const keepOnlyBtn = document.getElementById('duplicateNickKeepOnlyBtn');
  const deleteCurrentBtn = document.getElementById('duplicateNickDeleteCurrentBtn');
  const subtitle = document.getElementById('duplicateNickModalSubtitle');
  let lastTrigger = null;

  const t = (key, fallback='') => typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback;
  const esc = (value) => typeof PNS.escapeHtml === 'function'
    ? PNS.escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch));

  function getLocale() {
    try {
      const locale = typeof window.PNSI18N?.getLocale === 'function'
        ? window.PNSI18N.getLocale()
        : (window.PNSI18N?.locale || document.documentElement.dataset.locale || document.documentElement.lang || 'uk');
      return String(locale || 'uk').toLowerCase() === 'ua' ? 'uk' : String(locale || 'uk').toLowerCase();
    } catch {}
    return 'uk';
  }

  function getIntlLocale() {
    const locale = getLocale();
    if (locale === 'en') return 'en-US';
    if (locale === 'ru') return 'ru-RU';
    return 'uk-UA';
  }

  function applyModalI18n() {
    try { window.PNSI18N?.apply?.(modal); } catch {}
  }

  function normalizeShiftLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(shift\s*1|зміна\s*1|смена\s*1)$/i.test(raw)) return t('shift1', 'Зміна 1');
    if (/^(shift\s*2|зміна\s*2|смена\s*2)$/i.test(raw)) return t('shift2', 'Зміна 2');
    if (/^(both|обидві|обе|оба)$/i.test(raw)) return t('both', 'Обидві');
    return raw;
  }

  function syncLock(){
    try { PNS.syncBodyModalLock?.(); } catch {}
  }

  function setStatus(message, kind='info') {
    if (!status) return;
    status.hidden = !message;
    status.classList.toggle('is-error', kind === 'error');
    status.textContent = message || '';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    setStatus('');
    syncLock();
    try { lastTrigger?.focus?.(); } catch {}
  }

  function openModal(nickKey, shift, trigger = null) {
    if (!nickKey) return;
    lastTrigger = trigger || document.activeElement;
    modal.dataset.duplicateNick = String(nickKey || '');
    modal.dataset.duplicateShift = String(shift || '');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setStatus('');
    render();
    syncLock();
    setTimeout(() => {
      try { modal.querySelector('input[name="duplicateKeepPlayer"]')?.focus?.(); } catch {}
    }, 30);
  }

  function getContextPlayers() {
    const key = String(modal.dataset.duplicateNick || '');
    const shift = String(modal.dataset.duplicateShift || '');
    if (!key) return [];
    return (PNS.getDuplicateNickBucket?.(key, shift) || []).slice();
  }

  function getSelectedKeepId() {
    return String(modal.querySelector('input[name="duplicateKeepPlayer"]:checked')?.value || '');
  }

  function renderEmpty() {
    const shift = String(modal.dataset.duplicateShift || '');
    if (shiftBadge) shiftBadge.textContent = normalizeShiftLabel(PNS.duplicateShiftLabel?.(shift) || shift || t('duplicate_records', 'Дублікати'));
    if (meta) meta.textContent = t('duplicate_resolved', 'Дублікати вже прибрано');
    if (subtitle) subtitle.textContent = t('duplicate_modal_subtitle', 'Подивись усі однакові реєстрації, залиш одного гравця й прибери зайві дублікати.');
    if (hint) hint.textContent = t('duplicate_modal_empty', 'Для цього ніку в поточній зміні вже залишився тільки один запис.');
    if (list) list.innerHTML = `<div class="muted">${esc(t('duplicate_modal_no_records', 'Зайвих дублікатів більше немає.'))}</div>`;
    if (keepOnlyBtn) keepOnlyBtn.disabled = true;
    if (deleteCurrentBtn) deleteCurrentBtn.disabled = true;
    applyModalI18n();
  }

  function render() {
    const shift = String(modal.dataset.duplicateShift || '');
    const players = getContextPlayers();
    if (!players.length || players.length === 1) {
      renderEmpty();
      return;
    }

    const currentKeep = getSelectedKeepId();
    const keepId = currentKeep && players.some(player => String(player?.id || '') === currentKeep)
      ? currentKeep
      : String(players[0]?.id || '');

    if (shiftBadge) shiftBadge.textContent = normalizeShiftLabel(PNS.duplicateShiftLabel?.(shift) || shift || t('duplicate_records', 'Дублікати'));
    if (meta) meta.textContent = `${players[0]?.name || ''} · ${players.length}×`;
    if (subtitle) subtitle.textContent = t('duplicate_modal_subtitle', 'Подивись усі однакові реєстрації, залиш одного гравця й прибери зайві дублікати.');
    if (hint) hint.textContent = t('duplicate_modal_hint', 'Вибери один запис, який треба залишити. Решту можна видалити одним кліком.');

    list.innerHTML = players.map((player, index) => {
      const playerId = String(player?.id || '');
      const isSelected = playerId === keepId;
      const regInfo = PNS.getPlayerRegistrationInfo?.(player) || { formatted: t('duplicate_unknown_time', 'Невідомо') };
      const effectiveShift = normalizeShiftLabel(player?.registeredShiftLabel || player?.shiftLabel || player?.registeredShift || player?.shift || '') || t('both', 'Обидві');
      const assigned = PNS.getPlayerPlacementLabel?.(player) || t('reserve', 'Резерв');
      return `
        <article class="duplicate-nick-record${isSelected ? ' is-selected' : ''}" data-duplicate-player-card="${esc(playerId)}">
          <label class="duplicate-nick-record__pick">
            <input type="radio" name="duplicateKeepPlayer" value="${esc(playerId)}"${isSelected ? ' checked' : ''}>
          </label>
          <div class="duplicate-nick-record__content">
            <div class="duplicate-nick-record__top">
              <div class="duplicate-nick-record__name">${esc(player?.name || '')}</div>
              <span class="duplicate-nick-record__badge">#${index + 1}</span>
              ${player?.assignment?.baseId ? `<span class="duplicate-nick-record__badge">${esc(t('duplicate_in_turret', 'У турелі'))}</span>` : ''}
            </div>
            <div class="duplicate-nick-record__grid">
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('duplicate_registered_at', 'Коли зареєструвався'))}</span>
                <span class="duplicate-nick-field__value">${esc(regInfo.formatted || t('duplicate_unknown_time', 'Невідомо'))}</span>
              </div>
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('shift', 'Зміна'))}</span>
                <span class="duplicate-nick-field__value">${esc(effectiveShift)}</span>
              </div>
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('alliance', 'Альянс'))}</span>
                <span class="duplicate-nick-field__value">${esc(player?.alliance || '—')}</span>
              </div>
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('duplicate_current_place', 'Де стоїть зараз'))}</span>
                <span class="duplicate-nick-field__value">${esc(assigned)}</span>
              </div>
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('tier', 'Тір'))}</span>
                <span class="duplicate-nick-field__value">${esc(player?.tier || '—')}</span>
              </div>
              <div class="duplicate-nick-field">
                <span class="duplicate-nick-field__label">${esc(t('march', 'Марш'))}</span>
                <span class="duplicate-nick-field__value">${esc(typeof PNS.formatNum === 'function' ? PNS.formatNum(player?.march || 0) : String(player?.march || 0))}</span>
              </div>
            </div>
          </div>
          <div class="duplicate-nick-record__actions">
            <button type="button" class="btn btn-sm" data-duplicate-open-edit="${esc(playerId)}">${esc(t('edit', 'Редагувати'))}</button>
            <button type="button" class="btn btn-sm btn-danger-soft" data-duplicate-delete-id="${esc(playerId)}">${esc(t('duplicate_delete_this', 'Видалити цей запис'))}</button>
          </div>
        </article>
      `;
    }).join('');

    if (keepOnlyBtn) keepOnlyBtn.disabled = false;
    if (deleteCurrentBtn) deleteCurrentBtn.disabled = false;
    applyModalI18n();
  }

  function handleKeepOnly() {
    const key = String(modal.dataset.duplicateNick || '');
    const shift = String(modal.dataset.duplicateShift || '');
    const keepId = getSelectedKeepId();
    const players = getContextPlayers();
    if (!key || !keepId || players.length < 2) {
      setStatus(t('duplicate_choose_keep', 'Спочатку вибери запис, який треба залишити.'), 'error');
      return;
    }
    const keepPlayer = players.find(player => String(player?.id || '') === keepId);
    const removed = PNS.removeDuplicatePlayersKeepOne?.(keepId, key, shift) || 0;
    if (!removed) {
      setStatus(t('duplicate_nothing_removed', 'Зайвих дублікатів для видалення не знайдено.'), 'error');
      render();
      return;
    }
    setStatus(`${t('duplicate_keep_done', 'Залишено один запис для')}: ${keepPlayer?.name || ''}. ${t('duplicate_removed_count', 'Видалено дублікатів')}: ${removed}.`);
    render();
  }

  function handleDeleteCurrent(playerId) {
    const id = String(playerId || getSelectedKeepId() || '');
    if (!id) {
      setStatus(t('duplicate_choose_entry', 'Вибери запис, який треба видалити.'), 'error');
      return;
    }
    const players = getContextPlayers();
    const player = players.find(item => String(item?.id || '') === id) || state.playerById?.get?.(id);

    const runDelete = () => {
      const removed = PNS.deletePlayersByIds?.([id]) || 0;
      if (!removed) {
        setStatus(t('duplicate_delete_failed', 'Не вдалося видалити вибраний запис.'), 'error');
        return;
      }
      setStatus(`${t('duplicate_delete_done', 'Запис видалено')}: ${player?.name || ''}.`);
      render();
    };

    const title = t('duplicate_delete_confirm', 'Видалити цей дублікат?');
    const message = player?.name
      ? `${t('duplicate_delete_confirm_message', 'Ти збираєшся видалити дубльований запис гравця')}: ${player.name}`
      : t('duplicate_delete_confirm_message_generic', 'Ти збираєшся видалити дубльований запис гравця.');
    const note = t(
      'duplicate_delete_confirm_note',
      'Запис буде прибрано з таблиці. Якщо цей гравець уже стоїть у турелі або резерві цієї зміни, його також буде знято звідти.'
    );

    const customConfirm = PNS.resetConfirm?.showResetConfirm;
    if (typeof customConfirm === 'function') {
      customConfirm({
        title,
        message,
        note,
        confirmText: t('duplicate_delete_this', 'Видалити цей запис'),
        cancelText: t('cancel', 'Скасувати')
      }, runDelete);
      return;
    }

    const fallbackText = [title, message, note].filter(Boolean).join('\n\n');
    if (!window.confirm(fallbackText)) return;
    runDelete();
  }

  document.addEventListener('click', function(ev){
    const openBtn = ev.target.closest('[data-duplicate-open="1"], .duplicate-nick-badge, #playersDataTable tbody tr.is-duplicate-nick td[data-field="name"], #playersDataTable tbody tr.is-duplicate-nick td:first-child');
    if (openBtn) {
      const row = openBtn.closest?.('tr[data-player-id]') || null;
      const player = row ? state.playerById?.get?.(String(row.dataset.playerId || '')) : null;
      const nickKey = String(openBtn.dataset.duplicateNick || player?.name || '');
      const shift = String(openBtn.dataset.duplicateShift || row?.dataset.duplicateShifts?.split(',')[0] || '');
      if (nickKey) {
        ev.preventDefault();
        openModal(nickKey, shift, openBtn);
        return;
      }
    }

    if (ev.target.closest('[data-duplicate-modal-close]')) {
      ev.preventDefault();
      closeModal();
      return;
    }

    const deleteBtn = ev.target.closest('[data-duplicate-delete-id]');
    if (deleteBtn) {
      ev.preventDefault();
      handleDeleteCurrent(deleteBtn.getAttribute('data-duplicate-delete-id') || '');
      return;
    }

    const editBtn = ev.target.closest('[data-duplicate-open-edit]');
    if (editBtn) {
      ev.preventDefault();
      const playerId = String(editBtn.getAttribute('data-duplicate-open-edit') || '');
      if (playerId) {
        closeModal();
        try { PNS.ModalsShift?.openRosterPlayerEditModal?.(playerId); } catch {}
      }
      return;
    }

    const record = ev.target.closest('[data-duplicate-player-card]');
    if (record && !ev.target.closest('button,input,label')) {
      const radio = record.querySelector('input[name="duplicateKeepPlayer"]');
      if (radio) {
        radio.checked = true;
        modal.querySelectorAll('.duplicate-nick-record').forEach(item => item.classList.toggle('is-selected', item === record));
      }
    }
  });

  modal.addEventListener('change', function(ev){
    if (ev.target && ev.target.matches('input[name="duplicateKeepPlayer"]')) {
      const selected = String(ev.target.value || '');
      modal.querySelectorAll('.duplicate-nick-record').forEach(item => item.classList.toggle('is-selected', item.dataset.duplicatePlayerCard === selected));
      setStatus('');
    }
  });

  keepOnlyBtn?.addEventListener('click', function(ev){
    ev.preventDefault();
    handleKeepOnly();
  });

  deleteCurrentBtn?.addEventListener('click', function(ev){
    ev.preventDefault();
    handleDeleteCurrent();
  });

  document.addEventListener('keydown', function(ev){
    if (ev.key === 'Escape' && modal.classList.contains('is-open')) {
      ev.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('pns:i18n-changed', function(){
    if (modal.classList.contains('is-open')) render();
    else applyModalI18n();
  });

  document.addEventListener('pns:assignment-changed', function(){
    if (modal.classList.contains('is-open')) render();
  });

  PNS.openDuplicateNickModal = openModal;
  PNS.closeDuplicateNickModal = closeModal;
})();
