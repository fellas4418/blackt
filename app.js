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
const COOL_DOWN_TIME = 10 * 60 * 1000; 

let isPreReviewMode = false;
let todayWords = [];
let isMuted = localStorage.getItem('trigger_muted') === 'true';
let isPaused = false;
const currentLevel = localStorage.getItem('trigger_level') || 'middle';
// 🚀 직전 문제 오답 보관용 변수
window.lastWrongOptions = [];

function startCountdown(message, callback) {
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

function initApp() {
    wakeUpTTS(); 
    
    try {
        const sessionTag = document.getElementById('session-tag'); 
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        const muteBtn = document.getElementById('mute-toggle-btn');
        if (muteBtn) muteBtn.innerText = isMuted ? '🔇' : '🔊';

        const today = new Date().toLocaleDateString();
        if (localStorage.getItem('trigger_date') !== today) {
            localStorage.setItem('trigger_date', today);
            localStorage.setItem('trigger_session_middle', '1');
            localStorage.setItem('trigger_session_high', '1');
        }
        
        let currentSession = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
        const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
        
        let week = Math.ceil(currentDay / 7);
        let localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;
        
        let dayData = null;
        if (typeof wordsData !== 'undefined' && wordsData[currentLevel] && wordsData[currentLevel]["week" + week]) {
            dayData = wordsData[currentLevel]["week" + week][String(localDay)];
        }

        if (!dayData) {
            showSystemMessage(`Day ${currentDay}의<br>단어 데이터가 없습니다.`);
            setTimeout(() => { location.href = 'index.html'; }, 2000);
            return;
        }

        const isReviewDay = (localDay === 6 || localDay === 7);

        if (isReviewDay) {
            let allReviewWords = [];
            if (dayData && Array.isArray(dayData.test)) {
                allReviewWords = dayData.test;
            } else if (Array.isArray(dayData)) {
                allReviewWords = dayData;
            } else if (dayData && Array.isArray(dayData.review_parts)) {
                allReviewWords = dayData.review_parts.flat();
            }

            const halfIndex = Math.ceil(allReviewWords.length / 2);
            if (localDay === 6) {
                todayWords = allReviewWords.slice(0, halfIndex);
            } else if (localDay === 7) {
                todayWords = allReviewWords.slice(halfIndex);
            }
        } else {
            todayWords = dayData || []; 
        }

        // 🚀 [원본 로직 보존] 어제/그저께 (오답 + 별표)를 리스트 맨 앞 배치
        if (!isReviewDay && currentDay > 1) {
            let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            let preReviewWords = allWrongs.filter(w => 
                w.level === currentLevel && 
                (w.day === currentDay - 1 || w.day === currentDay - 2) &&
                (w.isWrong === true || w.isStarred === true)
            );
            
            if (preReviewWords.length > 0) {
                const newWordsOnly = todayWords.filter(tw => !preReviewWords.some(pw => pw.word === tw.word));
                targetWords = [...preReviewWords, ...newWordsOnly];
            } else {
                targetWords = todayWords;
            }
        } else {
            targetWords = todayWords;
        }

        if (sessionTag) {
            let currentSessionVal = localStorage.getItem(`trigger_session_${currentLevel}`);
            
            // 🚀 최후의 세션일 때 (가장 먼저 체크)
            if (currentSessionVal === 'final') {
                sessionTag.innerText = `최후의 세션 1 / 1`;
                sessionTag.style.color = "var(--neon-orange)";
            } 
            // 주말 복습일 때
            else if (isReviewDay) {
                let sNum = parseInt(currentSessionVal) || 1;
                let displaySession = sNum >= 6 ? 2 : 1;
                sessionTag.innerText = sNum > 6 ? `자유 복습 모드` : `Session ${displaySession} / 2 (주말복습)`;
                sessionTag.style.color = ""; // 색상 초기화
            } 
            // 평일 일반 세션일 때
            else {
                let sNum = parseInt(currentSessionVal) || 1;
                sessionTag.innerText = sNum > 6 ? `자유 복습 모드` : `Session ${sNum} / 6`;
                sessionTag.style.color = ""; // 색상 초기화
            }
        }

        // 🚀 [관리자 점프 핵심] 테스트 직행 신호 확인 시 학습 건너뛰고 테스트 시작
        if (localStorage.getItem('trigger_jump_test') === 'true') {
            localStorage.removeItem('trigger_jump_test'); // 신호 즉시 파기
            currentIdx = 0; 
            studyLoopCount = 2; // 학습 루프 완료 상태로 조작
            startCountdown("곧 테스트를 시작합니다.", startTest);
            return; // 아래 startStudy 실행 차단
        }

        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && parseInt(currentSession) <= 6 && currentSession !== 'final') {
            showSystemMessage("잠시 쉬어주세요.<br>곧 다시 시작할 수 있습니다.");
            setTimeout(() => { location.href = 'index.html'; }, 1800);
        } else {
            startStudy(); 
        }
    } catch (err) {
        showSystemMessage("에러 발생: " + err.message);
        setTimeout(() => { location.href = 'index.html'; }, 3000);
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

function startStudy() {
    if (currentIdx >= targetWords.length) {
        if (studyLoopCount < 2) {
            studyLoopCount++;
            currentIdx = 0; 
            startStudy();
            return;
        } else {
            currentIdx = 0;
            const currentSession = localStorage.getItem(`trigger_session_${currentLevel}`);
            if (currentSession === '3' || currentSession === '6' || currentSession === 'final' || parseInt(currentSession) > 6) {
                startCountdown("곧 테스트를 시작합니다.", startTest); 
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
        
        // 발음 2초 뒤 재생 로직
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
        wrongWords.splice(idx, 1); 
        if(starBtn) starBtn.innerText = "☆";
    } else {
        wrongWords.push({ ...wordObj, day: currentDay, level: currentLevel, isStarred: true }); 
        if(starBtn) starBtn.innerText = "⭐";
    }
    localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
}

function updateUI(data, isTest = false) {
    const targetEl = document.getElementById('target');
    const mBox = document.getElementById('meanings');
    
    if (!targetEl || !mBox) return;

    if (!data || !data.word) {
        targetEl.innerHTML = `<div style="font-size:1.2rem; color:var(--neon-orange); margin-top:20px;">🚨 단어 구조 오류</div>`;
        return;
    }

    let safeMeanings = Array.isArray(data.meanings) ? data.meanings : (data.meaning ? [data.meaning] : ["뜻 확인 필요"]);
    const fullMeaning = safeMeanings.join(', ');

    targetEl.style.setProperty('font-size', '3.3rem', 'important'); 
    targetEl.style.setProperty('text-shadow', '0 0 15px #fff', 'important');
    targetEl.style.setProperty('color', '#fff', 'important');
    targetEl.style.setProperty('margin-top', '0px', 'important');

    let titleHtml = "";
    if (!isTest) {
        titleHtml = `
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="display:flex; justify-content:center; align-items:center;">
                    <span style="font-size:1.8rem; visibility:hidden; pointer-events:none;">☆</span>
                    <span style="cursor:pointer; margin:0 10px;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</span>
                    <button id="star-btn" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:var(--neon-orange); padding-bottom:5px;">☆</button>
                </div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>`;
    } else {
        titleHtml = `
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:3.3rem; font-weight:bold; cursor:pointer;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>`;
    }
    
    targetEl.innerHTML = titleHtml;
    
    const starBtn = document.getElementById('star-btn');
    if(starBtn && !isTest) {
        let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
        const isStarred = wrongWords.some(w => w.word === data.word && w.level === currentLevel);
        starBtn.innerText = isStarred ? "⭐" : "☆";
        starBtn.onclick = (e) => { e.stopPropagation(); toggleStar(data); };
    }

    if (!isTest) {
        mBox.innerHTML = safeMeanings.map(m => `<div style="font-size:2.2rem; font-weight:bold; margin-bottom:15px;">${m}</div>`).join('');
    } else {
        // 🚀 [보기 중복 방지 로직 개선]
        // 1. 전체 데이터베이스에서 현재 레벨의 모든 단어 추출 (수천 개 후보)
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
        dictPool = [...new Set(dictPool)]; // 중복 제거

        // 2. 직전 문제에서 사용된 오답 보기들 필터링
        let filteredPool = dictPool.filter(m => !window.lastWrongOptions.includes(m));
        
        // 3. 만약 후보가 너무 부족하면(신규 레벨 등) 다시 전체 사용
        if (filteredPool.length < 3) filteredPool = dictPool;

        // 4. 무작위로 3개 오답 보기를 추출하여 저장 (다음 문제 방지용)
        let selectedWrongs = filteredPool.sort(() => Math.random() - 0.5).slice(0, 3);
        window.lastWrongOptions = selectedWrongs;

        const choices = [fullMeaning, ...selectedWrongs].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `
                <button class="choice-btn" 
                    style="font-size: 1.4rem !important; height: 75px !important; display: flex; align-items: center; justify-content: center; text-align: center; padding: 5px 15px !important; margin-bottom: 12px; line-height: 1.2; word-break: keep-all; font-weight: bold;" 
                    onclick="handleAnswer(${c === fullMeaning})">
                    ${c}
                </button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    if (window.currentTimer) clearInterval(window.currentTimer);
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentWordData = targetWords[currentIdx];
    
    if (!currentWordData) return;
    const idx = wrongWords.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);

    if (isCorrect) {
        score++;
        if (isReviewDay && idx > -1) {
            wrongWords.splice(idx, 1);
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    } else {
        if (idx === -1) {
            wrongWords.push({ ...currentWordData, day: currentDay, level: currentLevel, isWrong: true });
        } else {
            wrongWords[idx].isWrong = true;
        }
        localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
    }
    currentIdx++;
    startTest();
}

function finishSession(didTest = true) {
    let currentSession = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;
    const isReviewDay = (localDay === 6 || localDay === 7);
    
    let stats = JSON.parse(localStorage.getItem(`trigger_stats_${currentLevel}`) || '{}');
    if (!stats[currentDay]) stats[currentDay] = { progress: 0, accuracy: 0 };
    
    const accuracy = Math.floor((score / targetWords.length) * 100);

    const isMainTest = (currentSession === '6');
    const isReviewTest = (isReviewDay && currentSession === '2');

    if (didTest && accuracy < 80 && (isMainTest || isReviewTest)) {
        localStorage.setItem(`trigger_session_${currentLevel}`, 'final'); 
        showSystemMessage(`
            <div style="padding: 10px; text-align:center;">
                <div style="font-size:1.5rem; color:var(--neon-orange); font-weight:bold; margin-bottom:15px;">아쉬운 점수! 🚨</div>
                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #333;">
                    <div style="font-size:0.9rem; color:#888;">현재 정답률</div>
                    <div style="font-size:2rem; font-weight:bold; color:var(--neon-orange);">${accuracy}%</div>
                </div>
                <div style="font-size:0.95rem; color:#fff; margin-bottom:20px; line-height:1.6; word-break:keep-all;">
                    정답률 80% 미만은 <b style="color:var(--neon-orange);">최후의 세션</b>을 시작합니다.<br>
                    <span style="color:var(--neon-blue); font-weight:bold;">틀린 단어만 딱 1번 더 복습하고 끝!</span> 🔥
                </div>
                <button onclick="retryOnlyWrongs()" style="width:100%; padding:16px; background:var(--neon-blue); color:#fff; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem;">최후의 세션 시작</button>
            </div>
        `);
        return;
    }

    const isFinalSession = (currentSession === 'final');
    const isEndOfStudy = isReviewDay ? (parseInt(currentSession) >= 2) : (parseInt(currentSession) >= 6);

    if ((isEndOfStudy || isFinalSession) && didTest) {
        stats[currentDay].progress = isReviewDay ? 2 : 6;
        stats[currentDay].accuracy = accuracy;
        
        let highestDay = parseInt(localStorage.getItem(`trigger_highest_day_${currentLevel}`)) || 0;
        if (currentDay > highestDay) {
            let currentStreak = parseInt(localStorage.getItem('trigger_streak')) || 0;
            localStorage.setItem('trigger_streak', currentStreak + 1);
            localStorage.setItem(`trigger_highest_day_${currentLevel}`, currentDay);
        }
        
        let unlockedDay = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
        if (unlockedDay === currentDay) localStorage.setItem(`trigger_unlocked_day_${currentLevel}`, unlockedDay + 1);
        
        const isLow = accuracy < 80;
        showSystemMessage(`
            <div style="padding: 10px; text-align:center;">
                <div style="font-size:1.5rem; color:${isLow ? 'var(--neon-orange)' : 'var(--neon-green)'}; font-weight:bold; margin-bottom:15px;">
                    ${isLow ? '복습 완료! 노력 인정 👍' : 'MISSION COMPLETE! 👑'}
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #333;">
                    <div style="font-size:0.9rem; color:#888;">최종 테스트 정답률</div>
                    <div style="font-size:2rem; font-weight:bold; color:var(--neon-orange);">${accuracy}%</div>
                    ${isLow ? '<div style="font-size:0.8rem; color:#888; margin-top:5px;">(80% 미만 - 재복습 수행됨)</div>' : ''}
                </div>
                <button onclick="shareKakao()" style="width:100%; padding:16px; background:#fee500; color:#3c1e1e; border:none; border-radius:12px; font-weight:bold; font-size:1.1rem; cursor:pointer;">🟡 카톡으로 성과 공유하기</button> 
                <button onclick="location.href='index.html'" style="width:100%; padding:14px; background:transparent; color:#bbbbbb; border:none; cursor:pointer; font-size:1.1rem; font-weight:bold; text-decoration:underline;">종료하기</button>
            </div>
        `);
    } else {
        let nextSession = parseInt(currentSession) + 1;
        localStorage.setItem(`trigger_session_${currentLevel}`, nextSession.toString());
        localStorage.setItem('blackt_cooldown', Date.now() + COOL_DOWN_TIME);
        showSystemMessage(didTest ? "테스트 완료! 👍" : "세션 완료! 🔥");
        setTimeout(() => { location.href = 'index.html'; }, 2200);
    }
    localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));
}

function retryOnlyWrongs() {
    let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let retryList = allWrongs.filter(w => w.level === currentLevel && w.day === currentDay);
    if (retryList.length < 1) retryList = todayWords;
    
    targetWords = retryList;
    currentIdx = 0;
    studyLoopCount = 2; 

    // 🚀 [추가] 나갔다 오지 않아도 즉시 상단 바를 '최후의 세션'으로 변경
    const sessionTag = document.getElementById('session-tag');
    if (sessionTag) {
        sessionTag.innerText = `최후의 세션 1 / 1`;
        sessionTag.style.color = "var(--neon-orange)";
    }
    
    startStudy();
}

function shareKakao() {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) return;
    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const levelName = currentLevel === 'high' ? '고등' : '중등';
        const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
        const shareUrl = window.location.origin + window.location.pathname.replace('study.html', 'index.html');
        Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: '⚡ 사라져 보카 목표 달성!',
                description: `${userName}님이 [${levelName} Day ${currentDay}]를 완수했습니다.\n정답률: ${Math.floor((score/targetWords.length)*100)}%`,
                imageUrl: 'https://t1.kakaocdn.net/kakaocorp/Service/Official/Common/logo/kakaotalk_200x200.png', 
                link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
            },
            buttons: [{ title: '나도 도전하기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
        });
    } catch (e) {}
}

function skipToTest() { if (confirm("학습을 건너뛸까요?")) { currentIdx = targetWords.length; } }
function skipToFinish() { if (confirm("결과 화면으로 갈까요?")) { if (window.currentTimer) clearInterval(window.currentTimer); score = targetWords.length; currentIdx = targetWords.length; finishSession(true); } }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }

function jumpToFinish() {
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    localStorage.setItem('trigger_session_' + lvl, '6'); 
    localStorage.removeItem('blackt_cooldown');
    // 테스트 직행 쪽지 발송
    localStorage.setItem('trigger_jump_test', 'true');
    location.reload();
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
            const menu = document.getElementById('admin-menu');
            if (menu) {
                menu.style.setProperty('display', 'flex', 'important'); 
                alert("🛠️ 관리자 모드 활성화!");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
            adminClickCount = 0;
        }
    }
}
document.addEventListener('click', activateAdminMode);