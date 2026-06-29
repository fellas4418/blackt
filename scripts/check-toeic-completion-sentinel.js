const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function createStorage(seed) {
    const data = Object.assign({}, seed);
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = String(value);
        },
        removeItem(key) {
            delete data[key];
        },
        dump() {
            return Object.assign({}, data);
        }
    };
}

function loadToeicUnlock(seed, withSchedule) {
    const storage = createStorage(seed);
    const sandbox = {
        console,
        localStorage: storage,
        prompt() {
            return null;
        },
        alert() {},
        document: {
            readyState: 'complete',
            addEventListener() {},
            getElementById() {
                return null;
            }
        }
    };
    sandbox.window = sandbox;
    if (withSchedule) {
        vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-schedule.js'), 'utf8'), sandbox, {
            filename: 'toeic-schedule.js'
        });
    }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-unlock.js'), 'utf8'), sandbox, {
        filename: 'toeic-unlock.js'
    });
    return sandbox;
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message + ' (expected ' + expected + ', got ' + actual + ')');
    }
    console.log('OK:', message);
}

function runCase(name, seed, withSchedule, expectedCurrent, expectedUnlocked) {
    const sandbox = loadToeicUnlock(seed, withSchedule);
    sandbox.syncLevelOnLoad();
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_toeic, expectedCurrent, name + ' current day');
    assertEqual(data.trigger_unlocked_day_toeic, expectedUnlocked, name + ' unlocked day');
}

runCase(
    'completed TOEIC sentinel is preserved with schedule',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '55',
        trigger_unlocked_day_toeic: '55'
    },
    true,
    '55',
    '55'
);

runCase(
    'completed TOEIC sentinel is preserved without schedule',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '55',
        trigger_unlocked_day_toeic: '55'
    },
    false,
    '55',
    '55'
);

runCase(
    'oversized TOEIC progress clamps to completion sentinel',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic',
        trigger_current_day_toeic: '99',
        trigger_unlocked_day_toeic: '99'
    },
    true,
    '55',
    '55'
);
