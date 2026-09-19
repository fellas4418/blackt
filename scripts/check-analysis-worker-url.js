/**
 * analysis.html Worker URL override security regression check.
 * 실행: node scripts/check-analysis-worker-url.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
const defaultWorker = 'https://trigger-ocr-api.ohryee.workers.dev/';
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function extractWorkerSnippet() {
    const start = html.indexOf('const DEFAULT_WORKER_URL = ');
    const end = html.indexOf('        const TRIGGER_IMG_DIR =', start);
    if (start < 0 || end < 0) {
        throw new Error('Worker URL resolver block not found');
    }
    return html.slice(start, end);
}

function resolveFor(search) {
    const result = {};
    const sandbox = {
        window: { location: { origin: 'https://blackt.pages.dev', search } },
        URL,
        URLSearchParams,
        result
    };
    vm.runInNewContext(
        extractWorkerSnippet() + '\nresult.WORKER_URL = WORKER_URL;',
        sandbox,
        { filename: 'analysis-worker-url-snippet.js' }
    );
    return result.WORKER_URL;
}

function expect(search, expected, label) {
    const actual = resolveFor(search);
    if (actual !== expected) fail(label + ' (expected ' + expected + ', got ' + actual + ')');
    else pass(label);
}

console.log('--- analysis.html Worker URL 보안 회귀 검사 ---\n');

expect('', defaultWorker, 'worker override 없음 -> 기본 Worker');
expect('?worker=https%3A%2F%2Ftrigger-ocr-api.ohryee.workers.dev%2Fapi', defaultWorker, '공식 Worker origin만 허용하고 경로 제거');
expect('?worker=http%3A%2F%2F127.0.0.1%3A8787', 'http://127.0.0.1:8787/', '로컬 127.0.0.1 개발 Worker 허용');
expect('?worker=http%3A%2F%2Flocalhost%3A8787', 'http://localhost:8787/', '로컬 localhost 개발 Worker 허용');
expect('?worker=https%3A%2F%2Fevil.example', defaultWorker, '외부 HTTPS Worker 차단');
expect('?worker=%2F%2Fevil.example%2Fsteal', defaultWorker, '프로토콜 상대 외부 Worker 차단');
expect('?worker=https%3A%5C%5Cevil.example%2Fsteal', defaultWorker, '백슬래시 변형 외부 Worker 차단');
expect('?worker=%2Fapi', defaultWorker, '동일 origin 상대 경로 Worker 차단');

if (html.includes('const WORKER_URL = (workerOverride ? workerOverride.replace')) {
    fail('취약한 workerOverride 직접 대입 패턴이 남아 있음');
} else {
    pass('취약한 workerOverride 직접 대입 패턴 없음');
}

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
