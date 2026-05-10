-- D1 / SQLite: 기존 users 테이블에 유료 플래그 추가
-- 배포: wrangler d1 execute blackt --remote --file=./d1-migration-add-is-premium.sql

ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;
