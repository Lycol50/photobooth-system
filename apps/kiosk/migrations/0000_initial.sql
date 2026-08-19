PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  passcode_hash BLOB,
  passcode_salt BLOB,
  scrypt_version INTEGER NOT NULL DEFAULT 1 CHECK (scrypt_version = 1),
  scrypt_n INTEGER NOT NULL DEFAULT 131072,
  scrypt_r INTEGER NOT NULL DEFAULT 8,
  scrypt_p INTEGER NOT NULL DEFAULT 1,
  scrypt_key_length INTEGER NOT NULL DEFAULT 64,
  active_frame_id TEXT,
  google_forms_url TEXT,
  local_retention_days INTEGER NOT NULL DEFAULT 60 CHECK (local_retention_days = 60),
  cloud_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (cloud_retention_days = 30),
  lan_enabled INTEGER NOT NULL DEFAULT 0 CHECK (lan_enabled IN (0, 1)),
  lan_bind_host TEXT NOT NULL DEFAULT '127.0.0.1',
  lan_port INTEGER NOT NULL DEFAULT 4310 CHECK (lan_port BETWEEN 1024 AND 65535),
  lan_tls_secret_ref TEXT,
  lan_certificate_fingerprint TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  encrypted_path TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 5000),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 5000),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS frame_slots (
  frame_id TEXT NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 4),
  name TEXT NOT NULL,
  x REAL NOT NULL CHECK (x >= 0 AND x <= 1),
  y REAL NOT NULL CHECK (y >= 0 AND y <= 1),
  width REAL NOT NULL CHECK (width > 0 AND width <= 1 AND x + width <= 1.000000001),
  height REAL NOT NULL CHECK (height > 0 AND height <= 1 AND y + height <= 1.000000001),
  crop_mode TEXT NOT NULL CHECK (crop_mode IN ('crop-to-fill', 'fit')),
  PRIMARY KEY (frame_id, slot_index)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN (
    'attract', 'countdown', 'capturing', 'review', 'processing',
    'pending_upload', 'uploading', 'ready', 'final',
    'camera_error', 'upload_failed', 'interrupted'
  )),
  capture_round INTEGER NOT NULL DEFAULT 0 CHECK (capture_round >= 0),
  capture_count INTEGER NOT NULL DEFAULT 0 CHECK (capture_count BETWEEN 0 AND 4),
  collage_asset_id TEXT,
  cloud_photo_session_id TEXT,
  public_secret_ref TEXT,
  ready_at INTEGER,
  expires_at INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
  ,retention_anchor_at INTEGER
  ,cleanup_state TEXT NOT NULL DEFAULT 'active' CHECK (cleanup_state IN ('active', 'tombstoning'))
  ,cleanup_started_at INTEGER
);

CREATE TABLE IF NOT EXISTS session_assets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('capture', 'collage')),
  retake_round INTEGER NOT NULL DEFAULT 0 CHECK (retake_round >= 0),
  shot_number INTEGER CHECK (shot_number BETWEEN 1 AND 4),
  encrypted_path TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type = 'image/jpeg'),
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 12000),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 12000),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  created_at INTEGER NOT NULL,
  cleanup_state TEXT NOT NULL DEFAULT 'active' CHECK (cleanup_state IN ('active', 'tombstoning', 'tombstoned')),
  tombstone_path TEXT,
  UNIQUE (session_id, kind, retake_round, shot_number)
);

CREATE TABLE IF NOT EXISTS upload_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN (
    'queued', 'creating_upload', 'uploading', 'confirming',
    'retry_wait', 'failed', 'succeeded', 'cancelled'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lifetime_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_failure_count >= 0),
  automatic_retry_index INTEGER NOT NULL DEFAULT 0 CHECK (automatic_retry_index BETWEEN 0 AND 3),
  manual_retry_cycle INTEGER NOT NULL DEFAULT 0 CHECK (manual_retry_cycle >= 0),
  next_attempt_at INTEGER,
  lease_owner TEXT,
  lease_until INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL CHECK (operation IN (
    'passcode_bootstrap', 'passcode_change', 'settings_change',
    'frame_change', 'upload_retry', 'cleanup'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  detail_code TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_state_updated_idx ON sessions(state, updated_at);
CREATE INDEX IF NOT EXISTS sessions_retention_idx ON sessions(cleanup_state, retention_anchor_at);
CREATE INDEX IF NOT EXISTS session_assets_session_idx ON session_assets(session_id, kind, retake_round, shot_number);
CREATE INDEX IF NOT EXISTS upload_jobs_due_idx ON upload_jobs(state, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS upload_jobs_lease_idx ON upload_jobs(lease_until);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at);

INSERT OR IGNORE INTO settings (id, created_at, updated_at)
VALUES (1, unixepoch('subsec') * 1000, unixepoch('subsec') * 1000);
