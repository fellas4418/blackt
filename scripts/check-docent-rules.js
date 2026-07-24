/**
 * 도슨트 LOCKED 규칙 검사
 * 사용: node scripts/check-docent-rules.js
 * 실패 시 exit 1
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
    path.join(root, 'data', 'patterns', 'svo.json'),
    path.join(root, 'data', 'pattern_index.json')
];

const ALLOWED_BRACKETS = new Set([
    '「-은/는/이/가」',
    '「-을/를」',
    '「-다」',
    '「는」',
    '「은」',
    '「을」',
    '「를」',
    '「이」',
    '「가」',
    '「역할」',
    '「어」',
    '「보충어」',
    '「주어 · 서술어 · 목적어」'
]);

const PARTICLE_TEXTS = new Set(['은', '는', '이', '가', '을', '를']);

const errors = [];

function add(file, where, msg) {
    errors.push(file + ' · ' + where + ' · ' + msg);
}

function walkDocent(file, label, docent) {
    (docent || []).forEach(function (item, idx) {
        const where = label + ' #' + (idx + 1) + ' (' + (item.role || '') + ')';
        checkTextParts(file, where, item);
        checkKorParts(file, where, item.kor_parts);
    });
}

function checkKorParts(file, where, korParts) {
    (korParts || []).forEach(function (p) {
        const t = String(p.text || '').trim();
        // 예문 한글줄 조사는 성분색 mark 유지 (복구·유지)
        if (/「|」/.test(t)) {
            add(file, where, 'kor_parts 에 「」 있음: ' + t);
        }
    });
}

function checkTextParts(file, where, item) {
    const chunks = [];
    if (item.text_parts && item.text_parts.length) {
        item.text_parts.forEach(function (p) {
            chunks.push(String(p.text || ''));
        });
    } else if (item.text) {
        chunks.push(String(item.text));
    }
    const joined = chunks.join('');

    // brackets
    const brackets = joined.match(/「[^」]*」/g) || [];
    brackets.forEach(function (b) {
        if (!ALLOWED_BRACKETS.has(b)) {
            // allow 「는」 etc already in set; English words fail
            add(file, where, '허용 목록에 없는 「」: ' + b);
        }
    });

    // mid-sentence single newlines (not \\n\\n, not before list markers)
    let i = 0;
    while (i < joined.length) {
        if (joined[i] === '\n') {
            if (joined[i + 1] === '\n') {
                i += 2;
                continue;
            }
            const after = joined.slice(i + 1, i + 8);
            if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(after) || /^\d+\.\s/.test(after)) {
                i += 1;
                continue;
            }
            // 문장 단위 줄바꿈: 직전이 . ? ! 이면 허용
            const prev = joined[i - 1];
            if (prev === '.' || prev === '?' || prev === '!') {
                i += 1;
                continue;
            }
            // 강조 「…」 한 줄 유지: 다음이 「 이면 허용
            if (after.charAt(0) === '「') {
                i += 1;
                continue;
            }
            if (i > 0 && joined[i - 1] !== '\n') {
                const snip = JSON.stringify(joined.slice(Math.max(0, i - 12), i + 16));
                add(file, where, '장식용 중간 \\n: ' + snip);
            }
        }
        i += 1;
    }
}

files.forEach(function (file) {
    if (!fs.existsSync(file)) {
        add(file, '-', '파일 없음');
        return;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const base = path.basename(file);

    if (data.docent) {
        walkDocent(base, 'docent', data.docent);
    }
    if (Array.isArray(data.chapters)) {
        data.chapters.forEach(function (ch) {
            walkDocent(base, 'ch:' + (ch.id || ''), ch.docent);
            if (ch.docent_bridge) {
                checkTextParts(base, 'ch:' + ch.id + ' bridge', {
                    text: ch.docent_bridge
                });
            }
        });
    }
});

if (errors.length) {
    console.error('check-docent-rules: FAIL (' + errors.length + ')\n');
    errors.forEach(function (e) {
        console.error(' - ' + e);
    });
    process.exit(1);
}

console.log('check-docent-rules: OK');
