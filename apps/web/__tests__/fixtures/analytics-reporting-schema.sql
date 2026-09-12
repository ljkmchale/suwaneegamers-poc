CREATE TABLE analytics_sessions (
      session_id    TEXT PRIMARY KEY,
      first_seen_at TEXT NOT NULL,
      last_seen_at  TEXT NOT NULL,
      entry_path    TEXT NOT NULL,
      last_path     TEXT NOT NULL,
      referrer_host TEXT,
      device_type   TEXT NOT NULL DEFAULT 'desktop',
      page_views    INTEGER NOT NULL DEFAULT 0,
      engaged_seconds INTEGER NOT NULL DEFAULT 0
    , visitor_email TEXT, visitor_name TEXT, visitor_id TEXT, acquisition_path TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT);
CREATE TABLE analytics_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
      event_type       TEXT NOT NULL,
      path             TEXT NOT NULL,
      content_type     TEXT,
      content_id       TEXT,
      content_label    TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL
    );
CREATE TABLE analytics_purpose_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source, source_id)
    );
CREATE TABLE content_sync_jobs (
      id                TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      schedule          TEXT NOT NULL,
      command           TEXT NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      last_started_at   TEXT,
      last_finished_at  TEXT,
      last_success_at   TEXT,
      last_status       TEXT,
      last_exit_code    INTEGER,
      last_duration_ms  INTEGER,
      next_run_at       TEXT,
      last_message      TEXT
    , schedule_json TEXT, revalidate_paths_json TEXT, source_job_id TEXT);
CREATE TABLE content_sync_runs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id        TEXT NOT NULL REFERENCES content_sync_jobs(id) ON DELETE CASCADE,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      status        TEXT NOT NULL,
      exit_code     INTEGER,
      duration_ms   INTEGER,
      message       TEXT,
      stdout_tail   TEXT,
      stderr_tail   TEXT
    );