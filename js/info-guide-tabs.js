(function () {
  const ROOT_ID = 'infoGuideTabsSection';

  function normalizeLocale(locale) {
    const value = String(locale || 'uk').toLowerCase();
    if (value === 'ua') return 'uk';
    return value === 'ru' || value === 'en' ? value : 'uk';
  }

  function getLocale() {
    try {
      if (window.PNSI18N && typeof window.PNSI18N.getLocale === 'function') return normalizeLocale(window.PNSI18N.getLocale());
    } catch {}
    return normalizeLocale(document.documentElement.getAttribute('lang') || document.documentElement.dataset.locale || 'uk');
  }

  function getGuideCopy(locale) {
    const normalized = normalizeLocale(locale);
    const dicts = window.PNSI18N?.dict || window.PNSI18N_DICTS || {};
    return dicts?.[normalized]?.guide_copy || dicts?.uk?.guide_copy || null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderList(items, className) {
    return `<ul class="${className}">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function renderSteps(steps) {
    return `<ol class="igt-steps">${(steps || []).map((step) => `
      <li class="igt-step">
        <h3 class="igt-step-title">${escapeHtml(step.title)}</h3>
        <p class="igt-step-purpose">${escapeHtml(step.purpose)}</p>
        <p class="igt-step-copy">${escapeHtml(step.copy)}</p>
      </li>`).join('')}
    </ol>`;
  }

  function renderSide(cards) {
    return (cards || []).map((card) => `
      <div class="igt-side-card">
        <h4>${escapeHtml(card.title)}</h4>
        <p>${escapeHtml(card.text)}</p>
      </div>`).join('');
  }

  function renderBlocks(blocks) {
    return `<div class="igt-tiles">${(blocks || []).map((block) => `
      <div class="igt-tile">
        <h4>${escapeHtml(block.title)}</h4>
        ${renderList(block.items || [], 'igt-sublist')}
      </div>`).join('')}</div>`;
  }

  function renderImport(panel) {
    return `
      <div class="igt-panel-head">
        <div class="igt-eyebrow">${escapeHtml(panel.eyebrow)}</div>
        <h2 class="igt-panel-title">${escapeHtml(panel.title)}</h2>
        <p class="igt-panel-lead">${escapeHtml(panel.lead)}</p>
      </div>
      <div class="igt-grid">
        <div class="igt-stack">
          ${renderSteps(panel.steps)}
        </div>
        <div class="igt-stack">${renderSide(panel.side)}
          <div class="igt-note">
            <div class="igt-note-title">${escapeHtml(panel.noteTitle)}</div>
            <p>${escapeHtml(panel.noteText)}</p>
          </div>
        </div>
      </div>`;
  }

  function renderPlayers(panel) {
    return `
      <div class="igt-panel-head">
        <div class="igt-eyebrow">${escapeHtml(panel.eyebrow)}</div>
        <h2 class="igt-panel-title">${escapeHtml(panel.title)}</h2>
        <p class="igt-panel-lead">${escapeHtml(panel.lead)}</p>
      </div>
      <div class="igt-grid">
        <div class="igt-stack">
          ${renderSteps(panel.steps)}
        </div>
        <div class="igt-stack">${renderSide(panel.side)}
          <div class="igt-note">
            <div class="igt-note-title">${escapeHtml(panel.noteTitle)}</div>
            <p>${escapeHtml(panel.noteText)}</p>
          </div>
        </div>
      </div>`;
  }

  function renderTurrets(panel) {
    return `
      <div class="igt-panel-head">
        <div class="igt-eyebrow">${escapeHtml(panel.eyebrow)}</div>
        <h2 class="igt-panel-title">${escapeHtml(panel.title)}</h2>
        <p class="igt-panel-lead">${escapeHtml(panel.lead)}</p>
      </div>
      <div class="igt-grid">
        <div class="igt-stack">
          <div class="igt-card">
            <h3 class="igt-card-title">${escapeHtml(panel.sequenceTitle)}</h3>
            ${renderList(panel.sequence || [], 'igt-list')}
          </div>
          ${renderBlocks(panel.blocks)}
        </div>
        <div class="igt-stack">${renderSide(panel.side)}
          <div class="igt-note">
            <div class="igt-note-title">${escapeHtml(panel.noteTitle)}</div>
            <p>${escapeHtml(panel.noteText)}</p>
          </div>
        </div>
      </div>`;
  }

  function renderFinal(panel) {
    return `
      <div class="igt-panel-head">
        <div class="igt-eyebrow">${escapeHtml(panel.eyebrow)}</div>
        <h2 class="igt-panel-title">${escapeHtml(panel.title)}</h2>
        <p class="igt-panel-lead">${escapeHtml(panel.lead)}</p>
      </div>
      <div class="igt-grid">
        <div class="igt-stack">
          ${renderSteps(panel.steps)}
        </div>
        <div class="igt-stack">${renderSide(panel.side)}
          <div class="igt-note">
            <div class="igt-note-title">${escapeHtml(panel.noteTitle)}</div>
            <p>${escapeHtml(panel.noteText)}</p>
          </div>
        </div>
      </div>`;
  }

  function renderAbout(panel) {
    return `
      <div class="igt-panel-head">
        <div class="igt-eyebrow">${escapeHtml(panel.eyebrow)}</div>
        <h2 class="igt-panel-title">${escapeHtml(panel.title)}</h2>
        <p class="igt-panel-lead">${escapeHtml(panel.lead)}</p>
      </div>
      <div class="igt-grid">
        <div class="igt-stack">
          ${renderSteps(panel.steps)}
        </div>
        <div class="igt-stack igt-about-side-stack">${renderSide(panel.side)}
          <div class="igt-note igt-note--about">
            <div class="igt-note-title">${escapeHtml(panel.noteTitle)}</div>
            <p>${escapeHtml(panel.noteText)}</p>
          </div>
        </div>
      </div>`;
  }

  function renderPanel(name, panel) {
    if (name === 'turrets') return renderTurrets(panel);
    if (name === 'final-plan') return renderFinal(panel);
    if (name === 'about') return renderAbout(panel);
    if (name === 'players') return renderPlayers(panel);
    return renderImport(panel);
  }

  function applyLabels(root, copy, expanded) {
    root.querySelectorAll('[data-igt-label]').forEach((node) => {
      const key = node.getAttribute('data-igt-label');
      if (key === 'section_hint') {
        node.textContent = expanded
          ? (copy.section_hint_close || copy.section_hint_open || '')
          : (copy.section_hint_open || copy.section_hint || '');
        return;
      }
      if (copy[key]) node.textContent = copy[key];
    });
    const toggle = root.querySelector('.igt-toggle');
    if (toggle) toggle.setAttribute('aria-label', expanded ? copy.close_label : copy.open_label);
  }

  function render(root) {
    if (!root) return;
    const copy = getGuideCopy(getLocale());
    if (!copy) return;
    const activeTab = root.dataset.activeTab || root.dataset.defaultTab || 'import';
    const expanded = root.dataset.expanded === 'true';

    applyLabels(root, copy, expanded);

    root.querySelectorAll('.igt-tab').forEach((tab) => {
      const key = tab.dataset.tab;
      const isActive = key === activeTab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      const label = tab.querySelector('.igt-tab-label');
      if (label) {
        if (key === 'import') label.textContent = copy.tab_import;
        else if (key === 'players') label.textContent = copy.tab_players;
        else if (key === 'turrets') label.textContent = copy.tab_turrets;
        else if (key === 'final-plan') label.textContent = copy.tab_final_plan;
        else if (key === 'about') label.textContent = copy.tab_about;
      }
    });

    Object.keys(copy.panels || {}).forEach((name) => {
      const panelNode = root.querySelector(`[data-panel="${name}"]`);
      if (!panelNode) return;
      panelNode.innerHTML = renderPanel(name, copy.panels[name]);
      const visible = name === activeTab;
      panelNode.hidden = !visible;
      panelNode.classList.toggle('is-active', visible);
    });

    const shell = root.querySelector('.igt-shell');
    const content = root.querySelector('.igt-content');
    const toggle = root.querySelector('.igt-toggle');
    if (shell) shell.classList.toggle('is-open', expanded);
    if (content) content.hidden = !expanded;
    if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
  }

  function initRoot(root) {
    if (!root || root.dataset.igtReady === 'true') return;
    root.dataset.igtReady = 'true';
    root.dataset.activeTab = root.dataset.defaultTab || 'import';
    root.dataset.expanded = 'false';

    const toggle = root.querySelector('.igt-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        root.dataset.expanded = root.dataset.expanded === 'true' ? 'false' : 'true';
        render(root);
      });
    }

    root.querySelectorAll('.igt-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        root.dataset.activeTab = tab.dataset.tab || 'import';
        if (root.dataset.expanded !== 'true') root.dataset.expanded = 'true';
        render(root);
      });
    });

    render(root);
  }

  function boot() {
    initRoot(document.getElementById(ROOT_ID));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  document.addEventListener('pns:i18n-applied', () => {
    const root = document.getElementById(ROOT_ID);
    if (root) render(root);
  });
})();
