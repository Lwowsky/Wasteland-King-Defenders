(function () {
  'use strict';

  const IDS = ['towerCalcNoCrossShift', 'pickerNoCrossShiftDupes'];
  const TEXTS = ['Без дублювання helper-ів між shifts', 'Без дублювання між shifts', 'No cross-shift duplicates'];

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function fire(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
  }

  function restoreV38Damage() {
    document.querySelectorAll('[data-tc-hidden-no-dup="1"]').forEach((el) => {
      el.style.display = '';
      el.removeAttribute('data-tc-hidden-no-dup');
    });
  }

  function findCheckboxRow(input) {
    if (!input) return null;
    const candidates = [
      input.closest('label'),
      input.closest('.form-check'),
      input.closest('[class*="check"]'),
      input.closest('[class*="option"]'),
      input.closest('[class*="toggle"]'),
      input.closest('[class*="control"]'),
      input.parentElement,
      input.closest('div'),
    ].filter(Boolean);

    for (const el of candidates) {
      const t = norm(el.textContent);
      if (t && TEXTS.some((x) => t.includes(x)) && t.length < 180) return el;
    }
    return input.closest('label') || input.parentElement || null;
  }

  function disableNoCrossLogic() {
    try {
      const PNS = window.PNS || {};
      if (PNS.state) {
        if (PNS.state.towerCalc) PNS.state.towerCalc.noCrossShift = false;
        PNS.state.towerPickerNoCrossShiftDupes = false;
      }
      PNS.isTowerNoCrossShiftDupesEnabled = function () { return false; };
      if (PNS.ModalsShift) {
        PNS.ModalsShift.isPickerNoCrossShiftDupesEnabled = function () { return false; };
      }
    } catch {}
  }

  function hideById(id) {
    const input = document.getElementById(id);
    if (!input) return false;
    if (input.type === 'checkbox' && input.checked) {
      input.checked = false;
      fire(input);
    }
    const row = findCheckboxRow(input);
    if (row) {
      row.style.display = 'none';
      row.setAttribute('data-tc-v39-hidden', '1');
      return true;
    }
    return false;
  }

  function hideByText() {
    const all = Array.from(document.querySelectorAll('label, span, div'));
    all.forEach((el) => {
      if (el.getAttribute && el.getAttribute('data-tc-v39-hidden') === '1') return;
      const t = norm(el.textContent);
      if (!t || t.length > 180) return;
      if (!TEXTS.some((x) => t === x || t.startsWith(x + ' '))) return;
      const input = el.querySelector('input[type="checkbox"]') || el.previousElementSibling?.matches?.('input[type="checkbox"]') && el.previousElementSibling;
      const row = input ? findCheckboxRow(input) : (el.closest('label') || el.parentElement);
      if (row && row.querySelector && row.querySelector('input[type="checkbox"]')) {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
          cb.checked = false;
          fire(cb);
        }
        row.style.display = 'none';
        row.setAttribute('data-tc-v39-hidden', '1');
      }
    });
  }

  function run() {
    restoreV38Damage();
    disableNoCrossLogic();
    IDS.forEach(hideById);
    hideByText();
  }

  function patchTowerPickerRefresh() {
    const PNS = window.PNS || {};
    const MS = PNS.ModalsShift || {};
    if (typeof MS.updateTowerPickerDetail === 'function' && !MS.__v39WrappedUpdate) {
      const orig = MS.updateTowerPickerDetail;
      MS.updateTowerPickerDetail = function () {
        const out = orig.apply(this, arguments);
        setTimeout(run, 0);
        setTimeout(run, 50);
        return out;
      };
      MS.__v39WrappedUpdate = true;
    }
  }

  function boot() {
    run();
    patchTowerPickerRefresh();
    [100, 300, 800, 1500].forEach((ms) => setTimeout(run, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('load', boot, { once: true });
  document.addEventListener('click', function () {
    setTimeout(run, 0);
    setTimeout(run, 80);
  }, true);
})();
