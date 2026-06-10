CREATE TABLE IF NOT EXISTS region_tables (
  region TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  rows_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (region, cycle_id)
);

CREATE TABLE IF NOT EXISTS region_active (
  region TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  rows_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS region_access (
  region TEXT NOT NULL,
  uid TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (region, uid)
);

CREATE TABLE IF NOT EXISTS region_table_shares (
  code TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  cycle_id TEXT NOT NULL DEFAULT 'active',
  access TEXT NOT NULL DEFAULT 'view',
  expires_at_ms INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_region_access_uid ON region_access(uid);
CREATE INDEX IF NOT EXISTS idx_region_table_shares_region ON region_table_shares(region);

CREATE TABLE IF NOT EXISTS public_stats_pages (
  bucket INTEGER PRIMARY KEY,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  players_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS public_stats_meta (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'cloudflare-d1'
);


CREATE TABLE IF NOT EXISTS action_logs (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT '',
  actor_uid TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_alliance TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  alliance TEXT NOT NULL DEFAULT '',
  target_uid TEXT NOT NULL DEFAULT '',
  target_name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_action_logs_region_time ON action_logs(region, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_region_alliance_time ON action_logs(region, alliance, created_at_ms DESC);
