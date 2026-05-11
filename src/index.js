const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Secret",
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
  //      이후에는 해당 이름+전화번호 조합으로만 접속 가능
  if (ids.length === 1 && ids[0] === phone) {
    await env.DB.prepare("UPDATE users SET id = ?1, password_hash = ?2 WHERE id = ?3")
      .bind(userId, passwordHash, phone)
      .run();
    await env.DB.prepare("UPDATE saved_voca SET user_id = ?1 WHERE user_id = ?2")
      .bind(userId, phone)
      .run();
    await env.DB.prepare("UPDATE saved_grammar SET user_id = ?1 WHERE user_id = ?2")
      .bind(userId, phone)
      .run();
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

  const premRow = await env.DB.prepare("SELECT is_premium FROM users WHERE id = ?1").bind(userId).first();
  const isPremium = premRow && Number(premRow.is_premium) === 1 ? 1 : 0;

  return json({
    ok: true,
    saved_voca: vocaRows.results || [],
    saved_grammar: grammarRows.results || [],
    is_premium: isPremium,
  });
}

function verifyPaymentSecret(env, request, body) {
  const expected = String(env.API_SECRET_KEY || "").trim();
  if (!expected) return false;
  const headerSecret = String(request.headers.get("X-API-Secret") || request.headers.get("x-api-secret") || "").trim();
  const auth = String(request.headers.get("Authorization") || "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const bodySecret = String(body.api_secret_key || body.API_SECRET_KEY || "").trim();
  if (headerSecret === expected) return true;
  if (bearer === expected) return true;
  if (bodySecret === expected) return true;
  return false;
}

async function handlePaymentConfirm(env, request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!verifyPaymentSecret(env, request, body)) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = String(body.user_id || body.userId || "").trim();
  if (!userId) return json({ error: "user_id가 필요합니다." }, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(userId).first();
  if (!existing) return json({ error: "해당 user_id를 찾을 수 없습니다." }, 404);

  await env.DB.prepare("UPDATE users SET is_premium = 1 WHERE id = ?1").bind(userId).run();

  const verify = await env.DB.prepare("SELECT is_premium FROM users WHERE id = ?1").bind(userId).first();
  const okPremium = verify && Number(verify.is_premium) === 1;
  if (!okPremium) return json({ error: "is_premium 반영에 실패했습니다. DB 스키마를 확인해 주세요." }, 500);

  return json({ ok: true, user_id: userId, is_premium: 1 });
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

async function callGeminiStructured(env, parts, responseMimeType = "application/json") {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, responseMimeType },
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || data?.error || `gemini_${response.status}`;
    return { ok: false, error: msg, raw: data };
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "empty_gemini_response", raw: data };
  try {
    return { ok: true, json: JSON.parse(String(text).trim()) };
  } catch {
    const s = String(text);
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a !== -1 && b !== -1) {
      try {
        return { ok: true, json: JSON.parse(s.slice(a, b + 1)) };
      } catch {
        /* fallthrough */
      }
    }
    return { ok: false, error: "json_parse_failed", snippet: s.slice(0, 400) };
  }
}

async function handleExamExtract(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length === 0) return json({ error: "images 배열이 필요합니다." }, 400);
  if (images.length > 15) return json({ error: "이미지는 최대 15장까지 업로드할 수 있습니다." }, 400);

  const prompt = `You extract structure from Korean school English exam paper photos.
Return ONLY valid JSON (no markdown) with this exact shape:
{"questions":[{"number":1,"type":"multiple","points":2.5},{"number":2,"type":"essay","points":10}]}
Rules:
- "number": visible problem index (integer). Each numbered item appears once only.
- "type": "multiple" for 객관식·선택·빈칸 고르기 등, "essay" for 서술·논술·장문·단답 서술.
- "points": read the score printed at the end of each question line (e.g. 2.5점, [3점], (4.5)). Use decimals when shown; do not round to integers.
- Do not count sub-parts twice; use the score shown for the whole numbered item.
- Merge pages: include every numbered item you can read across all images.
- If unreadable, omit that item (do not guess numbers).`;

  const parts = [{ text: prompt }];
  let added = 0;
  for (const img of images) {
    const mime = String(img.mimeType || "image/jpeg");
    let data = String(img.data || "").trim();
    data = data.replace(/^data:image\/\w+;base64,/, "");
    if (!data) continue;
    if (data.length > 6_000_000) return json({ error: "단일 이미지 base64가 너무 큽니다." }, 400);
    parts.push({ inlineData: { mimeType: mime, data } });
    added++;
  }
  if (parts.length < 2) return json({ error: "유효한 이미지 base64가 없습니다." }, 400);

  const g = await callGeminiStructured(env, parts);
  if (!g.ok) return json({ error: g.error, detail: g.snippet || g.raw }, 500);
  const questions = g.json?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return json({ error: "문항을 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.", preview: JSON.stringify(g.json).slice(0, 300) }, 422);
  }
  const parsePoints = (value) => {
    if (value == null) return 0;
    const s = String(value).replace(/점/g, "").replace(/[^\d.]/g, " ").trim().split(/\s+/)[0];
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 10) / 10;
  };
  const byNumber = new Map();
  for (const q of questions) {
    const number = Number(q.number);
    const type = String(q.type || "").toLowerCase() === "essay" ? "essay" : "multiple";
    const points = parsePoints(q.points);
    if (!Number.isFinite(number) || number <= 0 || points < 0) continue;
    const prev = byNumber.get(number);
    if (!prev || points > prev.points) byNumber.set(number, { number, type, points });
  }
  const normalized = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  if (!normalized.length) return json({ error: "정규화된 문항이 없습니다." }, 422);
  return json({ ok: true, questions: normalized });
}

async function handleExamReportSave(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const id = String(body.id || crypto.randomUUID());
  const student_name = String(body.student_name || "").trim();
  const grade = String(body.grade || "").trim();
  const school_name = String(body.school_name || "").trim();
  const exam_type = String(body.exam_type || "").trim();
  if (!student_name || !school_name || !exam_type) {
    return json({ error: "student_name, school_name, exam_type이 필요합니다." }, 400);
  }

  const questions_json =
    typeof body.questions_json === "string" ? body.questions_json : JSON.stringify(body.questions_json ?? []);
  const session_json =
    typeof body.session_json === "string" ? body.session_json : JSON.stringify(body.session_json ?? {});
  let ai_diagnosis_json = null;
  if (body.ai_diagnosis_json != null) {
    ai_diagnosis_json =
      typeof body.ai_diagnosis_json === "string"
        ? body.ai_diagnosis_json
        : JSON.stringify(body.ai_diagnosis_json);
  }
  const admin_comment = String(body.admin_comment || "").trim();
  const voca_level_link = String(body.voca_level_link || "").trim();
  const now = new Date().toISOString();

  const existing = await env.DB.prepare("SELECT id FROM exam_analysis WHERE id = ?1 AND user_id = ?2")
    .bind(id, userId)
    .first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE exam_analysis SET student_name=?1, grade=?2, school_name=?3, exam_type=?4, voca_level_link=?5,
       questions_json=?6, session_json=?7, ai_diagnosis_json=?8, admin_comment=?9, updated_at=?10
       WHERE id=?11 AND user_id=?12`
    )
      .bind(
        student_name,
        grade,
        school_name,
        exam_type,
        voca_level_link,
        questions_json,
        session_json,
        ai_diagnosis_json,
        admin_comment,
        now,
        id,
        userId
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO exam_analysis (id, user_id, student_name, grade, school_name, exam_type, voca_level_link,
        questions_json, session_json, ai_diagnosis_json, admin_comment, created_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)`
    )
      .bind(
        id,
        userId,
        student_name,
        grade,
        school_name,
        exam_type,
        voca_level_link,
        questions_json,
        session_json,
        ai_diagnosis_json,
        admin_comment,
        now
      )
      .run();
  }
  return json({ ok: true, id });
}

async function handleExamReportList(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);
  const rows = await env.DB.prepare(
    `SELECT id, student_name, grade, school_name, exam_type, created_at, updated_at
     FROM exam_analysis WHERE user_id = ?1 ORDER BY datetime(created_at) DESC LIMIT 50`
  )
    .bind(userId)
    .all();
  return json({ ok: true, items: rows.results || [] });
}

async function handleExamReportGet(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);
  const id = String(body.id || "").trim();
  if (!id) return json({ error: "id가 필요합니다." }, 400);
  const row = await env.DB.prepare("SELECT * FROM exam_analysis WHERE id = ?1 AND user_id = ?2")
    .bind(id, userId)
    .first();
  if (!row) return json({ error: "not_found" }, 404);
  return json({ ok: true, report: row });
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
      if (request.method === "POST" && path === "/api/payment/confirm") {
        return handlePaymentConfirm(env, request);
      }
      if (request.method === "POST" && path === "/api/analyze") {
        return handleGeminiProxy(env, request);
      }
      if (request.method === "POST" && path === "/api/exam-report/extract") {
        return handleExamExtract(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/exam-report/save") {
        return handleExamReportSave(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/exam-report/list") {
        return handleExamReportList(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/exam-report/get") {
        return handleExamReportGet(env, await request.json());
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
