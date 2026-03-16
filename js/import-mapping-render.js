/* ==== import-mapping-render.js ==== */
/* Import wizard: mapping UI render */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const n = wiz.formatMessage;
  const i = wiz.REQUIRED_FIELDS || [];
  const c = wiz.CUSTOM_VISIBLE_FIELDS || [];
  const p = wiz.CUSTOM_LABEL_FALLBACKS || {};
  const f = wiz.normalizeCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const b = wiz.ensureCustomOptionalDefs;
  const S = wiz.getImportUiNodes;
  const C = wiz.syncFileInputUI;
  const k = wiz.setImportStatus;
  const I = wiz.getFieldDefByKey;
  const L = wiz.getFieldLabel;
  const q = wiz.ensureImportState;
  const D = wiz.validateImportReady;
  const m = wiz.getBuiltinCustomDefs;
  const _ = wiz.persistCustomOptionalDefs;
  const h = wiz.slugifyImportKey;
  const U = wiz.saveImportTemplate;
function O() {
    const a = t.importData.headers || [];
    (q(),
      (function () {
        try {
          const e = f(g());
          ((t.importData.customOptionalDefs = e), _(e));
        } catch {}
        try {
          const a =
              t.fieldLabelOverrides && "object" == typeof t.fieldLabelOverrides
                ? { ...t.fieldLabelOverrides }
                : {},
            r = [];
          (a.reserve_type_fighter &&
            a.reserve_type_fighter !== p.reserve_type_fighter &&
            ((a.reserve_type_fighter = p.reserve_type_fighter),
            r.push("reserve_type_fighter")),
            a.reserve_type_rider &&
              a.reserve_type_rider !== p.reserve_type_rider &&
              ((a.reserve_type_rider = p.reserve_type_rider),
              r.push("reserve_type_rider")),
            a.reserve_type_shooter &&
              a.reserve_type_shooter !== p.reserve_type_shooter &&
              ((a.reserve_type_shooter = p.reserve_type_shooter),
              r.push("reserve_type_shooter")),
            r.length &&
              ((t.fieldLabelOverrides = a),
              "function" == typeof e.saveFieldLabelOverrides &&
                e.saveFieldLabelOverrides()));
        } catch {}
      })());
    const n = S();
    if (
      (n.requiredMappingContainer &&
        ((n.requiredMappingContainer.innerHTML = ""),
        i
          .filter((e) => e.required)
          .forEach((o) => {
            const i = document.createElement("div");
            i.className = "mapping-row required";
            const s = L(o.key);
            i.innerHTML = e.renderHtmlTemplate(
              "tpl-import-required-mapping-head",
              {
                title_html: e.renderHtmlTemplate("tpl-import-required-title", {
                  label: e.escapeHtml(s),
                }),
                edit_text: r("edit", "Редагувати"),
              },
            );
            const l = document.createElement("input");
            ((l.type = "text"),
              (l.className = "field-label-input"),
              (l.value = s),
              l.addEventListener("change", () => {
                ("function" == typeof e.setFieldLabelOverride &&
                  e.setFieldLabelOverride(o.key, l.value),
                  O(),
                  U?.({ silent: !0 }));
              }),
              i.appendChild(l));
            const c = document.createElement("select");
            c.dataset.mapField = o.key;
            const d = document.createElement("option");
            ((d.value = ""),
              (d.textContent = r(
                "choose_column_placeholder",
                "— вибери колонку —",
              )),
              c.appendChild(d),
              a.forEach((e) => {
                const t = document.createElement("option");
                ((t.value = e), (t.textContent = e), c.appendChild(t));
              }),
              (c.value = t.importData.mapping[o.key] || ""),
              c.addEventListener("change", () => {
                ((t.importData.mapping[o.key] = c.value), D(), U?.({ silent: !0 }));
              }),
              i.appendChild(c));
            const u = i.querySelector(".mapping-edit-btn");
            (u &&
              u.addEventListener("click", (e) => {
                (e.preventDefault(),
                  i.classList.toggle("edit-open"),
                  i.classList.contains("edit-open") && l.focus());
              }),
              n.requiredMappingContainer.appendChild(i));
          })),
      n.optionalMappingContainer)
    ) {
      ((n.optionalMappingContainer.innerHTML = ""),
        [...c, ...b()].forEach((o) => {
          const i = document.createElement("div");
          ((i.className = "mapping-row" + (o.isCustom ? " is-custom-row" : "")),
            (i.dataset.mapKey = o.key));
          const s = o.isCustom ? String(o.label || "").trim() : L(o.key),
            l = e.renderHtmlTemplate("tpl-import-mapping-meta", {
              title: e.escapeHtml(s),
              meta_text: o.isCustom
                ? r("custom_column_label", "кастомна")
                : r("extra_column_label", "додаткова"),
            });
          i.innerHTML = e.renderHtmlTemplate(
            "tpl-import-optional-mapping-head",
            {
              title_html: l,
              remove_btn_html: o.isCustom
                ? e.renderHtmlTemplate("tpl-import-remove-button", {
                    title: r(
                      "remove_extra_column",
                      "Видалити додаткову колонку",
                    ),
                  })
                : "",
              edit_text: r("edit", "Редагувати"),
            },
          );
          const c = document.createElement("input");
          ((c.type = "text"),
            (c.className = "field-label-input"),
            (c.value = s),
            (c.placeholder = o.isCustom
              ? r("custom_column_name_placeholder", "Назва кастомної колонки")
              : ""),
            c.addEventListener("change", () => {
              if (o.isCustom) {
                const e = g().map((e) =>
                  e.key === o.key ? { ...e, label: c.value || e.label } : e,
                );
                ((t.importData.customOptionalDefs = f(e)),
                  _(t.importData.customOptionalDefs));
              } else
                "function" == typeof e.setFieldLabelOverride &&
                  e.setFieldLabelOverride(o.key, c.value);
              O(),
              U?.({ silent: !0 });
            }),
            i.appendChild(c));
          const d = document.createElement("select");
          d.dataset.mapField = o.key;
          const u = document.createElement("option");
          ((u.value = ""),
            (u.textContent = r("not_mapped_placeholder", "— не прив’язано —")),
            d.appendChild(u),
            a.forEach((e) => {
              const t = document.createElement("option");
              ((t.value = e), (t.textContent = e), d.appendChild(t));
            }),
            (d.value = t.importData.mapping[o.key] || ""),
            d.addEventListener("change", () => {
              t.importData.mapping[o.key] = d.value;
              U?.({ silent: !0 });
            }),
            i.appendChild(d));
          const p = i.querySelector(".mapping-edit-btn");
          p &&
            p.addEventListener("click", (e) => {
              (e.preventDefault(),
                i.classList.toggle("edit-open"),
                i.classList.contains("edit-open") && c.focus());
            });
          const h = i.querySelector(".mapping-remove-btn");
          (h &&
            h.addEventListener("click", (a) => {
              (a.preventDefault(),
                (function (a) {
                  const r = String(a || "");
                  if (!r) return;
                  const n = g().filter((e) => e.key !== r);
                  ((t.importData.customOptionalDefs = f(n.length ? n : m())),
                    _(t.importData.customOptionalDefs),
                    t.importData?.mapping &&
                      r in t.importData.mapping &&
                      delete t.importData.mapping[r],
                    Array.isArray(t.visibleOptionalColumns) &&
                      ((t.visibleOptionalColumns =
                        t.visibleOptionalColumns.filter((e) => e !== r)),
                      "function" == typeof e.saveVisibleOptionalColumns &&
                        e.saveVisibleOptionalColumns()),
                    O(),
                    U?.({ silent: !0 }));
                })(o.key));
            }),
            n.optionalMappingContainer.appendChild(i));
        }));
      const o = document.createElement("div");
      ((o.className = "mapping-row mapping-add-row"),
        (o.innerHTML = e.renderHtmlTemplate("tpl-import-add-extra-row", {
          button_text: r("add_extra_column", "+ Додати додаткову колонку"),
        })),
        o.querySelector(".mapping-add-btn")?.addEventListener("click", () =>
          (function () {
            const e = g().slice(),
              a = e.length + 1,
              n = String(
                r("custom_column_numbered", `Кастомна колонка ${a}`).replace(
                  "{n}",
                  String(a),
                ),
              ).trim();
            (e.push({
              key: `custom_opt_${Date.now()}_${a}_${h(n)}`,
              label: n,
              visibleDefault: !1,
            }),
              (t.importData.customOptionalDefs = f(e)),
              _(t.importData.customOptionalDefs));
            const o =
              t.importData.customOptionalDefs[
                t.importData.customOptionalDefs.length - 1
              ];
            (t.importData?.mapping &&
              !(o.key in t.importData.mapping) &&
              (t.importData.mapping[o.key] = ""),
              O(),
              U?.({ silent: !0 }));
            try {
              window.PNSI18N?.apply?.(
                document.getElementById("settings-modal") || document,
              );
            } catch {}
            try {
              window.PNSI18N?.apply?.(
                document.getElementById("settings-modal") || document,
              );
            } catch {}
            requestAnimationFrame(() => {
              try {
                const e = document.querySelector(
                  `#optionalMappingContainer .mapping-row[data-map-key="${CSS.escape(o.key)}"] .field-label-input`,
                );
                e && (e.focus(), e.select());
              } catch {}
            });
          })(),
        ),
        n.optionalMappingContainer.appendChild(o));
    }
    (n.columnVisibilityChecks &&
      ((n.columnVisibilityChecks.innerHTML = ""),
      [...c, ...g()].forEach((a) => {
        const r = a.colKey;
        if (!r) return;
        const o = document.createElement("label");
        o.className = "checkbox-row";
        const i = a.key && I(a.key) ? L(a.key) : a.label;
        o.innerHTML = e.renderHtmlTemplate(
          "tpl-import-column-visibility-check",
          { col_key: r, label_text: e.escapeHtml(i) },
        );
        const s = o.querySelector("input");
        ((s.checked = (t.visibleOptionalColumns || []).includes(r)),
          s.addEventListener("change", () => {
            const a = new Set(t.visibleOptionalColumns || []);
            (s.checked ? a.add(r) : a.delete(r),
              (t.visibleOptionalColumns = Array.from(a)),
              "function" == typeof e.saveVisibleOptionalColumns &&
                e.saveVisibleOptionalColumns(),
              "function" == typeof e.applyColumnVisibility &&
                e.applyColumnVisibility(t.showAllColumns),
              U?.({ silent: !0 }));
          }),
          n.columnVisibilityChecks.appendChild(o));
        try {
          window.PNSI18N?.apply?.(o);
        } catch {}
      })),
      D());
    try {
      C();
    } catch {}
  }

  Object.assign(wiz, { renderImportUI: O });
  e.renderImportUI = O;
})();
