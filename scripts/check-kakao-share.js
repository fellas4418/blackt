/**
 * VOCA 학습 완료 카톡 공유 회귀 검사 (Node)
 * 실행: node scripts/check-kakao-share.js
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

function loadPraiseShare() {
    const code = fs.readFileSync(path.join(root, 'praise-share.js'), 'utf8');
    const sandbox = {
        window: {},
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        encodeURIComponent,
        decodeURIComponent,
        escape: (s) => encodeURIComponent(s).replace(/%u([0-9A-F]{4})/gi, (_, h) =>
            String.fromCharCode(parseInt(h, 16))
        ),
        unescape: (s) => decodeURIComponent(s.replace(/%([0-9A-F]{2})/gi, '%$1')),
        localStorage: {
            _d: {
                trigger_level: 'middle',
                trigger_name: '테스트',
                trigger_current_day_middle: '5',
                trigger_session_middle: '1',
                trigger_unlocked_day_middle: '5'
            },
            getItem(k) {
                return this._d[k] ?? null;
            },
            setItem(k, v) {
                this._d[k] = String(v);
            }
        },
        wordsData: { middle: {} },
        console
    };
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox, { filename: 'praise-share.js' });
    return sandbox.TriggerPraise;
}

function checkAppJsSurface() {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const required = [
        'function shareKakao()',
        'function buildVocaShareBundle()',
        'function tryKakaoSdkShare(',
        'function tryNativeWebShare(',
        'function copyTextForShareFallback(',
        'window.shareKakao = shareKakao',
        'btn-study-kakao-share',
        'showStudyDayCompleteScreen',
        'bindStudyCompleteActionsOnce',
        'adminGoDayCompleteKakaoScreen',
        'adminTestKakaoShareOnly',
        'isAdminDayCompleteSharePreview',
        'KAKAO_SHARE_ORIGIN',
        'kakaoShareReceiverUrl',
        '/share-entry.html'
    ];
    for (const token of required) {
        if (!app.includes(token)) fail('app.js missing: ' + token);
        else pass('app.js has ' + token);
    }
    if (!fs.existsSync(path.join(root, 'praise-receiver.html'))) fail('praise-receiver.html missing');
    else pass('praise-receiver.html exists');
    if (app.includes("window.location.origin + '/index.html'") && app.includes('share_result=1')) {
        fail('buildVocaShareBundle still uses window.location.origin for share links');
    } else pass('share links not tied to window.location.origin');
    if (app.includes('tri3.imweb.me')) fail('app.js must not reference tri3.imweb.me in share path');
    else pass('app.js has no tri3.imweb.me share reference');
    if (app.includes("'/praise-receiver.html' + (q")) {
        fail('kakaoShareReceiverUrl must not link directly to praise-receiver.html');
    } else pass('kakaoShareReceiverUrl uses share-entry bridge');
}

function checkStudyHtml() {
    const html = fs.readFileSync(path.join(root, 'study.html'), 'utf8');
    if (!html.includes('kakao_js_sdk')) fail('study.html missing Kakao SDK script');
    else pass('study.html loads Kakao SDK');
    if (!html.includes('praise-share.js')) fail('study.html missing praise-share.js');
    else pass('study.html loads praise-share.js');
    if (!html.includes('app.js')) fail('study.html missing app.js');
    else pass('study.html loads app.js');
    if (html.includes('<motion')) fail('study.html has invalid <motion> tag');
    else pass('study.html has no <motion> tag');
}

function checkPraiseShare(TriggerPraise) {
    if (!TriggerPraise) {
        fail('TriggerPraise not exported');
        return;
    }
    const st = TriggerPraise.statsFromStorage('voca');
    if (st.b == null || st.m == null || isNaN(st.b)) {
        fail('statsFromStorage missing b/m meta');
    } else pass('statsFromStorage includes badge meta');

    let line = '';
    try {
        line = TriggerPraise.kakaoSubtitleLine(st);
    } catch (e) {
        fail('kakaoSubtitleLine threw: ' + e.message);
        return;
    }
    if (!line || !line.includes('배지')) fail('kakaoSubtitleLine empty or invalid');
    else pass('kakaoSubtitleLine: ' + line.slice(0, 40) + '…');

    if (typeof TriggerPraise.returnToKakaoInApp !== 'function') fail('returnToKakaoInApp missing');
    else pass('returnToKakaoInApp exported');

    const pc = TriggerPraise.encodePc(st);
    if (!pc) fail('encodePc returned empty');
    else pass('encodePc length ' + pc.length);

    const bare = { n: '학습자', d: 1, t: 0, k: 'voca' };
    try {
        TriggerPraise.kakaoSubtitleLine(bare);
        pass('kakaoSubtitleLine works without pre-set b/m');
    } catch (e2) {
        fail('kakaoSubtitleLine on bare ctx: ' + e2.message);
    }
}

function simulateBundle(TriggerPraise) {
    const st = TriggerPraise.statsFromStorage('voca');
    let badgeLine = '';
    try {
        badgeLine = TriggerPraise.kakaoSubtitleLine(st) || '';
    } catch (e) {
        fail('bundle simulation badgeLine: ' + e.message);
        return;
    }
    const title = `🔥 [${st.n}]님, 단어 학습 완료!`;
    const description = `누적 클리어: ${st.t} 단어\n오늘의 진도: Day ${st.d}`;
  if (!title.includes('테스트') && !title.includes('학습자')) {
        fail('bundle title unexpected');
    } else pass('bundle title OK');
    const payload = {
        objectType: 'feed',
        content: {
            title,
            description: description + badgeLine,
            imageUrl: 'https://blackt.pages.dev/' + encodeURI('로고, 이미지/share-v2.png'),
            link: { mobileWebUrl: 'https://example.com/share-entry.html', webUrl: 'https://example.com/share-entry.html' }
        }
    };
    if (payload.objectType !== 'feed' || !payload.content.title) fail('invalid Kakao payload');
    else pass('Kakao feed payload structure OK');
}

console.log('--- 카톡 공유 회귀 검사 ---\n');
checkAppJsSurface();
console.log('');
checkStudyHtml();
console.log('');
const TP = loadPraiseShare();
checkPraiseShare(TP);
console.log('');
simulateBundle(TP);
console.log('');
if (failed) {
    console.error('\n총 ' + failed + '건 실패');
    process.exit(1);
}
console.log('\n모든 검사 통과 (' + new Date().toISOString() + ')');
