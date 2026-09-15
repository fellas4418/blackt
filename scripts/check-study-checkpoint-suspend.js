/**
 * 학습 완료 후 pagehide가 다음 세션 체크포인트를 다시 쓰는 회귀 검사 (Node)
 * 실행: node scripts/check-study-checkpoint-suspend.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) return '';
    let brace = -1;
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') {
            if (depth === 0) brace = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && brace >= 0) return src.slice(start, i + 1);
        }
    }
    return '';
}

if (!app.includes('let __studyCkptSavesEnabled = true;')) {
    fail('app.js missing __studyCkptSavesEnabled');
} else {
    pass('app.js has __studyCkptSavesEnabled');
}

if (!app.includes('function suspendStudyCheckpoint()')) {
    fail('app.js missing suspendStudyCheckpoint');
} else {
    pass('app.js has suspendStudyCheckpoint');
}

if (!/function saveStudyCheckpoint\(\) \{[\s\S]{0,180}if \(!__studyCkptSavesEnabled\) return;/.test(app)) {
    fail('saveStudyCheckpoint does not gate on __studyCkptSavesEnabled');
} else {
    pass('saveStudyCheckpoint gates on __studyCkptSavesEnabled');
}

if (!/function finishSession\(didTest = true\) \{\s*suspendStudyCheckpoint\(\);/.test(app)) {
    fail('finishSession does not suspend checkpoint saves');
} else {
    pass('finishSession suspends checkpoint saves');
}

['startCountdown', 'startStudy', 'startTest'].forEach(function (name) {
    const fn = sliceFn(app, name);
    if (!fn) fail(name + ' missing');
    else if (!fn.includes('__studyCkptSavesEnabled = true;')) fail(name + ' does not re-enable checkpoint saves');
    else pass(name + ' re-enables checkpoint saves');
});

const memStore = function () {
    const d = Object.create(null);
    return {
        getItem(k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
        setItem(k, v) { d[k] = String(v); },
        removeItem(k) { delete d[k]; },
        _d: d
    };
};

const sessionStorage = memStore();
const localStorage = memStore();
localStorage.setItem('trigger_session_middle', '1');
localStorage.setItem('trigger_current_day_middle', '6');

const sandbox = {
    window: { location: { pathname: '/study.html' } },
    document: { body: { classList: { contains: () => true } } },
    sessionStorage,
    localStorage,
    currentLevel: 'middle',
    currentIdx: 20,
    studyLoopCount: 2,
    score: 18,
    isPreReviewMode: false,
    reviewRetryCount: 0,
    smartStudyActive: false,
    fullDayWords: [],
    sessionTestWrongWords: [],
    targetWords: [
        { word: 'apple' }, { word: 'book' }, { word: 'cat' }
    ],
    vocaIsReviewDay: function () { return false; },
    needsWordExclusionScreen: function () { return false; },
    JSON,
    parseInt,
    String
};
sandbox.window = Object.assign(sandbox.window, sandbox);

const ckptSrc = [
    'var __studyCkptPhase = "test";',
    'var __studyCkptSavesEnabled = true;',
    'var STUDY_CHECKPOINT_KEY = "trigger_study_ckpt_v1";',
    sliceFn(app, 'isStudyHtmlHost'),
    sliceFn(app, 'clearStudyCheckpoint'),
    sliceFn(app, 'suspendStudyCheckpoint'),
    sliceFn(app, 'saveStudyCheckpoint')
].join('\n');

if (!sliceFn(app, 'isStudyHtmlHost') || !sliceFn(app, 'saveStudyCheckpoint')) {
    fail('could not extract checkpoint functions');
} else {
    vm.runInNewContext(ckptSrc, sandbox, { filename: 'app.js#checkpoint' });

    sandbox.saveStudyCheckpoint();
    const before = sessionStorage.getItem('trigger_study_ckpt_v1');
    if (!before) fail('active checkpoint did not save');
    else pass('active checkpoint still saves');

    sandbox.suspendStudyCheckpoint();
    if (sessionStorage.getItem('trigger_study_ckpt_v1')) fail('suspend did not clear checkpoint');
    else pass('suspend clears checkpoint');

    sandbox.currentIdx = 20;
    sandbox.__studyCkptPhase = 'test';
    localStorage.setItem('trigger_current_day_middle', '6');
    localStorage.setItem('trigger_session_middle', '1');
    sandbox.saveStudyCheckpoint();
    if (sessionStorage.getItem('trigger_study_ckpt_v1')) {
        fail('pagehide after complete rewrote next-day checkpoint');
    } else {
        pass('pagehide after complete does not rewrite checkpoint');
    }

    sandbox.__studyCkptSavesEnabled = true;
    sandbox.currentIdx = 0;
    sandbox.__studyCkptPhase = 'study';
    sandbox.saveStudyCheckpoint();
    if (!sessionStorage.getItem('trigger_study_ckpt_v1')) fail('re-enabled save did not write');
    else pass('re-enabled study still saves checkpoint');
}

if (failed) {
    console.error('\n' + failed + ' check(s) failed');
    process.exit(1);
}
console.log('\nall study-checkpoint-suspend checks passed');
