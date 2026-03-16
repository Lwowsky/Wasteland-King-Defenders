/* Assignment status helpers */
(function(){
  const e = window.PNS;
  if (!e) return;

  e.assignmentText = function assignmentText(key, fallback="") {
    return typeof e.t === "function" ? e.t(key, fallback) : fallback;
  };

  e.assignmentRoleLabel = function assignmentRoleLabel(role, short=false) {
    return typeof e.roleLabel === "function" ? e.roleLabel(role, short) : String(role || "");
  };

  e.assignmentShiftLabel = function assignmentShiftLabel(shift) {
    return typeof e.shiftLabel === "function" ? e.shiftLabel(shift) : String(shift || "");
  };

  e.setRowStatus = function setRowStatus(player, text, className="") {
    const statusEl = player?.actionCellEl?.querySelector?.(".row-status");
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className = "row-status" + (className ? ` ${className}` : "");
  };
}());
