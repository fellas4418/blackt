-- 지문 분석 AI 질문 기록 (배포 시 D1에 실행)
-- wrangler d1 execute blackt --remote --file=./d1-migration-chat-history.sql

CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
ON chat_history(user_id, datetime(created_at) DESC);
