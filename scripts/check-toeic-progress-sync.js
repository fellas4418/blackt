/**
 * TOEIC 서버 진행률 복원 회귀 검사 (Node)
 * 실행: node scripts/check-toeic-progress-sync.js
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

const worker = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

if (/level IN \('middle', 'high', 'toeic'\)/.test(worker)) {
    pass('/api/streak includes TOEIC progress rows');
} else {
    fail('/api/streak does not query TOEIC progress');
}

if (index.includes("['middle', 'high', 'toeic'].forEach")) {
    pass('index progress merge includes TOEIC');
} else {
    fail('index progress merge skips TOEIC');
}

if (index.includes('TriggerToeicSchedule.TOEIC_TOTAL_DAYS + 1') && index.includes(': 55')) {
    pass('index progress merge preserves TOEIC completion sentinel 55');
} else {
    fail('index progress merge does not cap TOEIC at 55');
}

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}

console.log('\nTOEIC 진행률 복원 검사 통과 (' + new Date().toISOString() + ')');
