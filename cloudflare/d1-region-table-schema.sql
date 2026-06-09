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
