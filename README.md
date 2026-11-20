# CanaryTrap 🐤

Detect unauthorized access to files using Canary Tokens.

## Quick start

1. Install Python 3.10 or newer.
2. Open a terminal in the `canarytrap` folder.
3. Create and activate a virtual environment:
   - Windows: `python -m venv venv` then `venv\Scripts\activate`
   - Mac/Linux: `python3 -m venv venv` then `source venv/bin/activate`
4. Install the requirements: `pip install -r requirements.txt`
5. Run the app: `python app.py`
6. Open http://127.0.0.1:5000 in your browser.

## Project structure

```
canarytrap/
├── app.py              # Flask backend: routes, token generation, alerts, risk score
├── db.py               # SQLite helper functions
├── schema.sql          # Database tables
├── requirements.txt    # Python packages
├── templates/          # HTML pages (Home, Generate, Dashboard, Alerts, About)
└── static/
    ├── css/style.css   # Styling
    └── js/             # main.js (alerts pop-up), generate.js, dashboard.js, alerts.js
```

## Testing with a second computer or phone

1. Find your computer's local IP address (for example `192.168.1.20`).
2. Stop the app, then start it with these settings:
   - Windows PowerShell:
     `$env:CANARY_HOST="0.0.0.0"; $env:CANARY_BASE_URL="http://192.168.1.20:5000"; python app.py`
   - Mac/Linux:
     `CANARY_HOST=0.0.0.0 CANARY_BASE_URL=http://192.168.1.20:5000 python app.py`
3. Generate a NEW token (the address is written into the file when you download it).
4. Open the downloaded file on the other device while it is on the same Wi-Fi.

## Reset the demo

Stop the app and delete `canarytrap.db`. It is created again automatically on the next start.

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `CANARY_PORT` | `5000` | Port the app runs on |
| `CANARY_HOST` | `127.0.0.1` | Use `0.0.0.0` to allow other devices |
| `CANARY_BASE_URL` | `http://127.0.0.1:<port>` | Address written inside the canary files |

## Live presentation tools

- **🔴 Live monitor** (`/present`): big overall-risk gauge, folder tiles and a live feed. Built for a projector.
- **🎭 Simulate intruder** (button or press `S`): makes an alert from a fake visitor, so you can demo without a second device. These alerts are marked `[DEMO]`.
- **🔊 Sound** (press `M`): a beep when another user opens a canary file. Browsers need one click first.
- **⛶ Fullscreen** (press `F`) and **↺ Reset demo** (clears all tokens and alerts).

The demo tools have no login. Use them only on your own computer or private network.
