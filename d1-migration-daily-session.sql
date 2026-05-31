-- Day 학습 완료 기록 (배포 시 D1에 실행)
-- wrangler d1 execute blackt --remote --file=./d1-migration-daily-session.sql

CREATE TABLE IF NOT EXISTS daily_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  subject TEXT DEFAULT 'english',
  level TEXT,
  day_num INTEGER,
  accuracy INTEGER,
  wrong_count INTEGER,
  session_number INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, level, day_num)
);

CREATE INDEX IF NOT EXISTS idx_daily_session_user
ON daily_session(user_id, created_at DESC);
