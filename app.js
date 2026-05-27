function showSystemMessage(text) {
    const targetEl = document.getElementById('target');
    const meaningsEl = document.getElementById('meanings');
    
    if (targetEl) {
        targetEl.innerHTML = text;
        targetEl.style.setProperty('font-size', '24px', 'important'); 
        targetEl.style.setProperty('text-shadow', 'none', 'important');
        targetEl.style.setProperty('margin-top', '30px', 'important');
        targetEl.style.color = '#aaaaaa';
        targetEl.style.lineHeight = '1.6';
        targetEl.style.wordBreak = 'keep-all';
        targetEl.style.fontWeight = 'normal';
    }
    if (meaningsEl) meaningsEl.innerHTML = "";
}

function stopStudyTimersAndSpeech() {
    if (window.currentTimer) {
        clearInterval(window.currentTimer);
        window.currentTimer = null;
    }
    try {
        window.speechSynthesis.cancel();
    } catch (e) {}
    isPaused = false;
}

function showStudyDayCompleteScreen(accuracy, completedDay, creditEarnedHtml) {
    stopStudyTimersAndSpeech();
    const sessionTag = document.getElementById('session-tag');
    if (sessionTag) {
        sessionTag.innerText = 'SYNC COMPLETE ◆';
        sessionTag.style.color = 'var(--neon-green)';
    }
    const bar = document.getElementById('bar');
    if (bar) {
        bar.style.width = '100%';
        bar.style.backgroundColor = 'var(--neon-green)';
    }
    const dayNum = Number(completedDay) || parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) - 1 || 1;
    const creditHtml = creditEarnedHtml || '';
    const creditBal =
        typeof TriggerCredit !== 'undefined'
            ? '<div style="margin-top:12px;font-size:0.85rem;color:#888;">보유 크레딧 <strong style="color:var(--neon-orange);">' +
              TriggerCredit.getBalance() +
              '</strong></div>'
            : '';
    showSystemMessage(`
        <div style="text-align:center; max-width:100%;">
            <div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold; font-family:Orbitron,Pretendard,sans-serif; letter-spacing:0.05em;">PROTOCOL COMPLETE · ${accuracy}%</div>
            ${creditHtml}
            ${creditBal}
            <button type="button" id="btn-study-voca-pdf" style="width:100%; padding:14px; background:rgba(57,255,20,0.12); color:var(--neon-green); border:1px solid var(--neon-green); border-radius:6px; margin-top:16px; font-weight:bold; cursor:pointer;">📄 Day ${dayNum} 단어장 (3종)</button>
            <button type="button" id="btn-study-kakao-share" style="width:100%; padding:16px; background:#fee500; color:#000; border-radius:6px; margin-top:12px; border:none; font-weight:bold; cursor:pointer;">◆ 카톡 공유</button>
            <button type="button" id="btn-study-exit-home" style="display:block; width:100%; margin-top:20px; padding:12px; background:none; border:none; color:#888; text-decoration:underline; cursor:pointer; font-size:1rem;">종료하기</button>
        </div>
    `);
    setTimeout(function () {
        const pdfBtn = document.getElementById('btn-study-voca-pdf');
        const shareBtn = document.getElementById('btn-study-kakao-share');
        const exitBtn = document.getElementById('btn-study-exit-home');
        if (pdfBtn) {
            pdfBtn.onclick = function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof TriggerVocaPdf !== 'undefined') {
                    TriggerVocaPdf.printToday(currentLevel, dayNum, 'all');
                } else {
                    alert('단어장 기능을 불러오지 못했습니다. 메인 보카 탭에서 시도해 주세요.');
                }
            };
        }
        if (shareBtn) {
            shareBtn.onclick = function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                if (shareBtn.disabled) return;
                const label = shareBtn.textContent;
                shareBtn.disabled = true;
                shareBtn.textContent = '공유 준비 중…';
                Promise.resolve(shareKakao()).finally(function () {
                    shareBtn.disabled = false;
                    shareBtn.textContent = label;
                });
            };
        }
        if (exitBtn) {
            exitBtn.onclick = function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                location.href = 'index.html?tab=voca';
            };
        }
        if (typeof TriggerCredit !== 'undefined') TriggerCredit.updateDisplay();
    }, 0);
}

function initKakao() {
    try {
        if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
            Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
            console.log("카카오 SDK 초기화 완료");
        }
    } catch (e) { 
        console.error("카카오 초기화 실패", e); 
    }
}
window.addEventListener('load', initKakao);

let currentIdx = 0;
let score = 0;
let targetWords = []; 
let studyLoopCount = 1; 
const COOL_DOWN_TIME = 3 * 60 * 1000; 
const DAILY_CYCLE_COUNT = 5;
const TRIGGER_IMG_DIR = '로고, 이미지/';
/** 카톡 공유 링크 고정 도메인 (다른 origin 사용 금지) */
const KAKAO_SHARE_ORIGIN = 'https://blackt.pages.dev';
function triggerPagesImgUrl(fileName) {
    return KAKAO_SHARE_ORIGIN + '/' + encodeURI(TRIGGER_IMG_DIR + fileName);
}
/** 카톡 feed·버튼 링크 — share-entry 경유 (카톡 인앱 → praise-receiver) */
function kakaoShareReceiverUrl(query) {
    const q = String(query || '').replace(/^\?/, '');
    const params = new URLSearchParams(q);
    const out = new URLSearchParams();
    if (params.get('praise') === 'true') {
        out.set('praise', '1');
    } else {
        out.set('path', 'index.html');
    }
    const pc = params.get('pc');
    if (pc) out.set('pc', pc);
    return KAKAO_SHARE_ORIGIN + '/share-entry.html?' + out.toString();
}

let __studyCkptPhase = 'study';
const STUDY_CHECKPOINT_KEY = 'trigger_study_ckpt_v1';

let __blacktCooldownNotifyTimerId = null;
let __cooldownNotifAlreadySent = false;

function clearBlacktCooldownNotifySchedule() {
    if (__blacktCooldownNotifyTimerId != null) {
        clearTimeout(__blacktCooldownNotifyTimerId);
        __blacktCooldownNotifyTimerId = null;
    }
}

function triggerShowCooldownDoneNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = 'TRIGGER BLACK · VOCA';
    const options = {
        body: '3분 쉼이 끝났어요. 다음 사이클을 시작해 보세요! 🔥',
        icon: TRIGGER_IMG_DIR + 'icon-192.png',
        tag: 'blackt-cooldown-done',
        vibrate: [200, 100, 200]
    };
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(function (reg) {
                if (reg && typeof reg.showNotification === 'function') {
                    reg.showNotification(title, options);
                } else {
                    new Notification(title, options);
                }
            }).catch(function () {
                try { new Notification(title, options); } catch (e) {}
            });
        } else {
            new Notification(title, options);
        }
    } catch (e) {}
}

window.triggerShowCooldownDoneNotification = triggerShowCooldownDoneNotification;

function scheduleBlacktCooldownEndNotification() {
    clearBlacktCooldownNotifySchedule();
    __cooldownNotifAlreadySent = false;
    const raw = localStorage.getItem('blackt_cooldown');
    const endTime = parseInt(raw, 10);
    if (!raw || Number.isNaN(endTime)) return;
    const remaining = endTime - Date.now();
    if (remaining <= 0) return;
    if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) {}
    }
    __blacktCooldownNotifyTimerId = setTimeout(function () {
        __blacktCooldownNotifyTimerId = null;
        if (!__cooldownNotifAlreadySent) {
            triggerShowCooldownDoneNotification();
        }
        __cooldownNotifAlreadySent = true;
    }, remaining);
}

function handleCooldownExpiredUi() {
    clearBlacktCooldownNotifySchedule();
    if (!__cooldownNotifAlreadySent) {
        triggerShowCooldownDoneNotification();
    }
    __cooldownNotifAlreadySent = false;
    localStorage.removeItem('blackt_cooldown');
}

window.scheduleBlacktCooldownEndNotification = scheduleBlacktCooldownEndNotification;
window.clearBlacktCooldownNotifySchedule = clearBlacktCooldownNotifySchedule;
window.handleCooldownExpiredUi = handleCooldownExpiredUi;

let isPreReviewMode = false;
let todayWords = [];
let fullDayWords = [];
let smartStudyActive = false;
let sessionTestWrongWords = [];
let reviewRetryCount = 0; 
let isMuted = localStorage.getItem('trigger_muted') === 'true';
let isPaused = false;
const currentLevel = localStorage.getItem('trigger_level') || 'middle';
window.lastWrongOptions = [];

function isSmartStudyEligible(isReviewDay) {
    if (isPreReviewMode) return false;
    if (isReviewDay) return false;
    if (window.__customVocaPractice && window.__customVocaPractice.active) return false;
    return true;
}

function smartStudyExcludedKey() {
    const day = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) || 1;
    return `trigger_excluded_${currentLevel}_${day}`;
}

function smartStudyExcludedDoneKey() {
    const day = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) || 1;
    return `trigger_excluded_done_${currentLevel}_${day}`;
}

function smartStudyCycle4Key() {
    const day = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) || 1;
    return `trigger_cycle4_study_${currentLevel}_${day}`;
}

function loadExcludedWordSet() {
    try {
        const raw = localStorage.getItem(smartStudyExcludedKey());
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) { return new Set(); }
}

function saveExcludedWords(wordArr) {
    localStorage.setItem(smartStudyExcludedKey(), JSON.stringify(wordArr));
    localStorage.setItem(smartStudyExcludedDoneKey(), 'true');
}

function hasExcludedSelectionDone() {
    return localStorage.getItem(smartStudyExcludedDoneKey()) === 'true';
}

function loadCycle4StudyWords() {
    try {
        const raw = localStorage.getItem(smartStudyCycle4Key());
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function saveCycle4StudyWords(words) {
    localStorage.setItem(smartStudyCycle4Key(), JSON.stringify(words));
}

function clearSmartStudyDayState(level, day) {
    try {
        localStorage.removeItem(`trigger_excluded_${level}_${day}`);
        localStorage.removeItem(`trigger_excluded_done_${level}_${day}`);
        localStorage.removeItem(`trigger_cycle4_study_${level}_${day}`);
    } catch (e) {}
}

function shuffleWordList(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildStudyWordsFromExcluded(excludedSet) {
    return fullDayWords.filter(w => w && w.word && !excludedSet.has(w.word));
}

function getStudyBaseList() {
    const sessionNum = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`) || '1', 10);
    if (sessionNum >= 4) return loadCycle4StudyWords();
    return buildStudyWordsFromExcluded(loadExcludedWordSet());
}

function applySmartStudyWordSets(isReviewDay) {
    fullDayWords = todayWords.slice();
    smartStudyActive = isSmartStudyEligible(isReviewDay);
    if (!smartStudyActive) {
        targetWords = todayWords.slice();
        return;
    }
    const sessionNum = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`) || '1', 10);
    if (sessionNum >= 4) {
        targetWords = loadCycle4StudyWords().slice();
    } else if (hasExcludedSelectionDone()) {
        targetWords = buildStudyWordsFromExcluded(loadExcludedWordSet());
    } else {
        targetWords = fullDayWords.slice();
    }
}

function needsWordExclusionScreen(isReviewDay) {
    if (!isSmartStudyEligible(isReviewDay)) return false;
    const sessionNum = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`) || '1', 10);
    if (sessionNum !== 1) return false;
    return !hasExcludedSelectionDone();
}

function showWordExclusionScreen(onDone) {
    clearStudyCheckpoint();
    fullDayWords = todayWords.slice();
    smartStudyActive = true;
    const excluded = new Set();
    const total = fullDayWords.length;

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function applyExclChipStyle(row, isExcluded) {
        row.style.border = '1px solid ' + (isExcluded ? '#333' : 'rgba(0,243,255,0.35)');
        row.style.background = isExcluded ? 'rgba(0,0,0,0.4)' : 'rgba(0,243,255,0.06)';
        row.style.opacity = isExcluded ? '0.4' : '1';
        row.style.color = isExcluded ? '#666' : '#fff';
        row.style.textDecoration = isExcluded ? 'line-through' : 'none';
    }

    function bindExclWordRows() {
        document.querySelectorAll('.excl-word-chip').forEach(row => {
            row.onclick = () => {
                const idx = parseInt(row.getAttribute('data-idx'), 10);
                const wObj = fullDayWords[idx];
                if (!wObj || !wObj.word) return;
                if (excluded.has(wObj.word)) excluded.delete(wObj.word);
                else excluded.add(wObj.word);
                renderList(false);
            };
        });
    }

    function renderList(fullRebuild) {
        const studyCount = total - excluded.size;
        const listEl = document.getElementById('excl-word-list');

        if (!fullRebuild && listEl) {
            document.querySelectorAll('.excl-word-chip').forEach(row => {
                const idx = parseInt(row.getAttribute('data-idx'), 10);
                const wObj = fullDayWords[idx];
                if (!wObj || !wObj.word) return;
                applyExclChipStyle(row, excluded.has(wObj.word));
            });
            const countEl = document.getElementById('excl-study-count');
            if (countEl) countEl.textContent = String(studyCount);
            return;
        }

        const listHtml = fullDayWords.map((w, i) => {
            const isExcluded = excluded.has(w.word);
            return `<div class="excl-word-chip" data-idx="${i}" style="padding:8px 4px; border-radius:8px; border:1px solid ${isExcluded ? '#333' : 'rgba(0,243,255,0.35)'}; background:${isExcluded ? 'rgba(0,0,0,0.4)' : 'rgba(0,243,255,0.06)'}; opacity:${isExcluded ? '0.4' : '1'}; cursor:pointer; text-align:center; font-weight:bold; color:${isExcluded ? '#666' : '#fff'}; font-size:0.82rem; word-break:break-word; line-height:1.3; text-decoration:${isExcluded ? 'line-through' : 'none'};">${escHtml(w.word)}</div>`;
        }).join('');

        showSystemMessage(`
            <div style="text-align:center; padding:5px; max-width:100%;">
                <div style="font-size:1.2rem; color:var(--neon-blue); font-weight:bold; margin-bottom:8px;">아는 단어 제외</div>
                <p style="color:#888; font-size:0.9rem; margin-bottom:12px; line-height:1.5;">아는 단어를 탭해 학습에서 빼세요.<br><strong>3·5회 테스트는 ${total}개 전체</strong>입니다.</p>
                <div id="excl-word-list" style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; max-height:45vh; overflow-y:auto; margin-bottom:12px; padding:2px; overscroll-behavior:contain;">${listHtml}</div>
                <div style="color:#aaa; font-size:0.9rem; margin-bottom:12px;">학습 <strong id="excl-study-count" style="color:var(--neon-green);">${studyCount}</strong>개 · 테스트 <strong style="color:#fff;">${total}</strong>개</div>
                <button id="exclusion-start-btn" style="width:100%; padding:15px; background:var(--neon-green); color:#000; font-weight:bold; border-radius:10px; border:none; cursor:pointer;">선택 완료</button>
            </div>
        `);

        bindExclWordRows();
        const startBtn = document.getElementById('exclusion-start-btn');
        if (startBtn) {
            startBtn.onclick = () => {
                saveExcludedWords(Array.from(excluded));
                targetWords = shuffleWordList(buildStudyWordsFromExcluded(excluded));
                if (typeof onDone === 'function') onDone();
            };
        }
    }
    renderList(true);
}

function beginTestPhase() {
    score = 0;
    currentIdx = 0;
    if (smartStudyActive && fullDayWords.length > 0) {
        sessionTestWrongWords = [];
        targetWords = shuffleWordList(fullDayWords.slice());
    }
    startTest();
}

function startTodayWordsAfterPreReview() {
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
    applySmartStudyWordSets(isReviewDay);
    currentIdx = 0;
    score = 0;
    studyLoopCount = 1;
    if (needsWordExclusionScreen(isReviewDay)) {
        showWordExclusionScreen(() => startStudy());
    } else {
        startStudy();
    }
}
window.startTodayWordsAfterPreReview = startTodayWordsAfterPreReview;

// [QR 유입 경로 기억 로직] 즉시 실행형으로 교체 (43번 줄 아래)
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    // 1. QR 유입 경로 저장 (최초 1회)
    if (tabParam === 'analysis') {
        localStorage.setItem('trigger_user_origin', 'analysis_qr');
    }

    // 2. 저장된 유입 경로 확인
    const userOrigin = localStorage.getItem('trigger_user_origin');

    // 3. 분석 유입자라면 '시험 분석' 탭으로 즉시 고정
    if (tabParam === 'analysis' || userOrigin === 'analysis_qr') {
        // switchTab 함수가 로드될 때까지 0.01초 간격으로 체크해서 즉시 실행
        const checkSwitchTab = setInterval(function() {
            if (typeof switchTab === 'function') {
                switchTab('analysis');
                console.log("분석 유입자용 메인화면 강제 고정 완료");
                clearInterval(checkSwitchTab);
            }
        }, 10);
    }
})();

function startCountdown(message, callback) {
    __studyCkptPhase = 'pre_countdown';
    let count = 3;
    const renderHtml = (c) => `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:160px;">
            <div style="font-size:0.9rem; color:#888; margin-bottom:15px; text-shadow:none;">${message}</div>
            <div style="font-size:5.5rem; font-weight:900; color:var(--neon-orange); text-shadow: 0 0 20px var(--neon-orange); line-height:1;">${c}</div>
        </div>
    `;
    
    showSystemMessage(renderHtml(count));
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            showSystemMessage(renderHtml(count));
        } else {
            clearInterval(interval);
            callback();
        }
    }, 1000);
}

function wakeUpTTS() {
    window.speechSynthesis.cancel();
    let dummy = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(dummy);
}

function openGuide() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'flex';
}

function closeGuide() {
    const modal = document.getElementById('guide-modal');
    if (modal) {
        modal.style.display = 'none';
        localStorage.setItem('hasSeenGuide_2026', 'true');
    }
}

let isAppInitialized = false;

function loadCustomVocaPracticeList() {
    try {
        const mode = localStorage.getItem('trigger_custom_voca_mode');
        const raw = localStorage.getItem('voca_practice_list');
        if (!raw || !mode) return null;

        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return null;

        const normalized = list.map(x => {
            const word = x && x.word ? String(x.word).trim() : "";
            let meanings = [];
            if (Array.isArray(x && x.meanings)) meanings = x.meanings.map(m => String(m).trim()).filter(Boolean);
            else if (x && x.meaning) meanings = [String(x.meaning).trim()].filter(Boolean);
            else if (x && x.mean) meanings = [String(x.mean).trim()].filter(Boolean);
            return { word, meanings };
        }).filter(x => x.word && x.meanings && x.meanings.length > 0);

        if (normalized.length === 0) return null;

        return {
            mode,
            words: normalized,
            returnUrl: localStorage.getItem('trigger_custom_voca_return_url') || ''
        };
    } catch (e) {
        return null;
    }
}

function isStudyHtmlHost() {
    try {
        if (/\/study\.html/i.test(window.location.pathname || '')) return true;
        if (document.body && document.body.classList.contains('study-bg')) return true;
    } catch (e) {}
    return false;
}

function clearStudyCheckpoint() {
    try {
        sessionStorage.removeItem(STUDY_CHECKPOINT_KEY);
    } catch (e) {}
}

function saveStudyCheckpoint() {
    if (!isStudyHtmlHost()) return;
    if (!targetWords || targetWords.length < 1) return;
    const sessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
    const dayNow = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) || 1;
    const isReviewDay = (dayNow % 7 === 6 || dayNow % 7 === 0);
    if (needsWordExclusionScreen(isReviewDay)) return;
    try {
        const payload = {
            v: 2,
            level: currentLevel,
            day: dayNow,
            session: sessionRaw,
            preReview: !!isPreReviewMode,
            customSavedVoca: !!(window.__customVocaPractice && window.__customVocaPractice.active),
            firstWord: targetWords[0] && targetWords[0].word ? String(targetWords[0].word) : '',
            wordsJson: JSON.stringify(targetWords),
            fullDayWordsJson: smartStudyActive ? JSON.stringify(fullDayWords) : '',
            smartStudyActive: !!smartStudyActive,
            sessionTestWrongJson: smartStudyActive ? JSON.stringify(sessionTestWrongWords) : '[]',
            currentIdx,
            studyLoopCount,
            score,
            phase: __studyCkptPhase,
            reviewRetryCount
        };
        sessionStorage.setItem(STUDY_CHECKPOINT_KEY, JSON.stringify(payload));
    } catch (e) {}
}

function tryRestoreStudyCheckpoint(ctx) {
    if (!isStudyHtmlHost()) return null;
    let ck;
    try {
        const raw = sessionStorage.getItem(STUDY_CHECKPOINT_KEY);
        if (!raw) return null;
        ck = JSON.parse(raw);
    } catch (e) {
        return null;
    }
    if (!ck || (ck.v !== 1 && ck.v !== 2)) return null;
    const sessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
    const dayNow = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`), 10) || 1;
    if (ck.level !== currentLevel || ck.day !== dayNow || ck.session !== sessionRaw) return null;
    if (!!ck.preReview !== !!ctx.isPreReviewMode) return null;
    if (!!ck.customSavedVoca !== !!ctx.customSavedVoca) return null;
    if (ctx.customSavedVoca && ctx.firstCustomWord && ck.firstWord !== ctx.firstCustomWord) return null;

    let words;
    try {
        words = typeof ck.wordsJson === 'string' ? JSON.parse(ck.wordsJson) : ck.wordsJson;
    } catch (e) {
        return null;
    }
    if (!Array.isArray(words) || words.length < 1) return null;

    targetWords = words;
    if (ck.v >= 2) {
        smartStudyActive = !!ck.smartStudyActive;
        try {
            const fd = typeof ck.fullDayWordsJson === 'string' ? JSON.parse(ck.fullDayWordsJson) : [];
            fullDayWords = Array.isArray(fd) && fd.length > 0 ? fd : todayWords.slice();
        } catch (e) {
            fullDayWords = todayWords.slice();
        }
        try {
            sessionTestWrongWords = typeof ck.sessionTestWrongJson === 'string'
                ? JSON.parse(ck.sessionTestWrongJson) : [];
            if (!Array.isArray(sessionTestWrongWords)) sessionTestWrongWords = [];
        } catch (e) {
            sessionTestWrongWords = [];
        }
    }
    let idx = parseInt(ck.currentIdx, 10);
    if (Number.isNaN(idx) || idx < 0) idx = 0;
    currentIdx = Math.min(idx, targetWords.length);
    studyLoopCount = ck.studyLoopCount === 2 ? 2 : 1;
    score = parseInt(ck.score, 10) || 0;
    isPreReviewMode = !!ck.preReview;
    reviewRetryCount = parseInt(ck.reviewRetryCount, 10) || 0;

    let phase = ck.phase === 'test' || ck.phase === 'pre_countdown' ? ck.phase : 'study';
    return { phase, customSavedVoca: !!ck.customSavedVoca };
}

function runStudyHtmlEntryTail(sessionTag, currentSession, isReviewDay, restored) {
    const isCustomHost = !!(window.__customVocaPractice && window.__customVocaPractice.active);

    if (sessionTag) {
        if (isCustomHost) {
            sessionTag.innerText = `🧠 내 학습노트 단어 연습 (${targetWords.length}개)`;
            sessionTag.style.color = "var(--neon-green)";
        } else {
            let currentSessionVal = localStorage.getItem(`trigger_session_${currentLevel}`);

            if (currentSessionVal === 'final') {
                sessionTag.innerText = `최종 테스트 사이클 🔥`;
                sessionTag.style.color = "var(--neon-orange)";
            } else if (isReviewDay) {
                let sNum = parseInt(currentSessionVal) || 1;
                let displaySession = sNum >= 6 ? 2 : 1;
                sessionTag.innerText = sNum > DAILY_CYCLE_COUNT ? `자유 복습 모드` : `${displaySession} / 2 사이클 (주말복습)`;
                sessionTag.style.color = "";
            } else {
                let sNum = parseInt(currentSessionVal) || 1;
                sessionTag.innerText = sNum > DAILY_CYCLE_COUNT ? `자유 복습 모드` : `${sNum} / ${DAILY_CYCLE_COUNT} 사이클 진행 중`;
                sessionTag.style.color = "";
            }
        }
    }

    if (!isCustomHost) {
        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && parseInt(currentSession, 10) <= DAILY_CYCLE_COUNT && currentSession !== 'final') {
            clearStudyCheckpoint();
            showSystemMessage("잠시 쉬어주세요.<br>곧 다시 시작할 수 있습니다.");
            setTimeout(() => { location.href = 'index.html?tab=voca'; }, 1800);
            return;
        }
    }

    if (needsWordExclusionScreen(isReviewDay)) {
        clearStudyCheckpoint();
        showWordExclusionScreen(() => startStudy());
        return;
    }

    if (restored) {
        if (restored.phase === 'pre_countdown') {
            startCountdown("곧 테스트를 시작합니다.", beginTestPhase);
        } else if (restored.phase === 'test') {
            startTest();
        } else {
            startStudy(true);
        }
        return;
    }

    if (localStorage.getItem('trigger_jump_test') === 'true') {
        localStorage.removeItem('trigger_jump_test');
        currentIdx = 0;
        studyLoopCount = 2;
        score = 0;
        startCountdown("곧 테스트를 시작합니다.", beginTestPhase);
        return;
    }

    startStudy();
}

function initApp() {
    if (isAppInitialized) return; 
    isAppInitialized = true;

    wakeUpTTS(); 
    
if (typeof applyAdminPersistence === 'function') applyAdminPersistence();
    try {
        const sessionTag = document.getElementById('session-tag'); 
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        if (isAdminDayCompleteSharePreview()) {
            clearStudyCheckpoint();
            try {
                localStorage.removeItem('voca_practice_list');
                localStorage.removeItem('trigger_custom_voca_mode');
                localStorage.removeItem('trigger_custom_voca_return_url');
            } catch (e) {}
            if (sessionTag) {
                sessionTag.innerText = 'SYNC COMPLETE ◆ (관리자 미리보기)';
                sessionTag.style.color = 'var(--neon-green)';
            }
            const bar = document.getElementById('bar');
            if (bar) {
                bar.style.width = '100%';
                bar.style.backgroundColor = 'var(--neon-green)';
            }
            showStudyDayCompleteScreen(100);
            return;
        }

        // ✅ 분석 결과 페이지 → "사라져 VOCA로 나만의 단어 연습하기" 전용 모드
        // - 저장된 단어장으로만 학습
        // - 5초(뜻 보임) + 3초(뜻 숨김) + 2초(뜻 보임) 타이머는 기존 startStudy 그대로 사용
        // - 4지선다 테스트(복습 시스템)는 제외: 2회전 후 종료
        const custom = loadCustomVocaPracticeList();
        if (custom && custom.mode === 'saved_voca') {
            window.__customVocaPractice = { active: true, returnUrl: custom.returnUrl };
            targetWords = custom.words;

            const sessionForCk = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';

            const exitBtn = document.getElementById('exit-btn');
            const mainBackBtn = document.getElementById('main-back-btn');
            if (exitBtn) {
                const fallback = 'analysis.html';
                    const url = (custom.returnUrl && String(custom.returnUrl).trim()) ? String(custom.returnUrl) : fallback;
                // 분석 결과는 새로고침 시 DOM에 없음 → history.back 금지. 저장된 analysis URL로 이동 후 sessionStorage로 복원.
                window.customVocaGoBack = () => {
                    clearStudyCheckpoint();
                    try {
                        localStorage.removeItem('voca_practice_list');
                        localStorage.removeItem('trigger_custom_voca_mode');
                        localStorage.removeItem('trigger_custom_voca_return_url');
                    } catch (e) {}
                    if (/analysis\.html/i.test(url)) {
                        location.replace(url);
                    } else {
                        location.href = url;
                    }
                };
                exitBtn.onclick = () => { window.customVocaGoBack(); };
                if (mainBackBtn) mainBackBtn.onclick = () => { window.customVocaGoBack(); };
            }

            const restoreC = tryRestoreStudyCheckpoint({
                isPreReviewMode: false,
                customSavedVoca: true,
                firstCustomWord: custom.words[0] && custom.words[0].word
            });
            if (restoreC) {
                runStudyHtmlEntryTail(sessionTag, sessionForCk, false, restoreC);
                return;
            }

            currentIdx = 0;
            score = 0;
            studyLoopCount = 1;
            isPreReviewMode = false;

            if (sessionTag) {
                sessionTag.innerText = `🧠 내 학습노트 단어 연습 (${targetWords.length}개)`;
                sessionTag.style.color = "var(--neon-green)";
            }

            startStudy();
            return;
        }

        try {
            localStorage.removeItem('voca_practice_list');
            localStorage.removeItem('trigger_custom_voca_mode');
            localStorage.removeItem('trigger_custom_voca_return_url');
        } catch (e) {}

        const muteBtn = document.getElementById('mute-toggle-btn');
        if (muteBtn) muteBtn.innerText = isMuted ? '🔇' : '🔊';

        const today = new Date().toLocaleDateString();
        
        const startDayKey = `trigger_start_day_${currentLevel}_${today}`;
        if (!localStorage.getItem(startDayKey)) {
            const currentUnlocked = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
            localStorage.setItem(startDayKey, currentUnlocked);
        }
        const startDay = parseInt(localStorage.getItem(startDayKey));

       // [수정] 자정 초기화는 방지하고, 날짜 기록만 남깁니다.
        if (!localStorage.getItem('trigger_date')) localStorage.setItem('trigger_date', today);      
        let currentSession = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
        const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
        
        let week = Math.ceil(currentDay / 7);
        let localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;
        
        let dayData = null;
        if (typeof wordsData !== 'undefined' && wordsData[currentLevel] && wordsData[currentLevel]["week" + week]) {
            dayData = wordsData[currentLevel]["week" + week][String(localDay)];
        }

        if (!dayData || (startDay && currentDay >= startDay + 3)) {
            clearStudyCheckpoint();
            if (startDay && currentDay >= startDay + 3) {
                showSystemMessage(`뇌의 휴식이 필요합니다! 🧠<br>하루 최대 3일치까지만 학습 가능합니다.<br>내일 이어서 완주해 볼까요?`);
            } else {
                showSystemMessage(`Day ${currentDay} 데이터를<br>불러올 수 없습니다.`);
            }
            setTimeout(() => { location.href = 'index.html?tab=voca'; }, 2500);
            return;
        }

        const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);

        if (isReviewDay) {
            todayWords = getReviewWordsForDay(currentLevel, currentDay);
            if (!todayWords.length) {
                let allReviewWords = [];
                if (dayData && Array.isArray(dayData.test)) {
                    allReviewWords = dayData.test;
                } else if (Array.isArray(dayData)) {
                    allReviewWords = dayData;
                } else if (dayData && Array.isArray(dayData.review_parts)) {
                    allReviewWords = dayData.review_parts.flat();
                }
                const halfIndex = Math.ceil(allReviewWords.length / 2);
                if (currentDay % 7 === 6) {
                    todayWords = allReviewWords.slice(0, halfIndex);
                } else if (currentDay % 7 === 0) {
                    todayWords = allReviewWords.slice(halfIndex);
                }
            }
        } else {
            todayWords = dayData || []; 
        }

        if (!isReviewDay && currentDay > 1) {
            let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            let preReviewWords = allWrongs.filter(w => 
                w.level === currentLevel && 
                (parseInt(w.day) < currentDay) &&
                (w.isWrong === true || w.isStarred === true)
            );
            
            const reviewStatusKey = `trigger_review_done_${currentLevel}_${currentDay}`;
            if (preReviewWords.length > 0 && localStorage.getItem(reviewStatusKey) !== 'true') {
                isPreReviewMode = true;
                targetWords = preReviewWords;

                const restorePre = tryRestoreStudyCheckpoint({
                    isPreReviewMode: true,
                    customSavedVoca: false
                });
                if (restorePre) {
                    if (sessionTag) {
                        sessionTag.innerText = "🚨 망각 차단 복습 진행 중";
                        sessionTag.style.color = "var(--neon-orange)";
                    }
                    runStudyHtmlEntryTail(sessionTag, currentSession, isReviewDay, restorePre);
                    return;
                }

                showSystemMessage(`
                    <div style="text-align:center; padding:10px;">
                        <div style="font-size:1.3rem; color:var(--neon-orange); font-weight:bold; margin-bottom:15px;">망각 차단 1단계</div>
                        <p style="color:#ddd; font-size:1rem; margin-bottom:20px; line-height:1.5;">어제와 그저께 틀린 단어 <strong>${targetWords.length}개</strong>를<br>먼저 복습합니다.</p>
                        <button id="pre-review-start-btn" style="width:100%; padding:15px; background:var(--neon-orange); color:#000; font-weight:bold; border-radius:10px; border:none; cursor:pointer;">복습 시작하기</button>
                    </div>
                `);

                document.getElementById('pre-review-start-btn').onclick = () => {
                    
                    if (sessionTag) {
                        sessionTag.innerText = "🚨 망각 차단 복습 진행 중";
                        sessionTag.style.color = "var(--neon-orange)";
                    }
                    startStudy();
                };
                return; 
            } else {
                applySmartStudyWordSets(isReviewDay);
                isPreReviewMode = false; 
            }
        } else {
            applySmartStudyWordSets(isReviewDay);
            isPreReviewMode = false;
        }

        const restoreMain = tryRestoreStudyCheckpoint({ isPreReviewMode: false, customSavedVoca: false });
        runStudyHtmlEntryTail(sessionTag, currentSession, isReviewDay, restoreMain);
    } catch (err) {
        clearStudyCheckpoint();
        showSystemMessage("에러 발생: " + err.message);
        setTimeout(() => { location.href = 'index.html?tab=voca'; }, 3000);
    }
}

function playPronunciation(text, isManual = false) {
    if (isMuted && !isManual) return; 
    if (isPaused && !isManual) return; 

    try {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
    } catch(e) {} 
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('trigger_muted', isMuted);
    const btn = document.getElementById('mute-toggle-btn');
    if (btn) btn.innerText = isMuted ? '🔇' : '🔊';
}

function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pause-btn');
    const exitBtn = document.getElementById('exit-btn');
    
    if (isPaused) {
        if(pauseBtn) pauseBtn.innerText = "▶ 계속하기";
        if(exitBtn) exitBtn.style.display = "inline-block";
        window.speechSynthesis.pause(); 
    } else {
        if(pauseBtn) pauseBtn.innerText = "⏸ 일시중지";
        if(exitBtn) exitBtn.style.display = "none";
        window.speechSynthesis.resume(); 
    }
}

function startStudy(skipShuffle) {
    __studyCkptPhase = 'study';
    if (currentIdx === 0 && smartStudyActive && !skipShuffle) {
        const base = getStudyBaseList();
        targetWords = shuffleWordList(base);
    }
    const slot1 = document.getElementById('slot-1');
    const slot2 = document.getElementById('slot-2');

    if (studyLoopCount === 1) {
        if(slot1) slot1.classList.add('active');
        if(slot2) slot2.classList.remove('active');
    } else if (studyLoopCount === 2) {
        if(slot1) slot1.classList.add('active');
        if(slot2) slot2.classList.add('active');
    }

    if (currentIdx >= targetWords.length) {
        if (studyLoopCount < 2) {
            studyLoopCount++;
            currentIdx = 0; 
            startStudy();
            return;
        } else {
            currentIdx = 0;

            // 커스텀 연습 모드면 테스트/진도 처리 없이 여기서 종료
            if (window.__customVocaPractice && window.__customVocaPractice.active) {
                const returnUrl = window.__customVocaPractice.returnUrl || '';
                window.__customVocaPractice.active = false;
                clearStudyCheckpoint();

                showSystemMessage(`
                    <div style="text-align:center; padding:10px;">
                        <div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold; margin-bottom:10px;">연습 완료!</div>
                        <p style="color:#888; margin:0 0 18px 0; line-height:1.5;">TRIGGER VOCA 방식(5초→3초→마지막 뜻)으로<br>2회전 학습이 끝났습니다.</p>
                        <button onclick="location.reload()" style="width:100%; padding:16px; background:var(--neon-blue); color:#fff; border-radius:12px; border:none; font-weight:bold; cursor:pointer;">한 번 더 연습하기</button>
                        <button onclick="(window.customVocaGoBack ? window.customVocaGoBack() : (location.href='${returnUrl ? String(returnUrl).replace(/'/g, "\\'") : "analysis.html"}'))" style="width:100%; padding:14px; margin-top:10px; background:transparent; border:1px solid #444; color:#aaa; border-radius:12px; font-weight:bold; cursor:pointer;">분석 결과로 돌아가기</button>
                    </div>
                `);
                return;
            }

            const currentSessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
            const sNum = parseInt(currentSessionRaw); 

            if (sNum === 3 || sNum === DAILY_CYCLE_COUNT || currentSessionRaw === 'final' || isPreReviewMode) {
                score = 0; 
                startCountdown("곧 테스트를 시작합니다.", beginTestPhase); 
            } else {
                finishSession(false);
            }
            return;
        }
    }

    const data = targetWords[currentIdx];
    updateUI(data); 
    
    const items = document.querySelectorAll('#meanings div');
    const bar = document.getElementById('bar');
    
    items.forEach(item => {
        item.style.opacity = "1";
        item.style.transition = "opacity 0.2s ease";
    });

    if (data && data.word) {
        playPronunciation(data.word);
    }

    let time = 9000; 
    let hasPlayedSecondTTS = false; 
    
    const interval = setInterval(() => {
        if (isPaused) return; 
        
        time -= 100;

        if (time > 5000) {
            items.forEach(item => item.style.opacity = "1");
            if (bar) bar.style.backgroundColor = "var(--neon-blue)";
        } 
        
        if (time <= 7000 && !hasPlayedSecondTTS) {
            if (data && data.word) playPronunciation(data.word);
            hasPlayedSecondTTS = true;
        }

        if (time <= 5000 && time > 2000) {
            items.forEach(item => item.style.opacity = "0"); 
            if (bar) bar.style.backgroundColor = "var(--neon-orange)";
        } 
        else if (time <= 2000) {
            items.forEach(item => item.style.opacity = "1"); 
            if (bar) bar.style.backgroundColor = "var(--neon-green)";
        }

        if(bar) bar.style.width = (time / 9000 * 100) + "%";

        if (time <= 0 || currentIdx >= targetWords.length) { 
            clearInterval(interval);
            if (time <= 0) currentIdx++;
            setTimeout(startStudy, 200);
        }
    }, 100);
    
    window.currentTimer = interval;
}

function startTest() {
    __studyCkptPhase = 'test';
    if (currentIdx >= targetWords.length) {
        finishSession(true); 
        return;
    }

    const data = targetWords[currentIdx];
    updateUI(data, true);

    let time = 5000; 
    const interval = setInterval(() => {
        if (isPaused) return;
        
        time -= 100;
        const bar = document.getElementById('bar');
        if(bar) bar.style.width = (time / 5000 * 100) + "%";
        if (time <= 0 || currentIdx >= targetWords.length) { 
            clearInterval(interval); 
            if (time <= 0) handleAnswer(false); 
        }
    }, 100);
    window.currentTimer = interval;
}

function toggleStar(wordObj) {
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    const idx = wrongWords.findIndex(w => w.word === wordObj.word && w.level === currentLevel);
    
    const starBtn = document.getElementById('star-btn');
    
    if (idx > -1) {
        if (wrongWords[idx].isStarred) {
            // 1. 이미 별표인 경우 -> 별표 해제
            wrongWords[idx].isStarred = false;
            // 만약 오답(isWrong) 기록도 없다면 리스트에서 아예 제거
            if (!wrongWords[idx].isWrong) {
                wrongWords.splice(idx, 1); 
            }
            if(starBtn) starBtn.innerText = "☆";
        } else {
            // 2. 오답이라서 리스트엔 있지만 별표는 아닌 경우 -> 별표 추가
            wrongWords[idx].isStarred = true;
            if(starBtn) starBtn.innerText = "⭐";
        }
    } else {
        // 3. 리스트에 아예 없는 단어 -> 별표 단어로 새로 추가
        wrongWords.push({ ...wordObj, day: currentDay, level: currentLevel, isStarred: true }); 
        if(starBtn) starBtn.innerText = "⭐";
    }
    
    localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));

    const wrongWordCountEl = document.getElementById('wrong-word-count');
if (wrongWordCountEl) {
    // 1. 별표를 빼서 실제 데이터는 3개가 된 상태
    const levelWrongs = wrongWords.filter(w => w.level === currentLevel);
    // 2. 메인 화면의 글자도 즉시 "3 단어"로 다시 써줌
    wrongWordCountEl.innerText = `${levelWrongs.length} 단어`;
}
}

function fontSizeForStudyWord(word) {
    const n = (word || '').length;
    if (n <= 7) return '3.3rem';
    if (n <= 9) return '2.85rem';
    if (n <= 11) return '2.45rem';
    if (n <= 13) return '2.05rem';
    if (n <= 16) return '1.7rem';
    return '1.45rem';
}

function updateUI(data, isTest = false) {
    const targetEl = document.getElementById('target');
    const mBox = document.getElementById('meanings');
    const headerEl = document.querySelector('.header');
    const displayEl = document.getElementById('display');

    if (!targetEl || !mBox || !data) return;

    if (headerEl) headerEl.classList.toggle('test-phase-header', isTest);
    if (displayEl) displayEl.classList.toggle('test-phase', isTest);

    const oldCounter = document.getElementById('session-counter');
    if (oldCounter) oldCounter.remove();

    const currentNum = currentIdx + 1;
    const totalNum = targetWords.length;
    const counterLabel = isTest
        ? (smartStudyActive && fullDayWords.length > 0 ? '테스트 진행 (전체)' : '테스트 진행')
        : (smartStudyActive && fullDayWords.length > targetWords.length ? '학습 진행' : '학습 진행');
    const counterGap = isTest ? 'margin-top: 10px; margin-bottom: 0;' : 'margin-top: 5px; margin-bottom: 2px;';

    const counterHtml = `
        <div id="session-counter" style="text-align: center; ${counterGap} font-family: 'Pretendard', sans-serif; width: 100%;">
            <div style="font-size: 0.9rem; color: #666; font-weight: 800; margin-bottom: 4px;">${counterLabel}</div>
            <div style="font-size: 1rem; color: #aaa; font-weight: bold;">
                <span style="color: var(--neon-blue); font-size: 1.1rem;">${currentNum}</span> 
                <span style="color: #444; margin: 0 2px;">/</span> 
                ${totalNum}${smartStudyActive && !isTest && fullDayWords.length > totalNum ? `<span style="color:#555; font-size:0.85rem;"> (테스트 ${fullDayWords.length}개)</span>` : ''}
            </div>
        </div>
    `;
    
    if (headerEl) {
        headerEl.insertAdjacentHTML('beforeend', counterHtml);
    }

    let safeMeanings = Array.isArray(data.meanings) ? data.meanings : (data.meaning ? [data.meaning] : ["뜻 확인 필요"]);
    const fullMeaning = safeMeanings.join(', ');

    const wordFontSize = fontSizeForStudyWord(data.word);
    targetEl.style.setProperty('font-size', '1rem', 'important');
    targetEl.style.setProperty('text-shadow', '0 0 8px rgba(255, 255, 255, 0.45)', 'important');
    targetEl.style.setProperty('color', '#fff', 'important');
    targetEl.style.setProperty('width', '100%', 'important');
    targetEl.style.setProperty('box-sizing', 'border-box', 'important');
    if (isTest) {
        targetEl.style.removeProperty('margin-top');
        mBox.style.marginTop = '';
    } else {
        targetEl.style.setProperty('margin-top', '-40px', 'important');
        mBox.style.marginTop = '';
    }

    if (!isTest) {
        targetEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; width:100%; box-sizing:border-box; padding:0 4px;">
                <div class="study-word-row">
                    <span class="study-star-spacer" style="font-size:1.8rem; visibility:hidden; pointer-events:none;">☆</span>
                    <span class="study-word-text" style="cursor:pointer; font-size:${wordFontSize}; font-weight:bold;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</span>
                    <button id="star-btn" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:var(--neon-orange); padding:0 0 5px 0;">☆</button>
                </div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>`;
        mBox.innerHTML = safeMeanings.map(m => `<div style="font-size:2.2rem; font-weight:bold; margin-bottom:15px;">${m}</div>`).join('');
        
        const starBtn = document.getElementById('star-btn');
        if(starBtn) {
            let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            // 🎯 수정: 리스트에 있으면서 'isStarred'가 true일 때만 노란 별(⭐)로 표시되도록 수정
            const isStarred = wrongWords.some(w => w.word === data.word && w.level === currentLevel && w.isStarred);
            starBtn.innerText = isStarred ? "⭐" : "☆";
            starBtn.onclick = (e) => { e.stopPropagation(); toggleStar(data); };
        }
    } else {
        targetEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; width:100%; box-sizing:border-box; padding:0 16px;">
                <div class="study-word-text" style="font-size:${wordFontSize}; font-weight:bold; cursor:pointer; text-align:center; line-height:1.15; word-break:break-word; max-width:100%;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>`;
        
        let dictPool = [];
        if (typeof wordsData !== 'undefined' && wordsData[currentLevel]) {
            Object.values(wordsData[currentLevel]).forEach(week => {
                Object.values(week).forEach(dayEntry => {
                    const list = Array.isArray(dayEntry) ? dayEntry : (dayEntry.test || []);
                    list.forEach(w => {
                        const m = Array.isArray(w.meanings) ? w.meanings.join(', ') : w.meaning;
                        if (m && m !== fullMeaning) dictPool.push(m);
                    });
                });
            });
        }
        dictPool = [...new Set(dictPool)];
        let filteredPool = dictPool.filter(m => !window.lastWrongOptions.includes(m));
        if (filteredPool.length < 3) filteredPool = dictPool;
        let selectedWrongs = filteredPool.sort(() => Math.random() - 0.5).slice(0, 3);
        window.lastWrongOptions = selectedWrongs;

        const choices = [fullMeaning, ...selectedWrongs].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `
                <button class="choice-btn" style="font-size: 1.4rem !important; min-height: 92px !important; height: auto !important; margin-bottom: 20px !important; font-weight: bold; width: 100%; max-width: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 14px 22px !important; line-height: 1.25; word-break: keep-all; box-sizing: border-box;" 
                onclick="handleAnswer(${c === fullMeaning})">${c}</button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    if (window.currentTimer) clearInterval(window.currentTimer);
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentWordData = targetWords[currentIdx];
    
    if (!currentWordData) return;

    let masterWrongDB = JSON.parse(localStorage.getItem('trigger_master_wrong_db') || '[]');

    if (isCorrect) {
        score++;
        
        const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
        let currentSessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`);
        let isFinalStep = (currentSessionRaw === String(DAILY_CYCLE_COUNT) || currentSessionRaw === 'final' || (isReviewDay && currentSessionRaw === '2'));

        if (!isFinalStep) {
            const idx = wrongWords.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
            if (idx > -1) {
                // 🎯 수정: 학생이 수동으로 '별표'를 친 단어는 맞혀도 보호 (직접 끄게 유도)
                if (!wrongWords[idx].isStarred) {
                    wrongWords.splice(idx, 1);
                    localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
                }
            }
        }
    } else {
        // [오답 시 처리] 3회차 중간 테스트는 무시하고 5회/최종만 리스트에 저장
        const currentSessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`);

        if (smartStudyActive && currentSessionRaw === '3') {
            if (!sessionTestWrongWords.some(w => w.word === currentWordData.word)) {
                sessionTestWrongWords.push({ ...currentWordData });
            }
        }
        
        if (currentSessionRaw !== '3') {
            const idx = wrongWords.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
            if (idx === -1) {
                // 🎯 수정: 틀려도 isStarred는 넣지 않고, isWrong만 표시하여 강제 별표 방지
                wrongWords.push({ 
                    ...currentWordData, 
                    day: currentDay, 
                    level: currentLevel, 
                    isWrong: true 
                });
            } else {
                wrongWords[idx].isWrong = true;
            }
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
            
            // 메인 화면 숫자 즉시 업데이트
            const countEl = document.getElementById('wrong-word-count');
            if (countEl) {
                const levelWrongs = wrongWords.filter(w => w.level === currentLevel);
                countEl.innerText = `${levelWrongs.length} 단어`;
            }
        }

        // 🎯 괄호 오류 수정: [원장님용] 마스터 DB에는 오답 무조건 기록되도록 정상 배치
        const masterDB = JSON.parse(localStorage.getItem('trigger_master_wrong_db') || '[]');
        const mIdx = masterDB.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
        if (mIdx === -1) {
            masterDB.push({ 
                word: currentWordData.word, 
                meanings: currentWordData.meanings, 
                level: currentLevel, 
                day: currentDay, 
                wrongCount: 1 
            });
        } else {
            masterDB[mIdx].wrongCount++;
        }
        localStorage.setItem('trigger_master_wrong_db', JSON.stringify(masterDB)); // <-- 이름을 masterDB로 통일!
    }

    currentIdx++;
    startTest();
}

function finishSession(didTest = true) {
    clearStudyCheckpoint();
    let currentSessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
    let currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    const testTotal = (didTest && smartStudyActive && fullDayWords.length > 0)
        ? fullDayWords.length
        : targetWords.length;
    const accuracy = testTotal > 0 ? Math.floor((score / testTotal) * 100) : 0;

    if (smartStudyActive && didTest && currentSessionRaw === '3') {
        saveCycle4StudyWords(sessionTestWrongWords);
    }
    
    if (isPreReviewMode) {
        const sessionTag = document.getElementById('session-tag');

        if (didTest && accuracy >= 80) {
            const reviewStatusKey = `trigger_review_done_${currentLevel}_${currentDay}`;
            localStorage.setItem(reviewStatusKey, 'true');
            clearBlacktCooldownNotifySchedule();
            localStorage.removeItem('blackt_cooldown');
            reviewRetryCount = 0; 
    
            isPreReviewMode = false;

            if (sessionTag) {
                sessionTag.innerText = `1 / ${DAILY_CYCLE_COUNT} 사이클 진행 중`;
                sessionTag.style.color = ""; 
            }
    
            showSystemMessage(`
                <div style="text-align:center;">
                    <div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold;">망각 차단 CLEAR ◆</div>
                    <p style="color:#ddd; margin-top:10px;">잠시 후 <strong>오늘의 신규 단어</strong>를<br>바로 시작합니다!</p>
                    <div style="margin-top:20px; color:var(--neon-blue); font-size:1.2rem; font-weight:bold;">Ready...</div>
                </div>
            `);
    
            setTimeout(() => {
                startTodayWordsAfterPreReview();
            }, 1500); 
    
        } else {
            reviewRetryCount++;

            if (reviewRetryCount >= 2) {
                const reviewStatusKey = `trigger_review_done_${currentLevel}_${currentDay}`;
                localStorage.setItem(reviewStatusKey, 'true');
                reviewRetryCount = 0; 

                isPreReviewMode = false;

                if (sessionTag) {
                    sessionTag.innerText = `1 / ${DAILY_CYCLE_COUNT} 사이클 진행 중`;
                    sessionTag.style.color = "";
                }

                showSystemMessage(`
                    <div style="text-align:center;">
                        <div style="font-size:1.5rem; color:var(--neon-orange); font-weight:bold;">⚠️ 집중 학습 대상</div>
                        <p style="color:#888; margin-top:10px;">2회 연속 기준 미달입니다.<br>해당 단어는 오답 리스트에서 확인하고<br>우선 오늘 진도부터 나갑니다.</p>
                        <button onclick="startTodayWordsAfterPreReview()" style="width:100%; padding:16px; background:var(--neon-blue); color:#fff; border-radius:12px; margin-top:20px; border:none; font-weight:bold;">오늘 단어 시작하기</button>
                    </div>
                `);
            } else {
                let warningText = accuracy < 50 ? "⚠️ 집중력 경보!" : "아쉬운 점수!";
                showSystemMessage(`
                    <div style="text-align:center;">
                        <div style="font-size:1.5rem; color:var(--neon-orange); font-weight:bold;">${warningText} (${accuracy}%)</div>
                        <p style="color:#888; margin-top:10px;">기준 미달입니다. <strong>마지막 한 번의 기회</strong>가<br>더 남았습니다. 집중해 보세요!</p>
                        <button onclick="retryOnlyWrongs()" style="width:100%; padding:16px; background:var(--neon-blue); color:#fff; border-radius:12px; margin-top:20px; border:none; font-weight:bold;">마지막 복습 재도전</button>
                    </div>
                `);
            }
        }
        return; 
    }
    
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
    const today = new Date().toLocaleDateString();
    
    let totalSessions = isReviewDay ? 2 : DAILY_CYCLE_COUNT;
    let finishedNum = 0;

    if (currentSessionRaw === 'final') {
        finishedNum = totalSessions;
    } else {
        finishedNum = parseInt(currentSessionRaw);
    }

    if (finishedNum > totalSessions) finishedNum = totalSessions;
    let progressPercent = Math.floor((finishedNum / totalSessions) * 100);
    
    localStorage.setItem(`trigger_progress_${currentLevel}_${currentDay}`, progressPercent);

    let stats = JSON.parse(localStorage.getItem(`trigger_stats_${currentLevel}`) || '{}');
    if (!stats[currentDay]) stats[currentDay] = { progress: 0, accuracy: 0 };
    stats[currentDay].progress = progressPercent;

    let currentSessionDisplay = finishedNum >= totalSessions ? "SYNC ◆" : `${finishedNum} / ${totalSessions} 사이클`;
    stats[currentDay].status = currentSessionDisplay;

    if (didTest && accuracy < 80 && (currentSessionRaw === String(DAILY_CYCLE_COUNT) || (isReviewDay && currentSessionRaw === '2'))) {
        localStorage.setItem(`trigger_session_${currentLevel}`, 'final'); 
        
        let warningText = "아쉬운 점수!";
        if (accuracy < 50) warningText = "⚠️ 집중력 경보!";
        
        showSystemMessage(`
            <div style="text-align:center;">
                <div style="font-size:1.5rem; color:var(--neon-orange); font-weight:bold;">${warningText} (${accuracy}%)</div>
                <p style="color:#888; margin-top:10px;">기준 미달로 최후의 사이클을 진행합니다.</p>
                <button onclick="retryOnlyWrongs()" style="width:100%; padding:16px; background:var(--neon-blue); color:#fff; border-radius:12px; margin-top:20px; border:none; font-weight:bold;">최후의 사이클 시작</button>
            </div>
        `);
        return;
    }

    if ((finishedNum >= totalSessions || currentSessionRaw === 'final') && didTest) {
        let unlocked = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
        const startDayKey = `trigger_start_day_${currentLevel}_${today}`;
        const startDay = parseInt(localStorage.getItem(startDayKey)) || unlocked;

        if (unlocked === currentDay && (unlocked < startDay + 3)) {
            localStorage.setItem(`trigger_unlocked_day_${currentLevel}`, unlocked + 1);
        }
        
        stats[currentDay].accuracy = accuracy;
        localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));

        clearSmartStudyDayState(currentLevel, currentDay);
        localStorage.setItem(`trigger_current_day_${currentLevel}`, currentDay + 1);
        localStorage.setItem(`trigger_session_${currentLevel}`, '1');

        if ((currentSessionRaw === String(DAILY_CYCLE_COUNT) || currentSessionRaw === 'final' || (isReviewDay && currentSessionRaw === '2')) && accuracy >= 80) {
            if (currentDay === 70) {
                const giftSection = document.getElementById('final-gift-section');
                if (giftSection) {
                    giftSection.style.display = 'block';
                    const guideText = document.getElementById('pdf-guide-text');
                    if (guideText) guideText.innerHTML = '🏆 10주 완주! 단어장·주차 보너스는 아래에서, 최종 오답 시험지는 하단에서 받으세요.';
                    window.scrollTo({ top: giftSection.offsetTop, behavior: 'smooth' });
                }
            }
        }

        let creditEarnedHtml = '';
        if (accuracy >= 80 && typeof TriggerCredit !== 'undefined') {
            const dailyResult = TriggerCredit.earnDailyComplete(currentLevel, currentDay, accuracy);
            const weekResult = TriggerCredit.tryWeekBonus(currentLevel, currentDay);
            creditEarnedHtml = TriggerCredit.formatEarnedHtml(dailyResult, weekResult);
        }
        showStudyDayCompleteScreen(accuracy, currentDay, creditEarnedHtml);
    } else {
        localStorage.setItem(`trigger_session_${currentLevel}`, (finishedNum + 1).toString());
        localStorage.setItem('blackt_cooldown', Date.now() + COOL_DOWN_TIME);
        scheduleBlacktCooldownEndNotification();
        localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));
        
        if (didTest) {
            let resTitle = "TEST 통과!";
            let resColor = "var(--neon-blue)";
            let resMsg = "3분 휴식 후 다음 사이클이 열립니다.";
    
            if (accuracy < 50) {
                resTitle = "⚠️ 집중력 경보!";
                resColor = "var(--neon-orange)";
                resMsg = "지금은 뇌가 쉬고 싶어 하네요.<br>다음번엔 조금 더 집중해 보세요!";
            } else if (accuracy < 80) {
                resTitle = "거의 다 왔어요! 🤏";
                resColor = "var(--neon-blue)";
                resMsg = "헷갈린 단어들을 조금 더 집중해서 보세요.";
            } else {
                resTitle = "MISSION COMPLETE! 🔥";
                resColor = "var(--neon-green)";
                resMsg = "완벽합니다! 이 기세를 이어가세요.";
            }
    
            showSystemMessage(`
                <div style="text-align:center;">
                    <div style="font-size:1.5rem; color:${resColor}; font-weight:bold;">${resTitle} (${accuracy}%)</div>
                    <p style="color:#888; font-size:0.95rem; margin-top:10px;">${resMsg}</p>
                    <button onclick="location.href='index.html?tab=voca'" style="width:100%; padding:16px; background:#333; color:#fff; border-radius:12px; margin-top:20px; border:none; font-weight:bold;">확인</button>
                </div>
            `);
        } else {
            showSystemMessage("사이클 완료! 🔥");
            setTimeout(() => { location.href = 'index.html?tab=voca'; }, 2200);
        }
    }
}

function updateMasteredCount() {
    const level = localStorage.getItem('trigger_level') || 'middle';
    let totalCount = 0;
    
    if (wordsData[level]) {
        Object.values(wordsData[level]).forEach(week => {
            Object.values(week).forEach(day => {
                const dayList = Array.isArray(day) ? day : (day.test || []);
                totalCount += dayList.length;
            });
        });
    }

    let stats = JSON.parse(localStorage.getItem(`trigger_stats_${level}`) || '{}');
    let mastered = 0;
    Object.keys(stats).forEach(dayNum => {
        if (stats[dayNum].progress === 100) {
            mastered += 24; 
        }
    });

    const totalVocabEl = document.getElementById('total-vocab-count');
    const masteredCountEl = document.getElementById('mastered-count');
    if(totalVocabEl) totalVocabEl.innerText = totalCount;
    if(masteredCountEl) masteredCountEl.innerText = mastered;
}

function retryOnlyWrongs() {
    score = 0; 
    let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    
    if (isPreReviewMode) {
        targetWords = allWrongs.filter(w => 
            w.level === currentLevel && 
            (parseInt(w.day) < currentDay) &&
            (w.isWrong === true || w.isStarred === true)
        );
        const sessionTag = document.getElementById('session-tag');
        if (sessionTag) {
            sessionTag.innerText = `망각 차단 복습 재도전`;
            sessionTag.style.color = "var(--neon-orange)";
        }
    } else {
        let retryList = allWrongs.filter(w => w.level === currentLevel && w.day === currentDay);
        if (retryList.length < 1) retryList = todayWords;
        targetWords = retryList;
        const sessionTag = document.getElementById('session-tag');
        if (sessionTag) {
            sessionTag.innerText = `최후의 사이클 1 / 1`;
            sessionTag.style.color = "var(--neon-orange)";
        }
    }
    
    currentIdx = 0;
    studyLoopCount = 2; 
    startStudy();
}

// [수정 완료] 학습 종료 후 나타나는 카카오톡 공유 기능
/** 주차별 Day 1~5 신규 단어 전체 (달력·하루 진도량과 무관, 6·7일 복습 풀) */
function getWeekNewWordsPool(level, weekNum) {
    if (typeof wordsData === 'undefined' || !wordsData[level]) return [];
    const weekData = wordsData[level]['week' + weekNum];
    if (!weekData) return [];
    const pool = [];
    const seen = new Set();
    for (let localD = 1; localD <= 5; localD++) {
        const dayData = weekData[String(localD)];
        if (!Array.isArray(dayData)) continue;
        for (const w of dayData) {
            const key = String((w && w.word) || '').trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            pool.push(w);
        }
    }
    return pool;
}

/** 6·7일차: 해당 주 1~5일치 전량을 이틀에 나눠 복습 */
function getReviewWordsForDay(level, absoluteDay) {
    const localDay = absoluteDay % 7 === 0 ? 7 : absoluteDay % 7;
    if (localDay !== 6 && localDay !== 7) return [];
    const weekNum = Math.ceil(absoluteDay / 7);
    const pool = getWeekNewWordsPool(level, weekNum);
    if (!pool.length) return [];
    const halfIndex = Math.ceil(pool.length / 2);
    if (localDay === 6) return pool.slice(0, halfIndex);
    return pool.slice(halfIndex);
}

function getWordsForDay(level, absoluteDay) {
    if (typeof wordsData === 'undefined' || !wordsData[level]) return [];
    const week = Math.ceil(absoluteDay / 7);
    const localDay = absoluteDay % 7 === 0 ? 7 : absoluteDay % 7;
    if (localDay === 6 || localDay === 7) {
        const fromPool = getReviewWordsForDay(level, absoluteDay);
        if (fromPool.length) return fromPool;
    }
    const weekData = wordsData[level]['week' + week];
    if (!weekData) return [];
    const dayData = weekData[String(localDay)];
    if (!dayData) return [];
    if ((localDay === 6 || localDay === 7) && !Array.isArray(dayData)) {
        const legacy = dayData.test || [];
        const halfIndex = Math.ceil(legacy.length / 2);
        return localDay === 6 ? legacy.slice(0, halfIndex) : legacy.slice(halfIndex);
    }
    return Array.isArray(dayData) ? dayData : [];
}

function copyTextForShareFallback(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(() => true);
        }
    } catch (e) {}
    return new Promise((resolve) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            resolve(ok);
        } catch (e) {
            resolve(false);
        }
    });
}

const KAKAO_APP_KEY = 'fbb1520306ffaad0a882e993109a801c';
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js';

function ensureKakaoSdkReady() {
    return new Promise((resolve) => {
        const ready = () => {
            try {
                if (typeof Kakao !== 'undefined' && Kakao && !Kakao.isInitialized()) {
                    Kakao.init(KAKAO_APP_KEY);
                }
            } catch (e) {}
            resolve(typeof Kakao !== 'undefined' && Kakao && Kakao.isInitialized());
        };
        if (typeof Kakao !== 'undefined' && Kakao) {
            ready();
            return;
        }
        let inject = document.querySelector('script[data-trigger-kakao-sdk="1"]');
        if (inject) {
            inject.addEventListener('load', ready, { once: true });
            inject.addEventListener('error', () => resolve(false), { once: true });
            return;
        }
        inject = document.createElement('script');
        inject.src = KAKAO_SDK_URL;
        inject.async = true;
        inject.setAttribute('data-trigger-kakao-sdk', '1');
        inject.onload = ready;
        inject.onerror = () => resolve(false);
        document.head.appendChild(inject);
    });
}

function buildVocaShareBundle() {
    const userName = localStorage.getItem('trigger_name') || '학습자';
    let displayDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    if (localStorage.getItem(`trigger_session_${currentLevel}`) === '1' && displayDay > 1) displayDay--;

    const st =
        typeof TriggerPraise !== 'undefined' && TriggerPraise.statsFromStorage
            ? TriggerPraise.statsFromStorage('voca')
            : { n: userName, d: displayDay, t: 0, k: 'voca' };
    if (typeof TriggerPraise === 'undefined' || !TriggerPraise.statsFromStorage) {
        let learnedTotal = 0;
        const unlockedDay = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
        for (let i = 1; i < unlockedDay; i++) {
            if (i % 7 === 6 || i % 7 === 0) continue;
            learnedTotal += getWordsForDay(currentLevel, i).length;
        }
        st.t = learnedTotal;
        st.d = displayDay;
        st.n = userName;
    }
    const pc =
        typeof TriggerPraise !== 'undefined' && TriggerPraise.encodePc ? TriggerPraise.encodePc(st) : '';
    const pcQ = pc ? 'pc=' + encodeURIComponent(pc) : '';
    const shareUrl = kakaoShareReceiverUrl('share_result=1' + (pcQ ? '&' + pcQ : ''));
    const praiseShareUrl = kakaoShareReceiverUrl('praise=true' + (pcQ ? '&' + pcQ : ''));

    let badgeLine = '';
    try {
        if (typeof TriggerPraise !== 'undefined' && TriggerPraise.kakaoSubtitleLine) {
            badgeLine = TriggerPraise.kakaoSubtitleLine(st) || '';
        }
    } catch (e) {
        badgeLine = '';
    }

    const title = `🔥 [${st.n}]님, 단어 학습 완료!`;
    const description = `누적 클리어: ${st.t} 단어\n오늘의 진도: Day ${st.d}\n\n오늘도 목표를 달성했습니다! 칭찬 배지를 보내주세요.${badgeLine ? '\n\n' + badgeLine : ''}`;
    const clipboardText = `${title}\n${description}\n\n${shareUrl}\n\n칭찬 배지: ${praiseShareUrl}`;

    return {
        shareUrl,
        praiseShareUrl,
        title,
        description,
        clipboardText,
        payload: {
            objectType: 'feed',
            content: {
                title,
                description,
                imageUrl: triggerPagesImgUrl('share-v2.png') + '?v=3',
                link: { mobileWebUrl: shareUrl, webUrl: shareUrl }
            },
            buttons: [
                { title: '결과 자세히 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
                { title: '👍 칭찬 응원 배지 보내기', link: { mobileWebUrl: praiseShareUrl, webUrl: praiseShareUrl } }
            ]
        }
    };
}

function tryKakaoSdkShare(payload, timeoutMs) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            resolve(!!ok);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        ensureKakaoSdkReady().then((ok) => {
            if (!ok) {
                clearTimeout(timer);
                finish(false);
                return;
            }
            try {
                const ret = Kakao.Share.sendDefault(payload);
                if (ret && typeof ret.then === 'function') {
                    ret
                        .then(() => {
                            clearTimeout(timer);
                            finish(true);
                        })
                        .catch(() => {
                            clearTimeout(timer);
                            finish(false);
                        });
                }
            } catch (e) {
                clearTimeout(timer);
                finish(false);
            }
        });
    });
}

function tryNativeWebShare(bundle) {
    if (!navigator.share) return Promise.resolve(false);
    return navigator
        .share({
            title: bundle.title,
            text: bundle.description,
            url: bundle.shareUrl
        })
        .then(() => true)
        .catch((e) => {
            if (e && e.name === 'AbortError') return true;
            return false;
        });
}

function shareKakao() {
    stopStudyTimersAndSpeech();
    let bundle;
    try {
        bundle = buildVocaShareBundle();
    } catch (e) {
        alert('공유 정보를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
        return Promise.resolve();
    }

    const alertCopied = () => {
        alert(
            '✅ 공유 문구를 복사했어요.\n\n카톡 채팅창을 연 뒤 입력창을 길게 눌러 「붙여넣기」로 보내 주세요.\n(공유 창이 안 뜨는 환경에서는 이 방법이 가장 확실해요.)'
        );
    };
    const alertCopyFailed = () => {
        alert('자동 복사에 실패했어요. 아래 주소를 직접 복사해 카톡에 보내 주세요.\n\n' + bundle.shareUrl);
    };

    const onShareSuccess = function () {
        if (typeof TriggerCredit === 'undefined') return;
        var added = TriggerCredit.earnKakaoShare();
        if (added > 0) {
            TriggerCredit.updateDisplay();
        }
    };

    return (async function deliverKakaoShare() {
        const copiedInBg = copyTextForShareFallback(bundle.clipboardText);

        if (await tryKakaoSdkShare(bundle.payload, 2200)) {
            onShareSuccess();
            return;
        }

        if (await tryNativeWebShare(bundle)) {
            onShareSuccess();
            return;
        }

        const copied = await copiedInBg;
        if (copied) {
            onShareSuccess();
            alertCopied();
        } else alertCopyFailed();
    })().catch(() => {
        copyTextForShareFallback(bundle.clipboardText).then((ok) => {
            if (ok) onShareSuccess();
            ok ? alertCopied() : alertCopyFailed();
        });
    });
}

window.shareKakao = shareKakao;

function isAdminDayCompleteSharePreview() {
    try {
        if (localStorage.getItem('trigger_admin_mode') !== 'true') return false;
        return new URLSearchParams(window.location.search).get('admin_complete_share') === '1';
    } catch (e) {
        return false;
    }
}

/** 관리자: 메인에서 카톡 공유 파이프라인만 즉시 테스트 */
window.adminTestKakaoShareOnly = function () {
    if (localStorage.getItem('trigger_admin_mode') !== 'true') {
        alert('관리자 모드를 먼저 켜 주세요. (제목 3번 탭)');
        return;
    }
    if (typeof shareKakao !== 'function') {
        alert('공유 기능을 불러오지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
        return;
    }
    try {
        initKakao();
    } catch (e) {}
    Promise.resolve(shareKakao()).catch(function () {
        alert('카톡 공유를 실행하지 못했어요. 잠시 후 다시 시도해 주세요.');
    });
};

/** 관리자: 당일 테스트 완료 화면(카톡 공유 버튼)으로 바로 이동 */
window.adminGoDayCompleteKakaoScreen = function () {
    if (localStorage.getItem('trigger_admin_mode') !== 'true') {
        alert('관리자 모드를 먼저 켜 주세요. (제목 3번 탭)');
        return;
    }
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${lvl}`)) || 1;
    const localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;
    const isReviewDay = localDay === 6 || localDay === 7;
    const finalSession = isReviewDay ? '2' : String(DAILY_CYCLE_COUNT);
    localStorage.setItem(`trigger_session_${lvl}`, finalSession);
    try {
        localStorage.removeItem('voca_practice_list');
        localStorage.removeItem('trigger_custom_voca_mode');
        localStorage.removeItem('trigger_custom_voca_return_url');
        localStorage.removeItem('trigger_jump_test');
    } catch (e) {}
    if (typeof clearBlacktCooldownNotifySchedule === 'function') clearBlacktCooldownNotifySchedule();
    localStorage.removeItem('blackt_cooldown');
    clearStudyCheckpoint();
    location.href = 'study.html?admin_complete_share=1';
};

(function bindStudyCompleteActionsOnce() {
    if (window.__studyCompleteActionsBound) return;
    window.__studyCompleteActionsBound = true;
    function onStudyCompleteTap(ev) {
        const shareBtn = ev.target && ev.target.closest ? ev.target.closest('#btn-study-kakao-share') : null;
        const exitBtn = ev.target && ev.target.closest ? ev.target.closest('#btn-study-exit-home') : null;
        if (!shareBtn && !exitBtn) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (shareBtn && typeof shareKakao === 'function') shareKakao();
        else if (exitBtn) location.href = 'index.html?tab=voca';
    }
    document.addEventListener('click', onStudyCompleteTap, true);
})();

window.jumpToSession = function(n) {
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    
    // 1. 사이클 번호를 n으로 설정
    localStorage.setItem(`trigger_session_${lvl}`, n.toString());
    
    // 2. 쿨타임 및 점프용 임시 플래그 제거
    clearBlacktCooldownNotifySchedule();
    localStorage.removeItem('blackt_cooldown');
    
    // 3. [핵심] 만약 마지막 5사이클(또는 주말 2사이클)로 점프한다면 
    // 이미 학습 루프를 다 돌았다고 가정하고 바로 테스트로 진입하도록 플래그 설정
    if (n === DAILY_CYCLE_COUNT || n === 2) {
        localStorage.setItem('trigger_jump_test', 'true');
    }

    alert(`🛠️ 사이클 ${n} 테스트 단계로 점프합니다.`);
    
    // 4. 대시보드로 가서 '학습 시작하기'를 누르면 바로 테스트가 뜨게 함
    location.href = 'index.html?tab=voca'; 
};

function jumpToFinish() {
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
    localStorage.setItem('trigger_session_' + lvl, isReviewDay ? '2' : String(DAILY_CYCLE_COUNT));
    clearBlacktCooldownNotifySchedule();
    localStorage.removeItem('blackt_cooldown');
    localStorage.removeItem('trigger_jump_test'); 
    alert(`🛠️ 최종 테스트 단계로 점프 완료!\n메인 화면에서 '학습 시작하기'를 눌러주세요.`);
    location.href = 'index.html?tab=voca';
}

let adminClickCount = 0;
let adminTimer = null;

function activateAdminMode(e) {
    const isLogo = e.target.closest('.logo');
    const isTitle = e.target.id === 'main-header-title';

    if (isLogo || isTitle) {
        adminClickCount++;
        clearTimeout(adminTimer);
        adminTimer = setTimeout(() => { adminClickCount = 0; }, 1500);

        if (adminClickCount === 3) {
            enableAdminMode(true);
            adminClickCount = 0;
        }
    }
}

function enableAdminMode(showAlert) {
    localStorage.setItem('trigger_admin_mode', 'true');
    applyAdminPersistence();
    if (showAlert) {
        alert('🛠️ 관리자 모드 활성화!\n(이 기기에서 계속 유지됩니다)');
        const menu = document.getElementById('admin-menu');
        if (menu) {
            window.scrollTo({ top: menu.offsetTop - 40, behavior: 'smooth' });
        }
    }
}

function applyAdminPersistence() {
    const menu = document.getElementById('admin-menu');
    if (!menu) return;
    if (localStorage.getItem('trigger_admin_mode') !== 'true') {
        menu.style.setProperty('display', 'none', 'important');
        return;
    }
    if (typeof mainCurrentTab !== 'undefined' && mainCurrentTab !== 'voca') {
        menu.style.setProperty('display', 'none', 'important');
        return;
    }
    menu.style.setProperty('display', 'flex', 'important');
}

window.enableAdminMode = enableAdminMode;
window.applyAdminPersistence = applyAdminPersistence;

document.addEventListener('click', activateAdminMode);
window.addEventListener('pageshow', applyAdminPersistence);
window.addEventListener('focus', applyAdminPersistence);

window.forceComplete70 = function() {
    console.log("강제 완주 로직 실행: 데이터 주입 + 모든 리스트 해금"); 
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    
    // 1. 데이터 강제 주입
    localStorage.setItem('trigger_current_day_' + lvl, '70');
    localStorage.setItem('trigger_unlocked_day_' + lvl, '71'); // <- 핵심 해금 로직 추가
    localStorage.setItem('trigger_session_' + lvl, 'final');
    
    // 2. 방해 요소(쿨타임) 제거
    clearBlacktCooldownNotifySchedule();
    localStorage.removeItem('blackt_cooldown');

    alert('🏆 70일 완주 및 전 코스 잠금 해제 완료!\n이제 리스트 하단에 완주 축하 섹션이 나타납니다.');
    
    // 3. 확실한 페이지 이동 및 탭 고정
    window.location.href = 'index.html?tab=voca';
};

window.printMyWrongTest = function() {
    const db = JSON.parse(localStorage.getItem('trigger_master_wrong_db')) || [];
    const userName = localStorage.getItem('trigger_name') || '학습자';
    
    if (db.length === 0) {
        alert("기록된 누적 오답이 없습니다. 모든 테스트를 한 번에 통과하셨나봐요! 👍");
        return;
    }

    const printWindow = window.open('', '_blank');
    
    let html = `
        <html>
        <head>
            <title>TRIGGER BLACK · VOCA — 누적 오답 시험지</title>
            <style>
                @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
                body { font-family: 'Pretendard', sans-serif; padding: 30px; line-height: 1.5; color: #333; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 28px; letter-spacing: -1px; }
                .info-box { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; border: 1px solid #000; padding: 10px; }
                .test-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .test-table th, .test-table td { border: 1px solid #000; padding: 10px; text-align: center; }
                .test-table th { background-color: #f2f2f2; font-size: 14px; }
                .word-cell { text-align: left; font-size: 18px; font-weight: bold; padding-left: 20px; width: 45%; }
                .meaning-cell { width: 45%; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
                .no-print { position: fixed; bottom: 30px; right: 30px; }
                .btn-print { padding: 15px 30px; background: #000; color: #fff; border: none; border-radius: 50px; font-size: 18px; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎉 10주 완주 축하! 나만의 약점 보완 시험지 🎉</h1>
                <p style="margin-top:10px; color:#555;">"한 번의 실패는 성공을 위한 데이터일 뿐이다!"</p>
            </div>
            <div class="info-box">
                <span>성명: ${userName}</span>
                <span>학습 레벨: ${currentLevel.toUpperCase()}</span>
                <span>출력일: ${new Date().toLocaleDateString()}</span>
            </div>
            <p style="font-size: 13px; margin-bottom: 10px;">* 본 시험지는 귀하가 10주 과정 중 한 번이라도 틀렸던 단어들을 기반으로 자동 생성되었습니다.</p>
            <table class="test-table">
                <thead>
                    <tr>
                        <th style="width:10%">번호</th>
                        <th>단어 (Word)</th>
                        <th>뜻 (Meaning)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    db.forEach((w, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="word-cell">${w.word}</td>
                <td class="meaning-cell"></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div class="footer">
                TRIGGER BLACK — Designed by 원장님
            </div>
            <div class="no-print" style="display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; margin-top: 20px;">
            <button class="btn-print" onclick="window.print()" style="width: 350px;">지금 바로 인쇄 (PDF 저장)</button>
            
            <button onclick="window.open('https://open.kakao.com/o/siKCrAqi', '_blank')" 
                    style="width: 350px; padding: 15px 30px; background: #ffcc00; color: #000; border: none; border-radius: 50px; font-size: 18px; cursor: pointer; font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
                ✨ 실물 단어장 배송 신청 (2.0만 원)
            </button>
            <p style="font-size: 13px; color: #666; margin: 0;">📌 표지에 본인 이름이 각인된 프리미엄 소책자로 제작되어 배송됩니다.</p>
        </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

if (!window.isInitActive) {
    window.isInitActive = true;
    const runner = () => {
        if (document.getElementById('target')) {
            initApp();
        }
        applyAdminPersistence();
    };

    if (document.readyState === 'loading') { 
        document.addEventListener('DOMContentLoaded', runner); 
    } else { 
        runner(); 
    }
}

// 앱이 다시 활성화될 때(탭 전환 후 복귀 등) 실행되는 방어 코드
window.addEventListener('focus', () => {
    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime) {
        const remaining = parseInt(endTime) - Date.now();
        
        // 만약 자리를 비운 사이 이미 쿨타임이 끝났다면
        if (remaining <= 0) {
            handleCooldownExpiredUi();
            // 대시보드라면 버튼 상태를 즉시 '학습 시작'으로 변경
            if (typeof updateDashboardUI === 'function') {
                updateDashboardUI();
            }
        } else {
            // 아직 시간이 남았다면 남은 시간에 맞춰 타이머/UI 재설정
            if (typeof updateDashboardUI === 'function') {
                updateDashboardUI();
            }
        }
    }
});

(function scheduleCooldownNotifOnAppLoad() {
    function run() {
        if (typeof scheduleBlacktCooldownEndNotification === 'function') {
            scheduleBlacktCooldownEndNotification();
        }
    }
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
})();

(function registerStudyProgressCheckpoint() {
    if (!isStudyHtmlHost()) return;
    window.addEventListener('pagehide', saveStudyCheckpoint);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') saveStudyCheckpoint();
    });
})();

function goToAnalysis() {
    const grade = document.getElementById('exam-grade').value;
    const type = document.getElementById('exam-type').value;
    const period = document.getElementById('exam-period').value;

    // 선택 정보를 주소창에 꼬리표로 달아서 전송
    const query = `?grade=${encodeURIComponent(grade)}&type=${encodeURIComponent(type)}&period=${encodeURIComponent(period)}`;
    location.href = 'analysis.html' + query;
}