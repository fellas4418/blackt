/**
 * TOEIC unlock/progress guard regression checks.
 * 실행: node scripts/check-toeic-unlock.js
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

function makeStorage(seed) {
    return {
        _d: Object.assign({}, seed || {}),
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(this._d, key) ? this._d[key] : null;
        },
        setItem(key, value) {
            this._d[key] = String(value);
        },
        removeItem(key) {
            delete this._d[key];
        }
    };
}

function loadToeicUnlock(seed) {
    const storage = makeStorage(seed);
    const btn = { style: {}, className: 'level-btn' };
    const badge = { style: {} };
    const sandbox = {
        window: {},
        localStorage: storage,
        document: {
            readyState: 'complete',
            addEventListener() {},
            getElementById(id) {
                if (id === 'btn-toeic') return btn;
                if (id === 'toeic-mode-badge') return badge;
                return null;
            }
        },
        console
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.TriggerToeicSchedule = { TOEIC_TOTAL_DAYS: 54 };

    vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-unlock.js'), 'utf8'), sandbox, {
        filename: 'toeic-unlock.js'
    });
    return { sandbox, storage, btn, badge };
}

function checkCompletedSentinelPreserved() {
    const { sandbox, storage } = loadToeicUnlock({
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '55',
        trigger_unlocked_day_toeic: '55'
    });
    sandbox.syncLevelOnLoad();
    if (storage.getItem('trigger_current_day_toeic') !== '55') {
        fail('completed current_day sentinel 55 was clamped');
    } else pass('completed current_day sentinel 55 preserved');
    if (storage.getItem('trigger_unlocked_day_toeic') !== '55') {
        fail('completed unlocked_day sentinel 55 was clamped');
    } else pass('completed unlocked_day sentinel 55 preserved');
}

function checkLegacyOvershootClampedToCompletedSentinel() {
    const { sandbox, storage } = loadToeicUnlock({
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '71',
        trigger_unlocked_day_toeic: '71'
    });
    sandbox.syncLevelOnLoad();
    if (storage.getItem('trigger_current_day_toeic') !== '55') {
        fail('legacy current_day 71 did not clamp to completed sentinel 55');
    } else pass('legacy current_day 71 clamps to completed sentinel 55');
    if (storage.getItem('trigger_unlocked_day_toeic') !== '55') {
        fail('legacy unlocked_day 71 did not clamp to completed sentinel 55');
    } else pass('legacy unlocked_day 71 clamps to completed sentinel 55');
}

function checkLockedToeicFallsBackToMiddle() {
    const { sandbox, storage } = loadToeicUnlock({
        trigger_level: 'toeic',
        trigger_current_day_toeic: '12',
        trigger_unlocked_day_toeic: '12'
    });
    sandbox.syncLevelOnLoad();
    if (storage.getItem('trigger_level') !== 'middle') {
        fail('locked TOEIC level did not fall back to middle');
    } else pass('locked TOEIC level falls back to middle');
}

console.log('--- TOEIC unlock regression checks ---\n');
checkCompletedSentinelPreserved();
checkLegacyOvershootClampedToCompletedSentinel();
checkLockedToeicFallsBackToMiddle();

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
