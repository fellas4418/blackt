/**
 * Day1 재시작 시 레벨 localStorage prefix가 형제 트랙을 지우지 않는지 검사.
 * 예: toeic → toeic_note, middle → middle_note
 * 실행: node scripts/check-restart-level-prefix.js
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

function extractFunction(source, fnName) {
    const start = source.indexOf('function ' + fnName);
    if (start < 0) throw new Error(fnName + ' not found');
    let i = source.indexOf('{', start);
    let depth = 0;
    for (; i < source.length; i++) {
        const ch = source[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('unclosed ' + fnName);
}

function makeStorage(initial) {
    const data = Object.assign({}, initial);
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

function runRestart(fnSource, fnName, level, initial) {
    const localStorage = makeStorage(initial);
    const sandbox = {
        localStorage,
        Math,
        parseInt,
        String,
        clearBlacktCooldownNotifySchedule: null,
        clearStudyCheckpoint: null,
        vocaPassCountKey: function (lvl) {
            return 'trigger_voca_pass_count_' + (lvl || 'middle');
        },
        getVocaPassCount: function (lvl) {
            return Math.max(0, parseInt(localStorage.getItem('trigger_voca_pass_count_' + (lvl || 'middle')), 10) || 0);
        },
        window: {}
    };
    sandbox.window = sandbox;
    vm.runInNewContext(
        fnSource + '\n' + fnName + '(' + JSON.stringify(level) + ');',
        sandbox
    );
    return localStorage._dump();
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

if (!app.includes('isOwnLevelDayKey')) fail('app.js missing isOwnLevelDayKey guard');
else pass('app.js has isOwnLevelDayKey');

if (!indexHtml.includes('isOwnLevelDayKey')) fail('index.html missing isOwnLevelDayKey guard');
else pass('index.html has isOwnLevelDayKey');

const appFn = extractFunction(app, 'restartVocaCourseFromDay1');
const localFn = extractFunction(indexHtml, 'restartVocaCourseFromDay1Local');
pass('extracted restart functions');

const toeicSeed = {
    trigger_level: 'toeic',
    trigger_progress_toeic_12: '100',
    trigger_review_done_toeic_12: 'true',
    trigger_excluded_toeic_12: '["a"]',
    'trigger_start_day_toeic_2026-08-10': '12',
    trigger_current_day_toeic: '55',
    trigger_unlocked_day_toeic: '55',
    trigger_session_toeic: '1',
    trigger_stats_toeic: '{"12":{"progress":100}}',
    trigger_progress_toeic_note_3: '80',
    trigger_review_done_toeic_note_2: 'true',
    trigger_excluded_toeic_note_1: '["b"]',
    trigger_excluded_done_toeic_note_1: '1',
    trigger_cycle4_study_toeic_note_3: '1',
    'trigger_start_day_toeic_note_2026-08-10': '3',
    trigger_current_day_toeic_note: '3',
    trigger_unlocked_day_toeic_note: '3',
    trigger_progress_middle_5: '100',
    trigger_progress_middle_note_1: '50'
};

function assertToeicRestart(label, fnSource, fnName) {
    const after = runRestart(fnSource, fnName, 'toeic', toeicSeed);
    const mustGone = [
        'trigger_progress_toeic_12',
        'trigger_review_done_toeic_12',
        'trigger_excluded_toeic_12',
        'trigger_start_day_toeic_2026-08-10'
    ];
    const mustKeep = [
        'trigger_progress_toeic_note_3',
        'trigger_review_done_toeic_note_2',
        'trigger_excluded_toeic_note_1',
        'trigger_excluded_done_toeic_note_1',
        'trigger_cycle4_study_toeic_note_3',
        'trigger_start_day_toeic_note_2026-08-10',
        'trigger_current_day_toeic_note',
        'trigger_unlocked_day_toeic_note',
        'trigger_progress_middle_5',
        'trigger_progress_middle_note_1'
    ];
    for (const k of mustGone) {
        if (after[k] != null) fail(label + ' still has wiped key ' + k);
        else pass(label + ' wiped ' + k);
    }
    for (const k of mustKeep) {
        if (after[k] == null) fail(label + ' wrongly removed ' + k);
        else pass(label + ' kept ' + k);
    }
    if (after.trigger_current_day_toeic !== '1' || after.trigger_unlocked_day_toeic !== '1') {
        fail(label + ' did not reset toeic current/unlocked to 1');
    } else pass(label + ' reset toeic to Day 1');
}

assertToeicRestart('app.js', appFn, 'restartVocaCourseFromDay1');
assertToeicRestart('index.html', localFn, 'restartVocaCourseFromDay1Local');

const middleSeed = {
    trigger_progress_middle_70: '100',
    trigger_review_done_middle_70: 'true',
    trigger_progress_middle_note_2: '40',
    trigger_start_day_middle_note_x: '2'
};
const afterMiddle = runRestart(appFn, 'restartVocaCourseFromDay1', 'middle', middleSeed);
if (afterMiddle.trigger_progress_middle_70 != null) fail('middle restart left own progress');
else pass('middle restart wipes own progress');
if (afterMiddle.trigger_progress_middle_note_2 == null) fail('middle restart wiped middle_note progress');
else pass('middle restart keeps middle_note progress');
if (afterMiddle.trigger_start_day_middle_note_x == null) fail('middle restart wiped middle_note start_day');
else pass('middle restart keeps middle_note start_day');

if (failed > 0) {
    console.error('\n' + failed + ' check(s) failed');
    process.exit(1);
}
console.log('\nAll restart level-prefix checks passed');
