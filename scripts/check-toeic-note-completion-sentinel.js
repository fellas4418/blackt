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

function loadToeicUnlock(seed, opts) {
    const options = opts || {};
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
    if (options.withOcr) {
        vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-note-ocr.js'), 'utf8'), sandbox, {
            filename: 'toeic-note-ocr.js'
        });
    }
    if (options.withSchedule !== false) {
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

function runCase(name, seed, opts, expectedCurrent, expectedUnlocked) {
    const sandbox = loadToeicUnlock(seed, opts);
    sandbox.syncLevelOnLoad();
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_toeic_note, expectedCurrent, name + ' current day');
    assertEqual(data.trigger_unlocked_day_toeic_note, expectedUnlocked, name + ' unlocked day');
}

runCase(
    'completed LC note sentinel is preserved with schedule',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic_note',
        trigger_current_day_toeic_note: '5',
        trigger_unlocked_day_toeic_note: '5'
    },
    { withSchedule: true },
    '5',
    '5'
);

runCase(
    'completed LC note sentinel is preserved without schedule',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic_note',
        trigger_current_day_toeic_note: '5',
        trigger_unlocked_day_toeic_note: '5'
    },
    { withSchedule: false },
    '5',
    '5'
);

runCase(
    'oversized LC note progress clamps to completion sentinel',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic_note',
        trigger_current_day_toeic_note: '99',
        trigger_unlocked_day_toeic_note: '99'
    },
    { withSchedule: true },
    '5',
    '5'
);

runCase(
    'OCR-extended LC note unlocked days are preserved',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic_note',
        trigger_current_day_toeic_note: '6',
        trigger_unlocked_day_toeic_note: '6',
        trigger_toeic_note_user_days: JSON.stringify({
            '5': [{ word: 'alpha', meanings: ['알파'] }],
            '6': [{ word: 'beta', meanings: ['베타'] }]
        })
    },
    { withSchedule: true, withOcr: true },
    '6',
    '6'
);

runCase(
    'OCR-extended LC note completion sentinel is preserved',
    {
        trigger_toeic_unlocked: '1',
        trigger_level: 'toeic_note',
        trigger_current_day_toeic_note: '7',
        trigger_unlocked_day_toeic_note: '7',
        trigger_toeic_note_user_days: JSON.stringify({
            '5': [{ word: 'alpha', meanings: ['알파'] }],
            '6': [{ word: 'beta', meanings: ['베타'] }]
        })
    },
    { withSchedule: true, withOcr: true },
    '7',
    '7'
);

console.log('All LC note completion sentinel checks passed.');
