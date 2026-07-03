/**
 * VOCA 복습일 오답 저장 회귀 검사 (Node)
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

function requireMatch(label, regex) {
    if (regex.test(app)) pass(label);
    else fail(label);
}

const helperMatch = app.match(/function shouldPersistWrongToList\(sessionRaw, isReviewDay\) \{[\s\S]*?\n\}/);
if (!helperMatch) {
    fail('shouldPersistWrongToList helper exists');
} else {
    const helper = helperMatch[0];
    if (/if \(isReviewDay\) return sessionRaw === '2';/.test(helper)) {
        pass('review day final test persists on session 2');
    } else {
        fail('review day final test must persist on session 2');
    }
    if (/if \(isReviewDay\) return sessionRaw === '3';/.test(helper)) {
        fail('review day session 3 must not be required');
    } else {
        pass('review day session 3 is not required');
    }
}

requireMatch(
    'startStudy starts review-day test on session 2',
    /isReviewDay && sNum === 2/
);
requireMatch(
    'finishSession treats review-day session 2 as retry threshold',
    /isReviewDay && currentSessionRaw === '2'/
);
requireMatch(
    'admin completion preview jumps to review-day session 2',
    /const finalSession = isReviewDay \? '2' : String\(DAILY_CYCLE_COUNT\);/
);

if (failed) {
    process.exit(1);
}
