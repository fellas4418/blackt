/**
 * 관리자 회원 로그 API 인증 회귀 검사
 * 실행: node scripts/check-signup-log-auth.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function requireIncludes(text, token, label) {
    if (!text.includes(token)) fail(label + ' missing: ' + token);
    else pass(label + ' has ' + token);
}

const worker = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
const signupLogStart = worker.indexOf('async function handleSignupLog');
const signupLogEnd = worker.indexOf('async function handleSyncSave', signupLogStart);
const signupLog = signupLogStart >= 0 && signupLogEnd > signupLogStart
    ? worker.slice(signupLogStart, signupLogEnd)
    : '';

if (!signupLog) {
    fail('handleSignupLog block not found');
} else {
    requireIncludes(signupLog, 'const userId = `${phone}::${normalizeName(name)}`;', 'handleSignupLog');
    requireIncludes(signupLog, 'const authUserId = String(body.user_id || "").trim();', 'handleSignupLog');
    requireIncludes(signupLog, 'const password = String(body.password || "");', 'handleSignupLog');
    requireIncludes(signupLog, 'authUserId !== userId', 'handleSignupLog');
    requireIncludes(signupLog, 'await verifyUser(env, authUserId, password)', 'handleSignupLog');
    requireIncludes(signupLog, 'return json({ error: "인증 실패" }, 401);', 'handleSignupLog');
    requireIncludes(signupLog, 'eventType: "level"', 'handleSignupLog');
    if (/eventType\s*=\s*String\(body\.event_type/.test(signupLog) || /referrer:\s*String\(body\.referrer/.test(signupLog)) {
        fail('handleSignupLog must not trust client event_type/referrer');
    } else {
        pass('handleSignupLog ignores client event_type/referrer');
    }
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const logCallPos = indexHtml.indexOf("base + '/api/signup/log'");
const authCallPos = indexHtml.lastIndexOf("base + '/api/auth/simple'", logCallPos);
if (logCallPos < 0) {
    fail('index.html signup/log call not found');
} else {
    if (authCallPos < 0) fail('index.html does not auth before signup/log');
    else pass('index.html auths before signup/log');
    const callBlock = indexHtml.slice(Math.max(0, authCallPos), Math.min(indexHtml.length, logCallPos + 500));
    requireIncludes(callBlock, "var userId = String(authData.user_id || '').trim();", 'index.html signup/log');
    requireIncludes(callBlock, "var password = String(authData.auth_password || '').trim();", 'index.html signup/log');
    requireIncludes(callBlock, 'user_id: userId', 'index.html signup/log');
    requireIncludes(callBlock, 'password: password', 'index.html signup/log');
}

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
