/**
 * Analysis passage component Korean rendering regression checks.
 * 실행: node scripts/check-analysis-passage-components.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function assert(condition, msg) {
    if (!condition) fail(msg);
    else pass(msg);
}

function extractBetween(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start);
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('analysis.html marker not found: ' + startToken + ' -> ' + endToken);
    }
    return source.slice(start, end);
}

function loadPassageComponentHelpers() {
    const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
    const code =
        "function decorateCircledNumberMarks(s) { return String(s || ''); }\n" +
        extractBetween(html, 'function escapeHtml', '/** 지문 eng 표시') +
        extractBetween(html, 'function normalizePassageEngForDisplay', 'function normTranslationKeyCell') +
        extractBetween(html, 'const PASSAGE_COMPONENT_ROLE_META', 'function passageHasAnyComponents');
    const sandbox = { console };
    vm.runInNewContext(code, sandbox, { filename: 'analysis-passage-components.js' });
    return sandbox;
}

function checkCompleteComponentKorRenders(h) {
    const html = h.buildKorHtmlFromPassageComponents('Students read books.', '학생들은읽는다책을', [
        { role: 'S', text: 'Students', kor: '학생들은' },
        { role: 'V', text: ' read', kor: '읽는다' },
        { role: 'O', text: ' books', kor: '책을' },
        { role: 'M', text: '.', kor: '' }
    ]);
    assert(html && html.includes('학생들은') && html.includes('읽는다') && html.includes('책을'), 'complete component Korean renders');
}

function checkIncompleteKorFallsBack(h) {
    const html = h.buildKorHtmlFromPassageComponents('Students read books.', '학생들은읽는다책을오늘', [
        { role: 'S', text: 'Students', kor: '학생들은' },
        { role: 'V', text: ' read', kor: '읽는다' },
        { role: 'O', text: ' books', kor: '책을' },
        { role: 'M', text: '.', kor: '' }
    ]);
    assert(html === null, 'incomplete component Korean falls back to full translation');
}

function checkEmptyFillDoesNotDuplicatePlainKor(h) {
    const plainKor = '학생들은읽는다책을';
    const parts = h.validatePassageComponents('Students read books carefully.', [
        { role: 'S', text: 'Students', kor: '학생들은' },
        { role: 'V', text: ' read', kor: '읽는다' },
        { role: 'O', text: ' books', kor: '책을' },
        { role: 'M', text: ' carefully', kor: '' },
        { role: 'M', text: '.', kor: '' }
    ], plainKor);
    const filled = h.fillPassagePartsKorFromPlain(plainKor, parts);
    assert(h.passagePartsKorText(filled) === plainKor, 'empty fill does not duplicate full Korean');
    assert(filled[3].kor === '', 'fully consumed Korean pool leaves unmatched component empty');
}

console.log('--- analysis passage component checks ---\n');
const helpers = loadPassageComponentHelpers();
checkCompleteComponentKorRenders(helpers);
checkIncompleteKorFallsBack(helpers);
checkEmptyFillDoesNotDuplicatePlainKor(helpers);

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
