/**
 * Review-day wrong word persistence regression check.
 * 실행: node scripts/check-review-wrong-persist.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

const fnMatch = app.match(/function shouldPersistWrongToList\(sessionRaw, isReviewDay\) \{[\s\S]*?\n\}/);
if (!fnMatch) {
    fail('shouldPersistWrongToList 함수가 없습니다.');
} else {
    const fn = fnMatch[0];
    if (fn.includes("if (isReviewDay) return sessionRaw === '2';")) {
        pass('복습일 최종 테스트 세션 2에서 오답을 저장합니다.');
    } else {
        fail('복습일 오답 저장 조건은 sessionRaw === \\'2\\' 이어야 합니다.');
    }
    if (fn.includes("if (isReviewDay) return sessionRaw === '3';")) {
        fail('복습일 세션 3 조건이 남아 있습니다. 복습일은 총 2세션입니다.');
    } else {
        pass('복습일 세션 3 조건이 없습니다.');
    }
}

const requiredRuntimeGuards = [
    'let totalSessions = isReviewDay ? 2 : DAILY_CYCLE_COUNT;',
    "if (didTest && accuracy < 80 && (currentSessionRaw === String(DAILY_CYCLE_COUNT) || (isReviewDay && currentSessionRaw === '2')))",
    "if ((currentSessionRaw === String(DAILY_CYCLE_COUNT) || currentSessionRaw === 'final' || (isReviewDay && currentSessionRaw === '2')) && accuracy >= 80)"
];

requiredRuntimeGuards.forEach(function (token) {
    if (app.includes(token)) pass('완료 흐름 확인: ' + token.slice(0, 80));
    else fail('완료 흐름에서 복습일 세션 2 기준이 누락됨: ' + token);
});

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}

console.log('\n복습일 오답 저장 검사 통과');
