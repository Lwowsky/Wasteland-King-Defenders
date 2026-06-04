window.WKD = window.WKD || {};

(function () {
  const DUPLICATE_BADGE_TEXT = 'дубль';
  const REGISTRATION_DATE_LOCALE = 'uk-UA';
  let initialized = false;
  let activeNickKey = '';
  let selectedPlayerId = '';
  let editingPlayerId = '';
  let lastTrigger = null;
  let scheduled = 0;

  const roleOptions = [
    ['Fighter', 'Бійці'],
    ['Rider', 'Наїзники'],
    ['Shooter', 'Стрільці']
  ];
  const shiftOptions = [
    ['shift1', 'Зміна 1'],
    ['shift2', 'Зміна 2'],
    ['shift3', 'Зміна 3'],
    ['shift4', 'Зміна 4'],
    ['both', 'Обидві']
  ];

  function esc(value) {
    return WKD.escapeHtml ? WKD.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function clean(value) {
    return WKD.clean ? WKD.clean(value) : String(value ?? '').trim();
  }

  function normalizeNick(name) {
    let value = clean(name);
    if (!value) return '';
    try { value = value.normalize('NFKC'); } catch (_error) {}
    return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeShift(value) {
    const raw = clean(value).toLowerCase();
    if (/^(shift\s*)?1$|зміна\s*1|смена\s*1/.test(raw)) return 'shift1';
    if (/^(shift\s*)?2$|зміна\s*2|смена\s*2/.test(raw)) return 'shift2';
    if (/^(shift\s*)?3$|зміна\s*3|смена\s*3/.test(raw)) return 'shift3';
    if (/^(shift\s*)?4$|зміна\s*4|смена\s*4/.test(raw)) return 'shift4';
    if (/both|all|всі|обидві|обе/.test(raw)) return 'both';
    return raw || 'both';
  }

  function shiftLabel(shift) {
    return shiftOptions.find(option => option[0] === normalizeShift(shift))?.[1] || 'Обидві';
  }

  function roleLabel(role) {
    return roleOptions.find(option => option[0] === role)?.[1] || clean(role) || '—';
  }

  function toNumber(value) {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function makeFallbackId(player = {}, index = 0) {
    const seed = [player.name, player.alliance, player.shift, player.tier, player.march, player.rally, index]
      .map(value => String(value ?? '').trim().toLowerCase())
      .join('|');
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return `dup-${index + 1}-${Math.abs(hash).toString(36)}`;
  }

  function playerId(player, index = 0) {
    if (!player._rowId) player._rowId = makeFallbackId(player, index);
    return String(player._rowId);
  }

  function getPlayers() {
    return Array.isArray(WKD.state?.players) ? WKD.state.players : [];
  }

  function getEntries() {
    return getPlayers().map((player, index) => ({
      player,
      index,
      id: playerId(player, index),
      key: normalizeNick(player.name)
    })).filter(entry => entry.key);
  }

  function duplicateGroups() {
    const map = new Map();
    getEntries().forEach(entry => {
      const bucket = map.get(entry.key) || [];
      bucket.push(entry);
      map.set(entry.key, bucket);
    });
    return [...map.entries()]
      .filter(([, bucket]) => bucket.length > 1)
      .map(([key, bucket]) => ({ key, bucket }));
  }

  function duplicateKeySet() {
    return new Set(duplicateGroups().map(group => group.key));
  }

  function getBucket(key = activeNickKey) {
    const normalized = normalizeNick(key);
    if (!normalized) return [];
    return duplicateGroups().find(group => group.key === normalized)?.bucket || [];
  }

  function describeBucket(bucket = []) {
    const seen = new Set(bucket.map(entry => normalizeShift(entry.player.shift)));
    const ordered = ['shift1', 'shift2', 'shift3', 'shift4', 'both'].filter(shift => seen.has(shift));
    return ordered.length ? ordered.map(shiftLabel).join(' + ') : 'Дублікати';
  }

  function formattedDate(value) {
    if (!value && value !== 0) return 'Невідомо';
    let date = null;
    if (value?.seconds) date = new Date(Number(value.seconds) * 1000);
    else if (value instanceof Date) date = value;
    else if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 100000) {
      date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    } else if (typeof value === 'number' && Number.isFinite(value) && value > 1000000000) {
      date = new Date(value < 10000000000 ? value * 1000 : value);
    } else {
      const parsed = new Date(String(value).trim());
      if (!Number.isNaN(parsed.getTime()) && /\d/.test(String(value))) date = parsed;
    }
    if (date && !Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(REGISTRATION_DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }
    return clean(value) || 'Невідомо';
  }

  function placementLabel(player = {}) {
    return player.placement || player.assignmentLabel || 'Резерв';
  }

  function shouldPersist() {
    return (localStorage.getItem('wkd.players.sourceMode') || 'local') === 'local';
  }

  function saveIfNeeded() {
    if (shouldPersist()) WKD.saveJson?.(WKD.storageKeys.players, getPlayers());
  }

  function notifyChanged(kind = 'duplicates') {
    saveIfNeeded();
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: kind, persist: shouldPersist() } }));
  }

  function ensureBanner() {
    const panel = document.getElementById('playersPanel');
    if (!panel) return null;
    let banner = document.getElementById('playersDuplicateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'playersDuplicateBanner';
      banner.className = 'players-duplicate-banner';
      const stats = panel.querySelector('.stats-grid');
      (stats || panel.querySelector('.filters-card') || panel.firstElementChild)?.insertAdjacentElement(stats ? 'afterend' : 'beforebegin', banner);
    }
    return banner;
  }

  function renderBanner(groups = duplicateGroups()) {
    const banner = ensureBanner();
    if (!banner) return;
    if (!groups.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    const chips = groups
      .sort((a, b) => String(a.bucket[0]?.player?.name || '').localeCompare(String(b.bucket[0]?.player?.name || ''), 'uk', { numeric: true }))
      .slice(0, 32)
      .map(group => {
        const name = group.bucket[0]?.player?.name || group.key;
        return `<button type="button" class="players-duplicate-chip" data-duplicate-open="1" data-duplicate-nick="${esc(group.key)}">
          ${esc(name)} · ${esc(describeBucket(group.bucket))} · ${group.bucket.length}×
        </button>`;
      }).join('');
    banner.hidden = false;
    banner.innerHTML = `
      <div class="players-duplicate-banner__title">Знайдено повторювані ніки: ${groups.length}</div>
      <div class="players-duplicate-banner__text">Такі гравці підсвічені в таблиці. Відкрий дублікати, вибери правильний запис і видали зайві.</div>
      <div class="players-duplicate-banner__list">${chips}</div>
    `;
  }

  function applyTableMarks(groups = duplicateGroups()) {
    const duplicates = new Map(groups.map(group => [group.key, group]));
    document.querySelectorAll('#playersTbody tr[data-player-index]').forEach(row => {
      const index = Number(row.dataset.playerIndex);
      const player = getPlayers()[index];
      const nameCell = row.querySelector('td[data-field="name"]') || row.children[0];
      if (!nameCell || !player) return;
      nameCell.querySelectorAll('.duplicate-nick-badge').forEach(node => node.remove());
      row.classList.remove('is-duplicate-nick');
      row.removeAttribute('title');
      nameCell.classList.remove('is-duplicate-clickable');
      delete nameCell.dataset.duplicateNick;
      const key = normalizeNick(player.name);
      const group = duplicates.get(key);
      if (!group) return;
      row.classList.add('is-duplicate-nick');
      row.title = `Нік повторюється: ${describeBucket(group.bucket)}`;
      nameCell.classList.add('is-duplicate-clickable');
      nameCell.dataset.duplicateNick = key;
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'duplicate-nick-badge';
      badge.textContent = DUPLICATE_BADGE_TEXT;
      badge.dataset.duplicateNick = key;
      badge.setAttribute('aria-label', 'Відкрити дублікати цього ніку');
      nameCell.appendChild(badge);
    });
  }

  function applyDuplicateUi() {
    const groups = duplicateGroups();
    renderBanner(groups);
    applyTableMarks(groups);
    return groups;
  }

  function scheduleApplyDuplicateUi(delay = 0) {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => {
      scheduled = 0;
      applyDuplicateUi();
      if (activeNickKey && modal()?.classList.contains('is-open')) renderModal();
    }, delay);
  }

  function modal() { return document.getElementById('duplicateNickModal'); }
  function listEl() { return document.getElementById('duplicateNickModalList'); }
  function metaEl() { return document.getElementById('duplicateNickModalMeta'); }
  function shiftEl() { return document.getElementById('duplicateNickModalShift'); }
  function hintEl() { return document.getElementById('duplicateNickModalHint'); }
  function statusEl() { return document.getElementById('duplicateNickModalStatus'); }
  function keepOnlyBtn() { return document.getElementById('duplicateNickKeepOnlyBtn'); }
  function deleteCurrentBtn() { return document.getElementById('duplicateNickDeleteCurrentBtn'); }

  function setStatus(message = '', type = 'info') {
    const box = statusEl();
    if (!box) return;
    box.hidden = !message;
    box.classList.toggle('is-error', type === 'error');
    box.textContent = message;
  }

  function openModal(nickKey, trigger = null) {
    const key = normalizeNick(nickKey);
    if (!key) return;
    const root = modal();
    if (!root) return;
    activeNickKey = key;
    selectedPlayerId = getBucket(key)[0]?.id || '';
    editingPlayerId = '';
    lastTrigger = trigger || document.activeElement;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open', 'wkd-modal-open');
    setStatus('');
    renderModal();
    window.setTimeout(() => root.querySelector('input[name="duplicateKeepPlayer"]')?.focus?.(), 30);
  }

  function closeModal() {
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    if (!document.querySelector('.modal.is-open')) document.body.classList.remove('wkd-modal-open');
    activeNickKey = '';
    selectedPlayerId = '';
    editingPlayerId = '';
    setStatus('');
    try { lastTrigger?.focus?.(); } catch (_error) {}
  }

  function renderEmpty() {
    if (shiftEl()) shiftEl().textContent = 'Дублікати';
    if (metaEl()) metaEl().textContent = 'Дублікати вже прибрано';
    if (hintEl()) hintEl().textContent = 'Для цього ніку вже залишився тільки один запис.';
    if (listEl()) listEl().innerHTML = '<div class="duplicate-nick-empty muted">Зайвих дублікатів більше немає.</div>';
    if (keepOnlyBtn()) keepOnlyBtn().disabled = true;
    if (deleteCurrentBtn()) deleteCurrentBtn().disabled = true;
  }

  function renderModal() {
    const bucket = getBucket(activeNickKey);
    if (!bucket.length || bucket.length === 1) {
      renderEmpty();
      return;
    }
    if (!bucket.some(entry => entry.id === selectedPlayerId)) selectedPlayerId = bucket[0].id;
    if (shiftEl()) shiftEl().textContent = describeBucket(bucket);
    if (metaEl()) metaEl().textContent = `${bucket[0]?.player?.name || activeNickKey} · ${bucket.length}×`;
    if (hintEl()) hintEl().textContent = 'Вибери один запис, який треба залишити. Решту можна видалити одним кліком.';
    if (keepOnlyBtn()) keepOnlyBtn().disabled = false;
    if (deleteCurrentBtn()) deleteCurrentBtn().disabled = false;
    if (listEl()) listEl().innerHTML = bucket.map((entry, order) => (
      editingPlayerId === entry.id ? editTemplate(entry, order) : recordTemplate(entry, order)
    )).join('');
  }

  function fieldTemplate(label, value) {
    return `<div class="duplicate-nick-field"><span class="duplicate-nick-field__label">${esc(label)}</span><span class="duplicate-nick-field__value">${esc(value || '—')}</span></div>`;
  }

  function recordTemplate(entry, order) {
    const { player, id } = entry;
    const selected = id === selectedPlayerId;
    return `<article class="duplicate-nick-record${selected ? ' is-selected' : ''}" data-duplicate-player-card="${esc(id)}">
      <label class="duplicate-nick-record__pick">
        <input type="radio" name="duplicateKeepPlayer" value="${esc(id)}" ${selected ? 'checked' : ''}>
      </label>
      <div class="duplicate-nick-record__content">
        <div class="duplicate-nick-record__top">
          <div class="duplicate-nick-record__name">${esc(player.name)}</div>
          <span class="duplicate-nick-record__badge">#${order + 1}</span>
        </div>
        <div class="duplicate-nick-record__grid">
          ${fieldTemplate('Коли зареєструвався', formattedDate(player.registeredAt || player.createdAt || player.submittedAt || player.updatedAt))}
          ${fieldTemplate('Зміна', shiftLabel(player.shift))}
          ${fieldTemplate('Альянс', player.alliance)}
          ${fieldTemplate('Де стоїть зараз', placementLabel(player))}
          ${fieldTemplate('Тір', player.tier)}
          ${fieldTemplate('Марш', WKD.formatNumber ? WKD.formatNumber(player.march) : player.march)}
        </div>
      </div>
      <div class="duplicate-nick-record__actions">
        <button type="button" class="btn btn-sm" data-duplicate-edit-id="${esc(id)}">Редагувати</button>
        <button type="button" class="btn btn-sm btn-danger-soft" data-duplicate-delete-id="${esc(id)}">Видалити цей запис</button>
      </div>
    </article>`;
  }

  function optionList(options, current) {
    return options.map(([value, label]) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`).join('');
  }

  function editTemplate(entry, order) {
    const { player, id } = entry;
    const currentRole = roleOptions.some(([value]) => value === player.role) ? player.role : 'Fighter';
    const currentShift = shiftOptions.some(([value]) => value === normalizeShift(player.shift)) ? normalizeShift(player.shift) : 'both';
    return `<article class="duplicate-nick-record is-selected is-editing" data-duplicate-player-card="${esc(id)}">
      <label class="duplicate-nick-record__pick">
        <input type="radio" name="duplicateKeepPlayer" value="${esc(id)}" checked>
      </label>
      <div class="duplicate-nick-record__content">
        <div class="duplicate-nick-record__top">
          <div class="duplicate-nick-record__name">Редагування запису</div>
          <span class="duplicate-nick-record__badge">#${order + 1}</span>
        </div>
        <div class="duplicate-edit-grid">
          <label><span>Нік</span><input data-dup-edit="name" value="${esc(player.name)}"></label>
          <label><span>Альянс</span><input data-dup-edit="alliance" value="${esc(player.alliance)}"></label>
          <label><span>Тип військ</span><select data-dup-edit="role">${optionList(roleOptions, currentRole)}</select></label>
          <label><span>Тір</span><input data-dup-edit="tier" value="${esc(player.tier)}"></label>
          <label><span>Марш</span><input data-dup-edit="march" inputmode="numeric" value="${esc(player.march || '')}"></label>
          <label><span>Ралі</span><input data-dup-edit="rally" inputmode="numeric" value="${esc(player.rally || '')}"></label>
          <label><span>Зміна</span><select data-dup-edit="shift">${optionList(shiftOptions, currentShift)}</select></label>
          <label><span>Захоплення</span><input data-dup-edit="lair" value="${esc(player.lair || '')}"></label>
          <label class="duplicate-edit-check"><input type="checkbox" data-dup-edit="captain" ${player.captain ? 'checked' : ''}> <span>Капітан готовий</span></label>
        </div>
      </div>
      <div class="duplicate-nick-record__actions">
        <button type="button" class="btn btn-sm btn-primary" data-duplicate-save-edit="${esc(id)}">Зберегти</button>
        <button type="button" class="btn btn-sm" data-duplicate-cancel-edit>Скасувати</button>
        <button type="button" class="btn btn-sm btn-danger-soft" data-duplicate-delete-id="${esc(id)}">Видалити цей запис</button>
      </div>
    </article>`;
  }

  function setSelected(id) {
    selectedPlayerId = String(id || '');
    editingPlayerId = '';
    modal()?.querySelectorAll('.duplicate-nick-record').forEach(card => {
      card.classList.toggle('is-selected', card.dataset.duplicatePlayerCard === selectedPlayerId);
      const radio = card.querySelector('input[name="duplicateKeepPlayer"]');
      if (radio) radio.checked = card.dataset.duplicatePlayerCard === selectedPlayerId;
    });
    setStatus('');
  }

  function findEntry(id) {
    return getEntries().find(entry => entry.id === String(id || '')) || null;
  }

  function deleteErrorMessage(error) {
    const code = error?.message || String(error || '');
    if (code === 'region-delete-access-denied') return 'Видаляти записи з бази може тільки консул свого регіону, адмін або модератор.';
    if (code === 'region-delete-registration-only') return 'Цей запис прийшов з профілю гравця. Його не можна видалити як заявку з бази.';
    if (code === 'region-update-access-denied') return 'Редагувати таблицю регіону можуть консул або офіцер свого регіону, модератор чи адмін.';
    if (code === 'region-update-registration-only') return 'Цей запис прийшов з профілю гравця. Його не можна змінити як заявку з бази.';
    if (code === 'auth-required') return 'Для видалення з бази потрібно увійти в акаунт.';
    if (code === 'region-required') return 'Не знайдено номер регіону для видалення з бази.';
    return 'Не вдалося видалити запис. Перевір права доступу або права доступу.';
  }

  async function deletePlayersByIds(ids = []) {
    const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '')).filter(Boolean))];
    if (!wanted.length) return 0;

    if (typeof WKD.deletePlayersFromActiveSource === 'function') {
      const result = await WKD.deletePlayersFromActiveSource(wanted);
      if (result?.handled) return Number(result.removed) || 0;
    }

    const wantedSet = new Set(wanted);
    const before = getPlayers().length;
    WKD.state.players = getPlayers().filter((player, index) => !wantedSet.has(playerId(player, index)));
    const removed = before - WKD.state.players.length;
    if (removed) notifyChanged('duplicates-delete');
    return removed;
  }

  async function handleKeepOnly() {
    const bucket = getBucket(activeNickKey);
    if (!selectedPlayerId || bucket.length < 2) {
      setStatus('Спочатку вибери запис, який треба залишити.', 'error');
      return;
    }
    const idsToDelete = bucket.map(entry => entry.id).filter(id => id !== selectedPlayerId);
    let removed = 0;
    try {
      removed = await deletePlayersByIds(idsToDelete);
    } catch (error) {
      console.error(error);
      setStatus(deleteErrorMessage(error), 'error');
      renderModal();
      return;
    }
    if (!removed) {
      setStatus('Зайвих дублікатів для видалення не знайдено.', 'error');
      renderModal();
      return;
    }
    setStatus(`Залишено один запис. Видалено дублікатів: ${removed}.`);
    renderModal();
  }

  async function handleDelete(id = selectedPlayerId) {
    const entry = findEntry(id);
    if (!entry) {
      setStatus('Вибери запис, який треба видалити.', 'error');
      return;
    }
    const ok = await (WKD.confirmDialog?.({
      title: 'Видалити цей дублікат?',
      message: `Запис гравця «${entry.player.name}» буде прибрано з таблиці.`,
      note: 'Якщо треба залишити один правильний запис — вибери його і натисни «Залишити тільки вибраний».',
      acceptText: 'Видалити'
    }) ?? Promise.resolve(window.confirm('Видалити цей дублікат?')));
    if (!ok) return;
    let removed = 0;
    try {
      removed = await deletePlayersByIds([entry.id]);
    } catch (error) {
      console.error(error);
      setStatus(deleteErrorMessage(error), 'error');
      renderModal();
      return;
    }
    if (!removed) {
      setStatus('Не вдалося видалити вибраний запис.', 'error');
      return;
    }
    selectedPlayerId = getBucket(activeNickKey)[0]?.id || '';
    setStatus(`Запис видалено: ${entry.player.name}.`);
    renderModal();
  }

  async function saveEdit(id) {
    const entry = findEntry(id);
    const root = [...modal().querySelectorAll('[data-duplicate-player-card]')].find(card => card.dataset.duplicatePlayerCard === String(id));
    if (!entry || !root) return;
    const values = Object.fromEntries([...root.querySelectorAll('[data-dup-edit]')].map(input => [input.dataset.dupEdit, input.type === 'checkbox' ? input.checked : input.value]));
    const name = clean(values.name);
    if (!name) {
      setStatus('Нік не може бути пустим.', 'error');
      return;
    }
    const updated = {
      name,
      alliance: allianceTag3(values.alliance),
      role: values.role || entry.player.role,
      tier: clean(values.tier).toUpperCase() || entry.player.tier,
      march: toNumber(values.march),
      rally: toNumber(values.rally),
      shift: normalizeShift(values.shift),
      lair: clean(values.lair),
      captain: Boolean(values.captain)
    };
    try {
      if (typeof WKD.updatePlayerInActiveSource === 'function') {
        await WKD.updatePlayerInActiveSource(entry.id, updated);
      } else {
        Object.assign(entry.player, updated);
        notifyChanged('duplicates-edit');
      }
    } catch (error) {
      console.error(error);
      setStatus(deleteErrorMessage(error), 'error');
      return;
    }
    activeNickKey = normalizeNick(updated.name);
    selectedPlayerId = entry.id;
    editingPlayerId = '';
    setStatus('Запис оновлено.');
    renderModal();
  }

  function bindClicks() {
    document.addEventListener('click', event => {
      const openTarget = event.target.closest('[data-duplicate-open], .duplicate-nick-badge, td.is-duplicate-clickable');
      if (openTarget) {
        const nick = openTarget.dataset.duplicateNick;
        if (nick) {
          event.preventDefault();
          openModal(nick, openTarget);
          return;
        }
      }

      if (event.target.closest('[data-duplicate-modal-close]')) {
        event.preventDefault();
        closeModal();
        return;
      }

      const editBtn = event.target.closest('[data-duplicate-edit-id]');
      if (editBtn) {
        event.preventDefault();
        editingPlayerId = editBtn.dataset.duplicateEditId || '';
        selectedPlayerId = editingPlayerId;
        setStatus('');
        renderModal();
        return;
      }

      const saveBtn = event.target.closest('[data-duplicate-save-edit]');
      if (saveBtn) {
        event.preventDefault();
        saveEdit(saveBtn.dataset.duplicateSaveEdit || '');
        return;
      }

      if (event.target.closest('[data-duplicate-cancel-edit]')) {
        event.preventDefault();
        editingPlayerId = '';
        renderModal();
        return;
      }

      const deleteBtn = event.target.closest('[data-duplicate-delete-id]');
      if (deleteBtn) {
        event.preventDefault();
        handleDelete(deleteBtn.dataset.duplicateDeleteId || '');
        return;
      }

      const card = event.target.closest('[data-duplicate-player-card]');
      if (card && modal()?.contains(card) && !event.target.closest('button,input,select,label')) {
        event.preventDefault();
        setSelected(card.dataset.duplicatePlayerCard || '');
      }
    });

    modal()?.addEventListener('change', event => {
      if (event.target.matches('input[name="duplicateKeepPlayer"]')) setSelected(event.target.value);
    });

    keepOnlyBtn()?.addEventListener('click', event => {
      event.preventDefault();
      handleKeepOnly();
    });

    deleteCurrentBtn()?.addEventListener('click', event => {
      event.preventDefault();
      handleDelete(selectedPlayerId);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal()?.classList.contains('is-open')) {
        event.preventDefault();
        closeModal();
      }
    });
  }

  WKD.initDuplicateNickModal = () => {
    if (initialized || !modal()) return;
    initialized = true;
    bindClicks();
    applyDuplicateUi();
    document.addEventListener('wkd:players-rendered', () => scheduleApplyDuplicateUi(20));
    document.addEventListener('wkd:players-updated', () => scheduleApplyDuplicateUi(30));
  };

  WKD.normalizeDuplicateNick = normalizeNick;
  WKD.getDuplicateNicknameGroups = duplicateGroups;
  WKD.applyDuplicateNicknameUi = applyDuplicateUi;
  WKD.openDuplicateNickModal = openModal;
})();
