CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  is_premium INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_voca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  eng TEXT NOT NULL,
  kor TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'other',
  passage_title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_grammar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  point TEXT NOT NULL,
  sentence TEXT NOT NULL,
  explanation TEXT NOT NULL,
  passage_title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_saved_voca_user_eng
ON saved_voca(user_id, lower(eng));

CREATE UNIQUE INDEX IF NOT EXISTS ux_saved_grammar_user_sentence
ON saved_grammar(user_id, sentence);

-- 시험지 OCR·리포트(학교/시험별 내신 축적, Trigger Voca 레벨 연동)
CREATE TABLE IF NOT EXISTS exam_analysis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  grade TEXT,
  school_name TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  voca_level_link TEXT,
  questions_json TEXT NOT NULL,
  session_json TEXT NOT NULL,
  ai_diagnosis_json TEXT,
  admin_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_analysis_user_created
ON exam_analysis(user_id, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_exam_analysis_school_exam
ON exam_analysis(school_name, exam_type);

-- 지문 분석: 트리거 AI 실시간 질문 기록
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
ON chat_history(user_id, datetime(created_at) DESC);
