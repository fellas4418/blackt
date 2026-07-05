/**
 * High-severity regression checks for auth-sensitive logs and in-app PDF print.
 * 실행: node scripts/check-critical-regressions.js
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

function assertIncludes(haystack, needle, msg) {
    if (!haystack.includes(needle)) fail(msg);
    else pass(msg);
}

const worker = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const analysis = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');

const signupLogStart = worker.indexOf('async function handleSignupLog');
const signupLogEnd = worker.indexOf('async function handleSyncSave', signupLogStart);
const signupLog = signupLogStart >= 0 && signupLogEnd > signupLogStart
    ? worker.slice(signupLogStart, signupLogEnd)
    : '';

if (!signupLog) {
    fail('handleSignupLog 함수를 찾을 수 있어야 함');
} else {
    assertIncludes(signupLog, 'body.user_id', 'signup log 요청은 user_id를 받아야 함');
    assertIncludes(signupLog, 'bodyUserId !== userId', 'signup log는 인증 계정과 name/phone 파생 계정을 대조해야 함');
    assertIncludes(signupLog, 'verifyUser(env, bodyUserId, password)', 'signup log는 서버에서 비밀번호를 검증해야 함');
    assertIncludes(signupLog, 'eventType: "level"', '공개 signup log 경로는 level 이벤트만 기록해야 함');
    if (/eventType\s*=\s*String\(body\.event_/.test(signupLog) || /referrer:\s*String\(body\.referrer/.test(signupLog)) {
        fail('signup log는 클라이언트 event_type/referrer를 그대로 신뢰하면 안 됨');
    } else {
        pass('signup log는 클라이언트 event_type/referrer를 신뢰하지 않음');
    }
}

const levelLogIdx = index.indexOf("base + '/api/signup/log'");
const authBeforeLogIdx = index.lastIndexOf("base + '/api/auth/simple'", levelLogIdx);
if (levelLogIdx === -1) {
    fail('index.html에서 /api/signup/log 호출을 찾을 수 있어야 함');
} else {
    if (authBeforeLogIdx === -1) fail('레벨 로그 전 /api/auth/simple 인증 호출이 있어야 함');
    else pass('레벨 로그 전 /api/auth/simple 인증 호출 확인');
    const levelLogBlock = index.slice(Math.max(0, levelLogIdx - 700), levelLogIdx + 700);
    assertIncludes(levelLogBlock, 'user_id: authData.user_id', '레벨 로그 요청은 인증 user_id를 보내야 함');
    assertIncludes(levelLogBlock, 'password: authData.auth_password', '레벨 로그 요청은 인증 password를 보내야 함');
}

const printStart = analysis.indexOf('function triggerInAppPrint');
const printEnd = analysis.indexOf('function passagePdfOpenPrintWindow', printStart);
const printBlock = printStart >= 0 && printEnd > printStart ? analysis.slice(printStart, printEnd) : '';
if (!printBlock) {
    fail('triggerInAppPrint 함수를 찾을 수 있어야 함');
} else {
    if (/setTimeout\(\s*cleanupPrint\s*,\s*4000\s*\)/.test(printBlock)) {
        fail('PDF print DOM을 4초 고정 타이머로 제거하면 안 됨');
    } else {
        pass('PDF print 4초 고정 cleanup 제거 확인');
    }
    assertIncludes(printBlock, "window.addEventListener('focus', onPrintReturn)", 'PDF print cleanup은 포커스 복귀를 기다려야 함');
    assertIncludes(printBlock, "document.addEventListener('visibilitychange', onVisibilityChange)", 'PDF print cleanup은 visibility 복귀를 기다려야 함');
    assertIncludes(printBlock, "window.matchMedia('print')", 'PDF print cleanup은 print media 종료를 감지해야 함');
    assertIncludes(printBlock, 'setTimeout(cleanupPrint, 120000)', 'PDF print cleanup에는 긴 안전 fallback이 있어야 함');
}

const exportStart = analysis.indexOf('function runPassagePdfExport');
const exportEnd = analysis.indexOf('(function initPassagePdfUi', exportStart);
const exportBlock = exportStart >= 0 && exportEnd > exportStart ? analysis.slice(exportStart, exportEnd) : '';
if (!exportBlock) {
    fail('runPassagePdfExport 함수를 찾을 수 있어야 함');
} else {
    if (/await\s+passagePdfFetchChatHistoryAsync/.test(exportBlock) || /async function runPassagePdfExport/.test(exportBlock)) {
        fail('PDF 버튼 클릭 경로에서 채팅 기록 네트워크 대기를 하면 안 됨');
    } else {
        pass('PDF 버튼 클릭 경로에서 채팅 기록 네트워크 대기 제거 확인');
    }
    assertIncludes(analysis, 'function primePassagePdfChatHistory()', 'PDF 모달 열 때 질문 기록을 미리 불러와야 함');
}

if (failed) {
    console.error(`\n${failed} critical regression check(s) failed.`);
    process.exit(1);
}

console.log('\nAll critical regression checks passed.');
