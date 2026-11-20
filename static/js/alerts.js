// alerts.js - alert list with filters, search, severity and the "This was me" button.

let allAlerts = [];
let filter = "all";   // all | others | mine
let query = "";

function visibleAlerts() {
  const q = query.trim().toLowerCase();
  return allAlerts.filter((a) => {
    if (filter === "others" && a.trusted) return false;
    if (filter === "mine" && !a.trusted) return false;
    if (!q) return true;
    return [a.file_name, a.folder, a.ip_address].some((v) => String(v || "").toLowerCase().includes(q));
  });
}

function renderAlerts() {
  const body = document.getElementById("alerts-body");
  const rows = visibleAlerts();

  if (allAlerts.length === 0) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty"><span class="icon">∅</span>
      No alerts yet. Press <kbd>S</kbd> on the dashboard to simulate an intruder.</div></td></tr>`;
    return;
  }
  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty"><span class="icon">∅</span>
      Nothing matches this filter.</div></td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (a) => `
      <tr class="${a.trusted ? "" : "row-alert"}">
        <td>${escapeHtml(a.triggered_at)}</td>
        <td>${escapeHtml(a.file_name || "(deleted token)")}</td>
        <td>${escapeHtml(a.folder || "-")}</td>
        <td>
          ${escapeHtml(a.ip_address)}<br>
          <small class="muted" title="${escapeHtml(a.user_agent)}">${escapeHtml((a.user_agent || "").slice(0, 50))}</small>
        </td>
        <td>${a.trusted
          ? `<span class="badge good">Your device</span>`
          : `<span class="badge bad">OTHER user</span>`}</td>
        <td>${levelBadge(a.severity)}</td>
        <td>${a.trusted
          ? ""
          : `<button class="btn btn-small" data-trust="${a.id}">This was me</button>`}</td>
      </tr>`
    )
    .join("");
}

onCanaryUpdate((data) => {
  allAlerts = data.alerts;
  renderAlerts();
});

document.getElementById("search").addEventListener("input", (event) => {
  query = event.target.value;
  renderAlerts();
});

document.querySelector(".filters").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (!chip) return;
  filter = chip.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((c) => c.classList.toggle("on", c === chip));
  renderAlerts();
});

// "This was me": remember this device so its opens stop raising the risk
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-trust]");
  if (!button) return;
  button.disabled = true;
  await fetch(`/api/alerts/${button.dataset.trust}/trust`, { method: "POST" });
  showToast("Device saved as yours. Its opens will no longer raise the risk.", 5, "low");
});
