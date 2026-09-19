/**
 * Security regression checks for share-entry auth forwarding and analysis worker override.
 * Run: node scripts/check-share-security.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed += 1;
}

function pass(msg) {
    console.log('OK:', msg);
}

function assert(cond, msg) {
    if (!cond) fail(msg);
    else pass(msg);
}

function btoaUtf8Binary(s) {
    return Buffer.from(String(s), 'binary').toString('base64');
}

function makeElement() {
    return {
        textContent: '',
        onclick: null,
        style: {},
        classList: {
            add() {},
            remove() {},
        },
        setAttribute() {},
        addEventListener() {},
    };
}

function loadShareEntryScript() {
    const html = fs.readFileSync(path.join(root, 'share-entry.html'), 'utf8');
    const m = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
    if (!m) throw new Error('share-entry script not found');
    return m[1];
}

function simulateShareEntry(entryUrl, storage) {
    const script = loadShareEntryScript();
    const u = new URL(entryUrl);
    const elements = new Map();
    const replaced = [];
    const locationMock = {
        search: u.search,
        origin: u.origin,
        href: '',
        replace(v) {
            replaced.push(String(v));
        },
    };
    const sandbox = {
        URL,
        URLSearchParams,
        console,
        encodeURIComponent,
        decodeURIComponent,
        btoa: btoaUtf8Binary,
        unescape,
        location: locationMock,
        navigator: { userAgent: '' },
        window: {
            navigator: {},
            matchMedia() {
                return { matches: false };
            },
        },
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, makeElement());
                return elements.get(id);
            },
        },
        localStorage: {
            getItem(k) {
                return Object.prototype.hasOwnProperty.call(storage || {}, k) ? storage[k] : null;
            },
        },
        setTimeout(fn) {
            fn();
            return 0;
        },
    };
    sandbox.window.navigator = sandbox.navigator;
    vm.runInNewContext(script, sandbox, { filename: 'share-entry.html' });
    return replaced[replaced.length - 1] || locationMock.href;
}

function checkShareEntry() {
    const storage = { trigger_name: '학생', trigger_phone: '01012345678' };

    const escaped = simulateShareEntry('https://blackt.pages.dev/share-entry.html?path=//evil.example/steal', storage);
    assert(new URL(escaped).origin === 'https://blackt.pages.dev', 'protocol-relative path cannot leave blackt origin');
    assert(new URL(escaped).pathname === '/index.html', 'unsafe protocol-relative path falls back to app entry');

    const backslash = simulateShareEntry('https://blackt.pages.dev/share-entry.html?path=%5C%5Cevil.example%2Fsteal', storage);
    assert(new URL(backslash).origin === 'https://blackt.pages.dev', 'backslash path cannot leave blackt origin');
    assert(new URL(backslash).pathname === '/index.html', 'unsafe backslash path falls back to app entry');

    const appInvite = simulateShareEntry('https://blackt.pages.dev/share-entry.html?path=index.html', storage);
    assert(new URL(appInvite).pathname === '/index.html', 'plain app invite opens index.html');

    const vocaResult = simulateShareEntry('https://blackt.pages.dev/share-entry.html?path=index.html&pc=abc123', storage);
    const vocaUrl = new URL(vocaResult);
    assert(vocaUrl.pathname === '/praise-receiver.html', 'voca result share opens praise receiver');
    assert(vocaUrl.searchParams.get('share_result') === '1', 'voca result share keeps share_result flag');
    assert(!vocaUrl.searchParams.has('au'), 'auth bundle is not attached to praise receiver');

    const examShare = simulateShareEntry('https://blackt.pages.dev/share-entry.html?path=analysis.html&zone=exam&er=abc123', storage);
    const examUrl = new URL(examShare);
    assert(examUrl.pathname === '/analysis.html', 'exam share opens analysis page');
    assert(examUrl.searchParams.get('zone') === 'exam', 'exam share keeps zone parameter');
    assert(examUrl.searchParams.get('er') === 'abc123', 'exam share keeps report payload');
    assert(!examUrl.searchParams.has('au'), 'auth bundle is not attached to analysis share');
}

function loadAnalysisWorkerResolver() {
    const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
    const start = html.indexOf('const ANALYSIS_WORKER_URL_DEFAULT');
    const end = html.indexOf('const workerOverride', start);
    if (start < 0 || end < 0) throw new Error('analysis worker resolver not found');
    const src = html.slice(start, end);
    return new Function('rawOverride', src + '\nreturn resolveAnalysisWorkerUrl(rawOverride);');
}

function checkAnalysisWorkerResolver() {
    const resolve = loadAnalysisWorkerResolver();
    const fallback = 'https://trigger-ocr-api.ohryee.workers.dev/';
    assert(resolve('') === fallback, 'empty worker override uses production worker');
    assert(resolve('https://evil.example/collect') === fallback, 'external worker override is ignored');
    assert(resolve('javascript:alert(1)') === fallback, 'non-http worker override is ignored');
    assert(resolve('https://trigger-ocr-api.ohryee.workers.dev') === fallback, 'production worker override is allowed');
    assert(resolve('http://localhost:8787') === 'http://localhost:8787/', 'localhost worker override is allowed');

    const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
    assert(!html.includes("workerOverride ? workerOverride.replace"), 'analysis no longer trusts raw worker override');
}

console.log('--- share security regression checks ---\n');
checkShareEntry();
console.log('');
checkAnalysisWorkerResolver();
console.log('');

if (failed) {
    console.error('Total failures: ' + failed);
    process.exit(1);
}
console.log('All share security checks passed');
