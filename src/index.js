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

async function insertSignupLog(env, row) {
  const name = String(row.name || "").trim();
  const phone = normalizePhone(row.phone);
  if (!name || !phone) return;
  const userId = String(row.userId || row.user_id || "").trim() || `${phone}::${normalizeName(name)}`;
  const level = String(row.level || "").trim() || null;
  const referrer = String(row.referrer || "").trim() || null;
  const eventType = String(row.eventType || row.event_type || "signup").trim() || "signup";
  await env.DB.prepare(
    `INSERT INTO signup_logs (user_id, name, phone, level, referrer, event_type, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))`
  )
    .bind(userId, name, phone, level, referrer, eventType)
    .run();
}

function parseExamSessionTotals(sessionJson) {
  try {
    const s = typeof sessionJson === "string" ? JSON.parse(sessionJson) : sessionJson;
    const t = (s && s.totals) || {};
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      totalAcc: num(t.totalAcc),
      totalEarn: num(t.totalEarn),
      totalPts: num(t.totalPts),
      mcEarn: num(t.mcEarn),
      esEarn: num(t.esEarn),
    };
  } catch {
    return { totalAcc: null, totalEarn: null, totalPts: null, mcEarn: null, esEarn: null };
  }
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
      is_new_user: false,
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
      is_new_user: false,
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

  try {
    await insertSignupLog(env, {
      userId,
      name,
      phone,
      level: String(body.level || "미정(가입완료)").trim(),
      referrer: String(body.referrer || "").trim(),
      eventType: "signup",
    });
  } catch (e) {}

  return json({
    ok: true,
    message: "simple_auth_success",
    user_id: userId,
    auth_password: password,
    is_new_user: true,
  });
}

async function handleSignupLog(env, body) {
  const name = String(body.name || "").trim();
  const phone = normalizePhone(body.phone);
  if (!name || !phone) return json({ error: "name/phone이 필요합니다." }, 400);
  const level = String(body.level || "").trim();
  if (!level) return json({ error: "level이 필요합니다." }, 400);
  const userId = String(body.user_id || body.userId || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);
  const expectedUserId = `${phone}::${normalizeName(name)}`;
  if (userId !== expectedUserId) return json({ error: "계정 정보가 일치하지 않습니다." }, 403);
  try {
    await insertSignupLog(env, {
      userId,
      name,
      phone,
      level,
      eventType: "level",
    });
  } catch (e) {
    return json({ error: "signup_log_failed" }, 500);
  }
  return json({ ok: true });
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

  const ds = body.daily_session;
  if (ds && typeof ds === "object" && !Array.isArray(ds)) {
    const level = String(ds.level || "").trim();
    const dayNum = parseInt(ds.day_num ?? ds.dayNum, 10);
    const accuracyVal = parseInt(ds.accuracy, 10);
    const wrongCount = parseInt(ds.wrong_count ?? ds.wrongCount, 10);
    const subject = String(ds.subject || "english").trim() || "english";
    const sessionNumber = parseInt(ds.session_number ?? ds.sessionNumber, 10);
    if (level && Number.isFinite(dayNum) && dayNum > 0) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO daily_session (user_id, subject, level, day_num, accuracy, wrong_count, session_number, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))`
      )
        .bind(
          userId,
          subject,
          level,
          dayNum,
          Number.isFinite(accuracyVal) ? accuracyVal : 0,
          Number.isFinite(wrongCount) ? wrongCount : 0,
          Number.isFinite(sessionNumber) ? sessionNumber : null
        )
        .run();
    }
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

const GEMINI_EGRESS_HINT = "enam";

async function geminiApiFetch(env, endpoint, payload) {
  if (env.GEMINI_PROXY) {
    const id = env.GEMINI_PROXY.idFromName("gemini-egress");
    const stub = env.GEMINI_PROXY.get(id, { locationHint: GEMINI_EGRESS_HINT });
    const res = await stub.fetch(
      new Request("https://gemini-proxy.internal/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: endpoint, body: payload }),
      })
    );
    const wrapped = await res.json().catch(() => ({}));
    return {
      ok: !!wrapped.ok,
      status: Number(wrapped.status) || res.status || 500,
      data: wrapped.data || {},
    };
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function callGeminiChatSimple(env, fullPrompt, maxOutputTokens = 2048) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.35, maxOutputTokens },
  };
  const { ok, status, data } = await geminiApiFetch(env, endpoint, payload);
  if (!ok) {
    return { error: data?.error?.message || data?.error || `gemini_http_${status}` };
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  let text = "";
  if (Array.isArray(parts) && parts.length) {
    text = parts.map((p) => (p && p.text ? String(p.text) : "")).join("");
  } else {
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  text = String(text).trim();
  if (!text) return { error: "empty_response" };
  return { text };
}

/** AI 질문 답변: 옛 라벨·번호 형식을 이모지 3단 형식으로 통일 */
function normalizeChatAnswer(raw) {
  let t = String(raw || "").trim();
  if (!t) return t;
  t = t.replace(/^\s*\d+\)\s*/gm, "");
  const lineLabel = (re, label) => {
    t = t.replace(re, label);
  };
  lineLabel(/^해석\s*:/gim, "💬 답변요약:");
  lineLabel(/^답변\s*:/gim, "💬 답변요약:");
  lineLabel(/^이\s*문장에서\s*:/gim, "📌 지문 연결:");
  lineLabel(/^2\)\s*핵심문법\s*:/gim, "⭐ 핵심:");
  lineLabel(/^2\)\s*출제포인트\s*:/gim, "⭐ 핵심:");
  lineLabel(/^핵심\s*:/gim, "⭐ 핵심:");
  lineLabel(/^예시\s*:/gim, "📝 예시:");
  if (!/^💬/.test(t) && /^답변\s*:/i.test(t)) t = "💬 " + t;
  t = t.replace(/^💬\s*답변(?!요약)/gm, "💬 답변요약");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

const CHAT_ANSWER_LABELS = {
  withContext: {
    answer: "💬 답변요약",
    context: "📌 지문 연결",
    example: "📝 예시",
  },
  general: {
    answer: "💬 답변요약",
    summary: "⭐ 핵심",
    example: "📝 예시",
  },
};

function buildChatAskPrompt(question, contextSentence) {
  const base =
    "역할: 대한민국 고등 영어 강사. 고3 수험생에게 친근하고 쉽게, 명확하게 답합니다.\n" +
    "말투: 💬 답변요약·📌 지문 연결·⭐ 핵심·📝 예시 본문 모두 끝까지 같은 해요체(~해요, ~이에요, ~돼요, ~한답니다, ~거예요)만 쓰세요. 합니다·하십시오·반말·문어체는 쓰지 마세요.\n" +
    "호칭·인사 금지: 「학생 여러분」, 「여러분」, 「질문하신」, 「질문하셨네요」 등 대면 호칭·인사 없이 바로 설명부터 시작하세요.\n" +
    "금지: 지문·문장 통역만 하지 마세요. 라벨·본문에 「해석:」이라는 단어를 쓰지 마세요.\n" +
    "반드시 아래 3단만 출력합니다. 각 단은 빈 줄로 구분하고, 단 제목은 지정한 이모지+라벨을 그대로 쓰세요(번호 1)2)3) 붙이지 마세요).\n" +
    "💬 답변요약은 질문 핵심만 2~4문장으로 짧게. 한 단어의 모든 쓰임을 나열하지 마세요.\n" +
    "각 단 본문은 문장 중간에서 끊지 말고 끝까지 완성하세요. ⭐ 핵심·📝 예시는 반드시 끝까지 쓰세요.\n" +
    "📝 예시의 영어 문장에서 질문 주제와 직접 관련된 단어·구·절만 ⟦ ⟧ 로 감싸세요(한글 뜻 괄호 안은 감싸지 마세요). 예: ⟦Having finished his homework,⟧ he went out.\n" +
    "마크다운·코드블록 없이 일반 텍스트만 출력합니다.\n";

  if (contextSentence) {
    const L = CHAT_ANSWER_LABELS.withContext;
    return (
      base +
      "상황: 학생이 지문에서 문장을 골라 질문했습니다. 그 문장 전체를 번역하는 것이 아니라, 질문한 표현·구조·뜻·용법에 답하세요.\n" +
      "분량: 전체 450~750자(공백·줄바꿈 포함).\n" +
      "형식(정확히 이 제목만 사용):\n" +
      `${L.answer}: (질문에 대한 설명 2~4문장)\n\n` +
      `${L.context}: (선택 지문 문장과 연결해, 해당 표현이 문맥에서 어떤 역할인지 1~2문장)\n\n` +
      `${L.example}: (영어 예문 1~2개 + 각 괄호 안 짧은 한국어 뜻)\n` +
      `\n[선택된 지문 문장]\n${contextSentence}\n\n[학생 질문]\n${question}`
    );
  }

  const L = CHAT_ANSWER_LABELS.general;
  return (
    base +
    "상황: 지문 문장을 선택하지 않은 일반 문법·용법·개념 질문입니다. 문장 해석·번역 형식으로 답하지 마세요.\n" +
    "분량: 전체 450~750자(공백·줄바꿈 포함).\n" +
    "형식(정확히 이 제목만 사용):\n" +
    `${L.answer}: (질문에 직접 답하는 개념·원리 설명 2~4문장)\n\n` +
    `${L.summary}: (한 줄 요약)\n\n` +
    `${L.example}: (영어 예문 1~2개 + 각 괄호 안 짧은 한국어 뜻)\n` +
    `\n[학생 질문]\n${question}`
  );
}

function getAllowedGoldenKeyInviteCodes(env) {
  const raw = String(env.GOLDEN_KEY_INVITE_CODES || "tri3");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Golden Key · AI 질문: 유료 또는 유효 초대코드(tri3 등) */
async function userHasPassagePremiumExtras(env, userId, body) {
  const open = String(env.ANALYSIS_EXTRAS_OPEN || "").toLowerCase();
  if (open === "true" || open === "1") return true;
  const row = await env.DB.prepare("SELECT is_premium FROM users WHERE id = ?1").bind(userId).first();
  if (row && Number(row.is_premium) === 1) return true;
  const code = String(body.invite_code || "")
    .trim()
    .toLowerCase();
  if (code && getAllowedGoldenKeyInviteCodes(env).includes(code)) return true;
  return false;
}

async function handleChatAsk(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);
  if (!(await userHasPassagePremiumExtras(env, userId, body))) {
    return json({ error: "premium_required", message: "유료 또는 초대 코드 이용자만 AI 질문을 사용할 수 있습니다." }, 403);
  }

  const question = String(body.question || "").trim();
  const contextSentence = String(body.context_sentence || "").trim();
  if (!question) return json({ error: "question이 필요합니다." }, 400);
  if (question.length > 800) return json({ error: "question_too_long" }, 400);

  const fullPrompt = buildChatAskPrompt(question, contextSentence);
  const g = await callGeminiChatSimple(env, fullPrompt);
  if (g.error) return json({ error: g.error }, 500);

  const answerText = normalizeChatAnswer(g.text);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const questionForDb = contextSentence
    ? `[선택 지문 문장]\n${contextSentence}\n\n[질문]\n${question}`
    : question;
  try {
    await env.DB.prepare(
      "INSERT INTO chat_history (id, user_id, question, answer, created_at) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(id, userId, questionForDb, answerText, now)
      .run();
  } catch (dbErr) {
    console.error("chat_history insert failed:", dbErr?.message || dbErr);
  }

  return json({ ok: true, answer: answerText, id });
}

async function handleChatHistory(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);
  if (!(await userHasPassagePremiumExtras(env, userId, body))) {
    return json({ error: "premium_required", message: "유료 또는 초대 코드 이용자만 질문 기록을 볼 수 있습니다." }, 403);
  }

  const rows = await env.DB
    .prepare(
      "SELECT id, question, answer, created_at FROM chat_history WHERE user_id = ?1 ORDER BY datetime(created_at) DESC LIMIT 80"
    )
    .bind(userId)
    .all();

  return json({ ok: true, items: rows.results || [] });
}

const STREAK_MILESTONES = [7, 14, 30];

function kstTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd, delta) {
  const parts = String(ymd || "").split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return ymd;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + delta));
  return dt.toISOString().slice(0, 10);
}

/** distinct KST dates (desc) → 연속 일수 (오늘 또는 어제까지 이어지는 구간) */
function computeStreakFromDates(sortedDescYmd, todayYmd) {
  if (!sortedDescYmd.length) return 0;
  const latest = sortedDescYmd[0];
  const yesterday = addDaysYmd(todayYmd, -1);
  if (latest !== todayYmd && latest !== yesterday) return 0;
  const set = new Set(sortedDescYmd);
  let anchor = latest === todayYmd ? todayYmd : yesterday;
  let count = 0;
  let cur = anchor;
  while (set.has(cur)) {
    count += 1;
    cur = addDaysYmd(cur, -1);
  }
  return count;
}

function milestoneForStreak(streak) {
  const n = Number(streak) || 0;
  return STREAK_MILESTONES.includes(n) ? n : null;
}

async function handleStreak(env, body) {
  const userId = String(body.user_id || "").trim();
  const password = String(body.password || "");
  if (!(await verifyUser(env, userId, password))) return json({ error: "인증 실패" }, 401);

  const rows = await env.DB.prepare(
    `SELECT DISTINCT date(created_at, '+9 hours') AS d
     FROM daily_session
     WHERE user_id = ?1
     ORDER BY d DESC`
  )
    .bind(userId)
    .all();

  const dates = (rows.results || [])
    .map((r) => String(r.d || "").trim())
    .filter(Boolean);
  const today = kstTodayYmd();
  const streak = computeStreakFromDates(dates, today);
  const milestone = milestoneForStreak(streak);

  const progressRows = await env.DB.prepare(
    `SELECT level, MAX(day_num) AS max_day
     FROM daily_session
     WHERE user_id = ?1 AND level IN ('middle', 'high')
     GROUP BY level`
  )
    .bind(userId)
    .all();

  const voca_progress = {};
  for (const r of progressRows.results || []) {
    const lvl = String(r.level || "").trim();
    const maxDay = parseInt(r.max_day, 10) || 0;
    if (maxDay > 0) {
      voca_progress[lvl] = { completed_day: maxDay, next_day: maxDay + 1 };
    }
  }

  return json({ ok: true, streak, milestone, voca_progress });
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

/**
 * POST /api/analyze — Gemini generateContent 프록시(요청 본문 그대로 전달).
 * 지문 유형·passage_layout JSON 스키마는 analysis.html 분석 프롬프트에서 정의되며,
 * Worker는 본문 검증·변환을 하지 않습니다. (향후 서버 검증 추가 시 이 주석 근처 확장)
 */
async function handleGeminiProxy(env, request) {
  const body = await request.json();
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const { status, data } = await geminiApiFetch(env, endpoint, body);
  return json(data, status);
}

async function callGeminiStructured(env, parts, responseMimeType = "application/json") {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, responseMimeType },
  };
  const { ok, status, data } = await geminiApiFetch(env, endpoint, payload);
  if (!ok) {
    const msg = data?.error?.message || data?.error || `gemini_${status}`;
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

async function handleWordMeaning(env, body) {
  const raw = Array.isArray(body.words)
    ? body.words
    : body.word
      ? [body.word]
      : [];
  const words = [];
  const seen = new Set();
  for (const w of raw) {
    const clean = String(w || "")
      .toLowerCase()
      .replace(/[^a-z-]/g, "")
      .trim();
    if (!clean || clean.length < 2 || seen.has(clean)) continue;
    seen.add(clean);
    words.push(clean);
    if (words.length >= 35) break;
  }
  if (words.length === 0) return json({ error: "words 배열이 필요합니다." }, 400);

  const prompt =
    `You are a Korean high-school English vocabulary assistant. ` +
    `For each English headword in the JSON array, output ONLY valid JSON: ` +
    `{"items":[{"word":"...","meanings":["..."]}]}. ` +
    `Use 1 Korean meaning by default; add a 2nd only if senses are clearly different for test passages (not synonyms). ` +
    `If two meanings overlap, keep one. Meanings: short Korean, 수능·고2 level, no examples, no English gloss, no markdown.\n\n` +
    `Headwords:\n${JSON.stringify(words)}`;

  const g = await callGeminiStructured(env, [{ text: prompt }]);
  if (!g.ok) return json({ error: g.error, detail: g.snippet || g.raw }, 500);
  const items = Array.isArray(g.json?.items) ? g.json.items : [];
  return json({ items });
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
- "number": the main question number printed on the paper (1, 2, 3 …). Each number exactly once.
- Include EVERY consecutive number from 1 through the highest number visible (e.g. 30 questions → numbers 1–30, count=30). Do not skip because a page break splits items.
- "type": "multiple" for 객관식·선택·빈칸 고르기·일치불일치 등, "essay" ONLY for 서술·논술·장문·단답 서술 blocks.
- "points": 배점 at the end of each question line (2.5점, [3], (4)). Decimals allowed. Sum of all points should match the exam total (often 100).
- Do not count (1)(2) sub-items as separate questions; one row per main number.
- Merge all uploaded images; scan headers/footers for missed numbers.
- If one number is unreadable, omit only that number (do not guess).`;

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
    const raw = String(value).replace(/,/g, ".").replace(/점/g, "");
    const matches = raw.match(/\d+(?:\.\d+)?/g);
    const n = matches && matches.length ? parseFloat(matches[matches.length - 1]) : parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 10) / 10;
  };
  const medianPoints = (list, typeFilter) => {
    const pts = list
      .filter((q) => !typeFilter || q.type === typeFilter)
      .map((q) => Number(q.points) || 0)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    if (!pts.length) return 2.5;
    const mid = Math.floor(pts.length / 2);
    return pts.length % 2 ? pts[mid] : Math.round(((pts[mid - 1] + pts[mid]) / 2) * 10) / 10;
  };
  const byNumber = new Map();
  for (const q of questions) {
    const number = Number(q.number);
    const type = String(q.type || "").toLowerCase() === "essay" ? "essay" : "multiple";
    let points = parsePoints(q.points);
    if (!Number.isFinite(number) || number <= 0) continue;
    const prev = byNumber.get(number);
    if (!prev || points > prev.points) byNumber.set(number, { number, type, points });
  }
  let normalized = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  normalized.forEach((q) => {
    if ((Number(q.points) || 0) <= 0) q.points = medianPoints(normalized, q.type === "essay" ? "essay" : "multiple");
  });
  if (normalized.length) {
    const nums = normalized.map((q) => q.number);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const have = new Set(nums);
    const guess = medianPoints(normalized, "multiple");
    for (let n = min; n <= max; n++) {
      if (!have.has(n)) normalized.push({ number: n, type: "multiple", points: guess, _inferred: true });
    }
    normalized.sort((a, b) => a.number - b.number);
  }
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
  const voca_level_link = String(body.voca_level_link || "").trim();
  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    "SELECT id, admin_comment FROM exam_analysis WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, userId)
    .first();
  const admin_comment = existing ? String(existing.admin_comment || "").trim() : "";

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

async function handleAdminDailySession(env, request, url) {
  if (!verifyPaymentSecret(env, request, {})) return json({ error: "unauthorized" }, 401);
  const userId = String(url.searchParams.get("user_id") || "").trim();
  if (userId) {
    const rows = await env.DB.prepare(
      `SELECT day_num, level, accuracy, wrong_count, created_at
       FROM daily_session WHERE user_id = ?1 ORDER BY day_num ASC`
    )
      .bind(userId)
      .all();
    return json({ ok: true, user_id: userId, items: rows.results || [] });
  }
  const rows = await env.DB.prepare(
    `SELECT
      s.user_id,
      s.completed_days,
      s.avg_accuracy,
      s.last_study_at,
      (SELECT level FROM daily_session d2
       WHERE d2.user_id = s.user_id
       ORDER BY datetime(d2.created_at) DESC LIMIT 1) AS level
    FROM (
      SELECT user_id,
        COUNT(*) AS completed_days,
        ROUND(AVG(accuracy), 1) AS avg_accuracy,
        MAX(created_at) AS last_study_at
      FROM daily_session
      GROUP BY user_id
    ) s
    ORDER BY datetime(s.last_study_at) DESC`
  ).all();
  return json({ ok: true, items: rows.results || [] });
}

async function handleExamReportAdminList(env, request, body) {
  if (!verifyPaymentSecret(env, request, body)) return json({ error: "unauthorized" }, 401);
  const rows = await env.DB.prepare(
    `SELECT id, user_id, student_name, grade, school_name, exam_type, admin_comment, created_at, updated_at
     FROM exam_analysis ORDER BY datetime(created_at) DESC LIMIT 80`
  ).all();
  return json({ ok: true, items: rows.results || [] });
}

async function handleExamReportAdminComment(env, request, body) {
  if (!verifyPaymentSecret(env, request, body)) return json({ error: "unauthorized" }, 401);
  const id = String(body.id || "").trim();
  const admin_comment = String(body.admin_comment || "").trim();
  if (!id) return json({ error: "id가 필요합니다." }, 400);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE exam_analysis SET admin_comment = ?1, updated_at = ?2 WHERE id = ?3"
  )
    .bind(admin_comment, now, id)
    .run();
  if (!result.meta || !result.meta.changes) return json({ error: "not_found" }, 404);
  return json({ ok: true, id });
}

async function handleAdminMembers(env, request) {
  if (!verifyPaymentSecret(env, request, {})) return json({ error: "unauthorized" }, 401);
  let logRows = [];
  try {
    const rows = await env.DB.prepare(
      `SELECT id, user_id, name, phone, level, referrer, event_type, created_at
       FROM signup_logs ORDER BY datetime(created_at) DESC LIMIT 500`
    ).all();
    logRows = rows.results || [];
  } catch (e) {
    logRows = [];
  }
  const users = await env.DB.prepare("SELECT id, is_premium FROM users ORDER BY id ASC").all();
  return json({ ok: true, items: logRows, users: users.results || [] });
}

async function handleAdminExamTrends(env, request, url) {
  if (!verifyPaymentSecret(env, request, {})) return json({ error: "unauthorized" }, 401);
  const userId = String(url.searchParams.get("user_id") || "").trim();
  if (userId) {
    const rows = await env.DB.prepare(
      `SELECT id, student_name, grade, school_name, exam_type, session_json, created_at
       FROM exam_analysis WHERE user_id = ?1 ORDER BY datetime(created_at) ASC`
    )
      .bind(userId)
      .all();
    const items = (rows.results || []).map((r) => ({
      id: r.id,
      student_name: r.student_name,
      grade: r.grade,
      school_name: r.school_name,
      exam_type: r.exam_type,
      created_at: r.created_at,
      ...parseExamSessionTotals(r.session_json),
    }));
    return json({ ok: true, user_id: userId, items });
  }
  const rows = await env.DB.prepare(
    `SELECT user_id,
      MAX(student_name) AS student_name,
      MAX(grade) AS grade,
      COUNT(*) AS exam_count,
      MAX(created_at) AS last_exam_at
     FROM exam_analysis
     GROUP BY user_id
     ORDER BY datetime(MAX(created_at)) DESC
     LIMIT 120`
  ).all();
  return json({ ok: true, items: rows.results || [] });
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
  const premRow = await env.DB.prepare("SELECT is_premium FROM users WHERE id = ?1").bind(userId).first();
  const isPremium = premRow && Number(premRow.is_premium) === 1;
  const report = { ...row };
  if (!isPremium) report.admin_comment = null;
  return json({ ok: true, report, is_premium: isPremium ? 1 : 0 });
}

function referralIdFromPhone(phone) {
  const p = normalizePhone(phone);
  return p ? `r${p}` : "";
}

async function handleReferralSignup(env, body) {
  const referrerId = String(body.referrer_id || "").trim();
  const refereePhone = normalizePhone(body.referee_phone);
  if (!referrerId || !/^010\d{8}$/.test(refereePhone)) {
    return json({ error: "referrer_id/referee_phone가 필요합니다." }, 400);
  }
  if (referrerId === referralIdFromPhone(refereePhone)) {
    return json({ ok: true, skipped: "self" });
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO referral_signups (referrer_id, referee_phone) VALUES (?1, ?2)"
  )
    .bind(referrerId, refereePhone)
    .run();
  return json({ ok: true });
}

async function handleReferralClaim(env, body) {
  const referrerId = String(body.referrer_id || "").trim();
  if (!referrerId) return json({ error: "referrer_id가 필요합니다." }, 400);
  const pending = await env.DB.prepare(
    "SELECT referee_phone FROM referral_signups WHERE referrer_id = ?1 AND credited_sharer = 0"
  )
    .bind(referrerId)
    .all();
  const count = (pending.results || []).length;
  if (count > 0) {
    await env.DB.prepare(
      "UPDATE referral_signups SET credited_sharer = 1 WHERE referrer_id = ?1 AND credited_sharer = 0"
    )
      .bind(referrerId)
      .run();
  }
  return json({ ok: true, count });
}

export { GeminiProxy } from "./gemini-proxy.js";

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
      if (request.method === "POST" && path === "/api/signup/log") {
        return handleSignupLog(env, await request.json());
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
      if (request.method === "POST" && path === "/api/streak") {
        return handleStreak(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/payment/confirm") {
        return handlePaymentConfirm(env, request);
      }
      if (request.method === "POST" && path === "/api/chat/ask") {
        return handleChatAsk(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/chat/history") {
        return handleChatHistory(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/analyze") {
        return handleGeminiProxy(env, request);
      }
      if (request.method === "POST" && path === "/api/word-meaning") {
        return handleWordMeaning(env, await request.json());
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
      if (request.method === "POST" && path === "/api/referral/signup") {
        return handleReferralSignup(env, await request.json());
      }
      if (request.method === "POST" && path === "/api/referral/claim") {
        return handleReferralClaim(env, await request.json());
      }
      if (request.method === "GET" && path === "/api/admin/daily-session") {
        return handleAdminDailySession(env, request, url);
      }
      if (request.method === "GET" && path === "/api/admin/members") {
        return handleAdminMembers(env, request);
      }
      if (request.method === "GET" && path === "/api/admin/exam-trends") {
        return handleAdminExamTrends(env, request, url);
      }
      if (request.method === "POST" && path === "/api/exam-report/admin/list") {
        return handleExamReportAdminList(env, request, await request.json());
      }
      if (request.method === "POST" && path === "/api/exam-report/admin/comment") {
        return handleExamReportAdminComment(env, request, await request.json());
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
