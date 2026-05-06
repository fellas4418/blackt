const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(text || "")));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyUser(env, userId, password) {
  if (!userId || !password) return false;
  const hash = await sha256Hex(password);
  const row = await env.DB.prepare("SELECT id FROM users WHERE id = ?1 AND password_hash = ?2")
    .bind(userId, hash)
    .first();
  return !!row;
}

function normalizePhone(raw) {
  return String(raw || "").replace(/[^0-9]/g, "");
}

function normalizeName(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function handleSignup(env, body) {
  const id = String(body.id || "").trim();
  const password = String(body.password || "");
  if (!id || !password) return json({ error: "id/password가 필요합니다." }, 400);

  const exists = await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(id).first();
  if (exists) return json({ error: "이미 존재하는 아이디입니다." }, 409);

  const passwordHash = await sha256Hex(password);
  await env.DB.prepare("INSERT INTO users (id, password_hash) VALUES (?1, ?2)")
    .bind(id, passwordHash)
    .run();
  return json({ ok: true, message: "signup_success", user_id: id });
}

async function handleLogin(env, body) {
  const id = String(body.id || "").trim();
  const password = String(body.password || "");
  if (!id || !password) return json({ error: "id/password가 필요합니다." }, 400);
  const ok = await verifyUser(env, id, password);
  if (!ok) return json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
  return json({ ok: true, message: "login_success", user_id: id });
}

async function handleSimpleAuth(env, body) {
  const name = String(body.name || "").trim();
  const phone = normalizePhone(body.phone);
  if (!name || !phone) return json({ error: "name/phone이 필요합니다." }, 400);

  // 같은 이름+전화번호 조합일 때만 동일 계정으로 연결
  const userId = `${phone}::${normalizeName(name)}`;
  const password = userId;
  const passwordHash = await sha256Hex(password);

  // 1) 정확히 같은 (전화번호+이름) 계정이 있으면 그대로 로그인
  const exact = await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(userId).first();
  if (exact) {
    await env.DB.prepare("UPDATE users SET password_hash = ?2 WHERE id = ?1").bind(userId, passwordHash).run();
    return json({
      ok: true,
      message: "simple_auth_success",
      user_id: userId,
      auth_password: password,
    });
  }

  // 2) 같은 전화번호로 기존 계정이 있는지 검사
  const byPhone = await env.DB
    .prepare("SELECT id FROM users WHERE id = ?1 OR id LIKE ?2")
    .bind(phone, `${phone}::%`)
    .all();
  const ids = Array.isArray(byPhone.results) ? byPhone.results.map((r) => String(r.id || "")) : [];

  // 2-1) 레거시(전화번호만 id) 계정만 있으면 최초 1회 이름 결합 계정으로 승격
  //      FK가 걸린 저장 데이터가 있으므로 새 부모 행을 만든 뒤 자식 행을 이동한다.
  if (ids.length === 1 && ids[0] === phone) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, password_hash) VALUES (?1, ?2)")
        .bind(userId, passwordHash),
      env.DB.prepare("UPDATE saved_voca SET user_id = ?1 WHERE user_id = ?2")
        .bind(userId, phone),
      env.DB.prepare("UPDATE saved_grammar SET user_id = ?1 WHERE user_id = ?2")
        .bind(userId, phone),
      env.DB.prepare("DELETE FROM users WHERE id = ?1")
        .bind(phone),
    ]);
    return json({
      ok: true,
      message: "simple_auth_success",
      user_id: userId,
      auth_password: password,
    });
  }

  // 2-2) 같은 전화번호의 다른 이름 계정이 이미 있으면 접속 차단
  if (ids.length > 0) {
    return json({ error: "동일한 전화번호의 기존 계정과 이름이 일치하지 않습니다." }, 403);
  }

  // 3) 완전 신규면 생성
  await env.DB.prepare("INSERT INTO users (id, password_hash) VALUES (?1, ?2)")
    .bind(userId, passwordHash)
    .run();

  return json({
    ok: true,
    message: "simple_auth_success",
    user_id: userId,
    auth_password: password,
  });
}

async function handleSyncSave(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const voca = Array.isArray(body.voca) ? body.voca : [];
  const grammar = Array.isArray(body.grammar) ? body.grammar : [];

  for (const row of voca) {
    const eng = String(row.eng || "").trim();
    const kor = String(row.kor || "").trim();
    if (!eng || !kor) continue;
    const level = String(row.level || "other").trim() || "other";
    const passageTitle = String(row.passageTitle || row.passage_title || "").trim();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO saved_voca (user_id, eng, kor, level, passage_title) VALUES (?1, ?2, ?3, ?4, ?5)"
    ).bind(userId, eng, kor, level, passageTitle).run();
  }

  for (const row of grammar) {
    const point = String(row.point || "").trim();
    const sentence = String(row.sentence || "").trim();
    const explanation = String(row.explanation || "").trim();
    if (!point || !sentence || !explanation) continue;
    const passageTitle = String(row.passageTitle || row.passage_title || "").trim();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO saved_grammar (user_id, point, sentence, explanation, passage_title) VALUES (?1, ?2, ?3, ?4, ?5)"
    ).bind(userId, point, sentence, explanation, passageTitle).run();
  }

  return json({ ok: true });
}

async function handleSyncLoad(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const vocaRows = await env.DB.prepare(
    "SELECT eng, kor, level, passage_title AS passageTitle FROM saved_voca WHERE user_id = ?1 ORDER BY id DESC"
  ).bind(userId).all();
  const grammarRows = await env.DB.prepare(
    "SELECT point, sentence, explanation, passage_title AS passageTitle FROM saved_grammar WHERE user_id = ?1 ORDER BY id DESC"
  ).bind(userId).all();

  return json({
    ok: true,
    saved_voca: vocaRows.results || [],
    saved_grammar: grammarRows.results || [],
  });
}

async function handleSyncDelete(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const type = String(body.type || "").trim();
  const item = body.item || {};

  if (type === "voca") {
    const eng = String(item.eng || "").trim();
    if (!eng) return json({ error: "eng가 필요합니다." }, 400);
    await env.DB.prepare("DELETE FROM saved_voca WHERE user_id = ?1 AND lower(eng) = lower(?2)")
      .bind(userId, eng)
      .run();
    return json({ ok: true });
  }

  if (type === "grammar") {
    const sentence = String(item.sentence || "").trim();
    if (!sentence) return json({ error: "sentence가 필요합니다." }, 400);
    await env.DB.prepare("DELETE FROM saved_grammar WHERE user_id = ?1 AND sentence = ?2")
      .bind(userId, sentence)
      .run();
    return json({ ok: true });
  }

  return json({ error: "지원하지 않는 삭제 타입입니다." }, 400);
}

async function handleGeminiProxy(env, request) {
  const body = await request.json();
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return json(data, response.status);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "POST" && path === "/api/signup") {
        return handleSignup(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/login") {
        return handleLogin(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/auth/simple") {
        return handleSimpleAuth(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/sync/save") {
        return handleSyncSave(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/sync/load") {
        return handleSyncLoad(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/sync/delete") {
        return handleSyncDelete(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/analyze") {
        return handleGeminiProxy(env, request);
      }
      if (request.method === "POST" && path === "/") {
        return handleGeminiProxy(env, request);
      }
      return json({ error: "not_found" }, 404);
    } catch (e) {
      return json({ error: e?.message || "internal_error" }, 500);
    }
  },
};
