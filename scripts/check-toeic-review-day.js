/**
 * TOEIC 복습일 로딩 회귀 검사 (Node)
 * 실행: node scripts/check-toeic-review-day.js
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

function loadToeicContext() {
    const sandbox = {
        console,
        window: {},
        globalThis: null,
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {}
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    ['worddata.js', 'worddata_toeic.js', 'toeic-schedule.js'].forEach(function (file) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
    });
    return sandbox;
}

function checkToeicGeneratedReviewDays(sandbox) {
    const result = vm.runInContext(`(() => {
        const S = window.TriggerToeicSchedule;
        const out = {
            hasToeic: typeof wordsData !== 'undefined' && !!wordsData.toeic,
            hasSchedule: !!S,
            reviewDays: []
        };
        if (!out.hasToeic || !out.hasSchedule) return out;
        for (let day = 1; day <= S.vocaTotalDays('toeic'); day++) {
            if (!S.isReviewDay('toeic', day)) continue;
            const week = S.weekNumForLevel('toeic', day);
            const localDay = S.localDayForLevel('toeic', day);
            const dayData = wordsData.toeic['week' + week] && wordsData.toeic['week' + week][String(localDay)];
            const reviewWords = S.buildToeicReviewWords('toeic', day);
            out.reviewDays.push({
                day,
                week,
                localDay,
                hasPhysicalDayData: !!dayData,
                count: reviewWords.length
            });
        }
        return out;
    })()`, sandbox);

    if (!result.hasToeic) fail('wordsData.toeic missing');
    else pass('wordsData.toeic loaded');
    if (!result.hasSchedule) fail('TriggerToeicSchedule missing');
    else pass('TriggerToeicSchedule loaded');

    const bad = (result.reviewDays || []).filter(function (r) {
        return r.hasPhysicalDayData || r.count < 1 || r.count > 80;
    });
    if (bad.length) {
        fail('TOEIC review-day generation invalid: ' + JSON.stringify(bad));
    } else {
        pass('TOEIC review days generate 1-80 words without physical day slots');
    }
}

function checkStudyEntryGuard() {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const reviewIdx = app.indexOf('const isReviewDay = vocaIsReviewDay(currentDay);');
    const guardIdx = app.indexOf('if ((!dayData && !isReviewDay) || (startDay && currentDay >= startDay + 3))');

    if (reviewIdx < 0) {
        fail('app.js missing pre-guard isReviewDay calculation');
    } else {
        pass('app.js calculates isReviewDay before dayData gate');
    }

    if (guardIdx < 0) {
        fail('app.js dayData gate still blocks generated review days');
    } else {
        pass('app.js dayData gate allows generated review days');
    }

    if (reviewIdx >= 0 && guardIdx >= 0 && reviewIdx > guardIdx) {
        fail('app.js computes isReviewDay after dayData gate');
    }
}

console.log('--- TOEIC 복습일 로딩 회귀 검사 ---\n');
const sandbox = loadToeicContext();
checkToeicGeneratedReviewDays(sandbox);
checkStudyEntryGuard();

if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}

console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
