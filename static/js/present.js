// present.js - the big-screen Live monitor. Uses the same data as every other page.

onCanaryUpdate((data) => {
  const gauge = document.getElementById("gauge");
  gauge.style.setProperty("--pct", data.system_risk.percent);
  gauge.className = `gauge ${levelClass(data.system_risk.level)}`;
  document.getElementById("gauge-value").textContent = `${data.system_risk.percent}%`;
  document.getElementById("gauge-label").textContent = `${data.system_risk.level} risk`;

  const n = data.tokens.length;
  document.getElementById("present-tokens").textContent =
    `${n} canary token${n === 1 ? "" : "s"} placed · updates every 4 seconds`;

  document.getElementById("present-folders").innerHTML = data.folders.length
    ? data.folders
        .map(
          (f) => `
        <div class="pcard ${levelClass(f.risk_level)}">
          <span>${escapeHtml(f.name)}</span><strong>${f.risk_percent}%</strong>
        </div>`
        )
        .join("")
    : `<p class="muted">No folders yet. Generate a token to start.</p>`;

  document.getElementById("feed").innerHTML = data.alerts.length
    ? data.alerts
        .slice(0, 6)
        .map(
          (a) => `
        <li class="${a.trusted ? "" : "row-alert"}">
          <span class="muted">${escapeHtml(a.triggered_at)}</span>
          <strong>${escapeHtml(a.file_name || "Canary file")}</strong>
          ${a.trusted ? "your device" : `<span class="badge bad">OTHER user</span>`}
          ${levelBadge(a.severity)}
        </li>`
        )
        .join("")
    : `<li class="muted">Waiting for activity…</li>`;
});
