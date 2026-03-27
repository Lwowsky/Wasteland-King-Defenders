(function(){
  const PNS = window.PNS || {};
  const t = (key, fallback="") => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  async function legacyExportBoardSheet(sheet) {
    if (typeof window.html2canvas !== 'function') {
      alert(window.__PNS_OFFLINE_NO_HTML2CANVAS__
        ? t('png_export_offline', 'PNG export is unavailable in the offline package without a local html2canvas library.')
        : t('html2canvas_missing', 'html2canvas failed to load.'));
      return;
    }

    const activeShift = (PNS.state && PNS.state.activeShift) || 'all';
    sheet.classList.add('is-exporting-png');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const canvas = await window.html2canvas(sheet, {
        backgroundColor: null,
        scale: 5,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: function(clonedDoc) {
          const clonedSheet = clonedDoc.querySelector('#board-modal .board-sheet')
            || clonedDoc.querySelector('.board-modal .board-sheet')
            || clonedDoc.querySelector('.board-sheet');
          if (clonedSheet) clonedSheet.classList.add('is-exporting-png');
        }
      });
      const link = document.createElement('a');
      link.download = 'pns-board-' + activeShift + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert(t('png_failed', 'Failed to generate PNG'));
    } finally {
      sheet.classList.remove('is-exporting-png');
    }
  }

  document.addEventListener('click', async function(event) {
    const btn = event.target.closest('#exportPngBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    const sheet = document.querySelector('#board-modal .board-sheet')
      || document.querySelector('.board-modal .board-sheet')
      || document.querySelector('.board-sheet');
    if (!sheet) return;

    if (typeof window.exportBoardAsPNG === 'function') {
      try {
        const statusEl = document.getElementById('boardPreviewStatus') || document.getElementById('towerCalcPreviewStatus') || null;
        await window.exportBoardAsPNG({
          sheet,
          statusEl,
          scale: 5,
        });
        return;
      } catch (err) {
        console.error(err);
      }
    }

    await legacyExportBoardSheet(sheet);
  }, true);
})();
