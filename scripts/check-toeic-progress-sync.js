/**
 * TOEIC progress must restore from server and preserve the completion sentinel.
 * Run: node scripts/check-toeic-progress-sync.js
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
        signupLogs: [],
        dailySessions: []
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
        if (q.indexOf('INSERT INTO signup_logs') === 0) {
            state.signupLogs.push({ user_id: args[0], event_type: args[5] });
            return { success: true };
        }
        if (q.indexOf('INSERT OR REPLACE INTO daily_session') === 0) {
            const row = {
                user_id: args[0],
                subject: args[1],
                level: args[2],
                day_num: Number(args[3]) || 0,
                accuracy: Number(args[4]) || 0,
                wrong_count: Number(args[5]) || 0,
                session_number: args[6]
            };
            const idx = state.dailySessions.findIndex(function (item) {
                return item.user_id === row.user_id && item.level === row.level && item.day_num === row.day_num;
            });
            if (idx >= 0) state.dailySessions[idx] = row;
            else state.dailySessions.push(row);
            return { success: true };
        }
        if (q.indexOf("SELECT DISTINCT date(created_at, '+9 hours') AS d FROM daily_session") === 0) {
            return { results: [] };
        }
        if (q.indexOf('SELECT level, MAX(day_num) AS max_day FROM daily_session') === 0) {
            const userId = String(args[0] || '');
            const allowed = ['middle', 'high', 'toeic'].filter(function (lvl) {
                return q.indexOf("'" + lvl + "'") >= 0;
            });
            const maxByLevel = {};
            state.dailySessions.forEach(function (row) {
                if (row.user_id !== userId) return;
                if (allowed.indexOf(row.level) < 0) return;
                maxByLevel[row.level] = Math.max(maxByLevel[row.level] || 0, row.day_num);
            });
            return {
                results: Object.keys(maxByLevel).map(function (level) {
                    return { level: level, max_day: maxByLevel[level] };
                })
            };
        }
        throw new Error('Unexpected SQL: ' + q);
    }

    return {
        env: {
            DB: {
                prepare(sql) {
                    return {
                        bind(...args) {
                            return {
                                first() { return Promise.resolve(runQuery(sql, args, 'first')); },
                                all() { return Promise.resolve(runQuery(sql, args, 'all')); },
                                run() { return Promise.resolve(runQuery(sql, args, 'run')); }
                            };
                        }
                    };
                }
            }
        },
        state
    };
}

function loadWorker() {
    let code = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
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
    vm.runInNewContext(code, sandbox, { filename: 'src/index.js' });
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

async function checkWorkerToeicProgress() {
    const worker = loadWorker();
    const { env } = createMockEnv();
    const auth = await post(worker, env, '/api/auth/simple', {
        name: '토익학생',
        phone: '01022223333'
    });
    const userId = String(auth.data.user_id || '');
    const password = String(auth.data.auth_password || '');
    if (!auth.data.ok || !userId || !password) {
        fail('auth/simple failed for TOEIC test user');
        return;
    }
    await post(worker, env, '/api/sync/save', {
        user_id: userId,
        password: password,
        voca: [],
        grammar: [],
        daily_session: {
            level: 'toeic',
            day_num: 54,
            accuracy: 95,
            wrong_count: 0,
            session_number: 2,
            subject: 'english'
        }
    });
    const streak = await post(worker, env, '/api/streak', { user_id: userId, password: password });
    const toeic = streak.data && streak.data.voca_progress && streak.data.voca_progress.toeic;
    if (!toeic || toeic.completed_day !== 54 || toeic.next_day !== 55) {
        fail('TOEIC progress missing from /api/streak: ' + JSON.stringify(streak.data));
    } else {
        pass('/api/streak returns TOEIC next_day=55');
    }
}

function checkIndexMergeSource() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    if (!html.includes("['middle', 'high', 'toeic'].forEach")) fail('mergeVocaProgressFromServer does not include toeic');
    else pass('mergeVocaProgressFromServer includes toeic');
    if (!html.includes('vocaTotalDaysForLevel(lvl)') || html.includes('Math.min(71, Math.max(1, parseInt(p.next_day')) {
        fail('mergeVocaProgressFromServer does not cap by per-level total days');
    } else {
        pass('mergeVocaProgressFromServer caps by per-level total days');
    }
}

function checkToeicCompletionClamp() {
    const store = {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '55',
        trigger_unlocked_day_toeic: '55',
        trigger_session_toeic: '1'
    };
    const sandbox = {
        console,
        localStorage: {
            getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); }
        },
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById() { return { style: {} }; }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-schedule.js'), 'utf8'), sandbox, { filename: 'toeic-schedule.js' });
    sandbox.selectLevel = function () {};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-unlock.js'), 'utf8'), sandbox, { filename: 'toeic-unlock.js' });
    sandbox.syncLevelOnLoad();
    if (store.trigger_current_day_toeic !== '55' || store.trigger_unlocked_day_toeic !== '55') {
        fail('TOEIC completion sentinel 55 was clamped to ' + store.trigger_current_day_toeic + '/' + store.trigger_unlocked_day_toeic);
    } else {
        pass('TOEIC completion sentinel 55 is preserved');
    }
    store.trigger_current_day_toeic = '999';
    store.trigger_unlocked_day_toeic = '999';
    sandbox.syncLevelOnLoad();
    if (store.trigger_current_day_toeic !== '55' || store.trigger_unlocked_day_toeic !== '55') {
        fail('TOEIC oversized progress was not clamped to 55');
    } else {
        pass('TOEIC oversized progress clamps to 55');
    }
}

(async function main() {
    console.log('--- TOEIC 진도 복원 회귀 검사 ---\n');
    await checkWorkerToeicProgress();
    checkIndexMergeSource();
    checkToeicCompletionClamp();
    if (failed) {
        console.error('\n총 ' + failed + '건 실패');
        process.exit(1);
    }
    console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
