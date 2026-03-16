/* ==== import-status-ui.js ==== */
/* Import wizard: status UI, file input shell, DOM node lookups */
(function () {
  const PNS = window.PNS;
  if (!PNS) return;
  const wiz = (PNS.ImportWizard = PNS.ImportWizard || {});
  const r = wiz.translate || ((t, a = "") => ("function" == typeof PNS.t ? PNS.t(t, a) : a));
  function S() {
    return {
      requiredMappingContainer: document.querySelector(
        "#requiredMappingContainer",
      ),
      optionalMappingContainer: document.querySelector(
        "#optionalMappingContainer",
      ),
      columnVisibilityChecks: document.querySelector("#columnVisibilityChecks"),
      importLoadedInfo: document.querySelector("#importLoadedInfo"),
      importStatusInfo: document.querySelector("#importStatusInfo"),
    };
  }
  function v() {
    return {
      fileInputMock: document.querySelector("#fileInputMock"),
      urlInputMock: document.querySelector("#urlInputMock"),
      loadUrlMockBtn: document.querySelector("#loadUrlMockBtn"),
      detectColumnsMockBtn: document.querySelector("#detectColumnsMockBtn"),
      saveVisibleColumnsMockBtn: document.querySelector(
        "#saveVisibleColumnsMockBtn",
      ),
      saveTemplateMockBtns: Array.from(
        document.querySelectorAll("[data-save-import-template]"),
      ),
      applyImportMockBtn: document.querySelector("#applyImportMockBtn"),
      resetAllStorageBtn: document.querySelector("#resetAllStorageBtn"),
      resetColumnDataBtn: document.querySelector("#resetColumnDataBtn"),
      resetTableDataBtn: document.querySelector("#resetTableDataBtn"),
    };
  }
  function C() {
    const e = v().fileInputMock;
    if (!e) return;
    const t = e.closest(".file-drop, .import-upload-card") || e.parentElement;
    if (!t) return;
    ((t.style.position = t.style.position || "relative"),
      e.classList.add("pns-file-input-native"));
    let a = t.querySelector(".pns-file-input-ui");
    (a ||
      ((a = document.createElement("div")),
      (a.className = "pns-file-input-ui"),
      (a.innerHTML = PNS.renderHtmlTemplate("tpl-file-input-ui", {})),
      t.appendChild(a)),
      a.dataset.boundClick ||
        ((a.dataset.boundClick = "1"),
        a.addEventListener("click", (t) => {
          t.preventDefault();
          try {
            e.click();
          } catch {}
        })),
      t.dataset.boundFileClick ||
        ((t.dataset.boundFileClick = "1"),
        t.addEventListener("click", (t) => {
          if (
            !(
              (t.target && t.target.closest(".pns-file-input-ui")) ||
              t.target === e
            )
          )
            try {
              e.click();
            } catch {}
        })));
    const n = a.querySelector(".pns-file-input-btn"),
      o = a.querySelector(".pns-file-input-name");
    if ((n && (n.textContent = r("choose_file", "Вибрати файл")), o)) {
      const t = e.files && e.files[0] ? e.files[0].name : "";
      o.textContent = t || r("no_file_selected", "Файл не вибрано");
    }
  }
  function T(e) {
    const t = S();
    t.importLoadedInfo && (t.importLoadedInfo.textContent = e || "");
  }
  function k(t, a) {
    if ("function" == typeof PNS.setImportStatus)
      return void PNS.setImportStatus(t, a);
    const r = S();
    r.importStatusInfo &&
      ((r.importStatusInfo.textContent = t || ""),
      (r.importStatusInfo.className = "muted small" + (a ? ` ${a}` : "")));
  }

  Object.assign(wiz, {
    getImportUiNodes: S,
    getImportActionNodes: v,
    syncFileInputUI: C,
    setImportLoadedInfo: T,
    setImportStatus: k,
  });
  PNS.setImportLoadedInfo = PNS.setImportLoadedInfo || T;
  PNS.setImportStatus = PNS.setImportStatus || k;
})();
