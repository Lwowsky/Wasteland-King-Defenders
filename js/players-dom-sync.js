/* ==== players-dom-sync.js ==== */
/* Players table parsing and DOM linking for shift/import tools */
(function(){
  const e = window.PNS;
  if (!e) return;
  const { state: t } = e;

  function getPlayerRows(){
    const table = e.controls?.playersDataTable || document.querySelector('#playersDataTable');
    const tbody = table ? table.querySelector('tbody') : null;
    return tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
  }

  function relinkPlayersToDOM(){
    const rows = getPlayerRows();
    if (!rows.length) return false;
    const byId = new Map();
    rows.forEach(row => {
      const playerId = row.dataset.playerId;
      if (playerId) byId.set(playerId, row);
    });
    const hasIds = byId.size > 0;
    if (!Array.isArray(t.players) || !t.players.length) return false;

    t.players.forEach((player, index) => {
      const row = hasIds ? byId.get(player.id) : rows[index];
      if (!row) return;
      player.rowEl = row;
      player.actionCellEl = row.querySelector('td[data-field="actions"]') || row.querySelector('td[data-col-key="actions"]') || row.querySelector('td:last-child');
      row.dataset.playerId = player.id;
      row.dataset.shift = player.shift || row.dataset.shift || 'both';
    });
    t.playerById = new Map(t.players.map(player => [player.id, player]));
    return true;
  }

  function parsePlayersFromTable(){
    const rows = getPlayerRows();
    if (!rows.length) return;

    t.players = [];
    t.playerById = new Map();

    rows.forEach((row, index) => {
      const cells = Array.from(row.querySelectorAll('td'));
      const getField = name => row.querySelector(`td[data-field="${name}"]`)?.textContent?.trim() || '';
      const getCol = key => row.querySelector(`td[data-col-key="${key}"]`)?.textContent?.trim() || '';

      const roleText = getField('role') || getField('focus_troop') || cells[2]?.textContent?.trim() || '';
      const tierText = getField('tier') || cells[3]?.textContent?.trim() || '';
      const marchText = getField('march') || cells[4]?.textContent?.trim() || '';
      const rallyText = getField('rally') || getCol('rally_size') || '';
      const captainReadyText = getField('captainReady') || cells[6]?.textContent?.trim() || '';
      const shiftText = getField('shiftLabel') || cells[7]?.textContent?.trim() || row.dataset.shift || 'Обидві';

      const player = {
        id: `p${index + 1}`,
        name: getField('name') || cells[0]?.textContent?.trim() || '',
        alliance: getField('alliance') || getCol('alliance') || cells[1]?.textContent?.trim() || '',
        role: e.normalizeRole(roleText),
        tier: e.normalizeTierText(tierText),
        tierRank: e.tierRank(tierText),
        march: e.parseNumber(marchText),
        rally: e.parseNumber(rallyText),
        captainReady: e.normalizeYesNo(captainReadyText),
        shift: e.normalizeShiftValue(shiftText),
        shiftLabel: e.normalizeShiftLabel(shiftText),
        lairLevel: getField('lair') || getCol('lair_level') || '',
        secondaryRole: e.normalizeRole(getField('secondary_role') || getCol('secondary_role') || ''),
        secondaryTier: e.normalizeTierText(getField('secondary_tier') || getCol('secondary_tier') || ''),
        troop200k: getField('troop_200k') || getCol('troop_200k') || '',
        notes: getField('notes') || getCol('notes') || '',
        raw: {},
        rowEl: row,
        actionCellEl: row.querySelector('td[data-field="actions"]') || row.querySelector('td[data-col-key="actions"]') || cells.at(-1),
        assignment: null,
      };

      row.dataset.playerId = player.id;
      row.dataset.shift = player.shift;
      t.players.push(player);
      t.playerById.set(player.id, player);
    });
  }

  function ensurePlayersLinked(){
    if (Array.isArray(t.players) && t.players.length > 0) {
      if (!relinkPlayersToDOM()) {
        const table = e.controls?.playersDataTable || document.querySelector('#playersDataTable');
        const tbody = table?.querySelector('tbody');
        const tableExists = !!table;
        const hasRows = !!tbody && tbody.querySelectorAll('tr').length > 0;
        if (tableExists && !hasRows && typeof e.renderPlayersTableFromState === 'function') {
          try {
            e.renderPlayersTableFromState();
            relinkPlayersToDOM();
          } catch (err) {
            console.warn('[players_parse] failed to re-render players table from state', err);
          }
        }
      }
    } else {
      parsePlayersFromTable();
    }
  }

  e.parsePlayersFromTable = parsePlayersFromTable;
  e.relinkPlayersToDOM = relinkPlayersToDOM;
  e.ensurePlayersLinked = ensurePlayersLinked;
  e.getPlayerRows = getPlayerRows;
})();
