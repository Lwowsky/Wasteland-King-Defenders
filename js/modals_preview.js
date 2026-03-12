// Settings "5 towers" preview helpers (split from modals_api.js)
(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  function towerPreviewSlotKeyFromTitle(title) {
    const t = String(title || '').toLowerCase();
    if (/(техно|hub|central)/i.test(t)) return 'hub';
    if (/(північ|север|north)/i.test(t)) return 'north';
    if (/(захід|запад|west)/i.test(t)) return 'west';
    if (/(схід|восток|east)/i.test(t)) return 'east';
    if (/(півден|юж|south)/i.test(t)) return 'south';
    return '';
  }

  function getBaseByPreviewSlot(slot) {
    const key = String(slot || '').toLowerCase();
    if (!key) return null;
    const bases = (state.bases || []);
    for (const b of bases) {
      const title = String(b?.title || '');
      if (towerPreviewSlotKeyFromTitle(title) === key) return b;
    }
    return null;
  }

  function syncSettingsTowerPreview() {
    const root = document.querySelector('.shift-towers-preview');
    if (!root) return;
    let focusedId = String(state.focusedBaseId || '');
    if (!focusedId) {
      try {
        const fc = MS.getFocusedCard?.();
        focusedId = String(fc?.dataset?.baseId || fc?.dataset?.baseid || '');
      } catch {}
    }
    root.querySelectorAll('[data-preview-slot]').forEach((el) => {
      const slot = el.getAttribute('data-preview-slot') || '';
      const base = getBaseByPreviewSlot(slot);
      const card = el.closest('.tower-thumb-card') || el;
      const status = card.querySelector('.tower-thumb-status');
      if (!base) {
        card.classList.remove('is-active', 'is-ready', 'is-not-ready');
        card.dataset.previewBaseId = '';
        if (status) status.textContent = '?';
        card.title = t('turret_not_found', 'Турель не знайдена');
        return;
      }
      const baseId = String(base.id || '');
      card.dataset.previewBaseId = baseId;
      const ready = !!base.captainId;
      card.classList.toggle('is-ready', ready);
      card.classList.toggle('is-not-ready', !ready);
      card.classList.toggle('is-active', !!focusedId && focusedId === baseId);
      card.setAttribute('aria-pressed', (!!focusedId && focusedId === baseId) ? 'true' : 'false');
      card.title = `${String(base.title || baseId).split('/')[0].trim()} — ${ready ? t('ready', 'готова').toLowerCase() : t('no_captain_short', 'без капітана').toLowerCase()}`;
      if (status) {
        status.textContent = ready ? '✓' : '!';
        status.setAttribute('aria-label', ready ? t('turret_ready_aria', 'Турель готова') : t('turret_not_ready_aria', 'Турель не готова'));
      }
    });
  }

  function focusTowerFromPreviewElement(previewEl) {
    const card = previewEl?.closest?.('.tower-thumb-card') || previewEl;
    if (!card) return;
    let baseId = String(card.dataset.previewBaseId || '');
    if (!baseId) {
      const slotEl = card.querySelector?.('[data-preview-slot]') || card;
      const slot = slotEl?.getAttribute?.('data-preview-slot') || '';
      const base = getBaseByPreviewSlot(slot);
      baseId = String(base?.id || '');
    }
    if (!baseId) return;

    state.focusedBaseId = baseId;

    // Prefer using the same path as arrows/select so right panel becomes editable immediately.
    const sel = document.getElementById('focusTowerSelect');
    let switched = false;
    if (sel) {
      const hasOption = Array.from(sel.options || []).some((o) => String(o.value) === String(baseId));
      if (hasOption) {
        sel.value = baseId;
        try { MS.handleFocusSelect?.(sel); switched = true; } catch {}
      }
    }
    if (!switched) {
      try { MS.focusTowerById?.(baseId); switched = true; } catch {}
    }

    try {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(baseId) : String(baseId).replace(/"/g, '\\"');
      const baseCard = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) ||
                       document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
      if (baseCard) {
        MS.markFocusedCard?.(baseCard);
        if ((state.towerViewMode || 'all') === 'focus') {
          setTimeout(() => { try { MS.applyTowerVisibilityMode?.(); } catch {} }, 0);
        }
      }
    } catch {}

    setTimeout(() => {
      try { MS.syncFocusedTowerSelect?.(); } catch {}
      try { syncSettingsTowerPreview(); } catch {}
      try {
        if (document.getElementById('towerPickerModal')?.classList.contains('is-open')) {
          MS.refreshTowerPickerModalList?.();
          MS.updateTowerPickerDetail?.();
        }
      } catch {}
    }, 20);
  }




  Object.assign(MS, {
    towerPreviewSlotKeyFromTitle,
    getBaseByPreviewSlot,
    syncSettingsTowerPreview,
    focusTowerFromPreviewElement,
  });
})();
