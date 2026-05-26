CREATE TABLE IF NOT EXISTS referral_signups (
  referrer_id TEXT NOT NULL,
  referee_phone TEXT NOT NULL,
  credited_sharer INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (referee_phone)
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer
ON referral_signups(referrer_id, credited_sharer);
