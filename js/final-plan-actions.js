/* Final plan export/share actions */
(function(){
  const PNS = window.PNS || {};

  function tr(key, fallback="") {
    try {
      return typeof PNS.t === "function" ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function shiftLabel(shift) {
    try {
      return typeof PNS.shiftLabel === "function" ? PNS.shiftLabel(shift) : String(shift || "");
    } catch {
      return String(shift || "");
    }
  }

  function formatNum(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function getPreviewSheet() {
    return document.querySelector("#towerCalcBoardPreviewSheet .board-sheet") || document.querySelector("#towerCalcBoardPreviewSheet");
  }

  function getPreviewShift() {
    try {
      const state = typeof window.getCalcState === "function" ? window.getCalcState() : (PNS.state?.towerCalc || {});
      return String(state?.previewShift || "shift2").toLowerCase() === "shift1" ? "shift1" : "shift2";
    } catch {
      return "shift2";
    }
  }

  function getPreviewStatusEl() {
    return document.getElementById("towerCalcPreviewStatus");
  }

  function getBoardStatusEl() {
    return document.getElementById("boardPreviewStatus") || getPreviewStatusEl();
  }

  function getBoardSlots() {
    try {
      if (typeof window.__pnsGetBaseSlots === "function") {
        const slots = window.__pnsGetBaseSlots();
        if (Array.isArray(slots) && slots.length) return slots;
      }
    } catch {}
    return Array.isArray(PNS.state?.bases) ? PNS.state.bases.slice(0, 5) : [];
  }

  function resolveBoardTowerState(base, shift) {
    try {
      if (typeof window.__pnsResolveBoardTowerState === "function") {
        return window.__pnsResolveBoardTowerState(base, shift);
      }
    } catch {}
    return null;
  }

  function getAssignedMarch(baseLike, player, shift) {
    try {
      if (typeof window.__pnsGetBoardAssignedMarch === "function") {
        return Number(window.__pnsGetBoardAssignedMarch(baseLike, player, shift) || 0) || 0;
      }
    } catch {}
    return Number(player?.march || 0) || 0;
  }

  function getTranslatedBaseTitle(base, index) {
    const raw = String(base?.title || base?.id || `${tr("turret", "Турель")} ${index + 1}`);
    const lower = raw.toLowerCase();
    const titleMap = [
      [/техно|hub|central/, "hub", "Tech Hub"],
      [/північ|north|север/, "north_turret", "North Turret"],
      [/захід|west|запад/, "west_turret", "West Turret"],
      [/схід|east|вост/, "east_turret", "East Turret"],
      [/півден|south|юж/, "south_turret", "South Turret"]
    ];
    const found = titleMap.find(([rx]) => rx.test(lower));
    if (!found) return raw;
    const [, key, fallback] = found;
    try {
      if (typeof window.getBoardLanguageTextMulti === "function") {
        return String(window.getBoardLanguageTextMulti(key, fallback) || raw);
      }
    } catch {}
    return raw;
  }

  function normalizePlayerLine(player, march) {
    return [
      String(player?.name || "").trim(),
      String(player?.alliance || "—").trim() || "—",
      String(player?.tier || "—").trim() || "—",
      formatNum(march)
    ].join(" ✦ ");
  }

  function buildBoardTxtForShift(shift) {
    const normalizedShift = String(shift || "").toLowerCase() === "shift1" ? "shift1" : "shift2";
    const lines = [`=== ${shiftLabel(normalizedShift)} ===`, ""];
    getBoardSlots().forEach((base, index) => {
      const boardState = resolveBoardTowerState(base, normalizedShift);
      const title = getTranslatedBaseTitle(base, index);
      const captain = boardState?.captain || null;
      const helpers = Array.isArray(boardState?.helpers)
        ? boardState.helpers.slice().sort((left, right) =>
            Number(right?.tierRank || 0) - Number(left?.tierRank || 0)
            || Number(right?.march || 0) - Number(left?.march || 0)
            || String(left?.name || "").localeCompare(String(right?.name || ""))
          )
        : [];

      lines.push(`[${title}]`);
      if (captain) {
        lines.push(normalizePlayerLine(captain, Number(boardState?.captainMarch || captain?.march || 0) || 0));
      }
      helpers.forEach((helper) => {
        lines.push(normalizePlayerLine(helper, getAssignedMarch(boardState?.baseLike || base, helper, normalizedShift)));
      });
      if (!captain && !helpers.length) {
        lines.push(tr("no_assigned_players", "Немає призначених гравців"));
      }
      lines.push("");
    });
    return lines.join("\n").trim() + "\n";
  }

  function buildBoardTxtAllShifts() {
    return [buildBoardTxtForShift("shift1"), buildBoardTxtForShift("shift2")].join("\n");
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function getPreferredPngScale() {
    const dpr = Number(window.devicePixelRatio || 1) || 1;
    if (dpr >= 2.2) return 4;
    if (dpr >= 1.5) return 3.5;
    return 3;
  }

  async function renderSheetToPngBlob(sheet, options = {}) {
    if (!sheet) return null;
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas_missing");
    }
    const rect = typeof sheet.getBoundingClientRect === "function"
      ? sheet.getBoundingClientRect()
      : { width: 0, height: 0 };
    const exportScale = Math.max(2, Math.min(4, Number(options.scale || getPreferredPngScale()) || 3));
    const cleanup = [];
    try {
      sheet.classList?.add("is-exporting-png");
      cleanup.push(() => sheet.classList?.remove("is-exporting-png"));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await window.html2canvas(sheet, {
        backgroundColor: null,
        scale: exportScale,
        useCORS: true,
        logging: false,
        width: Math.max(1, Math.ceil(rect.width || sheet.scrollWidth || 0)),
        height: Math.max(1, Math.ceil(rect.height || sheet.scrollHeight || 0)),
        windowWidth: Math.max(
          Math.ceil(rect.width || 0) + 64,
          window.innerWidth || document.documentElement?.clientWidth || 0
        ),
        windowHeight: Math.max(
          Math.ceil(rect.height || 0) + 64,
          window.innerHeight || document.documentElement?.clientHeight || 0
        ),
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          try {
            const cloneSheet = clonedDoc.querySelector('.board-sheet');
            if (cloneSheet) cloneSheet.classList.add('is-exporting-png');
            const pills = clonedDoc.querySelectorAll('.board-cap > span');
            pills.forEach((pill, idx) => {
              try {
                pill.style.border = '0';
                pill.style.outline = '0';
                pill.style.boxShadow = 'none';
                pill.style.textShadow = 'none';
                pill.style.backgroundImage = 'none';
                pill.style.filter = 'none';
                pill.style.borderRadius = '8px';
                pill.style.padding = '6px 10px';
                pill.style.fontWeight = '800';
                pill.style.lineHeight = '1';
                pill.style.display = 'block';
                pill.style.textAlign = 'center';
                if (idx === 0) {
                  pill.style.background = '#4e73c6';
                  pill.style.color = '#f9fbff';
                } else if (idx === 1) {
                  pill.style.background = '#5aa174';
                  pill.style.color = '#f8fff9';
                } else {
                  pill.style.background = '#f1bb3e';
                  pill.style.color = '#1c1400';
                }
              } catch {}
            });
          } catch {}
        }
      });
      try {
        const ctx = canvas.getContext?.("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
        }
      } catch {}
      return await new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("png_blob_failed")), "image/png");
        } catch (err) {
          reject(err);
        }
      });
    } finally {
      cleanup.reverse().forEach((fn) => {
        try { fn(); } catch {}
      });
    }
  }

  function downloadBlob(filename, blob) {
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  async function trySharePngBlob(blob, filename, title, text) {
    if (!blob) return false;
    if (navigator.share && window.File) {
      const file = new File([blob], filename, { type: "image/png" });
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return true;
      }
    }
    return false;
  }

  async function tryCopyPngBlob(blob) {
    if (!blob) return false;
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    }
    return false;
  }

  function getBoardSheet() {
    return document.querySelector("#boardModalPreviewSheet .board-sheet")
      || document.querySelector("#board-modal #boardModalPreviewSheet .board-sheet")
      || document.querySelector("#board-modal #boardModalPreviewSheet");
  }

  function getBoardShift() {
    const active = document.querySelector("#board-modal [data-shift-tab].active, #board-modal [data-calc-preview-shift].active");
    const value = String(active?.getAttribute?.("data-shift-tab") || active?.getAttribute?.("data-calc-preview-shift") || "shift1");
    return value.toLowerCase() === "shift2" ? "shift2" : "shift1";
  }

  window.exportBoardAsPNG = async function(options = {}) {
    const sheet = options.sheet || getBoardSheet();
    const shift = String(options.shift || getBoardShift()).toLowerCase() === "shift2" ? "shift2" : "shift1";
    const shiftText = shiftLabel(shift);
    const statusEl = options.statusEl || getBoardStatusEl();
    if (!sheet) {
      alert(tr("no_final_plan_export", "Немає фінального плану для експорту."));
      return false;
    }
    if (typeof window.html2canvas !== "function") {
      const message = window.__PNS_OFFLINE_NO_HTML2CANVAS__
        ? tr("png_export_offline", "PNG export недоступний в offline-пакеті без локальної бібліотеки html2canvas.")
        : tr("html2canvas_missing", "html2canvas не завантажився.");
      if (statusEl) statusEl.textContent = message;
      alert(message);
      return false;
    }
    try {
      if (statusEl) statusEl.textContent = `${tr("preparing_png", "Готуємо PNG")} · ${shiftText}…`;
      const blob = await renderSheetToPngBlob(sheet, { scale: options.scale });
      const filename = options.filename || `pns-final-board-${shift}.png`;
      downloadBlob(filename, blob);
      if (statusEl) statusEl.textContent = `${tr("png_saved", "PNG збережено")} · ${shiftText}.`;
      return true;
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = tr("png_failed", "Не вдалося згенерувати PNG.");
      alert(tr("png_failed", "Не вдалося згенерувати PNG."));
      return false;
    }
  };

  window.shareBoardAsImage = async function(options = {}) {
    const sheet = options.sheet || getBoardSheet();
    const shift = String(options.shift || getBoardShift()).toLowerCase() === "shift2" ? "shift2" : "shift1";
    const shiftText = shiftLabel(shift);
    const statusEl = options.statusEl || getBoardStatusEl();
    if (!sheet) {
      alert(tr("no_final_plan_share", "Немає фінального плану для поширення."));
      return false;
    }
    try {
      if (statusEl) statusEl.textContent = `${tr("preparing_share", "Готуємо поширення")} · ${shiftText}…`;
      const blob = await renderSheetToPngBlob(sheet);
      const title = `P&S ${tr("final_plan", "Фінальний план")}`;
      const text = `${tr("final_plan", "Фінальний план")} ${shiftText}`;
      const filename = `pns-final-board-${shift}.png`;
      if (await trySharePngBlob(blob, filename, title, text)) {
        if (statusEl) statusEl.textContent = `${tr("board_shared", "План поширено")} · ${shiftText}.`;
        return true;
      }
      if (await tryCopyPngBlob(blob)) {
        if (statusEl) statusEl.textContent = `${tr("board_copied_image", "PNG план скопійовано в буфер")} · ${shiftText}.`;
        return true;
      }
      downloadBlob(filename, blob);
      if (statusEl) statusEl.textContent = `${tr("png_saved", "PNG збережено")} · ${shiftText}.`;
      return true;
    } catch (err) {
      if (err && (err.name === "AbortError" || err.message === "AbortError")) {
        if (statusEl) statusEl.textContent = tr("share_cancelled", "Поширення скасовано.");
        return false;
      }
      console.error(err);
      if (statusEl) statusEl.textContent = tr("share_board_failed", "Не вдалося поширити фінальний план.");
      alert(tr("share_board_failed", "Не вдалося поширити фінальний план."));
      return false;
    }
  };

  window.exportBoardAsTXT = function(){
    const statusEl = getBoardStatusEl();
    try {
      const text = buildBoardTxtAllShifts();
      if (!String(text || "").trim()) {
        alert(tr("no_final_plan_export", "Немає фінального плану для експорту."));
        return false;
      }
      if (statusEl) statusEl.textContent = tr("preparing_txt", "Готуємо TXT…");
      downloadTextFile("pns-final-plan-shift1-shift2.txt", text);
      if (statusEl) statusEl.textContent = tr("txt_saved", "TXT збережено.");
      return true;
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = tr("txt_failed", "Не вдалося зберегти TXT.");
      alert(tr("txt_failed", "Не вдалося зберегти TXT."));
      return false;
    }
  };

  window.calcExportPreviewBoardPng = async function(){
    return await window.exportBoardAsPNG({
      sheet: getPreviewSheet(),
      shift: getPreviewShift(),
      statusEl: getPreviewStatusEl()
    });
  };

  window.calcSharePreviewBoard = async function(){
    return await window.shareBoardAsImage({
      sheet: getPreviewSheet(),
      shift: getPreviewShift(),
      statusEl: getPreviewStatusEl()
    });
  };

  document.addEventListener("click", function(ev){
    if (ev.defaultPrevented) return;
    const btn = ev.target.closest("#exportBoardTxtBtn,[data-calc-preview-export-txt]");
    if (!btn) return;
    ev.preventDefault();
    try {
      window.exportBoardAsTXT?.();
    } catch (err) {
      console.error(err);
    }
  });
})();
