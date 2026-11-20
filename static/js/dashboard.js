// dashboard.js - risk banner, folder cards and the token table.

const TYPE_LABELS = {
  html: "Web document (.html)",
  url: "Shortcut (.url)",
};

function statusBadge(status) {
  let cls = "good";
  if (status === "Opened by OTHER user") cls = "bad";
  else if (status === "Opened by you only") cls = "warn";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

// Summary banner at the top of the dashboard
function renderBanner(risk, folders) {
  const banner = document.getElementById("system-banner");
  banner.className = `banner ${levelClass(risk.level)}`;

  if (folders.length === 0) {
    banner.textContent = "No folders are being monitored yet. Generate a token to start.";
  } else if (risk.level === "Low") {
    banner.textContent = `Overall risk is Low (${risk.percent}%). No suspicious opens.`;
  } else {
    const worst = folders[0]; // folders are sorted, highest risk first
    banner.textContent = `Overall risk is ${risk.level} (${risk.percent}%). Most at risk: ${worst.name}.`;
  }
}

function renderFolders(folders) {
  const box = document.getElementById("folders");
  if (folders.length === 0) {
    box.innerHTML = `<p class="muted">No folders yet. Generate a token to start monitoring.</p>`;
    return;
  }

  box.innerHTML = folders
    .map(
      (f) => `
      <div class="card risk risk-${f.risk_level.toLowerCase()}">
        <h3>${escapeHtml(f.name)}</h3>
        <div class="risk-number">${f.risk_percent}%</div>
        <div class="bar"><div class="fill" style="width: ${f.risk_percent}%"></div></div>
        <p>${levelBadge(f.risk_level)}</p>
        <p class="muted">
          ${f.triggered_tokens} of ${f.total_tokens} tokens opened by others ·
          ${f.other_hits} other-user open(s)
        </p>
      </div>`
    )
    .join("");
}

function renderTokens(tokens) {
  const body = document.getElementById("tokens-body");
  if (tokens.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="muted">No tokens yet. Go to "Generate Token".</td></tr>`;
    return;
  }

  body.innerHTML = tokens
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.file_name)}</td>
        <td>${escapeHtml(t.folder)}</td>
        <td>${escapeHtml(TYPE_LABELS[t.token_type] || t.token_type)}</td>
        <td>${escapeHtml(t.created_at)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${levelBadge(t.risk_level, t.risk_percent)}</td>
        <td>${escapeHtml(t.last_triggered || "—")}</td>
      </tr>`
    )
    .join("");
}

function timeAgo(stamp) {
  if (!stamp) return "No opens yet";
  const mins = Math.round((Date.now() - new Date(stamp.replace(" ", "T")).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return stamp.slice(0, 10);
}

function renderStats(data) {
  const last = data.alerts.find((a) => !a.trusted); // newest open by someone else
  const items = [
    ["Canary tokens", data.tokens.length, "var(--purple)"],
    ["Folders watched", data.folders.length, "var(--cyan)"],
    ["Opens by others", data.alerts.filter((a) => !a.trusted).length, "var(--bad)"],
    ["Last outside open", timeAgo(last && last.triggered_at), "var(--warn)"],
  ];
  document.getElementById("stats").innerHTML = items
    .map(([label, value, color]) => `
      <div class="stat" style="--c: ${color}">
        <div class="label">${label}</div>
        <div class="value">${escapeHtml(value)}</div>
      </div>`)
    .join("");
}

onCanaryUpdate((data) => {
  renderStats(data);
  renderBanner(data.system_risk, data.folders);
  renderFolders(data.folders);
  renderTokens(data.tokens);
  document.getElementById("last-updated").textContent =
    "Last checked at " + new Date().toLocaleTimeString();
});
