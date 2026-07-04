/**
 * Critical regression checks for public write endpoints and PDF printing.
 * Run: node scripts/check-critical-regressions.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ok(msg) {
    console.log('OK:', msg);
}

function fail(msg) {
    failed++;
    console.error('FAIL:', msg);
}

function expect(condition, passMsg, failMsg) {
    if (condition) ok(passMsg);
    else fail(failMsg || passMsg);
}

function section(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    if (start < 0) return '';
    const end = source.indexOf(endToken, start + startToken.length);
    return end < 0 ? source.slice(start) : source.slice(start, end);
}

function checkSignupLogAuth() {
    const worker = read('src/index.js');
    const fn = section(worker, 'async function handleSignupLog', 'async function handleSyncSave');

    expect(!!fn, 'handleSignupLog exists', 'handleSignupLog missing');
    expect(
        /verifyUser\(env,\s*userId,\s*password\)/.test(fn),
        'signup log endpoint verifies the user password',
        'signup log endpoint must verify user_id/password'
    );
    expect(
        fn.includes('const expectedUserId = `${phone}::${normalizeName(name)}`') &&
            fn.includes('userId !== expectedUserId'),
        'signup log endpoint binds writes to the authenticated name/phone',
        'signup log endpoint must reject logs for a different user'
    );
    expect(
        fn.includes('eventType: "level"') && !/eventType\s*=\s*String\(body\.event_type/.test(fn),
        'signup log endpoint fixes event type server-side',
        'signup log endpoint must not trust client-provided event_type'
    );

    const index = read('index.html');
    const selectLevel = section(index, 'function selectLevel(level)', 'function maskAccountName');
    expect(
        selectLevel.includes("/api/auth/simple") &&
            selectLevel.includes("/api/signup/log") &&
            selectLevel.includes("user_id: userId") &&
            selectLevel.includes("password: password"),
        'level logging sends authenticated credentials',
        'level logging must authenticate before calling /api/signup/log'
    );
}

function checkPrintCleanup() {
    const analysis = read('analysis.html');
    const fn = section(analysis, 'function triggerInAppPrint', 'function passagePdfOpenPrintWindow');

    expect(!!fn, 'triggerInAppPrint exists', 'triggerInAppPrint missing');
    expect(
        fn.includes("addEventListener('afterprint'") && fn.includes("matchMedia('print')"),
        'print cleanup waits for print completion signals',
        'print cleanup must use afterprint and print media signals'
    );
    expect(
        !fn.includes('}, 1500);'),
        'print cleanup no longer removes DOM after 1.5s',
        'print cleanup must not remove DOM after a fixed 1.5s delay'
    );
    expect(
        fn.includes('setTimeout(cleanupPrintArea, 60000)'),
        'print cleanup keeps a long fallback timeout',
        'print cleanup should keep a long fallback timeout for unsupported browsers'
    );
}

checkSignupLogAuth();
checkPrintCleanup();

if (failed) {
    console.error(`\n${failed} critical regression check(s) failed.`);
    process.exit(1);
}

console.log('\nCritical regression checks passed.');
