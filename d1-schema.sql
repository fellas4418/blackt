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
