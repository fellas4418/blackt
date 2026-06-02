/**
 * 지문분석 결과 HTML 조립 XSS 회귀 검사 (Node)
 * 실행: node scripts/check-analysis-xss.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const analysisPath = path.join(root, 'analysis.html');
const source = fs.readFileSync(analysisPath, 'utf8');
let failed = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failed++;
}

function pass(msg) {
    console.log('OK:', msg);
}

function extractFunction(name) {
    const start = source.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('missing function ' + name);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let i = bodyStart; i < source.length; i++) {
        const ch = source[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('unterminated function ' + name);
}

function decodeAttr(s) {
    return String(s || '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function onclicks(markup) {
    const out = [];
    const re = /onclick="([^"]*)"/g;
    let m;
    while ((m = re.exec(markup))) out.push(decodeAttr(m[1]));
    return out;
}

function assertNoExecutableMarkup(label, markup) {
    if (/<script\b/i.test(markup)) fail(label + ' contains script tag');
    else pass(label + ' has no script tag');
    if (/<img\b/i.test(markup)) fail(label + ' contains raw img tag');
    else pass(label + ' escapes img-like payloads');
    if (/\sonerror\s*=|\sonload\s*=|\sonmouseover\s*=/i.test(markup)) fail(label + ' contains raw event attribute');
    else pass(label + ' has no raw event attributes');
}

function assertOnclicksDoNotEscape(label, markup) {
    onclicks(markup).forEach((code, idx) => {
        let called = false;
        const makeHandler = new Function(
            'toggleGrammarSave',
            'showWordPopup',
            'toggleVocaSave',
            'closeWordPopup',
            'startVocaPractice',
            'saveAllKeywords',
            'toggleVocaList',
            'alert',
            'return function(){' + code + '}'
        );
        const handler = makeHandler(
            () => {
                called = true;
            },
            () => {
                called = true;
            },
            () => {
                called = true;
            },
            () => {},
            () => {},
            () => {},
            () => {},
            () => {
                throw new Error('alert escaped from string literal');
            }
        );
        try {
            handler.call({});
            pass(label + ' onclick #' + (idx + 1) + ' stays inside intended handler');
            if (!called && /toggle(?:Grammar|Voca)Save|showWordPopup/.test(code)) {
                fail(label + ' onclick #' + (idx + 1) + ' did not call intended handler');
            }
        } catch (e) {
            fail(label + ' onclick #' + (idx + 1) + ' is executable injection: ' + e.message);
        }
    });
}

const helpersStart = source.indexOf('function escapeHtml(s)');
const helpersEnd = source.indexOf('/** 지문 eng 표시', helpersStart);
if (helpersStart < 0 || helpersEnd < 0) {
    fail('missing escape helpers block');
} else {
    pass('escape helpers block found');
}

if (!source.includes("let backgroundHtml = escapeHtml(res.background || '내용 확인 중').replace")) {
    fail('backgroundHtml is not escaped before innerHTML insertion');
} else {
    pass('backgroundHtml is escaped before innerHTML insertion');
}

const popupEl = {
    innerHTML: '',
    style: {}
};
const sandbox = {
    console,
    encodeURIComponent,
    setTimeout: () => 1,
    clearTimeout: () => {},
    window: {},
    document: {
        getElementById(id) {
            return id === 'word-popup' ? popupEl : null;
        }
    },
    GRAMMAR_PREVIEW_VISIBLE: 3,
    savedVocaCache: [],
    aiKeywordsObj: []
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
    source.slice(helpersStart, helpersEnd) +
        '\nvar wordPopupAutoCloseTimer = null;\n' +
        extractFunction('buildGrammarListWrapHtml') +
        '\n' +
        extractFunction('buildKeywordPanelHtml') +
        '\n' +
        extractFunction('showWordPopup'),
    sandbox,
    { filename: 'analysis-xss-snippet.js' }
);

const jsBreakout = "\\'); alert('__XSS__'); void('";
const htmlBreakout = '<img src=x onerror=alert("__XSS__")>';

const grammarMarkup = sandbox.buildGrammarListWrapHtml(
    {
        grammar: [
            {
                point: jsBreakout + htmlBreakout,
                sentence: jsBreakout + htmlBreakout,
                explanation: jsBreakout + htmlBreakout
            }
        ]
    },
    []
);
assertNoExecutableMarkup('grammar markup', grammarMarkup);
assertOnclicksDoNotEscape('grammar markup', grammarMarkup);

sandbox.aiKeywordsObj = [
    {
        eng: 'word' + htmlBreakout,
        kor: jsBreakout + htmlBreakout,
        level: "high'); alert('__XSS__'); ('"
    }
];
const keywordMarkup = sandbox.buildKeywordPanelHtml();
assertNoExecutableMarkup('keyword markup', keywordMarkup);
assertOnclicksDoNotEscape('keyword markup', keywordMarkup);

sandbox.showWordPopup('word' + htmlBreakout, jsBreakout + htmlBreakout, "high'); alert('__XSS__'); ('");
assertNoExecutableMarkup('word popup markup', popupEl.innerHTML);
assertOnclicksDoNotEscape('word popup markup', popupEl.innerHTML);

if (failed) {
    console.error('\nanalysis XSS regression check failed:', failed);
    process.exit(1);
}
console.log('\nanalysis XSS regression check passed');
