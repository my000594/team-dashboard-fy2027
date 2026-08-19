-- ナレッジ👍投票用D1データベースの初期スキーマ。
-- Cloudflareダッシュボード（D1 → 対象データベース → Console）で1回だけ実行する。
-- データベース名: team-dashboard-fy2027-votes（Pagesプロジェクトに DB としてバインドする想定）

CREATE TABLE IF NOT EXISTS votes (
  item_key    TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (item_key, voter_email)
);

CREATE INDEX IF NOT EXISTS idx_votes_item_key ON votes(item_key);
