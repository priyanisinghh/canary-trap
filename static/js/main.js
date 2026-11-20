// main.js - loaded on every page.
// Every 4 seconds it asks the server for the latest state. It:
//   1. updates the overall risk indicator in the navigation bar
//   2. shows a colour-coded pop-up when a new canary alert appears

const canaryState = {
  lastAlertId: null,   // newest alert already shown
  listeners: [],       // page-specific functions that want fresh data
};

// Protects against HTML injection when we display text from the server
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

// "Critical" -> "level-critical" (the CSS class that sets the colour)
function levelClass(level) {
  return `level-${String(level).toLowerCase()}`;
}

// Coloured label, for example: High · 50%
function levelBadge(level, percent = null) {
  const text = percent === null ? level : `${level} · ${percent}%`;
  return `<span class="level-badge ${levelClass(level)}">${escapeHtml(text)}</span>`;
}

function showToast(html, seconds = 8, level = "high") {
  const toast = document.createElement("div");
  toast.className = `toast ${levelClass(level)}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<div class="toast-body">${html}</div>
    <button class="toast-x" aria-label="Close">×</button>
    <div class="toast-bar" style="animation-duration: ${seconds}s"></div>`;
  toast.querySelector(".toast-x").onclick = () => toast.remove();
  document.getElementById("toast-area").appendChild(toast);
  setTimeout(() => toast.remove(), seconds * 1000);
}

// Pages call onCanaryUpdate(function) to receive fresh data on every check
function onCanaryUpdate(fn) {
  canaryState.listeners.push(fn);
}

// Shows the overall system risk in the navigation bar
function updateSystemRisk(risk) {
  const pill = document.getElementById("system-risk");
  if (!pill || !risk) return;
  pill.textContent = `● Risk: ${risk.level} (${risk.percent}%)`;
  pill.className = `risk-pill ${levelClass(risk.level)}`;
}

async function checkServer() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();

    updateSystemRisk(data.system_risk);

    // Pop-up only when a NEW alert arrives (not on the very first load)
    if (
      canaryState.lastAlertId !== null &&
      data.latest_alert &&
      data.latest_alert_id !== canaryState.lastAlertId
    ) {
      const a = data.latest_alert;
      const who = a.trusted ? "your own device" : "<strong>OTHER user</strong>";
      showToast(
        `<strong>${escapeHtml(a.file_name || "Canary file")}</strong> was opened at
         ${escapeHtml(a.triggered_at)} by ${who}.<br>
         Severity: <strong>${escapeHtml(a.severity)}</strong> · IP ${escapeHtml(a.ip_address)}`,
        8,
        a.severity
      );
      if (!a.trusted) startAlarm(a.severity);
    }

    canaryState.lastAlertId = data.latest_alert_id;
    canaryState.listeners.forEach((fn) => fn(data));
  } catch (err) {
    console.warn("CanaryTrap: cannot reach the server yet", err);
  }
  setTimeout(checkServer, 4000);
}

// Start checking once the page is fully loaded
document.addEventListener("DOMContentLoaded", checkServer);
