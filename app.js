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

// 🚀 카카오 초기화 안정화 (중복 제거 및 위치 고정)
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
        
        let currentSession = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`)) || 1;
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
            if (Array.isArray(dayData)) {
                todayWords = dayData;
            } else if (dayData && dayData.review_parts) {
                if (currentSession === 1) {
                    todayWords = dayData.review_parts[0] || [];
                } else if (currentSession === 2) {
                    todayWords = dayData.review_parts[1] || [];
                } else {
                    todayWords = dayData.test || [];
                    if (currentSession < 6) {
                        currentSession = 6; 
                        localStorage.setItem(`trigger_session_${currentLevel}`, '6');
                    }
                }
            } else {
                todayWords = [];
            }
        } else {
            todayWords = dayData || []; 
        }

        if (!todayWords || todayWords.length === 0) {
            showSystemMessage("학습할 단어가 없습니다.");
            setTimeout(() => { location.href = 'index.html'; }, 2000);
            return;
        }

        targetWords = todayWords;

        if (!isReviewDay && currentDay > 1 && currentSession === 1) {
            let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            let preReviewWords = allWrongs.filter(w => w.level === currentLevel && (w.day === currentDay - 1 || w.day === currentDay - 2));
            
            if (preReviewWords.length > 0) {
                isPreReviewMode = true;
                targetWords = preReviewWords;
                if (sessionTag) sessionTag.innerText = `🚨 이전 오답 테스트`;
                
                startCountdown("사전 오답 테스트를 시작합니다.", startTest);
                return; 
            }
        }

        if (sessionTag) {
            sessionTag.innerText = currentSession > 6 ? `자유 복습 모드` : `Session ${currentSession} / 6`;
        }

        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && currentSession <= 6) {
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
        if(pauseBtn) {
            pauseBtn.innerText = "▶ 계속하기";
            pauseBtn.style.borderColor = "var(--neon-blue)"; 
            pauseBtn.style.color = "#ffffff"; 
        }
        if(exitBtn) {
            exitBtn.style.display = "inline-block";
        }
        window.speechSynthesis.pause(); 
    } else {
        if(pauseBtn) {
            pauseBtn.innerText = "⏸ 일시중지";
            pauseBtn.style.borderColor = "var(--neon-blue)"; 
            pauseBtn.style.color = "#ffffff";
        }
        if(exitBtn) {
            exitBtn.style.display = "none";
        }
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
            const currentSession = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`)) || 1;
            
            if (currentSession === 3 || currentSession === 6 || currentSession > 6) {
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
    items.forEach(item => item.classList.add('active'));

    playPronunciation(data.word);
    setTimeout(() => playPronunciation(data.word), 3000);

    let time = 6000;
    const interval = setInterval(() => {
        if (isPaused) return; 
        
        time -= 100;
        const bar = document.getElementById('bar');
        if(bar) bar.style.width = (time / 6000 * 100) + "%";
        if (time <= 0 || currentIdx >= targetWords.length) { // 스킵 대응
            clearInterval(interval);
            if (time <= 0) currentIdx++;
            setTimeout(startStudy, 500);
        }
    }, 100);
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
        if (time <= 0 || currentIdx >= targetWords.length) { // 스킵 대응
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
        wrongWords.push({ ...wordObj, day: currentDay, level: currentLevel }); 
        if(starBtn) starBtn.innerText = "⭐";
    }
    localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
}

function updateUI(data, isTest = false) {
    const targetEl = document.getElementById('target');
    const mBox = document.getElementById('meanings');
    
    if (!data || !data.word) return;

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
            </div>
        `;
    } else {
        titleHtml = `
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:3.3rem; font-weight:bold; cursor:pointer;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>
        `;
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
        const allOtherMeanings = targetWords.filter(w => w.word !== data.word).map(w => {
            if (Array.isArray(w.meanings)) return w.meanings.join(', ');
            return w.meaning || "뜻 정보 없음";
        });
        
        let availableMeanings = [...allOtherMeanings].sort(() => Math.random() - 0.5).slice(0, 3);
        const choices = [fullMeaning, ...availableMeanings].sort(() => Math.random() - 0.5);
        
        mBox.innerHTML = choices.map(c => {
            const isCorrect = (c === fullMeaning);
            return `
                <button class="choice-btn" 
                    style="font-size: 1.4rem !important; height: 75px !important; display: flex; align-items: center; justify-content: center; text-align: center; padding: 5px 15px !important; margin-bottom: 12px; line-height: 1.2; word-break: keep-all; font-weight: bold;" 
                    onclick="handleAnswer(${isCorrect})">
                    ${c}
                </button>`;
        }).join('');
    }
}

function handleAnswer(isCorrect) {
    clearInterval(window.currentTimer);
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
            wrongWords.push({ ...currentWordData, day: currentDay, level: currentLevel });
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    }
    currentIdx++;
    startTest();
}

function finishSession(didTest = true) {
    if (isPreReviewMode) {
        isPreReviewMode = false;
        targetWords = todayWords; 
        currentIdx = 0;
        score = 0;
        studyLoopCount = 1;
        const sessionTag = document.getElementById('session-tag');
        if(sessionTag) sessionTag.innerText = `Session 1 / 6`;
        startCountdown("복습 완료! 👍<br>오늘의 단어를 시작할게요.", startStudy);
        return;
    }

    let currentSession = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`)) || 1;
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let stats = JSON.parse(localStorage.getItem(`trigger_stats_${currentLevel}`) || '{}');
    if (!stats[currentDay]) stats[currentDay] = { progress: 0, accuracy: 0 };
    
    stats[currentDay].progress = Math.max(stats[currentDay].progress, currentSession);

    if (currentSession >= 6 && didTest) {
        stats[currentDay].accuracy = Math.floor((score / targetWords.length) * 100);
        let highestDay = parseInt(localStorage.getItem(`trigger_highest_day_${currentLevel}`)) || 0;
        if (currentDay > highestDay) {
            let currentStreak = parseInt(localStorage.getItem('trigger_streak')) || 0;
            localStorage.setItem('trigger_streak', currentStreak + 1);
            localStorage.setItem(`trigger_highest_day_${currentLevel}`, currentDay);
        }
    }
    localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));

    if (currentSession <= 6) {
        localStorage.setItem(`trigger_session_${currentLevel}`, currentSession + 1);
        if (currentSession + 1 === 7) {
            let unlockedDay = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
            if (unlockedDay === currentDay) localStorage.setItem(`trigger_unlocked_day_${currentLevel}`, unlockedDay + 1);
        }
    }

    if (currentSession >= 6) {
        const accuracy = Math.floor((score / targetWords.length) * 100);
        const isHighScorer = accuracy >= 80;

        showSystemMessage(`
            <div style="padding: 10px; text-align:center;">
                <div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold; margin-bottom:15px;">MISSION COMPLETE!</div>
                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #333;">
                    <div style="font-size:0.9rem; color:#888;">최종 테스트 정답률</div>
                    <div style="font-size:2rem; font-weight:bold; color:var(--neon-orange);">${accuracy}%</div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${isHighScorer ? 
                        `<button onclick="shareKakao()" style="width:100%; padding:16px; background:#fee500; color:#3c1e1e; border:none; border-radius:12px; font-weight:bold; font-size:1.1rem; cursor:pointer;">🟡 카톡으로 성과 공유하기</button>` 
                        : `<div style="color:#888; font-size:0.85rem; margin-bottom:10px;">80% 이상 득점 시 자랑하기가 활성화됩니다! 🔥</div>`
                    }
                    <button onclick="location.href='index.html'" style="width:100%; padding:12px; background:transparent; color:#666; border:none; cursor:pointer; font-size:0.9rem;">종료하기</button>
                </div>
            </div>
        `);
    } else {
        localStorage.setItem('blackt_cooldown', Date.now() + COOL_DOWN_TIME);
        showSystemMessage(didTest ? "테스트 완료! 👍" : "세션 완료! 🔥<br>조금씩 실력이 늘고 있어요.");
        setTimeout(() => { location.href = 'index.html'; }, 2200);
    }
}

// 🚀 깔끔하게 정리된 카카오 공유 함수
function shareKakao() {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
        alert("카카오 SDK가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const levelName = currentLevel === 'high' ? '고등' : '중등';
        const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
        const shareUrl = window.location.origin + window.location.pathname.replace('study.html', 'index.html');
        const thumbImg = 'https://t1.kakaocdn.net/kakaocorp/Service/Official/Common/logo/kakaotalk_200x200.png';

        Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: '⚡ 트리거 보카 목표 달성!',
                description: `${userName}님이 [${levelName} Day ${currentDay}]를 완수했습니다.\n정답률: ${Math.floor((score/targetWords.length)*100)}%`,
                imageUrl: thumbImg, 
                link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
            },
            buttons: [
                {
                    title: '나도 도전하기',
                    link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
                }
            ],
        });
    } catch (e) {
        console.error("공유 에러:", e);
        alert("카톡 공유 중 오류가 발생했습니다.");
    }
}

// 🚀 관리자 스킵 함수
function skipToTest() {
    if (confirm("학습을 건너뛸까요?")) {
        currentIdx = targetWords.length; 
    }
}

function skipToFinish() {
    if (confirm("결과 화면으로 갈까요?")) {
        clearInterval(window.currentTimer);
        score = targetWords.length; 
        currentIdx = targetWords.length;
        finishSession(true);
    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }