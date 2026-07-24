/**
 * 공유/분석 진입점 보안 회귀 검사 (Node)
 * 실행: node scripts/check-share-security.js
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

function assert(cond, msg) {
    if (!cond) fail(msg);
    else pass(msg);
}

function fakeEl() {
    return {
        textContent: '',
        onclick: null,
        classList: {
            add() {},
            remove() {}
        }
    };
}

function runShareEntry(search) {
    const html = fs.readFileSync(path.join(root, 'share-entry.html'), 'utf8');
    const match = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!match) throw new Error('share-entry script not found');

    let replaced = '';
    const location = {
        search,
        origin: 'https://blackt.pages.dev',
        href: '',
        replace(url) {
            replaced = String(url || '');
        }
    };
    const navigator = { userAgent: '', standalone: false };
    const windowObj = {
        navigator,
        matchMedia() {
            return { matches: true };
        }
    };
    const sandbox = {
        window: windowObj,
        navigator,
        location,
        document: {
            getElementById() {
                return fakeEl();
            }
        },
        localStorage: {
            getItem(key) {
                if (key === 'trigger_name') return '테스트';
                if (key === 'trigger_phone') return '01012345678';
                return null;
            }
        },
        URL,
        URLSearchParams,
        encodeURIComponent,
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        unescape: (s) => decodeURIComponent(s.replace(/%([0-9A-F]{2})/gi, '%$1')),
        setTimeout() {}
    };
    vm.runInNewContext(match[1], sandbox, { filename: 'share-entry.html' });
    if (!replaced) throw new Error('share-entry did not redirect');
    return new URL(replaced);
}

function checkShareEntry() {
    const badInputs = [
        '?path=%2F%2Fevil.example%2Fsteal',
        '?path=https%3A%2F%2Fevil.example%2Fsteal',
        '?path=%5C%5Cevil.example%5Csteal'
    ];
    badInputs.forEach((q) => {
        const u = runShareEntry(q);
        assert(u.origin === 'https://blackt.pages.dev', 'unsafe share path stays on blackt.pages.dev: ' + q);
        assert(u.pathname === '/index.html', 'unsafe share path falls back to /index.html: ' + q);
        assert(!u.searchParams.has('au'), 'unsafe share path does not receive auth bundle: ' + q);
    });

    const exam = runShareEntry('?path=analysis.html&zone=exam&er=abc123');
    assert(exam.origin === 'https://blackt.pages.dev', 'exam share stays same origin');
    assert(exam.pathname === '/analysis.html', 'exam share routes to analysis.html');
    assert(exam.searchParams.get('zone') === 'exam', 'exam share preserves zone');
    assert(exam.searchParams.get('er') === 'abc123', 'exam share preserves er');
    assert(!exam.searchParams.has('au'), 'exam share does not receive auth bundle');

    const invite = runShareEntry('?path=index.html&ref=r01012345678');
    assert(invite.origin === 'https://blackt.pages.dev', 'app invite stays same origin');
    assert(invite.pathname === '/index.html', 'app invite routes to index.html');
    assert(invite.searchParams.get('ref') === 'r01012345678', 'app invite preserves ref');
    assert(invite.searchParams.has('au'), 'safe app invite may receive auth bundle');
}

function loadAnalysisWorkerResolver() {
    const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
    const match = html.match(/const ANALYSIS_WORKER_URL = [\s\S]*?const WORKER_URL = resolveAnalysisWorkerUrl\(workerOverride\);/);
    if (!match) throw new Error('analysis worker resolver not found');
    const code = match[0].replace(
        /const WORKER_URL = resolveAnalysisWorkerUrl\(workerOverride\);/,
        'this.resolveAnalysisWorkerUrl = resolveAnalysisWorkerUrl; this.ANALYSIS_WORKER_URL = ANALYSIS_WORKER_URL;'
    );
    const sandbox = {
        window: { location: { origin: 'https://blackt.pages.dev' } },
        URL
    };
    vm.runInNewContext(code, sandbox, { filename: 'analysis-worker-resolver.js' });
    return {
        resolve: sandbox.resolveAnalysisWorkerUrl,
        prod: sandbox.ANALYSIS_WORKER_URL
    };
}

function checkAnalysisWorkerOverride() {
    const { resolve, prod } = loadAnalysisWorkerResolver();
    assert(resolve('') === prod, 'empty worker override uses production worker');
    assert(resolve('https://trigger-ocr-api.ohryee.workers.dev/') === prod, 'production worker override is allowed');
    assert(resolve('http://127.0.0.1:8787/') === 'http://127.0.0.1:8787/', 'loopback worker override is allowed');
    assert(resolve('https://evil.example/collect') === prod, 'external https worker override is rejected');
    assert(resolve('//evil.example/collect') === prod, 'protocol-relative worker override is rejected');
    assert(resolve('ftp://127.0.0.1:8787/') === prod, 'non-http worker override is rejected');
}

console.log('--- 공유/분석 보안 회귀 검사 ---\n');
checkShareEntry();
console.log('');
checkAnalysisWorkerOverride();
console.log('');

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
