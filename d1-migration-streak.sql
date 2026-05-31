-- Streak(연속 학습일): daily_session.created_at 기준으로 Worker /api/streak 에서 계산 (별도 테이블 없음)
-- wrangler d1 execute blackt --remote --file=./d1-migration-streak.sql

CREATE INDEX IF NOT EXISTS idx_daily_session_user_created
ON daily_session(user_id, created_at DESC);
