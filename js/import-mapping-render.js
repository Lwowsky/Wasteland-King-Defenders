/* ==== import-mapping-render.js ==== */
/* Import wizard: mapping UI render */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const i = wiz.REQUIRED_FIELDS || [];
  const c = wiz.CUSTOM_VISIBLE_FIELDS || [];
  const p = wiz.CUSTOM_LABEL_FALLBACKS || {};
  const f = wiz.normalizeCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const b = wiz.ensureCustomOptionalDefs;
  const S = wiz.getImportUiNodes;
  const C = wiz.syncFileInputUI;
  const I = wiz.getFieldDefByKey;
  const L = wiz.getFieldLabel;
  const q = wiz.ensureImportState;
  const D = wiz.validateImportReady;
  const m = wiz.getBuiltinCustomDefs;
  const _ = wiz.persistCustomOptionalDefs;
  const h = wiz.slugifyImportKey;
  const U = wiz.saveImportTemplate;

  function T(row, isOpen) {
    if (!row) return;
    row.classList.toggle("edit-open", !!isOpen);
    const btn = row.querySelector(".mapping-edit-btn");
    if (!btn) return;
    btn.dataset.mode = isOpen ? "save" : "edit";
    btn.setAttribute("aria-pressed", isOpen ? "true" : "false");
    const icon = btn.querySelector("[data-mapping-edit-icon]") ||
      btn.querySelector('span[aria-hidden="true"]');
    const label = btn.querySelector("[data-mapping-edit-label]") ||
      btn.querySelector("span:last-child");
    if (icon) icon.textContent = isOpen ? "✓" : "✎";
    if (label) {
      label.textContent = r(isOpen ? "save" : "edit", isOpen ? "Зберегти" : "Редагувати");
    }
  }

  function E(input) {
    try {
      input?.focus();
      input?.select?.();
    } catch {}
  }

  function A(rowSelector) {
    requestAnimationFrame(() => {
      try {
        const row = document.querySelector(rowSelector);
        if (!row) return;
        T(row, true);
        E(row.querySelector(".field-label-input"));
      } catch {}
    });
  }

  function O() {
    const a = t.importData.headers || [];
    q();

    try {
      const defs = f(g());
      t.importData.customOptionalDefs = defs;
      _(defs);
    } catch {}

    try {
      const overrides =
        t.fieldLabelOverrides && typeof t.fieldLabelOverrides == "object"
          ? { ...t.fieldLabelOverrides }
          : {};
      const changed = [];
      if (
        overrides.reserve_type_fighter &&
        overrides.reserve_type_fighter !== p.reserve_type_fighter
      ) {
        overrides.reserve_type_fighter = p.reserve_type_fighter;
        changed.push("reserve_type_fighter");
      }
      if (
        overrides.reserve_type_rider &&
        overrides.reserve_type_rider !== p.reserve_type_rider
      ) {
        overrides.reserve_type_rider = p.reserve_type_rider;
        changed.push("reserve_type_rider");
      }
      if (
        overrides.reserve_type_shooter &&
        overrides.reserve_type_shooter !== p.reserve_type_shooter
      ) {
        overrides.reserve_type_shooter = p.reserve_type_shooter;
        changed.push("reserve_type_shooter");
      }
      if (changed.length) {
        t.fieldLabelOverrides = overrides;
        if (typeof e.saveFieldLabelOverrides === "function") {
          e.saveFieldLabelOverrides();
        }
      }
    } catch {}

    const n = S();

    if (n.requiredMappingContainer) {
      n.requiredMappingContainer.innerHTML = "";
      i.filter((field) => field.required).forEach((field) => {
        const row = document.createElement("div");
        row.className = "mapping-row required";
        row.dataset.mapKey = field.key;

        const currentLabel = L(field.key);
        row.innerHTML = e.renderHtmlTemplate("tpl-import-required-mapping-head", {
          title_html: e.renderHtmlTemplate("tpl-import-required-title", {
            label: e.escapeHtml(currentLabel),
          }),
          edit_text: r("edit", "Редагувати"),
        });

        const input = document.createElement("input");
        input.type = "text";
        input.className = "field-label-input";
        input.value = currentLabel;

        const saveRequiredLabel = () => {
          if (typeof e.setFieldLabelOverride === "function") {
            e.setFieldLabelOverride(field.key, input.value);
          }
          O();
          U?.({ silent: true });
        };

        input.addEventListener("change", saveRequiredLabel);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveRequiredLabel();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            input.value = currentLabel;
            T(row, false);
          }
        });
        row.appendChild(input);

        const select = document.createElement("select");
        select.dataset.mapField = field.key;
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = r("choose_column_placeholder", "— вибери колонку —");
        select.appendChild(emptyOption);
        a.forEach((header) => {
          const option = document.createElement("option");
          option.value = header;
          option.textContent = header;
          select.appendChild(option);
        });
        select.value = t.importData.mapping[field.key] || "";
        select.addEventListener("change", () => {
          t.importData.mapping[field.key] = select.value;
          D();
          U?.({ silent: true });
        });
        row.appendChild(select);

        const editBtn = row.querySelector(".mapping-edit-btn");
        if (editBtn) {
          T(row, false);
          editBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (row.classList.contains("edit-open")) {
              saveRequiredLabel();
              return;
            }
            T(row, true);
            E(input);
          });
        }

        n.requiredMappingContainer.appendChild(row);
      });
    }

    if (n.optionalMappingContainer) {
      n.optionalMappingContainer.innerHTML = "";

      [...c, ...b()].forEach((field) => {
        const row = document.createElement("div");
        row.className = "mapping-row" + (field.isCustom ? " is-custom-row" : "");
        row.dataset.mapKey = field.key;

        const currentLabel = field.isCustom ? String(field.label || "").trim() : L(field.key);
        const titleHtml = e.renderHtmlTemplate("tpl-import-mapping-meta", {
          title: e.escapeHtml(currentLabel),
          meta_text: field.isCustom
            ? r("custom_column_label", "кастомна")
            : r("extra_column_label", "додаткова"),
        });

        row.innerHTML = e.renderHtmlTemplate("tpl-import-optional-mapping-head", {
          title_html: titleHtml,
          remove_btn_html: field.isCustom
            ? e.renderHtmlTemplate("tpl-import-remove-button", {
                title: r("remove_extra_column", "Видалити додаткову колонку"),
              })
            : "",
          edit_text: r("edit", "Редагувати"),
        });

        const input = document.createElement("input");
        input.type = "text";
        input.className = "field-label-input";
        input.value = currentLabel;
        input.placeholder = field.isCustom
          ? r("custom_column_name_placeholder", "Назва кастомної колонки")
          : "";

        const saveOptionalLabel = () => {
          if (field.isCustom) {
            const updatedDefs = g().map((item) =>
              item.key === field.key ? { ...item, label: input.value || item.label } : item,
            );
            t.importData.customOptionalDefs = f(updatedDefs);
            _(t.importData.customOptionalDefs);
          } else if (typeof e.setFieldLabelOverride === "function") {
            e.setFieldLabelOverride(field.key, input.value);
          }
          O();
          U?.({ silent: true });
        };

        input.addEventListener("change", saveOptionalLabel);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveOptionalLabel();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            input.value = currentLabel;
            T(row, false);
          }
        });
        row.appendChild(input);

        const select = document.createElement("select");
        select.dataset.mapField = field.key;
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = r("not_mapped_placeholder", "— не прив’язано —");
        select.appendChild(emptyOption);
        a.forEach((header) => {
          const option = document.createElement("option");
          option.value = header;
          option.textContent = header;
          select.appendChild(option);
        });
        select.value = t.importData.mapping[field.key] || "";
        select.addEventListener("change", () => {
          t.importData.mapping[field.key] = select.value;
          U?.({ silent: true });
        });
        row.appendChild(select);

        const editBtn = row.querySelector(".mapping-edit-btn");
        if (editBtn) {
          T(row, false);
          editBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (row.classList.contains("edit-open")) {
              saveOptionalLabel();
              return;
            }
            T(row, true);
            E(input);
          });
        }

        const removeBtn = row.querySelector(".mapping-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            const key = String(field.key || "");
            if (!key) return;
            const updatedDefs = g().filter((item) => item.key !== key);
            t.importData.customOptionalDefs = f(updatedDefs.length ? updatedDefs : m());
            _(t.importData.customOptionalDefs);
            if (t.importData?.mapping && key in t.importData.mapping) {
              delete t.importData.mapping[key];
            }
            if (Array.isArray(t.visibleOptionalColumns)) {
              t.visibleOptionalColumns = t.visibleOptionalColumns.filter((col) => col !== key);
              if (typeof e.saveVisibleOptionalColumns === "function") {
                e.saveVisibleOptionalColumns();
              }
            }
            O();
            U?.({ silent: true });
          });
        }

        n.optionalMappingContainer.appendChild(row);
      });

      const addRow = document.createElement("div");
      addRow.className = "mapping-row mapping-add-row";
      addRow.innerHTML = e.renderHtmlTemplate("tpl-import-add-extra-row", {
        button_text: r("add_extra_column", "+ Додати додаткову колонку"),
      });
      addRow.querySelector(".mapping-add-btn")?.addEventListener("click", () => {
        const defs = g().slice();
        const index = defs.length + 1;
        const label = String(
          r("custom_column_numbered", `Кастомна колонка ${index}`).replace("{n}", String(index)),
        ).trim();

        defs.push({
          key: `custom_opt_${Date.now()}_${index}_${h(label)}`,
          label,
          visibleDefault: false,
        });

        t.importData.customOptionalDefs = f(defs);
        _(t.importData.customOptionalDefs);

        const createdDef =
          t.importData.customOptionalDefs[t.importData.customOptionalDefs.length - 1];

        if (t.importData?.mapping && !(createdDef.key in t.importData.mapping)) {
          t.importData.mapping[createdDef.key] = "";
        }

        O();
        try {
          window.PNSI18N?.apply?.(document.getElementById("settings-modal") || document);
        } catch {}
        A(
          `#optionalMappingContainer .mapping-row[data-map-key="${CSS.escape(createdDef.key)}"]`,
        );
        U?.({ silent: true });
      });
      n.optionalMappingContainer.appendChild(addRow);
    }

    if (n.columnVisibilityChecks) {
      n.columnVisibilityChecks.innerHTML = "";
      [...c, ...g()].forEach((field) => {
        const colKey = field.colKey;
        if (!colKey) return;
        const checkboxRow = document.createElement("label");
        checkboxRow.className = "checkbox-row";
        const labelText = field.key && I(field.key) ? L(field.key) : field.label;
        checkboxRow.innerHTML = e.renderHtmlTemplate("tpl-import-column-visibility-check", {
          col_key: colKey,
          label_text: e.escapeHtml(labelText),
        });
        const checkbox = checkboxRow.querySelector("input");
        checkbox.checked = (t.visibleOptionalColumns || []).includes(colKey);
        checkbox.addEventListener("change", () => {
          const next = new Set(t.visibleOptionalColumns || []);
          if (checkbox.checked) next.add(colKey);
          else next.delete(colKey);
          t.visibleOptionalColumns = Array.from(next);
          if (typeof e.saveVisibleOptionalColumns === "function") {
            e.saveVisibleOptionalColumns();
          }
          if (typeof e.applyColumnVisibility === "function") {
            e.applyColumnVisibility(t.showAllColumns);
          }
          U?.({ silent: true });
        });
        n.columnVisibilityChecks.appendChild(checkboxRow);
        try {
          window.PNSI18N?.apply?.(checkboxRow);
        } catch {}
      });
    }

    D();
    try {
      C();
    } catch {}
  }

  Object.assign(wiz, { renderImportUI: O });
  e.renderImportUI = O;
})();
