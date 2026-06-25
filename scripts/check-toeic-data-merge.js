const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = {
    window: null,
    globalThis: null,
    console
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

function runScript(file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}

runScript('worddata.js');
runScript('worddata_toeic.js');

const result = vm.runInContext(
    `({
        lexicalHasToeic: !!(typeof wordsData !== "undefined" && wordsData.toeic),
        windowHasToeic: !!(window.wordsData && window.wordsData.toeic),
        sameObject: (typeof wordsData !== "undefined" && window.wordsData === wordsData),
        dayOneCount: (typeof wordsData !== "undefined" && wordsData.toeic && wordsData.toeic.week1 && wordsData.toeic.week1["1"] || []).length
    })`,
    ctx
);

if (!result.lexicalHasToeic || !result.windowHasToeic || !result.sameObject || result.dayOneCount < 1) {
    console.error('TOEIC word data merge failed:', result);
    process.exit(1);
}

console.log('TOEIC word data merge OK:', result);
