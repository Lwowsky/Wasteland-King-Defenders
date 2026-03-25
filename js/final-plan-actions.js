/* Final plan export/share actions */
(function () {
  const PNS = window.PNS || {};

  function tr(key, fallback = "") {
    try {
      return typeof PNS.t === "function"
        ? PNS.t(key, fallback)
        : fallback || key;
    } catch {
      return fallback || key;
    }
  }

  function shiftLabel(shift) {
    try {
      return typeof PNS.shiftLabel === "function"
        ? PNS.shiftLabel(shift)
        : String(shift || "");
    } catch {
      return String(shift || "");
    }
  }

  function formatNum(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function getPreviewSheet() {
    return (
      document.querySelector("#towerCalcBoardPreviewSheet .board-sheet") ||
      document.querySelector("#towerCalcBoardPreviewSheet")
    );
  }

  function getPreviewShift() {
    try {
      const state =
        typeof window.getCalcState === "function"
          ? window.getCalcState()
          : PNS.state?.towerCalc || {};
      return String(state?.previewShift || "shift2").toLowerCase() === "shift1"
        ? "shift1"
        : "shift2";
    } catch {
      return "shift2";
    }
  }

  function getPreviewStatusEl() {
    return document.getElementById("towerCalcPreviewStatus");
  }

  function getBoardStatusEl() {
    return (
      document.getElementById("boardPreviewStatus") || getPreviewStatusEl()
    );
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
        return (
          Number(
            window.__pnsGetBoardAssignedMarch(baseLike, player, shift) || 0,
          ) || 0
        );
      }
    } catch {}
    return Number(player?.march || 0) || 0;
  }

  function getTranslatedBaseTitle(base, index) {
    const raw = String(
      base?.title || base?.id || `${tr("turret", "Турель")} ${index + 1}`,
    );
    const lower = raw.toLowerCase();
    const titleMap = [
      [/테크\s*허브|기술\s*허브|テックハブ|技术中心|trung\s*tâm\s*kỹ\s*thuật|trung\s*tam\s*ky\s*thuat|المركز\s*التقني|техно|hub|central|tech-zentrum|centrum tech|centrum techniczn/, "hub", "Tech Hub"],
      [/북쪽\s*포탑|北タレット|北炮塔|tháp\s*pháo\s*bắc|thap\s*phao\s*bac|північ|north|север|nord|północ|البرج\s*الشمالي/, "north_turret", "North Turret"],
      [/서쪽\s*포탑|西タレット|西炮塔|tháp\s*pháo\s*tây|thap\s*phao\s*tay|захід|west|запад|zachod|البرج\s*الغربي/, "west_turret", "West Turret"],
      [/동쪽\s*포탑|東タレット|东炮塔|tháp\s*pháo\s*đông|thap\s*phao\s*dong|схід|east|вост|ost|wschod|البرج\s*الشرقي/, "east_turret", "East Turret"],
      [/남쪽\s*포탑|南タレット|南炮塔|tháp\s*pháo\s*nam|thap\s*phao\s*nam|півден|south|юж|süd|sud|połud|البرج\s*الجنوبي/, "south_turret", "South Turret"],
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
      formatNum(march),
    ].join(" ✦ ");
  }

  function buildBoardTxtForShift(shift) {
    const normalizedShift =
      String(shift || "").toLowerCase() === "shift1" ? "shift1" : "shift2";
    const lines = [`=== ${shiftLabel(normalizedShift)} ===`, ""];
    getBoardSlots().forEach((base, index) => {
      const boardState = resolveBoardTowerState(base, normalizedShift);
      const title = getTranslatedBaseTitle(base, index);
      const captain = boardState?.captain || null;
      const helpers = Array.isArray(boardState?.helpers)
        ? boardState.helpers
            .slice()
            .sort(
              (left, right) =>
                Number(right?.tierRank || 0) - Number(left?.tierRank || 0) ||
                Number(right?.march || 0) - Number(left?.march || 0) ||
                String(left?.name || "").localeCompare(
                  String(right?.name || ""),
                ),
            )
        : [];

      lines.push(`[${title}]`);
      if (captain) {
        lines.push(
          normalizePlayerLine(
            captain,
            Number(boardState?.captainMarch || captain?.march || 0) || 0,
          ),
        );
      }
      helpers.forEach((helper) => {
        lines.push(
          normalizePlayerLine(
            helper,
            getAssignedMarch(
              boardState?.baseLike || base,
              helper,
              normalizedShift,
            ),
          ),
        );
      });
      if (!captain && !helpers.length) {
        lines.push(tr("no_assigned_players", "Немає призначених гравців"));
      }
      lines.push("");
    });
    return lines.join("\n").trim() + "\n";
  }

  function buildBoardTxtAllShifts() {
    return [
      buildBoardTxtForShift("shift1"),
      buildBoardTxtForShift("shift2"),
    ].join("\n");
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
    if (!sheet || typeof window.html2canvas !== "function") {
      throw new Error("html2canvas_unavailable");
    }

    const exportScale = Math.max(
      2,
      Math.min(4, Number(options.scale || getPreferredPngScale()) || 3),
    );

    const cleanup = [];

    try {
      const sandbox = document.createElement("div");
      sandbox.style.position = "fixed";
      sandbox.style.left = "-100000px";
      sandbox.style.top = "0";
      sandbox.style.pointerEvents = "none";
      sandbox.style.opacity = "1";
      sandbox.style.zIndex = "-1";
      sandbox.style.overflow = "visible";
      sandbox.style.background = "#d9dde6";
      document.body.appendChild(sandbox);
      cleanup.push(() => sandbox.remove());

      const style = document.createElement("style");
      style.textContent = `
  .png-export-sheet {
    display: block;
    width: max-content;
    max-width: none;
    min-width: 0;
    overflow: visible;
    box-sizing: border-box;
    margin: 0;
    padding: 10px 12px;
    background: #d7dde6;
  }

  .png-export-sheet .board-grid {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 10px;
    width: max-content;
    max-width: none;
    min-width: 0;
    overflow: visible;
  }

  .png-export-sheet .board-col {
    flex: 0 0 272px;
    width: 272px;
    min-width: 272px;
    max-width: 272px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .png-export-sheet .board-cap > span {
    border: 0;
    outline: 0;
    box-shadow: none;
    text-shadow: none;
    background-image: none;
    filter: none;
    border-radius: 8px;
    padding: 6px 10px;
    font-weight: 800;
    line-height: 1;
    display: block;
    text-align: center;
  }

  .png-export-sheet .board-cap > .cap-total {
    background: #4e73c6;
    color: #f9fbff;
  }

  .png-export-sheet .board-cap > .cap-free {
    background: #5aa174;
    color: #f8fff9;
  }

  .png-export-sheet .board-cap > .cap-used {
    background: #f1bb3e;
    color: #1c1400;
  }
`;
      sandbox.appendChild(style);
      cleanup.push(() => style.remove());

      const exportSheet = sheet.cloneNode(true);
      exportSheet.classList.add("png-export-sheet");
      sandbox.appendChild(exportSheet);

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      const exportGrid = exportSheet.querySelector(".board-grid");

      const exportWidth = Math.ceil(
        Math.max(
          exportSheet.scrollWidth || 0,
          exportGrid?.scrollWidth || 0,
          exportSheet.getBoundingClientRect().width || 0,
        ),
      );

      const exportHeight = Math.ceil(
        Math.max(
          exportSheet.scrollHeight || 0,
          exportSheet.getBoundingClientRect().height || 0,
        ),
      );

      const canvas = await window.html2canvas(exportSheet, {
        backgroundColor: null,
        scale: exportScale,
        useCORS: true,
        logging: false,
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
        scrollX: 0,
        scrollY: 0,
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
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error("png_blob_failed")),
            "image/png",
          );
        } catch (err) {
          reject(err);
        }
      });
    } finally {
      cleanup.reverse().forEach((fn) => {
        try {
          fn();
        } catch {}
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
      if (
        typeof navigator.canShare !== "function" ||
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ title, text, files: [file] });
        return true;
      }
    }
    return false;
  }

  async function tryCopyPngBlob(blob) {
    if (!blob) return false;
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return true;
    }
    return false;
  }

  function getBoardSheet() {
    return (
      document.querySelector("#boardModalPreviewSheet .board-sheet") ||
      document.querySelector(
        "#board-modal #boardModalPreviewSheet .board-sheet",
      ) ||
      document.querySelector("#board-modal #boardModalPreviewSheet")
    );
  }

  function getBoardShift() {
    const active = document.querySelector(
      "#board-modal [data-shift-tab].active, #board-modal [data-calc-preview-shift].active",
    );
    const value = String(
      active?.getAttribute?.("data-shift-tab") ||
        active?.getAttribute?.("data-calc-preview-shift") ||
        "shift1",
    );
    return value.toLowerCase() === "shift2" ? "shift2" : "shift1";
  }

  window.exportBoardAsPNG = async function (options = {}) {
    const sheet = options.sheet || getBoardSheet();
    const shift =
      String(options.shift || getBoardShift()).toLowerCase() === "shift2"
        ? "shift2"
        : "shift1";
    const shiftText = shiftLabel(shift);
    const statusEl = options.statusEl || getBoardStatusEl();
    if (!sheet) {
      alert(tr("no_final_plan_export", "Немає фінального плану для експорту."));
      return false;
    }
    if (typeof window.html2canvas !== "function") {
      const message = window.__PNS_OFFLINE_NO_HTML2CANVAS__
        ? tr(
            "png_export_offline",
            "PNG export недоступний в offline-пакеті без локальної бібліотеки html2canvas.",
          )
        : tr("html2canvas_missing", "html2canvas не завантажився.");
      if (statusEl) statusEl.textContent = message;
      alert(message);
      return false;
    }
    try {
      if (statusEl)
        statusEl.textContent = `${tr("preparing_png", "Готуємо PNG")} · ${shiftText}…`;
      const blob = await renderSheetToPngBlob(sheet, { scale: options.scale });
      const filename = options.filename || `pns-final-board-${shift}.png`;
      downloadBlob(filename, blob);
      if (statusEl)
        statusEl.textContent = `${tr("png_saved", "PNG збережено")} · ${shiftText}.`;
      return true;
    } catch (err) {
      console.error(err);
      if (statusEl)
        statusEl.textContent = tr("png_failed", "Не вдалося згенерувати PNG.");
      alert(tr("png_failed", "Не вдалося згенерувати PNG."));
      return false;
    }
  };

  window.shareBoardAsImage = async function (options = {}) {
    const sheet = options.sheet || getBoardSheet();
    const shift =
      String(options.shift || getBoardShift()).toLowerCase() === "shift2"
        ? "shift2"
        : "shift1";
    const shiftText = shiftLabel(shift);
    const statusEl = options.statusEl || getBoardStatusEl();
    if (!sheet) {
      alert(tr("no_final_plan_share", "Немає фінального плану для поширення."));
      return false;
    }
    try {
      if (statusEl)
        statusEl.textContent = `${tr("preparing_share", "Готуємо поширення")} · ${shiftText}…`;
      const blob = await renderSheetToPngBlob(sheet);
      const title = `P&S ${tr("final_plan", "Фінальний план")}`;
      const text = `${tr("final_plan", "Фінальний план")} ${shiftText}`;
      const filename = `pns-final-board-${shift}.png`;
      if (await trySharePngBlob(blob, filename, title, text)) {
        if (statusEl)
          statusEl.textContent = `${tr("board_shared", "План поширено")} · ${shiftText}.`;
        return true;
      }
      if (await tryCopyPngBlob(blob)) {
        if (statusEl)
          statusEl.textContent = `${tr("board_copied_image", "PNG план скопійовано в буфер")} · ${shiftText}.`;
        return true;
      }
      downloadBlob(filename, blob);
      if (statusEl)
        statusEl.textContent = `${tr("png_saved", "PNG збережено")} · ${shiftText}.`;
      return true;
    } catch (err) {
      if (err && (err.name === "AbortError" || err.message === "AbortError")) {
        if (statusEl)
          statusEl.textContent = tr("share_cancelled", "Поширення скасовано.");
        return false;
      }
      console.error(err);
      if (statusEl)
        statusEl.textContent = tr(
          "share_board_failed",
          "Не вдалося поширити фінальний план.",
        );
      alert(tr("share_board_failed", "Не вдалося поширити фінальний план."));
      return false;
    }
  };

  window.exportBoardAsTXT = function () {
    const statusEl = getBoardStatusEl();
    try {
      const text = buildBoardTxtAllShifts();
      if (!String(text || "").trim()) {
        alert(
          tr("no_final_plan_export", "Немає фінального плану для експорту."),
        );
        return false;
      }
      if (statusEl) statusEl.textContent = tr("preparing_txt", "Готуємо TXT…");
      downloadTextFile("pns-final-plan-shift1-shift2.txt", text);
      if (statusEl) statusEl.textContent = tr("txt_saved", "TXT збережено.");
      return true;
    } catch (err) {
      console.error(err);
      if (statusEl)
        statusEl.textContent = tr("txt_failed", "Не вдалося зберегти TXT.");
      alert(tr("txt_failed", "Не вдалося зберегти TXT."));
      return false;
    }
  };

  window.calcExportPreviewBoardPng = async function () {
    return await window.exportBoardAsPNG({
      sheet: getPreviewSheet(),
      shift: getPreviewShift(),
      statusEl: getPreviewStatusEl(),
    });
  };

  window.calcSharePreviewBoard = async function () {
    return await window.shareBoardAsImage({
      sheet: getPreviewSheet(),
      shift: getPreviewShift(),
      statusEl: getPreviewStatusEl(),
    });
  };

  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented) return;
    const btn = ev.target.closest(
      "#exportBoardTxtBtn,[data-calc-preview-export-txt]",
    );
    if (!btn) return;
    ev.preventDefault();
    try {
      window.exportBoardAsTXT?.();
    } catch (err) {
      console.error(err);
    }
  });
})();
