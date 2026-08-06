/**
 * 복습일 최종 테스트 오답 저장 판정 회귀 검사
 * 실행: node scripts/check-review-wrong-persist.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const match = app.match(/function shouldPersistWrongToList\(sessionRaw, isReviewDay\) \{[\s\S]*?\n\}/);

if (!match) {
    console.error('FAIL: shouldPersistWrongToList 함수를 찾을 수 없습니다.');
    process.exit(1);
}

const sandbox = {
    DAILY_CYCLE_COUNT: 5,
    isPreReviewMode: false,
    result: null
};

vm.runInNewContext(
    match[0] + `
result = {
    reviewSession1: shouldPersistWrongToList('1', true),
    reviewSession2: shouldPersistWrongToList('2', true),
    weekdaySession3: shouldPersistWrongToList('3', false),
    weekdaySession5: shouldPersistWrongToList('5', false),
    finalSession: shouldPersistWrongToList('final', false)
};`,
    sandbox,
    { filename: 'app.js:shouldPersistWrongToList' }
);

const expected = {
    reviewSession1: false,
    reviewSession2: true,
    weekdaySession3: false,
    weekdaySession5: true,
    finalSession: true
};

let failed = 0;
Object.keys(expected).forEach((key) => {
    if (sandbox.result[key] !== expected[key]) {
        console.error(`FAIL: ${key} expected ${expected[key]}, got ${sandbox.result[key]}`);
        failed++;
    } else {
        console.log(`OK: ${key}`);
    }
});

if (failed) process.exit(1);
console.log('\n복습일 오답 저장 판정 검사 통과');
