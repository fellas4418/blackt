/**
 * 내 학습 노트 모달(renderNoteList) stored XSS 회귀 검사 (Node)
 * 실행: node scripts/check-note-modal-xss.js
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

function assertNoExecutableMarkup(label, markup) {
    if (/<script\b/i.test(markup)) fail(label + ' contains script tag');
    else pass(label + ' has no script tag');
    if (/<img\b/i.test(markup)) fail(label + ' contains raw img tag');
    else pass(label + ' escapes img-like payloads');
    const rawTags = String(markup || '').match(/<[^>]*>/g) || [];
    if (rawTags.some((tag) => /\son(?:error|load|mouseover)\s*=/i.test(tag.replace(/"[^"]*"/g, '""')))) {
        fail(label + ' contains raw event attribute');
    } else {
        pass(label + ' has no raw event attributes');
    }
    if (!String(markup || '').includes('&lt;img') && /onerror/i.test(markup)) {
        fail(label + ' still contains unescaped onerror payload text in executable form');
    }
}

const helpersStart = source.indexOf('function escapeHtml(s)');
const helpersEnd = source.indexOf('/** 지문 eng 표시', helpersStart);
if (helpersStart < 0 || helpersEnd < 0) {
    fail('missing escape helpers block');
} else {
    pass('escape helpers block found');
}

const listEl = { innerHTML: '' };
const sandbox = {
    console,
    currentNoteTab: 'voca',
    noteSyncResolved: true,
    savedVocaCache: [],
    savedGrammarCache: [],
    document: {
        getElementById(id) {
            return id === 'note-list-container' ? listEl : null;
        }
    }
};
vm.createContext(sandbox);
vm.runInContext(
    source.slice(helpersStart, helpersEnd) + '\n' + extractFunction('renderNoteList'),
    sandbox,
    { filename: 'note-modal-xss-snippet.js' }
);

const htmlBreakout = '<img src=x onerror=alert("__NOTE_XSS__")>';

sandbox.currentNoteTab = 'voca';
sandbox.savedVocaCache = [
    {
        passageTitle: 'title' + htmlBreakout,
        eng: 'word' + htmlBreakout,
        kor: '뜻' + htmlBreakout,
        level: 'high'
    }
];
sandbox.renderNoteList();
assertNoExecutableMarkup('voca note list', listEl.innerHTML);
if (!listEl.innerHTML.includes('&lt;img')) fail('voca note list did not HTML-escape img payload');
else pass('voca note list HTML-escapes img payload');

sandbox.currentNoteTab = 'grammar';
sandbox.savedGrammarCache = [
    {
        passageTitle: '문법' + htmlBreakout,
        point: '포인트' + htmlBreakout,
        sentence: '문장' + htmlBreakout,
        explanation: '설명' + htmlBreakout
    }
];
sandbox.renderNoteList();
assertNoExecutableMarkup('grammar note list', listEl.innerHTML);
if (!listEl.innerHTML.includes('&lt;img')) fail('grammar note list did not HTML-escape img payload');
else pass('grammar note list HTML-escapes img payload');

if (failed) {
    console.error('\nnote modal XSS regression check failed:', failed);
    process.exit(1);
}
console.log('\nnote modal XSS regression check passed');
