#!/usr/bin/env node

const fs = require("node:fs");
const assert = require("node:assert/strict");

function normalizeSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    return this.db.execute(this.sql, this.args, "first");
  }

  async all() {
    return this.db.execute(this.sql, this.args, "all");
  }

  async run() {
    return this.db.execute(this.sql, this.args, "run");
  }
}

class FakeDB {
  constructor() {
    this.tables = {
      users: [],
      saved_voca: [],
      saved_grammar: [],
      exam_analysis: [],
      chat_history: [],
    };
    this.failChatInsert = false;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async execute(sql, args, mode) {
    const q = normalizeSql(sql);

    if (q === "select name from sqlite_master where type = 'table' and name = ?1") {
      const table = String(args[0] || "");
      return Object.prototype.hasOwnProperty.call(this.tables, table) ? { name: table } : null;
    }

    if (q === "select id from users where id = ?1 and password_hash = ?2") {
      const row = this.tables.users.find((u) => u.id === args[0] && u.password_hash === args[1]);
      return row ? { id: row.id } : null;
    }

    if (q === "select id from users where id = ?1") {
      const row = this.tables.users.find((u) => u.id === args[0]);
      return row ? { id: row.id } : null;
    }

    if (q === "select id from users where id = ?1 or id like ?2") {
      const exact = String(args[0] || "");
      const prefix = String(args[1] || "").replace(/%$/, "");
      const results = this.tables.users
        .filter((u) => u.id === exact || u.id.startsWith(prefix))
        .map((u) => ({ id: u.id }));
      return { results };
    }

    if (q === "update users set id = ?1, password_hash = ?2 where id = ?3") {
      const row = this.tables.users.find((u) => u.id === args[2]);
      if (!row) return { meta: { changes: 0 } };
      row.id = args[0];
      row.password_hash = args[1];
      return { meta: { changes: 1 } };
    }

    if (q === "select is_premium from users where id = ?1") {
      const row = this.tables.users.find((u) => u.id === args[0]);
      return row ? { is_premium: row.is_premium || 0 } : null;
    }

    for (const table of ["saved_voca", "saved_grammar", "exam_analysis", "chat_history"]) {
      if (q === `update ${table} set user_id = ?1 where user_id = ?2`) {
        let changes = 0;
        this.tables[table].forEach((row) => {
          if (row.user_id === args[1]) {
            row.user_id = args[0];
            changes++;
          }
        });
        return { meta: { changes } };
      }
    }

    if (q === "insert into chat_history (id, user_id, question, answer, created_at) values (?1, ?2, ?3, ?4, ?5)") {
      if (this.failChatInsert) throw new Error("simulated chat_history insert failure");
      this.tables.chat_history.push({
        id: args[0],
        user_id: args[1],
        question: args[2],
        answer: args[3],
        created_at: args[4],
      });
      return { meta: { changes: 1 } };
    }

    throw new Error(`Unhandled ${mode} SQL: ${sql}`);
  }
}

async function loadWorker() {
  const source = fs.readFileSync("src/index.js", "utf8");
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  return (await import(url)).default;
}

async function post(worker, env, path, body) {
  const res = await worker.fetch(
    new Request("https://worker.test" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
    env
  );
  return { status: res.status, body: await res.json() };
}

async function withGeminiStub(fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init && init.body || "{}"));
    const parts = payload?.contents?.[0]?.parts || [];
    const prompt = String(parts[0]?.text || "");
    const text = prompt.startsWith("You extract structure")
      ? JSON.stringify({ questions: [{ number: 1, type: "multiple", points: 2.5 }, { number: 3, type: "essay", points: 10 }] })
      : "💬 답변요약: 저장 테스트 답변이에요.\n\n⭐ 핵심: 기록 저장 여부를 확인해요.\n\n📝 예시: This is a test. (이것은 테스트예요.)";
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

(async () => {
  const worker = await loadWorker();

  const db = new FakeDB();
  const legacyPhone = "01012345678";
  db.tables.users.push({ id: legacyPhone, password_hash: "old", is_premium: 1 });
  db.tables.saved_voca.push({ user_id: legacyPhone, eng: "loss", kor: "손실" });
  db.tables.saved_grammar.push({ user_id: legacyPhone, point: "to부정사" });
  db.tables.exam_analysis.push({ id: "exam-1", user_id: legacyPhone });
  db.tables.chat_history.push({ id: "chat-1", user_id: legacyPhone });

  const auth = await post(worker, { DB: db }, "/api/auth/simple", { name: "Kim Student", phone: "010-1234-5678" });
  assert.equal(auth.status, 200);
  assert.equal(auth.body.user_id, "01012345678::kim student");
  for (const table of ["saved_voca", "saved_grammar", "exam_analysis", "chat_history"]) {
    assert.equal(db.tables[table][0].user_id, auth.body.user_id, `${table} did not migrate`);
  }

  await withGeminiStub(async () => {
    const chatOk = await post(
      worker,
      { DB: db, GEMINI_API_KEY: "test" },
      "/api/chat/ask",
      { user_id: auth.body.user_id, password: auth.body.auth_password, question: "test", invite_code: "tri3" }
    );
    assert.equal(chatOk.status, 200);
    assert.equal(chatOk.body.ok, true);
    assert.equal(db.tables.chat_history.filter((r) => r.user_id === auth.body.user_id).length, 2);

    db.failChatInsert = true;
    const chatFail = await post(
      worker,
      { DB: db, GEMINI_API_KEY: "test" },
      "/api/chat/ask",
      { user_id: auth.body.user_id, password: auth.body.auth_password, question: "test2", invite_code: "tri3" }
    );
    assert.equal(chatFail.status, 500);
    assert.equal(chatFail.body.error, "chat_history_save_failed");

    db.failChatInsert = false;
    const extract = await post(
      worker,
      { DB: db, GEMINI_API_KEY: "test" },
      "/api/exam-report/extract",
      { user_id: auth.body.user_id, password: auth.body.auth_password, images: [{ mimeType: "image/jpeg", data: "ZmFrZQ==" }] }
    );
    assert.equal(extract.status, 422);
    assert.equal(extract.body.error, "missing_question_numbers");
    assert.deepEqual(extract.body.missing_numbers, [2]);
  });

  console.log("worker data integrity checks passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
