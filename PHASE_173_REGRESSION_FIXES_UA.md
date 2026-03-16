# Phase 173 — regression fixes after browser smoke

## Fixed

1. Import first-load error
- fixed `js/import-status-ui.js`
- cause: `syncFileInputUI()` shadowed `PNS` with the file input element and called `e.renderHtmlTemplate(...)` on the input node
- result: first import no longer fails with `renderHtmlTemplate is not a function`

2. Final Plan shift buttons inside Turret Planning
- fixed `js/final-plan-preview.js`
- cause: preview render always preferred `state.activeShift` over `towerCalc.previewShift`
- result: `Shift 1` / `Shift 2` buttons now switch the final plan preview correctly

3. Clear LocalStorage completely
- hardened `js/patch-reset-storage-actions.js`
- now it:
  - suppresses persistence
  - clears localStorage and sessionStorage
  - removes `pns*` keys again as a safety pass
  - resets in-memory runtime state
  - refreshes UI immediately
  - reloads the page cleanly

4. Template bridge hardening
- updated `js/template-boot.js`
- also exposes `window.renderHtmlTemplate` as a stable alias to `PNS.renderHtmlTemplate`

## Checked
- `node --check` for all `js/*.js`
- local static smoke passes
