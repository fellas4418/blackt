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

function assertEqual(actual, expected, message) {
    if (String(actual) !== String(expected)) {
        throw new Error(message + ' (expected ' + expected + ', got ' + actual + ')');
    }
    console.log('OK:', message);
}

function loadExtraOcr(seed) {
    const storage = createStorage(seed);
    const sandbox = {
        console,
        localStorage: storage,
        document: {
            readyState: 'complete',
            addEventListener() {},
            getElementById() {
                return null;
            }
        },
        alert() {},
        confirm() {
            return true;
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'voca-extra-ocr.js'), 'utf8'), sandbox, {
        filename: 'voca-extra-ocr.js'
    });
    return sandbox;
}

function loadToeicNoteOcr(seed) {
    const storage = createStorage(seed);
    const sandbox = {
        console,
        localStorage: storage,
        document: {
            readyState: 'complete',
            addEventListener() {},
            getElementById() {
                return null;
            }
        },
        alert() {},
        confirm() {
            return true;
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'toeic-note-ocr.js'), 'utf8'), sandbox, {
        filename: 'toeic-note-ocr.js'
    });
    return sandbox;
}

function manyWords(n, prefix) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({ word: (prefix || 'w') + i, meanings: ['뜻' + i] });
    }
    return out;
}

// extra_note: multi-chunk first import must not unlock Day 2+ or mark them CLEAR
{
    const sandbox = loadExtraOcr({});
    const result = sandbox.TriggerVocaExtraOcr.addDaysChunked('extra_note', manyWords(75, 'e'), 1);
    assertEqual(result.firstDay, 1, 'extra multi-chunk starts at Day 1');
    assertEqual(result.lastDay, 3, 'extra multi-chunk spans 3 days');
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_extra_note, '1', 'extra multi-chunk keeps current at Day 1');
    assertEqual(data.trigger_unlocked_day_extra_note, '1', 'extra multi-chunk does not unlock past Day 1');
}

// extra_note: mid-course OCR must not jump current/unlocked to the new last day
{
    const sandbox = loadExtraOcr({
        trigger_current_day_extra_note: '2',
        trigger_unlocked_day_extra_note: '2',
        trigger_session_extra_note: '2',
        trigger_extra_note_user_days: JSON.stringify({
            '1': [{ word: 'a', meanings: ['에이'] }],
            '2': [{ word: 'b', meanings: ['비'] }],
            '3': [{ word: 'c', meanings: ['씨'] }]
        })
    });
    const result = sandbox.TriggerVocaExtraOcr.addDaysChunked('extra_note', manyWords(5, 'n'), 4);
    assertEqual(result.firstDay, 4, 'extra mid-course OCR appends Day 4');
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_extra_note, '2', 'extra mid-course OCR does not jump current');
    assertEqual(data.trigger_unlocked_day_extra_note, '2', 'extra mid-course OCR does not raise unlocked');
    assertEqual(data.trigger_session_extra_note, '2', 'extra mid-course OCR keeps session');
}

// toeic_note: OCR while mid-base must not skip Days 2–4
{
    const sandbox = loadToeicNoteOcr({
        trigger_current_day_toeic_note: '2',
        trigger_unlocked_day_toeic_note: '2',
        trigger_session_toeic_note: '3'
    });
    const result = sandbox.TriggerToeicNoteOcr.addDaysChunked(manyWords(5, 't'), 5);
    assertEqual(result.firstDay, 5, 'LC note OCR appends Day 5');
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_toeic_note, '2', 'LC note mid-base OCR does not jump current');
    assertEqual(data.trigger_unlocked_day_toeic_note, '2', 'LC note mid-base OCR does not raise unlocked');
    assertEqual(data.trigger_session_toeic_note, '3', 'LC note mid-base OCR keeps session');
}

// toeic_note: after base complete, multi-chunk must not unlock Day 6 early / skip Day 5
{
    const sandbox = loadToeicNoteOcr({
        trigger_current_day_toeic_note: '5',
        trigger_unlocked_day_toeic_note: '5',
        trigger_session_toeic_note: '1'
    });
    const result = sandbox.TriggerToeicNoteOcr.addDaysChunked(manyWords(80, 'u'), 5);
    assertEqual(result.firstDay, 5, 'LC note post-complete multi-chunk starts Day 5');
    assertEqual(result.lastDay, 6, 'LC note post-complete multi-chunk ends Day 6');
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_current_day_toeic_note, '5', 'LC note multi-chunk keeps current on Day 5');
    assertEqual(data.trigger_unlocked_day_toeic_note, '5', 'LC note multi-chunk does not unlock Day 6 early');
}

// Heal only: unlocked lagging behind current/firstDay
{
    const sandbox = loadToeicNoteOcr({
        trigger_current_day_toeic_note: '5',
        trigger_unlocked_day_toeic_note: '4',
        trigger_session_toeic_note: '1'
    });
    sandbox.TriggerToeicNoteOcr.addDaysChunked(manyWords(3, 'h'), 5);
    const data = sandbox.localStorage.dump();
    assertEqual(data.trigger_unlocked_day_toeic_note, '5', 'LC note heals unlocked up to firstDay only');
    assertEqual(data.trigger_current_day_toeic_note, '5', 'LC note heal does not change current');
}

console.log('All OCR day progress unlock checks passed.');
