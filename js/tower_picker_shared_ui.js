(function () {
  const PNS = window.PNS = window.PNS || {};
  const UI = PNS.TowerPickerSharedUI = PNS.TowerPickerSharedUI || {};

  function esc(v) {
    if (typeof PNS.escapeHtml === 'function') return PNS.escapeHtml(String(v ?? ''));
    return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  function renderDataAttrs(attrs) {
    return Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  }

  function renderCaptainOptions(options, selectedId) {
    return (options || []).map((p) => {
      const id = String(p?.id ?? '');
      const shiftLabel = String(p?.shiftLabel || p?.shift || '');
      const label = `${String(p?.name || '')} · ${String(p?.role || '')} · ${shiftLabel} · ${fmt(p?.march)}${p?.captainReady ? ' · CAP' : ''}`;
      return `<option value="${esc(id)}" ${String(selectedId || '') === id ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }

  function renderSuggestions(players) {
    return (players || []).slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))).map((p) => {
      const label = `${String(p?.alliance || '')} · ${String(p?.role || '')} · ${String(p?.tier || '')} · ${fmt(p?.march)}`;
      return `<option value="${esc(String(p?.name || ''))}" label="${esc(label)}"></option>`;
    }).join('');
  }

  UI.renderTowerPickerListItem = function renderTowerPickerListItem(model) {
    const id = String(model?.id || '');
    const attrName = String(model?.attrName || 'data-pick-tower-id');
    const attrs = { [attrName]: id, ...(model?.attrs || {}) };
    const done = !!model?.done;
    const playersCount = Number(model?.playersCount || 0) || 0;
    const statusIcon = done ? '✓' : '!';
    const statusLabel = done ? 'Готова' : 'Без капітана';
    const countCls = done ? 'is-ready' : 'is-not-ready';
    return `<button type="button" class="btn btn-sm tower-picker-item ${model?.active ? 'active ' : ''}${done ? 'is-ready tower-done' : 'is-not-ready'}"${renderDataAttrs(attrs)}><div class="tower-item-row"><strong>${esc(model?.title || '')}</strong><span class="tower-item-status" aria-hidden="true">${statusIcon}</span></div><span class="muted small">${statusLabel} · <span class="tower-item-count ${countCls}">гравців: ${playersCount}</span></span></button>`;
  };

  UI.renderTowerPickerDetail = function renderTowerPickerDetail(model) {
    const wrapperAttrs = renderDataAttrs(model?.wrapperAttrs || {});
    const captain = model?.captain || null;
    const memberRows = model?.memberRows || [];
    const selectedCaptainId = captain ? String(captain.id || '') : '';
    const captainOptions = renderCaptainOptions(model?.captainOptions || [], selectedCaptainId);
    const suggestions = renderSuggestions(model?.playersForSuggestions || []);
    const checkboxes = (model?.checkboxes || []).filter(Boolean).map((cb) => (
      `<label class="picker-only-captains"><input type="checkbox" id="${esc(cb.id)}" ${cb.checked ? 'checked' : ''}/> ${esc(cb.label)}</label>`
    )).join('');
    const rightText = esc(model?.membersRightText || (captain ? 'Капітан + гравці' : 'Без капітана'));
    const manualSummary = esc(model?.manualSummary || 'Додати гравця вручну');
    const rallyLabel = esc(model?.rallyLabel || 'Розмір ралі');
    const rallyPlaceholder = esc(model?.manualRallyPlaceholder || rallyLabel);
    const addManualLabel = esc(model?.manualAddLabel || 'Додати гравця');
    const addManualCaptainLabel = esc(model?.manualCaptainLabel || 'Поставити капітана');
    const noRowsHtml = `<tr><td colspan="6" class="muted">${esc(model?.emptyMembersText || 'Немає призначених гравців')}</td></tr>`;
    const rowsHtml = memberRows.map((row) => (
      `<tr><td>${esc(row?.name || '')}</td><td>${esc(row?.alliance || '')}</td><td>${esc(row?.role || '')}</td><td>${esc(row?.tier || '')}</td><td>${esc(row?.marchDisplay || '')}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${esc(row?.id || '')}" data-picker-edit-base="${esc(model?.baseId || '')}">✎</button></td></tr>`
    )).join('') || noRowsHtml;
    const maxHelpers = Number(model?.rule?.maxHelpers || 0) || 0;
    const tierMinМарш = model?.rule?.tierMinМарш || {};
    return `
      <div class="stack tower-picker-scope"${wrapperAttrs}>
        <h3>${esc(model?.title || '')}</h3>
        <div class="picker-meta-row muted small"><span class="picker-meta-shift">Shift: ${esc(model?.shiftLabel || '')}</span>${checkboxes}</div>
        <div class="picker-topline top-space"><select id="towerPickerCaptainSelect" class="input-like" aria-label="Вибір капітана"><option value="">${captain ? 'Змінити капітана…' : 'Вибрати капітана…'}</option>${captainOptions}</select><div class="picker-actions"><button class="btn btn-sm" type="button" data-picker-set-captain="${esc(model?.baseId || '')}">Поставити капітана</button><button class="btn btn-sm" type="button" data-picker-autofill="${esc(model?.baseId || '')}">Автозаповнення</button><button class="btn btn-sm" type="button" data-picker-clear-base="${esc(model?.baseId || '')}">Очистити турель</button><button class="btn btn-sm" type="button" data-picker-save-board="${esc(model?.baseId || '')}">Зберегти таблицю турелі</button></div></div>
        <div class="limit-grid limit-grid-compact top-space"><div><span>Марш капітана</span><strong>${fmt(model?.stats?.captainМарш)}</strong></div><div><span>${rallyLabel}</span><strong>${fmt(model?.stats?.rallySize)}</strong></div><div><span>Разом</span><strong>${fmt(model?.stats?.total)}</strong></div><div><span>Вільне місце</span><strong>${fmt(model?.stats?.free)}</strong></div></div>
        <details class="tower-collapsible top-space" id="towerPickerLimitsBlock"><summary>Налаштування турелі · ліміти по тірах (макс. марш)</summary><div class="inner stack"><div class="picker-limits-head"><label><span class="muted small">Макс. гравців</span><input id="pickerMaxHelpers" type="number" min="0" value="${maxHelpers}" /></label><button class="btn btn-sm" type="button" data-picker-save-rule="${esc(model?.baseId || '')}">Зберегти ліміти</button><button class="btn btn-sm" type="button" data-picker-recalc-rule="${esc(model?.baseId || '')}">Перерахувати склад</button><button class="btn btn-sm" type="button" data-picker-reset-rule="${esc(model?.baseId || '')}">Скинути ліміти (T14–T9 → 0)</button></div><div class="row gap wrap">${['T14','T13','T12','T11','T10','T9'].map(t => `<label><span class="muted small">${t}</span><input type="number" min="0" data-picker-tier="${t}" value="${Number(tierMinМарш?.[t] || 0) || 0}" style="width:90px" /></label>`).join('')}</div><div class="muted small">0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.</div></div></details>
        <details class="tower-collapsible" id="towerPickerManualBlock"><summary>${manualSummary}</summary><div class="inner stack"><div class="picker-manual-row"><input id="pickerManualSearch" list="pickerManualГравецьSuggestions" placeholder="Пошук гравця (зі списку)" autocomplete="off" spellcheck="false" /><input id="pickerManualName" placeholder="Нік (можна свій, не зі списку)" autocomplete="off" /><datalist id="pickerManualГравецьSuggestions">${suggestions}</datalist><input id="pickerManualАльянс" placeholder="Альянс" /><select id="pickerManualРоль"><option>Fighter</option><option>Shooter</option><option>Rider</option></select></div><div id="pickerManualHint" class="picker-manual-hint muted small"></div><div class="picker-manual-row2"><input id="pickerManualТір" placeholder="T14" /><input id="pickerManualМарш" placeholder="Марш" type="number" min="0" /><input id="pickerManualRally" placeholder="${rallyPlaceholder}" type="number" min="0" /><button class="btn btn-sm" type="button" data-picker-add-manual-captain="${esc(model?.baseId || '')}">${addManualCaptainLabel}</button><button class="btn btn-sm" type="button" data-picker-add-manual="${esc(model?.baseId || '')}">${addManualLabel}</button></div></div></details>
        <div class="panel subpanel" style="padding:10px"><div class="row gap wrap" style="justify-content:space-between"><strong>Гравці в турелі</strong><span class="muted small">${rightText}</span></div><div class="helpers-table-wrap top-space"><table class="mini-table"><thead><tr><th>Гравець</th><th>Альянс</th><th>Роль</th><th>Тір</th><th>Марш</th><th>✎</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div>
      </div>`;
  };
})();
