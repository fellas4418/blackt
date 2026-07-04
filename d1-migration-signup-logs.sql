-- 회원가입·레벨 변경 로그 (구글 시트와 동일 정보를 D1에도 축적)
CREATE TABLE IF NOT EXISTS signup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  level TEXT,
  referrer TEXT,
  event_type TEXT NOT NULL DEFAULT 'signup',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signup_logs_created
ON signup_logs(datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_signup_logs_phone_name
ON signup_logs(phone, name);
