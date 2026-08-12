/**
 * 추천 claim: lifetime total_credited + 클라이언트 watermark로
 * 응답 유실·재설치 후에도 크레딧이 복구되는지 검사.
 * 실행: node scripts/check-referral-credit-watermark.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URL, URLSearchParams } = require('url');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function ok(cond, msg) {
    if (cond) pass(msg);
    else fail(msg);
}

const src = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const creditSrc = fs.readFileSync(path.join(root, 'trigger-credit.js'), 'utf8');

const claimStart = src.indexOf('async function handleReferralClaim');
ok(claimStart >= 0, 'handleReferralClaim exists');
const claimFn = src.slice(
    claimStart,
    src.indexOf('function maskLeaderboardName', claimStart)
);
ok(/total_credited/.test(claimFn), 'claim returns total_credited');
ok(
    /COUNT\(\*\)[\s\S]*credited_sharer\s*=\s*1/.test(claimFn),
    'claim counts lifetime credited_sharer=1'
);
ok(
    /return json\(\{\s*ok:\s*true,\s*count,\s*total_credited\s*\}\)/.test(claimFn),
    'json includes total_credited'
);

ok(
    /STORAGE_REFERRAL_APPLIED\s*=\s*'trigger_referral_credits_applied'/.test(creditSrc),
    'client watermark key defined'
);
ok(
    /total_credited/.test(creditSrc) && /STORAGE_REFERRAL_APPLIED/.test(creditSrc),
    'sync uses total_credited + watermark'
);

function makeStorage(initial) {
    const data = Object.assign({}, initial || {});
    const keys = () => Object.keys(data);
    return {
        get length() {
            return keys().length;
        },
        key(i) {
            return keys()[i] ?? null;
        },
        getItem(k) {
            return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
        },
        setItem(k, v) {
            data[k] = String(v);
        },
        removeItem(k) {
            delete data[k];
        },
        _dump() {
            return Object.assign({}, data);
        }
    };
}

function loadCreditApi(localStorage, claimImpl) {
    const sandbox = {
        localStorage,
        sessionStorage: makeStorage({}),
        Math,
        Number,
        parseInt,
        String,
        Date,
        JSON,
        isNaN,
        console,
        URL,
        URLSearchParams,
        Promise,
        fetch: function () {
            return Promise.resolve({
                json: function () {
                    return Promise.resolve(claimImpl());
                }
            });
        },
        document: {
            getElementById: function () {
                return null;
            }
        },
        location: { search: '', href: 'https://example.com/', pathname: '/', hash: '' },
        history: { replaceState: function () {} }
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    vm.runInNewContext(creditSrc, sandbox);
    return sandbox.TriggerCredit;
}

(async function runSim() {
    // 1) 정상 claim → watermark
    let lifetime = 0;
    let pending = 2;
    const storeA = makeStorage({ trigger_phone: '01012345678' });
    const apiA = loadCreditApi(storeA, function () {
        const batch = pending;
        lifetime += batch;
        pending = 0;
        return { ok: true, count: batch, total_credited: lifetime };
    });
    const gained1 = await apiA.syncReferralCreditsFromServer();
    ok(gained1 === 100, 'first claim grants 100 for 2 signups (got ' + gained1 + ')');
    ok(storeA.getItem('trigger_referral_credits_applied') === '2', 'watermark set to 2');
    ok(apiA.getBalance() === 100, 'balance 100 after first claim');

    // 2) 재호출 — delta 0
    const gained2 = await apiA.syncReferralCreditsFromServer();
    ok(gained2 === 0, 'second claim adds nothing');
    ok(apiA.getBalance() === 100, 'balance unchanged');

    // 3) 응답 유실 후(서버는 이미 burn) 재동기화
    lifetime = 2;
    pending = 0;
    const storeB = makeStorage({ trigger_phone: '01012345678' });
    const apiB = loadCreditApi(storeB, function () {
        return { ok: true, count: 0, total_credited: lifetime };
    });
    const gained3 = await apiB.syncReferralCreditsFromServer();
    ok(gained3 === 100, 'lost-response recovery grants 100 from total_credited (got ' + gained3 + ')');
    ok(storeB.getItem('trigger_referral_credits_applied') === '2', 'recovered watermark');

    // 4) 재설치 + 서버에 기존 2 + 신규 pending 1
    lifetime = 2;
    pending = 1;
    const storeC = makeStorage({ trigger_phone: '01012345678' });
    const apiC = loadCreditApi(storeC, function () {
        const batch = pending;
        lifetime += batch;
        pending = 0;
        return { ok: true, count: batch, total_credited: lifetime };
    });
    const gained4 = await apiC.syncReferralCreditsFromServer();
    ok(gained4 === 150, 'reinstall restores 2 prior + 1 new = 150 (got ' + gained4 + ')');
    ok(storeC.getItem('trigger_referral_credits_applied') === '3', 'watermark 3 after reinstall+new');

    if (failed) {
        console.error('\n' + failed + ' check(s) failed');
        process.exit(1);
    }
    console.log('\nAll referral credit watermark checks passed');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
