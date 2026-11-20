"""
CanaryTrap - create 'canary' files and get alerted when someone opens them.

Run:  python app.py   then open http://127.0.0.1:5000
"""
import base64
import os
import random
import uuid
from datetime import datetime, timedelta
from html import escape
from io import BytesIO

from flask import (Flask, Response, abort, jsonify, render_template,
                   request, send_file, url_for)

import db

app = Flask(__name__)

# ---- Settings (can be changed with environment variables) ----
PORT = int(os.environ.get("CANARY_PORT", "5000"))
# The address written INSIDE the downloaded canary files.
# Must be reachable from the computer that opens the file.
BASE_URL = os.environ.get("CANARY_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")

TOKEN_TYPES = {
    "html": "Web Document (.html)",
    "url": "Internet Shortcut (.url)",
}

TIME_FMT = "%Y-%m-%d %H:%M:%S"
RECENT_WINDOW = timedelta(hours=24)

# A 1x1 transparent GIF used as an invisible "beacon" image.
PIXEL_GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

# Create the database tables if they do not exist yet.
db.init_db()


# ---------------- helpers ----------------

def now_str():
    return datetime.now().strftime(TIME_FMT)


def clean_name(raw):
    """Keep only letters, numbers, dash, underscore and spaces (safe file names)."""
    safe = "".join(c for c in raw.strip() if c.isalnum() or c in "-_ ")
    return safe.replace(" ", "_")[:50]


def risk_level(score):
    if score >= 80:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 20:
        return "Medium"
    return "Low"


def token_score(other_opens):
    """Each open by another user adds 25 points to a token (maximum 100)."""
    return min(100, other_opens * 25)


def load_tokens():
    return db.fetch_all("SELECT * FROM tokens ORDER BY created_at DESC")


def load_alerts():
    """All alerts, newest first. Each alert gets a 'trusted' flag (True = your own device)."""
    trusted = {
        (s["ip_address"], s["user_agent"])
        for s in db.fetch_all("SELECT ip_address, user_agent FROM trusted_sources")
    }
    alerts = db.fetch_all("""
        SELECT a.id, a.token_id, a.triggered_at, a.ip_address, a.user_agent,
               t.file_name, t.folder
        FROM alerts a
        LEFT JOIN tokens t ON t.id = a.token_id
        ORDER BY a.id DESC
    """)
    for a in alerts:
        a["trusted"] = (a["ip_address"], a["user_agent"]) in trusted

    # Severity = the token's risk level at the moment this open happened.
    # Walk from oldest to newest so each alert counts only the opens before it.
    counts = {}
    for a in reversed(alerts):
        if a["trusted"]:
            a["severity"] = "Low"          # your own device
            continue
        counts[a["token_id"]] = counts.get(a["token_id"], 0) + 1
        a["severity"] = risk_level(token_score(counts[a["token_id"]]))
    return alerts


def annotate_tokens(tokens, alerts):
    """Add a status to every token. 'alerts' must be newest first."""
    for t in tokens:
        mine = [a for a in alerts if a["token_id"] == t["id"]]
        other = [a for a in mine if not a["trusted"]]
        t["hits"] = len(mine)
        t["other_hits"] = len(other)
        t["last_triggered"] = mine[0]["triggered_at"] if mine else None
        if not mine:
            t["status"] = "Not opened"
        elif other:
            t["status"] = "Opened by OTHER user"
        else:
            t["status"] = "Opened by you only"

        t["risk_percent"] = token_score(len(other))
        t["risk_level"] = risk_level(t["risk_percent"])
    return tokens


def calculate_folders(tokens, alerts):
    """
    FOLDER RISK PERCENTAGE (0 - 100)
      up to 60 points : share of the folder's tokens opened by someone else
      +10 per other-user open (max +30)
      +10 if an other-user open happened in the last 24 hours
    Opens from devices marked as 'mine' are ignored.
    """
    cutoff = (datetime.now() - RECENT_WINDOW).strftime(TIME_FMT)
    folders = {}

    for t in tokens:
        f = folders.setdefault(t["folder"], {
            "name": t["folder"], "total_tokens": 0,
            "triggered": set(), "other_hits": 0, "recent": False,
        })
        f["total_tokens"] += 1

    for a in alerts:
        if a["trusted"] or a["folder"] not in folders:
            continue
        f = folders[a["folder"]]
        f["triggered"].add(a["token_id"])
        f["other_hits"] += 1
        if a["triggered_at"] >= cutoff:
            f["recent"] = True

    result = []
    for f in folders.values():
        base = len(f["triggered"]) / f["total_tokens"] * 60
        intensity = min(f["other_hits"] * 10, 30)
        recency = 10 if f["recent"] else 0
        score = round(min(100, base + intensity + recency))
        result.append({
            "name": f["name"],
            "total_tokens": f["total_tokens"],
            "triggered_tokens": len(f["triggered"]),
            "other_hits": f["other_hits"],
            "risk_percent": score,
            "risk_level": risk_level(score),
        })
    return sorted(result, key=lambda x: x["risk_percent"], reverse=True)


# ---------------- pages ----------------

@app.get("/")
def home():
    return render_template("index.html")


@app.get("/generate")
def generate_page():
    return render_template("generate.html", token_types=TOKEN_TYPES)


@app.get("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


@app.get("/alerts")
def alerts_page():
    return render_template("alerts.html")


@app.get("/present")
def present_page():
    return render_template("present.html")


@app.get("/about")
def about_page():
    return render_template("about.html")


# ---------------- API used by the JavaScript ----------------

@app.post("/api/tokens")
def create_token():
    """Step 3: generate a unique canary token and save it."""
    data = request.get_json(silent=True) or {}
    file_name = clean_name(data.get("file_name", ""))
    folder = (data.get("folder") or "General").strip()[:40] or "General"
    token_type = data.get("token_type", "html")

    if not file_name:
        return jsonify(error="Please enter a file name (letters, numbers, - or _)."), 400
    if token_type not in TOKEN_TYPES:
        return jsonify(error="Unknown token type."), 400

    token_id = uuid.uuid4().hex  # random 128-bit ID, practically impossible to guess
    db.run(
        "INSERT INTO tokens (id, file_name, folder, token_type, created_at) VALUES (?, ?, ?, ?, ?)",
        (token_id, file_name, folder, token_type, now_str()),
    )
    return jsonify(
        id=token_id,
        file_name=file_name,
        folder=folder,
        download_url=url_for("download_token", token_id=token_id),
    ), 201


@app.get("/download/<token_id>")
def download_token(token_id):
    """Step 4: give the user the token file to download."""
    token = db.fetch_one("SELECT * FROM tokens WHERE id = ?", (token_id,))
    if not token:
        abort(404)

    trigger_url = f"{BASE_URL}/t/{token_id}"

    if token["token_type"] == "url":
        filename = f"{token['file_name']}.url"
        content = f"[InternetShortcut]\r\nURL={trigger_url}/open.html\r\n"
    else:
        filename = f"{token['file_name']}.html"
        content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{escape(token['file_name'])}</title></head>
<body style="font-family: Arial, sans-serif; padding: 40px;">
  <h1>CONFIDENTIAL - {escape(token['folder'])}</h1>
  <p>This document is restricted. Do not share without approval.</p>
  <img src="{trigger_url}/pixel.gif" width="1" height="1" alt="">
</body>
</html>"""

    return send_file(
        BytesIO(content.encode("utf-8")),
        as_attachment=True,
        download_name=filename,
        mimetype="application/octet-stream",
    )


@app.get("/t/<token_id>/<path:asset>")
def trigger(token_id, asset):
    """Step 6: called automatically when someone opens the canary file. Records an alert."""
    if not db.fetch_one("SELECT id FROM tokens WHERE id = ?", (token_id,)):
        return "Unknown token", 404

    db.run(
        "INSERT INTO alerts (token_id, triggered_at, ip_address, user_agent) VALUES (?, ?, ?, ?)",
        (
            token_id,
            now_str(),
            request.remote_addr or "unknown",
            request.headers.get("User-Agent", ""),
        ),
    )

    headers = {"Cache-Control": "no-store"}
    if asset.endswith(".gif"):
        return Response(PIXEL_GIF, mimetype="image/gif", headers=headers)
    return Response("CanaryTrap: access recorded.", mimetype="text/plain", headers=headers)


@app.get("/api/state")
def api_state():
    """One endpoint that gives every page what it needs (polled every few seconds)."""
    tokens = load_tokens()
    alerts = load_alerts()
    annotate_tokens(tokens, alerts)
    folders = calculate_folders(tokens, alerts)
    system_percent = max((f["risk_percent"] for f in folders), default=0)
    latest = alerts[0] if alerts else None
    return jsonify(
        tokens=tokens,
        folders=folders,
        system_risk={"percent": system_percent, "level": risk_level(system_percent)},
        alerts=alerts,
        latest_alert=latest,
        latest_alert_id=latest["id"] if latest else 0,
    )


@app.post("/api/alerts/<int:alert_id>/trust")
def trust_alert(alert_id):
    """'This was me': remember this device so its opens stop raising the risk."""
    alert = db.fetch_one("SELECT ip_address, user_agent FROM alerts WHERE id = ?", (alert_id,))
    if not alert:
        return jsonify(error="Alert not found."), 404
    db.run(
        "INSERT OR IGNORE INTO trusted_sources (ip_address, user_agent, label) VALUES (?, ?, ?)",
        (alert["ip_address"], alert["user_agent"], "Owner device"),
    )
    return jsonify(ok=True)


# ---------------- demo tools for live presentations ----------------

# Fake visitors for the demo. These IPs are from documentation-only ranges (never real people).
DEMO_VISITORS = [
    ("203.0.113.45", "Chrome on Windows"),
    ("198.51.100.23", "Safari on iPhone"),
    ("192.0.2.77", "Firefox on Linux"),
]


@app.post("/api/demo/simulate")
def simulate_intruder():
    """Pretend someone else opened one of your canary files (no second device needed)."""
    tokens = db.fetch_all("SELECT id FROM tokens")
    if not tokens:
        return jsonify(error="Create a canary token first."), 400
    token = random.choice(tokens)
    ip, device = random.choice(DEMO_VISITORS)
    db.run(
        "INSERT INTO alerts (token_id, triggered_at, ip_address, user_agent) VALUES (?, ?, ?, ?)",
        (token["id"], now_str(), ip, f"[DEMO] {device}"),
    )
    return jsonify(ok=True), 201


@app.post("/api/demo/reset")
def reset_demo():
    """Delete all tokens, alerts and trusted devices so the demo can start again."""
    for table in ("alerts", "trusted_sources", "tokens"):
        db.run(f"DELETE FROM {table}")
    return jsonify(ok=True)


# ---------------- risk raised report ----------------

def _state_data():
    """The same data the dashboard uses, as a plain dict."""
    result = api_state()
    if isinstance(result, tuple):
        result = result[0]
    return result.get_json() if hasattr(result, "get_json") else result


@app.get("/report")
def risk_report():
    """Downloadable HTML report of risk raised (open it and print to PDF if needed)."""
    data = _state_data()
    alerts = data["alerts"]
    html = render_template(
        "report.html",
        system_risk=data["system_risk"],
        folders=data["folders"],
        tokens=data["tokens"],
        raised=[a for a in alerts if not a["trusted"]],
        own_count=sum(1 for a in alerts if a["trusted"]),
        generated_at=now_str(),
    )
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return Response(html, mimetype="text/html", headers={
        "Content-Disposition": f"attachment; filename=canarytrap-risk-report-{stamp}.html"})


@app.get("/report.csv")
def risk_report_csv():
    """The same alerts as a spreadsheet (CSV)."""
    import csv
    import io
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["Time", "Token file", "Folder", "IP address", "Device", "Who", "Severity", "Raised risk"])
    for a in _state_data()["alerts"]:
        writer.writerow([
            a["triggered_at"], a["file_name"] or "", a["folder"] or "", a["ip_address"], a["user_agent"] or "",
            "your device" if a["trusted"] else "other user", a["severity"], "no" if a["trusted"] else "yes",
        ])
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return Response(out.getvalue(), mimetype="text/csv", headers={
        "Content-Disposition": f"attachment; filename=canarytrap-risk-report-{stamp}.csv"})


if __name__ == "__main__":
    app.run(
        debug=True,
        host=os.environ.get("CANARY_HOST", "127.0.0.1"),
        port=PORT,
    )
