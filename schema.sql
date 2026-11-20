-- Every canary token the user has generated
CREATE TABLE IF NOT EXISTS tokens (
    id          TEXT PRIMARY KEY,          -- random UUID
    file_name   TEXT NOT NULL,
    folder      TEXT NOT NULL,             -- the folder being monitored
    token_type  TEXT NOT NULL,             -- 'html' or 'url'
    created_at  TEXT NOT NULL
);

-- One row every time a canary file is opened (the "trigger" events)
CREATE TABLE IF NOT EXISTS alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id     TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    ip_address   TEXT,
    user_agent   TEXT,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- Devices the owner marked as "This was me"
CREATE TABLE IF NOT EXISTS trusted_sources (
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    label      TEXT,
    PRIMARY KEY (ip_address, user_agent)
);
