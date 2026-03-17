/* Final plan preview and board rendering helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const ModalsShift = PNS.ModalsShift = PNS.ModalsShift || {};
  const state = PNS.state = PNS.state || {};

  function escapeHtml(value) {
    return (PNS.escapeHtml || (v => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))))(String(value ?? ''));
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function roleNorm(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized.includes('fight')) return 'fighter';
    if (normalized.includes('rid')) return 'rider';
    if (normalized.includes('shoot') || normalized.includes('arch')) return 'shooter';
    return '';
  }

  function shiftLabel(shift) {
    try {
      return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : String(shift || '');
    } catch {
      return String(shift || '');
    }
  }

  function roleLabel(role, short = false) {
    try {
      return typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role, short) : String(role || '');
    } catch {
      return String(role || '');
    }
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcState === 'function') return window.getCalcState();
    } catch {}
    state.towerCalc = state.towerCalc && typeof state.towerCalc === 'object' ? state.towerCalc : {};
    return state.towerCalc;
  }

  function persistCalcState(calcState) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(calcState));
    } catch {}
  }

  function getBoardLanguageText(key, fallback, locale) {
    try {
      return typeof window.getBoardLanguageText === 'function'
        ? window.getBoardLanguageText(key, fallback, locale)
        : String(fallback || '');
    } catch {
      return String(fallback || '');
    }
  }

  function mapBoardLanguageText(mapper) {
    try {
      return typeof window.mapBoardLanguageText === 'function' ? window.mapBoardLanguageText(mapper) : '';
    } catch {
      return '';
    }
  }

  function getBoardLanguageTextMulti(key, fallback) {
    try {
      return typeof window.getBoardLanguageTextMulti === 'function'
        ? window.getBoardLanguageTextMulti(key, fallback)
        : String(fallback || '');
    } catch {
      return String(fallback || '');
    }
  }

  function renderBoardLanguagePickerMarkup(kind) {
    try {
      return typeof window.renderBoardLanguagePickerMarkup === 'function'
        ? window.renderBoardLanguagePickerMarkup(kind)
        : '';
    } catch {
      return '';
    }
  }

  function getBaseSlots() {
    const bases = [];
    try {
      (ModalsShift.getTowerCards?.() || []).forEach(card => {
        const baseId = String(card?.dataset?.baseId || card?.dataset?.baseid || '');
        if (baseId && !bases.includes(baseId)) bases.push(baseId);
      });
    } catch {}
    if (!bases.length) {
      for (const base of state.bases || []) {
        const baseId = String(base?.id || '');
        if (baseId && !bases.includes(baseId)) bases.push(baseId);
      }
    }
    return bases.slice(0, 5).map(baseId => state.baseById?.get?.(baseId) || { id: baseId, title: baseId });
  }

  function getShiftBaseAssignments(shift) {
    (function ensureShiftPlans() {
      try { ModalsShift.saveCurrentShiftPlanSnapshot?.(); } catch {}
      try { state.shiftPlans = state.shiftPlans || {}; } catch {}
      return state.shiftPlans;
    })();
    const slots = getBaseSlots();
    const planBases = state.shiftPlans?.[shift]?.bases || {};
    return slots.map((base, index) => {
      const liveBase = state.baseById?.get?.(base?.id || '');
      const saved = planBases?.[base?.id] || {};
      const isActiveShift = String(state.activeShift || '') === String(shift || '');
      const captainId = String((saved.captainId ?? (isActiveShift ? liveBase?.captainId : null)) || '');
      const helperIds = Array.isArray(saved.helperIds)
        ? saved.helperIds
        : (isActiveShift && Array.isArray(liveBase?.helperIds) ? liveBase.helperIds : []);
      const role = saved.role || (isActiveShift ? liveBase?.role : null) || base?.role || null;
      return {
        index,
        baseId: String(base?.id || ''),
        title: String(base?.title || base?.id || `${tr('turret', 'Турель')} ${index + 1}`),
        captainId,
        helperIds: helperIds.slice ? helperIds.slice() : [],
        helperCount: Array.isArray(helperIds) ? helperIds.length : 0,
        role
      };
    });
  }

  function getBoardAssignedMarch(baseLike, player, shift) {
    if (!player) return 0;
    const playerMarch = Math.max(0, Number(player.march || 0) || 0);
    try {
      if (baseLike?.captainId && String(baseLike.captainId) === String(player.id)) return playerMarch;
    } catch {}
    try {
      const override = PNS.getTowerMarchOverride?.(baseLike?.id, player?.id, shift);
      if (Number.isFinite(override) && override >= 0) return Math.max(0, Number(override) || 0);
    } catch {}
    const tierCap = Math.max(0, Number(baseLike?.tierMinMarch?.[String(player.tier || '').toUpperCase()] || 0) || 0);
    return tierCap > 0 ? Math.min(playerMarch, tierCap) : playerMarch;
  }

  function resolveBoardTowerState(base, shift) {
    const linked = getShiftBaseAssignments(shift).find(item => String(item?.baseId || '') === String(base?.id || '')) || {
      baseId: String(base?.id || ''),
      title: String(base?.title || base?.id || ''),
      captainId: '',
      helperIds: [],
      role: base?.role || null
    };
    const savedRule = (typeof PNS.getBaseTowerRule === 'function' && PNS.getBaseTowerRule(String(base?.id || ''), { shift })) || {};
    const baseLike = {
      id: String(base?.id || ''),
      title: String(base?.title || base?.id || ''),
      captainId: String(linked?.captainId || ''),
      helperIds: Array.isArray(linked?.helperIds) ? linked.helperIds.slice() : [],
      role: linked?.role || base?.role || null,
      maxHelpers: Number(savedRule?.maxHelpers ?? base?.maxHelpers ?? 29) || 29,
      tierMinMarch: {
        T14: Number(savedRule?.tierMinMarch?.T14 ?? base?.tierMinMarch?.T14 ?? 0) || 0,
        T13: Number(savedRule?.tierMinMarch?.T13 ?? base?.tierMinMarch?.T13 ?? 0) || 0,
        T12: Number(savedRule?.tierMinMarch?.T12 ?? base?.tierMinMarch?.T12 ?? 0) || 0,
        T11: Number(savedRule?.tierMinMarch?.T11 ?? base?.tierMinMarch?.T11 ?? 0) || 0,
        T10: Number(savedRule?.tierMinMarch?.T10 ?? base?.tierMinMarch?.T10 ?? 0) || 0,
        T9: Number(savedRule?.tierMinMarch?.T9 ?? base?.tierMinMarch?.T9 ?? 0) || 0
      }
    };
    const captain = baseLike.captainId ? state.playerById?.get?.(baseLike.captainId) : null;
    const helpers = (Array.isArray(baseLike.helperIds) ? baseLike.helperIds : []).map(id => state.playerById?.get?.(id)).filter(Boolean);
    const captainMarch = Math.max(0, Number(captain?.march || 0) || 0);
    const rallySize = Math.max(0, Number(captain?.rally || 0) || 0);
    const helpersTotal = helpers.reduce((sum, helper) => sum + getBoardAssignedMarch(baseLike, helper, shift), 0);
    const total = captainMarch + helpersTotal;
    const capacityTotal = captainMarch + rallySize;
    const free = Math.max(0, capacityTotal - total);
    return {
      captain,
      helpers,
      rule: { maxHelpers: baseLike.maxHelpers, tierMinMarch: { ...(baseLike.tierMinMarch || {}) } },
      captainMarch,
      rallySize,
      helpersTotal,
      total,
      capacityTotal,
      free,
      baseLike
    };
  }

  function renderBoardSheet(shift) {
    shiftLabel(shift);
    const colsHtml = getBaseSlots()
      .map(base => state.baseById?.get?.(String(base?.id || '')) || base)
      .filter(Boolean)
      .map((base, index) => {
        const boardState = resolveBoardTowerState(base, shift);
        const captain = boardState.captain;
        const helpers = boardState.helpers.slice().sort((left, right) =>
          Number(right.tierRank || 0) - Number(left.tierRank || 0)
          || Number(right.march || 0) - Number(left.march || 0)
          || String(left.name || '').localeCompare(String(right.name || ''))
        );
        const troopTheme = String(roleNorm(captain?.role) || '').toLowerCase();
        const subtitle = escapeHtml(captain
          ? mapBoardLanguageText(locale => {
              const normalizedRole = String(roleNorm(String(captain.role || '')) || '').toLowerCase();
              const key = normalizedRole === 'fighter'
                ? 'fighter_plural'
                : normalizedRole === 'rider'
                  ? 'rider_plural'
                  : normalizedRole === 'shooter'
                    ? 'shooter_plural'
                    : '';
              return key ? getBoardLanguageText(key, String(captain.role || ''), locale) : String(captain.role || '');
            })
          : getBoardLanguageTextMulti('type_defined_by_captain', tr('type_defined_by_captain', 'Тип визначається капітаном')));
        const modClass = captain ? ` ${troopTheme}-theme` : ' is-auto';
        const title = escapeHtml(mapBoardLanguageText(locale => {
          const raw = String(base.title || base.id || `${tr('turret', 'Турель')} ${index + 1}`);
          const lower = raw.toLowerCase();
          let key = '';
          if (/техно|hub|central/.test(lower)) key = 'hub';
          else if (/північ|north|север/.test(lower)) key = 'north_turret';
          else if (/захід|west|запад/.test(lower)) key = 'west_turret';
          else if (/схід|east|вост/.test(lower)) key = 'east_turret';
          else if (/півден|south|юж/.test(lower)) key = 'south_turret';
          return key ? getBoardLanguageText(key, raw, locale) : raw;
        }));
        const rows = [];
        if (captain) {
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-captain-row', {
            name: escapeHtml(String(captain.name || '')),
            alliance: escapeHtml(String(captain.alliance || '')),
            tier: escapeHtml(String(captain.tier || '')),
            march: formatNumber(boardState.captainMarch)
          }));
        }
        helpers.forEach(helper => {
          const assignedMarch = getBoardAssignedMarch(boardState.baseLike, helper, shift);
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-helper-row', {
            name: escapeHtml(String(helper.name || '')),
            alliance: escapeHtml(String(helper.alliance || '')),
            tier: escapeHtml(String(helper.tier || '')),
            march: formatNumber(assignedMarch)
          }));
        });
        if (!rows.length) {
          rows.push(PNS.renderHtmlTemplate('tpl-board-col-empty-row', {
            message: escapeHtml(getBoardLanguageTextMulti('no_assigned_players', tr('no_assigned_players', 'Немає призначених гравців')))
          }));
        }
        return PNS.renderHtmlTemplate('tpl-board-col', {
          mod_class: modClass,
          shift: escapeHtml(shift),
          base_id: escapeHtml(String(base.id || '')),
          title,
          auto_class: captain ? '' : ' is-auto',
          sub_text: captain ? subtitle : escapeHtml(getBoardLanguageTextMulti('type_defined_by_captain', tr('type_defined_by_captain', 'Тип визначається капітаном'))),
          cap_total: formatNumber(boardState.capacityTotal),
          cap_free: formatNumber(boardState.free),
          cap_used: formatNumber(boardState.total),
          rows_html: rows.join('')
        });
      })
      .join('');

    return PNS.renderHtmlTemplate('tpl-board-sheet', {
      title: escapeHtml((function renderSheetTitle(targetShift) {
        const normalized = String(targetShift || '').toLowerCase() === 'shift1' ? 'shift1' : 'shift2';
        return mapBoardLanguageText(locale => {
          const shiftText = getBoardLanguageText(normalized, normalized, locale);
          const halfText = getBoardLanguageText(normalized === 'shift1' ? 'first_half' : 'second_half', '', locale);
          return halfText ? `${shiftText} • ${halfText}` : shiftText;
        });
      })(shift)),
      cols_html: colsHtml
    });
  }

  function setCalcPreviewShift(shift) {
    const calcState = getCalcState();
    calcState.previewShift = String(shift || '').toLowerCase() === 'shift1' ? 'shift1' : 'shift2';
    persistCalcState(calcState);
    return calcState.previewShift;
  }

  function renderLiveFinalBoard(modal) {
    const target = (modal || document.getElementById('towerCalcModal'))?.querySelector?.('#towerCalcGlobalOut');
    if (!target) return;
    const calcState = getCalcState();
    const activeShift = window.PNS?.state?.activeShift;
    const previewShift = String((calcState.previewShift === 'shift1' || calcState.previewShift === 'shift2') ? calcState.previewShift : ((activeShift === 'shift1' || activeShift === 'shift2') ? activeShift : 'shift1')).toLowerCase() === 'shift2'
      ? 'shift2'
      : 'shift1';
    if (calcState.previewShift !== previewShift) {
      calcState.previewShift = previewShift;
      persistCalcState(calcState);
    }
    target.innerHTML = window.renderHtmlTemplate('tpl-tower-calc-preview', {
      shift1_active: previewShift === 'shift1' ? 'active' : '',
      shift2_active: previewShift === 'shift2' ? 'active' : '',
      shift1_text: shiftLabel('shift1'),
      shift2_text: shiftLabel('shift2'),
      lang_picker_html: renderBoardLanguagePickerMarkup('calc'),
      export_png_text: tr('export_png', 'Завантажити PNG'),
      export_txt_text: tr('export_txt', 'TXT'),
      share_text: tr('final_plan_share', 'Поділитися'),
      status_text: tr('final_plan_status', 'Фінальний план'),
      shift_text: shiftLabel(previewShift),
      sheet_html: renderBoardSheet(previewShift)
    });
    try { target.querySelector('.tower-calc-preview-toolbar')?.scrollTo?.({ left: 0, top: 0 }); } catch {}
  }

  function renderStandaloneFinalBoard(modal) {
    const root = modal || document.getElementById('board-modal');
    if (!root) return false;
    const toolbar = root.querySelector('.tower-calc-preview-toolbar');
    const status = root.querySelector('#boardPreviewStatus');
    const sheet = root.querySelector('#boardModalPreviewSheet');
    if (!toolbar || !status || !sheet) return false;

    const calcState = getCalcState();
    const previewShift = String((calcState.previewShift === 'shift1' || calcState.previewShift === 'shift2') ? calcState.previewShift : (state.activeShift || 'shift1')).toLowerCase() === 'shift2' ? 'shift2' : 'shift1';
    calcState.previewShift = previewShift;
    persistCalcState(calcState);

    toolbar.innerHTML = window.renderHtmlTemplate('tpl-board-modal-toolbar', {
      shift1_active: previewShift === 'shift1' ? 'active' : '',
      shift2_active: previewShift === 'shift2' ? 'active' : '',
      shift1_text: shiftLabel('shift1'),
      shift2_text: shiftLabel('shift2'),
      lang_picker_html: renderBoardLanguagePickerMarkup('board'),
      board_language_text: escapeHtml(tr('board_language', 'Мова плану')),
      export_png_text: escapeHtml(tr('export_png', 'Завантажити PNG')),
      export_txt_text: escapeHtml(tr('export_txt', 'TXT')),
      share_text: escapeHtml(tr('final_plan_share', 'Поділитися'))
    });
    try { toolbar.classList.add('board-head-actions--single'); } catch {}
    try { toolbar.scrollLeft = 0; } catch {}
    status.textContent = `${tr('final_plan_status', 'Фінальний план')} · ${shiftLabel(previewShift)}`;
    sheet.innerHTML = renderBoardSheet(previewShift);
    try { sheet.scrollTop = 0; sheet.scrollLeft = 0; } catch {}

    try { window.PNS?.wireBoardLanguageButtons?.(toolbar); } catch {}
    try {
      toolbar.querySelectorAll('[data-calc-preview-shift], [data-shift-tab]').forEach((button) => {
        button.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          const nextShift = String(
            button.getAttribute('data-calc-preview-shift')
            || button.getAttribute('data-shift-tab')
            || 'shift1'
          );
          try { setCalcPreviewShift(nextShift); } catch {}
          try { renderStandaloneFinalBoard(root); } catch {}
          return false;
        };
      });
      const exportBtn = toolbar.querySelector('[data-preview-export-png], #exportPngBtn');
      if (exportBtn) {
        exportBtn.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          return !!window.exportBoardAsPNG?.();
        };
      }
      const txtBtn = toolbar.querySelector('[data-preview-export-txt], #exportBoardTxtBtn');
      if (txtBtn) {
        txtBtn.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          try { ev.stopImmediatePropagation?.(); } catch {}
          return !!window.exportBoardAsTXT?.();
        };
      }
      const shareBtn = toolbar.querySelector('[data-preview-share-board], #shareBoardBtn');
      if (shareBtn) {
        shareBtn.onclick = async function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          try { ev.stopImmediatePropagation?.(); } catch {}
          return await (window.shareBoardAsImage?.({
            sheet: sheet.querySelector('.board-sheet') || sheet,
            shift: getCalcState()?.previewShift || previewShift,
            statusEl: status
          }) || false);
        };
      }

      const mobileMenu = toolbar.querySelector('[data-board-mobile-menu]');
      const mobileMenuTrigger = toolbar.querySelector('[data-board-mobile-menu-trigger]');
      const mobileMenuPanel = toolbar.querySelector('[data-board-mobile-menu-panel]');
      if (mobileMenu && mobileMenuTrigger) {
        mobileMenuTrigger.onclick = function(ev) {
          try { ev.preventDefault(); } catch {}
          try { ev.stopPropagation(); } catch {}
          const willOpen = !mobileMenu.classList.contains('is-open');
          mobileMenu.classList.toggle('is-open', willOpen);
          mobileMenuTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return false;
        };
      }
      if (mobileMenuPanel) {
        mobileMenuPanel.querySelectorAll('button').forEach((button) => {
          button.addEventListener('click', () => {
            mobileMenu?.classList.remove('is-open');
            mobileMenuTrigger?.setAttribute('aria-expanded', 'false');
          });
        });
      }
    } catch {}
    return true;
  }

  Object.assign(PNS, {
    getBaseSlots,
    getShiftBaseAssignments,
    getBoardAssignedMarch,
    resolveBoardTowerState,
    renderBoardSheet,
    setCalcPreviewShift,
    renderLiveFinalBoard,
    renderStandaloneFinalBoard
  });

  Object.assign(window, {
    __pnsGetBaseSlots: getBaseSlots,
    __pnsGetShiftBaseAssignments: getShiftBaseAssignments,
    __pnsGetBoardAssignedMarch: getBoardAssignedMarch,
    __pnsResolveBoardTowerState: resolveBoardTowerState,
    __pnsRenderBoardSheet: renderBoardSheet,
    __pnsSetCalcPreviewShift: setCalcPreviewShift,
    __pnsRenderLiveFinalBoard: renderLiveFinalBoard,
    __pnsRenderStandaloneFinalBoard: renderStandaloneFinalBoard
  });
})();
