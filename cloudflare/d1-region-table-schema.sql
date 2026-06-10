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
CREATE INDEX IF NOT EXISTS idx_region_tables_updated ON region_tables(updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_region_table_shares_expires ON region_table_shares(expires_at_ms);

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

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'notice',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  alliance TEXT NOT NULL DEFAULT '',
  actor_uid TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  actor_role_text TEXT NOT NULL DEFAULT '',
  actor_photo_url TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'player',
  target_label TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT NOT NULL DEFAULT '',
  reply_to_title TEXT NOT NULL DEFAULT '',
  reply_to_actor_name TEXT NOT NULL DEFAULT '',
  reply_to_created_at_ms INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL DEFAULT 0,
  read_at_ms INTEGER NOT NULL DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_uid_time ON user_notifications(uid, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_uid_unread_time ON user_notifications(uid, unread, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS user_notification_summary (
  uid TEXT PRIMARY KEY,
  unread_total INTEGER NOT NULL DEFAULT 0,
  campaign_seen_at_ms INTEGER NOT NULL DEFAULT 0,
  last_title TEXT NOT NULL DEFAULT '',
  last_message TEXT NOT NULL DEFAULT '',
  last_region TEXT NOT NULL DEFAULT '',
  last_alliance TEXT NOT NULL DEFAULT '',
  last_actor_uid TEXT NOT NULL DEFAULT '',
  last_actor_name TEXT NOT NULL DEFAULT '',
  last_actor_role TEXT NOT NULL DEFAULT '',
  last_target_type TEXT NOT NULL DEFAULT '',
  last_notification_at_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_sent_messages (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sent_message',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  alliance TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'player',
  target_label TEXT NOT NULL DEFAULT '',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipient_preview TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT NOT NULL DEFAULT '',
  reply_to_title TEXT NOT NULL DEFAULT '',
  reply_to_actor_name TEXT NOT NULL DEFAULT '',
  reply_to_created_at_ms INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_sent_messages_uid_time ON user_sent_messages(uid, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'region_campaign',
  source TEXT NOT NULL DEFAULT 'region-campaign',
  cycle_id TEXT NOT NULL DEFAULT '',
  actor_uid TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  actor_role_text TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'region',
  target_label TEXT NOT NULL DEFAULT '',
  alliance TEXT NOT NULL DEFAULT '',
  campaign_group_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  title_key TEXT NOT NULL DEFAULT '',
  message_key TEXT NOT NULL DEFAULT '',
  created_at_ms INTEGER NOT NULL DEFAULT 0,
  expires_at_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_region_time ON notification_campaigns(region, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_region_target_time ON notification_campaigns(region, target_type, alliance, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_expires ON notification_campaigns(expires_at_ms);

CREATE TABLE IF NOT EXISTS notification_directory (
  uid TEXT NOT NULL,
  farm_id TEXT NOT NULL DEFAULT 'main',
  nickname TEXT NOT NULL DEFAULT '',
  nickname_key TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  email_key TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  display_key TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  alliance TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player',
  account_role TEXT NOT NULL DEFAULT 'player',
  rank TEXT NOT NULL DEFAULT '',
  shk TEXT NOT NULL DEFAULT '',
  farm_count INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, farm_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_directory_uid ON notification_directory(uid);
CREATE INDEX IF NOT EXISTS idx_notification_directory_region ON notification_directory(region);
CREATE INDEX IF NOT EXISTS idx_notification_directory_region_alliance ON notification_directory(region, alliance);
CREATE INDEX IF NOT EXISTS idx_notification_directory_role ON notification_directory(role);
CREATE INDEX IF NOT EXISTS idx_notification_directory_nick ON notification_directory(nickname_key);

CREATE TABLE IF NOT EXISTS final_plan_shares (
  code TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  cycle_id TEXT NOT NULL DEFAULT 'active',
  event_start_at_ms INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_by_name TEXT NOT NULL DEFAULT '',
  expires_at_ms INTEGER NOT NULL DEFAULT 0,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_final_plan_shares_region ON final_plan_shares(region);
CREATE INDEX IF NOT EXISTS idx_final_plan_shares_updated ON final_plan_shares(updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_final_plan_shares_expires ON final_plan_shares(expires_at_ms);
