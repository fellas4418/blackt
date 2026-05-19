/**
 * analysis.html Worker URL regression checks.
 * Run: node scripts/check-analysis-worker-url.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'analysis.html'), 'utf8');
const start = html.indexOf('const params = new URLSearchParams(window.location.search);');
const end = html.indexOf('function buildAnalysisContextTrim(searchParams)', start);

if (start < 0 || end < 0) {
    console.error('FAIL: could not locate analysis Worker URL block');
    process.exit(1);
}

const workerUrlBlock = html.slice(start, end);
let failed = 0;

function check(name, search, expected) {
    const sandbox = {
        window: {
            location: {
                href: 'https://tri3.example/analysis.html' + search,
                search
            }
        },
        URL,
        URLSearchParams,
        result: null
    };
    vm.runInNewContext(workerUrlBlock + '\nresult = WORKER_URL;', sandbox, { filename: 'analysis-worker-url.js' });
    if (sandbox.result !== expected) {
        console.error(`FAIL: ${name}: expected ${expected}, got ${sandbox.result}`);
        failed++;
    } else {
        console.log(`OK: ${name}`);
    }
}

const prod = 'https://trigger-ocr-api.ohryee.workers.dev/';
check('default production worker', '', prod);
check('production override allowed', '?worker=https%3A%2F%2Ftrigger-ocr-api.ohryee.workers.dev%2Fapi', 'https://trigger-ocr-api.ohryee.workers.dev/');
check('localhost override allowed', '?worker=http%3A%2F%2Flocalhost%3A8787%2F', 'http://localhost:8787/');
check('127 loopback override allowed', '?worker=http%3A%2F%2F127.0.0.1%3A8787%2F', 'http://127.0.0.1:8787/');
check('ipv6 loopback override allowed', '?worker=http%3A%2F%2F%5B%3A%3A1%5D%3A8787%2F', 'http://[::1]:8787/');
check('malicious override rejected', '?worker=https%3A%2F%2Fevil.example%2F', prod);
check('credential-style malicious override rejected', '?worker=https%3A%2F%2Ftrigger-ocr-api.ohryee.workers.dev%40evil.example%2F', prod);
check('protocol-relative override rejected', '?worker=%2F%2Fevil.example%2F', prod);
check('relative override rejected', '?worker=%2Fapi', prod);

if (failed) process.exit(1);
