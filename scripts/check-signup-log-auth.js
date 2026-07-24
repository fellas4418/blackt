/**
 * /api/signup/log must not accept unauthenticated or forged level logs.
 * Run: node scripts/check-signup-log-auth.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
let failed = 0;

function fail(message) {
    failed++;
    console.error('FAIL:', message);
}

function pass(message) {
    console.log('OK:', message);
}

function normalizeSql(sql) {
    return String(sql || '').replace(/\s+/g, ' ').trim();
}

function createMockEnv() {
    const state = {
        users: new Map(),
        signupLogs: []
    };

    function runQuery(sql, args, mode) {
        const q = normalizeSql(sql);
        if (q === 'SELECT id FROM users WHERE id = ?1 AND password_hash = ?2') {
            const id = String(args[0] || '');
            const hash = String(args[1] || '');
            const ok = state.users.get(id) === hash;
            return mode === 'first' ? (ok ? { id } : null) : { results: ok ? [{ id }] : [] };
        }
        if (q === 'SELECT id FROM users WHERE id = ?1') {
            const id = String(args[0] || '');
            return mode === 'first'
                ? (state.users.has(id) ? { id } : null)
                : { results: state.users.has(id) ? [{ id }] : [] };
        }
        if (q === 'SELECT id FROM users WHERE id = ?1 OR id LIKE ?2') {
            const exact = String(args[0] || '');
            const likePrefix = String(args[1] || '').replace(/%$/, '');
            const rows = [];
            for (const id of state.users.keys()) {
                if (id === exact || id.indexOf(likePrefix) === 0) rows.push({ id });
            }
            return mode === 'first' ? (rows[0] || null) : { results: rows };
        }
        if (q === 'INSERT INTO users (id, password_hash) VALUES (?1, ?2)') {
            state.users.set(String(args[0] || ''), String(args[1] || ''));
            return { success: true };
        }
        if (q.indexOf('UPDATE users SET id = ?1, password_hash = ?2 WHERE id = ?3') === 0) {
            const oldId = String(args[2] || '');
            state.users.delete(oldId);
            state.users.set(String(args[0] || ''), String(args[1] || ''));
            return { success: true };
        }
        if (q.indexOf('UPDATE saved_voca SET user_id = ?1 WHERE user_id = ?2') === 0 ||
            q.indexOf('UPDATE saved_grammar SET user_id = ?1 WHERE user_id = ?2') === 0) {
            return { success: true };
        }
        if (q.indexOf('INSERT INTO signup_logs') === 0) {
            state.signupLogs.push({
                user_id: args[0],
                name: args[1],
                phone: args[2],
                level: args[3],
                referrer: args[4],
                event_type: args[5]
            });
            return { success: true };
        }
        throw new Error('Unexpected SQL: ' + q);
    }

    const env = {
        DB: {
            prepare(sql) {
                return {
                    bind(...args) {
                        return {
                            first() {
                                return Promise.resolve(runQuery(sql, args, 'first'));
                            },
                            all() {
                                return Promise.resolve(runQuery(sql, args, 'all'));
                            },
                            run() {
                                return Promise.resolve(runQuery(sql, args, 'run'));
                            }
                        };
                    }
                };
            }
        }
    };
    return { env, state };
}

function loadWorker() {
    const sourcePath = path.join(root, 'src/index.js');
    let code = fs.readFileSync(sourcePath, 'utf8');
    code = code.replace(
        /export\s+\{\s*GeminiProxy\s*\}\s+from\s+["']\.\/gemini-proxy\.js["'];/,
        'const GeminiProxy = {};'
    );
    code = code.replace(/export\s+default\s+\{/, 'globalThis.worker = {');
    const sandbox = {
        console,
        crypto: webcrypto,
        TextEncoder,
        URL,
        Request,
        Response,
        setTimeout,
        clearTimeout
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox, { filename: sourcePath });
    return sandbox.worker;
}

async function post(worker, env, pathName, body) {
    const req = new Request('https://worker.test' + pathName, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const res = await worker.fetch(req, env);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

function checkClientUsesAuthenticatedLog() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const logIdx = html.indexOf("base + '/api/signup/log'");
    if (logIdx < 0) {
        fail('index.html missing /api/signup/log call');
        return;
    }
    const before = html.slice(Math.max(0, logIdx - 900), logIdx);
    const requestBlock = html.slice(logIdx, logIdx + 700);
    if (!before.includes("base + '/api/auth/simple'")) fail('level log does not obtain simple auth first');
    else pass('level log obtains simple auth first');
    if (!requestBlock.includes('user_id: userId') || !requestBlock.includes('password: password')) {
        fail('level log does not send user_id/password');
    } else {
        pass('level log sends user_id/password');
    }
    if (requestBlock.includes('event_type')) fail('level log should not send client-controlled event_type');
    else pass('level log does not send client-controlled event_type');
}

(async function main() {
    console.log('--- signup/log 인증 회귀 검사 ---\n');
    const worker = loadWorker();
    const { env, state } = createMockEnv();

    const auth = await post(worker, env, '/api/auth/simple', {
        name: '홍길동',
        phone: '01012345678'
    });
    if (auth.status !== 200 || !auth.data.ok) fail('auth/simple failed for test user');
    else pass('auth/simple created test user');
    const userId = String(auth.data.user_id || '');
    const password = String(auth.data.auth_password || '');
    const initialLogCount = state.signupLogs.length;

    const unauth = await post(worker, env, '/api/signup/log', {
        name: '홍길동',
        phone: '01012345678',
        level: '중등'
    });
    if (unauth.status !== 401) fail('unauthenticated signup/log should return 401, got ' + unauth.status);
    else pass('unauthenticated signup/log is rejected');
    if (state.signupLogs.length !== initialLogCount) fail('unauthenticated signup/log inserted a row');
    else pass('unauthenticated signup/log inserts no row');

    const forged = await post(worker, env, '/api/signup/log', {
        name: '다른이름',
        phone: '01012345678',
        level: '고등',
        user_id: userId,
        password
    });
    if (forged.status !== 403) fail('forged name/phone signup/log should return 403, got ' + forged.status);
    else pass('forged name/phone signup/log is rejected');
    if (state.signupLogs.length !== initialLogCount) fail('forged signup/log inserted a row');
    else pass('forged signup/log inserts no row');

    const ok = await post(worker, env, '/api/signup/log', {
        name: '홍길동',
        phone: '01012345678',
        level: '중등',
        event_type: 'signup',
        referrer: 'attacker',
        user_id: userId,
        password
    });
    if (ok.status !== 200 || !ok.data.ok) fail('authenticated signup/log failed');
    else pass('authenticated signup/log succeeds');
    const last = state.signupLogs[state.signupLogs.length - 1];
    if (!last || last.event_type !== 'level') fail('signup/log did not force event_type=level');
    else pass('signup/log forces event_type=level');
    if (last && last.referrer) fail('signup/log accepted client-controlled referrer');
    else pass('signup/log ignores client-controlled referrer');

    console.log('');
    checkClientUsesAuthenticatedLog();

    if (failed) {
        console.error('\n총 ' + failed + '건 실패');
        process.exit(1);
    }
    console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
