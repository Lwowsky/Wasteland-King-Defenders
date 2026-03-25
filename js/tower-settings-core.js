/* Tower settings helpers/core extracted from tower-settings.js */
(function(){const e=window.PNS;if(!e)return;const{$:n}=e;
function o(e){const t=String(e||"").trim().toLowerCase();try{return t.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/(^-|-$)/g,"")||"base"}catch{return t.replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||"base"}}function i(e,t,a=!0){e&&(e.classList.remove("shooter-theme","fighter-theme","rider-theme"),"Shooter"===t?e.classList.add("shooter-theme"):"Fighter"===t?e.classList.add("fighter-theme"):"Rider"===t&&e.classList.add("rider-theme"))}function s(t,a){t.role=a||null,i(t.cardEl,t.role,!0),i(t.boardEl,t.role,!1);const r=n(".base-type",t.cardEl),o=n(".base-role",t.cardEl);if(r&&(r.textContent=t.role?`${"function"==typeof e.t?e.t("turret"):"Турель"}: ${"function"==typeof e.roleLabel?e.roleLabel(t.role,!0).toLowerCase():String(t.role||"").toLowerCase()}`:"function"==typeof e.t?e.t("type_defined_by_captain"):"Тип турелі визначається капітаном"),o&&(o.classList.remove("shooter","fighter","rider","is-auto","is-hidden"),t.role?(o.textContent="function"==typeof e.roleLabel?e.roleLabel(t.role):t.role,o.classList.add(t.role.toLowerCase())):(o.textContent="function"==typeof e.t?e.t("type_defined_by_captain"):"Auto",o.classList.add("is-auto"))),t.boardEl){const a=n(".board-sub",t.boardEl);a&&(a.classList.toggle("is-auto",!t.role),a.textContent=t.role?`${"function"==typeof e.roleLabel?e.roleLabel(t.role):t.role}`:"function"==typeof e.t?e.t("type_defined_by_captain"):"Тип визначається капітаном")}}function l(t){if(!t?.cardEl)return;const a=("function"==typeof e.isLegacyBaseEditorEnabled&&e.isLegacyBaseEditorEnabled()?n(".base-editor",t.cardEl):null)||t.cardEl,r=n("[data-v4-maxhelpers]",a);r&&(r.value=String(e.clampInt(t.maxHelpers,29))),["T14","T13","T12","T11","T10","T9"].forEach(r=>{const n=a.querySelector(`[data-v4-tier="${r}"]`);n&&(n.value=String(e.clampInt(t?.tierMinMarch?.[r],0)))}),t.cardEl.dataset.baseMaxHelpers=String(e.clampInt(t.maxHelpers,29)),["T14","T13","T12","T11","T10","T9"].forEach(a=>{t.cardEl.dataset["tierMin"+a]=String(e.clampInt(t?.tierMinMarch?.[a],0))})}function c(e,t=0){const a=String(e||"").toLowerCase();return/(테크|기술\s*허브|техно|tech|hub|центр)/i.test(a)?"hub":/(북쪽\s*포탑|північ|north|север)/i.test(a)?"north":/(서쪽\s*포탑|захід|west|запад)/i.test(a)?"west":/(동쪽\s*포탑|схід|east|восток)/i.test(a)?"east":/(남쪽\s*포탑|півден|south|юж)/i.test(a)?"south":["hub","north","west","east","south"][Number(t)||0]||`slot-${t}`}function d(e,t=0){return c(String(e||"").split("/")[0].trim(),t)||o(String(e||"").split("/")[0].trim())}e.renderQuotaRow=e.renderQuotaRow||function(e){},e.slug=o,e.setRoleTheme=i,e.applyBaseRoleUI=s
const t=e.__pnsTowerSettingsCore=e.__pnsTowerSettingsCore||{};
t.slug=o,
t.setRoleTheme=i,
t.applyBaseRoleUI=s,
t.syncBaseEditorSettingsInputs=l,
t.towerSlotFromText=c,
t.resolveBoardBaseSlotId=d,
e.renderQuotaRow=e.renderQuotaRow||function(e){},
e.slug=o,
e.setRoleTheme=i,
e.applyBaseRoleUI=s,
e.syncBaseEditorSettingsInputs=l,
e.towerSlotFromText=c;
}());
