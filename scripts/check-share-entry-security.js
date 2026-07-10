/**
 * share-entry.html redirect/auth-bundle regression checks.
 * 실행: node scripts/check-share-entry-security.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'share-entry.html'), 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);

if (!scriptMatch) {
    throw new Error('share-entry inline script not found');
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function makeElement() {
    return {
        textContent: '',
        onclick: null,
        classList: {
            add() {},
            remove() {}
        }
    };
}

function simulateShareEntry(search, opts) {
    opts = opts || {};
    const captured = { href: '', replace: '' };
    let hrefValue = 'https://blackt.pages.dev/share-entry.html' + search;
    const location = {
        search,
        origin: 'https://blackt.pages.dev',
        replace(value) {
            captured.replace = String(value);
        }
    };
    Object.defineProperty(location, 'href', {
        get() {
            return hrefValue;
        },
        set(value) {
            hrefValue = String(value);
            captured.href = hrefValue;
        }
    });

    const navigator = {
        userAgent: opts.userAgent || '',
        standalone: false
    };
    const storage = {
        trigger_name: opts.name || '',
        trigger_phone: opts.phone || '',
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
        }
    };
    const elements = {};
    const sandbox = {
        URL,
        URLSearchParams,
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        encodeURIComponent,
        unescape: (s) => decodeURIComponent(s.replace(/%([0-9A-F]{2})/gi, '%$1')),
        localStorage: storage,
        location,
        navigator,
        window: {
            navigator,
            matchMedia() {
                return { matches: false };
            }
        },
        document: {
            getElementById(id) {
                if (!elements[id]) elements[id] = makeElement();
                return elements[id];
            }
        },
        setTimeout(fn) {
            fn();
            return 1;
        }
    };

    vm.runInNewContext(scriptMatch[1], sandbox, { filename: 'share-entry.html' });
    return captured.replace || captured.href;
}

function decodeAuthBundle(token) {
    const json = decodeURIComponent(escape(Buffer.from(String(token), 'base64').toString('binary')));
    return JSON.parse(json);
}

function checkExamShareDoesNotExposeAuth() {
    const redirected = simulateShareEntry('?path=analysis.html&zone=exam&er=abc123', {
        name: '홍길동',
        phone: '01012345678'
    });
    const u = new URL(redirected);
    assert(u.origin === 'https://blackt.pages.dev', 'exam share must stay on Pages origin');
    assert(u.pathname === '/analysis.html', 'exam share must route to analysis.html');
    assert(u.searchParams.get('zone') === 'exam', 'exam share must preserve zone');
    assert(u.searchParams.get('er') === 'abc123', 'exam share must preserve er');
    assert(!u.searchParams.has('au'), 'exam share must not expose auth bundle');
}

function checkUnsafePathCannotExfiltrateAuth() {
    const redirected = simulateShareEntry('?path=//evil.example/collect', {
        name: '홍길동',
        phone: '01012345678'
    });
    const u = new URL(redirected);
    assert(u.origin === 'https://blackt.pages.dev', 'unsafe path must not redirect off origin');
    assert(!redirected.includes('evil.example'), 'unsafe path must be discarded');
    assert(!u.searchParams.has('au'), 'unsafe path must not receive auth bundle');
}

function checkAppReferralKeepsAuthRestore() {
    const redirected = simulateShareEntry('?path=index.html&ref=test-ref', {
        name: '홍길동',
        phone: '01012345678'
    });
    const u = new URL(redirected);
    assert(u.origin === 'https://blackt.pages.dev', 'app referral must stay on Pages origin');
    assert(u.pathname === '/index.html', 'app referral must route to index.html');
    assert(u.searchParams.get('ref') === 'test-ref', 'app referral must preserve ref');
    const au = u.searchParams.get('au');
    assert(au, 'app referral should keep auth restore bundle');
    const decoded = decodeAuthBundle(au);
    assert(decoded.n === '홍길동', 'auth bundle name roundtrip');
    assert(decoded.p === '01012345678', 'auth bundle phone roundtrip');
}

function checkVocaReceiverDoesNotExposeAuth() {
    const redirected = simulateShareEntry('?path=index.html&pc=pc123', {
        name: '홍길동',
        phone: '01012345678'
    });
    const u = new URL(redirected);
    assert(u.pathname === '/praise-receiver.html', 'voca result share must route to receiver');
    assert(u.searchParams.get('pc') === 'pc123', 'voca result share must preserve pc');
    assert(!u.searchParams.has('au'), 'voca result share must not expose auth bundle');
}

checkExamShareDoesNotExposeAuth();
checkUnsafePathCannotExfiltrateAuth();
checkAppReferralKeepsAuthRestore();
checkVocaReceiverDoesNotExposeAuth();

console.log('share-entry security checks passed');
