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

try {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
        console.log("카카오 SDK 초기화 완료");
    }
} catch (e) { console.error("카카오 초기화 실패", e); }

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
        
        // 🚀 [수정] 바뀐 5+2 데이터 구조에서 데이터를 가져옵니다.
        let dayData = null;
        let week = Math.ceil(currentDay / 7);
        let localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;

        if (window.wordsData && window.wordsData[currentLevel]) {
            const weekKey = "week" + week;
            if (window.wordsData[currentLevel][weekKey]) {
                dayData = window.wordsData[currentLevel][weekKey][String(localDay)];
            }
        }

        const isReviewDay = (localDay === 6 || localDay === 7);

        if (isReviewDay) {
            if (!dayData || !dayData.review_parts) {
                showSystemMessage(`복습 데이터를 찾을 수 없습니다.`);
                setTimeout(() => { location.href = 'index.html'; }, 2000);
                return;
            }
            if (currentSession === 1) todayWords = dayData.review_parts[0];
            else if (currentSession === 2) todayWords = dayData.review_parts[1];
            else {
                todayWords = dayData.test;
                if (currentSession < 6) {
                    currentSession = 6;
                    localStorage.setItem(`trigger_session_${currentLevel}`, '6');
                }
            }
        } else {
            todayWords = dayData || [];
        }
        
        if (todayWords.length === 0) {
            showSystemMessage(`Day ${currentDay}의<br>단어 데이터가 없습니다.`);
            setTimeout(() => { location.href = 'index.html'; }, 2000);
            return;
        }

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
        targetWords = todayWords; 

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
            pauseBtn.style.borderColor = "var(--neon-green)";
            pauseBtn.style.color = "var(--neon-green)";
        }
        if(exitBtn) exitBtn.style.display = "block"; 
        window.speechSynthesis.pause(); 
    } else {
        if(pauseBtn) {
            pauseBtn.innerText = "⏸ 일시중지";
            pauseBtn.style.borderColor = "var(--neon-blue)";
            pauseBtn.style.color = "#fff";
        }
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
        if (time <= 0) {
            clearInterval(interval);
            currentIdx++;
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
        if (time <= 0) { clearInterval(interval); handleAnswer(false); }
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

    // 🚀 [수정] 뜻 배열 처리 로직 보강
    let safeMeanings = Array.isArray(data.meanings) ? data.meanings : (data.meaning ? [data.meaning] : ["뜻 정보 없음"]);
    const fullMeaning = safeMeanings.join(', ');

    targetEl.style.setProperty('font-size', '3.3rem', 'important'); 
    targetEl.style.setProperty('text-shadow', '0 0 15px #fff', 'important');
    targetEl.style.setProperty('color', '#fff', 'important');
    targetEl.style.setProperty('margin-top', '0px', 'important');

    let titleHtml = `
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                <span style="cursor:pointer;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</span>
                <button id="star-btn" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:var(--neon-orange); padding-bottom:5px;">☆</button>
            </div>
            <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
        </div>
    `;
    
    targetEl.innerHTML = titleHtml;
    
    const starBtn = document.getElementById('star-btn');
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const isStarred = wrongWords.some(w => w.word === data.word && w.level === currentLevel);
    
    if(starBtn) {
        starBtn.innerText = isStarred ? "⭐" : "☆";
        starBtn.onclick = (e) => { e.stopPropagation(); toggleStar(data); };
    }

    if (!isTest) {
        mBox.innerHTML = safeMeanings.map(m => `<div style="font-size:2.2rem; font-weight:bold; margin-bottom:15px;">${m}</div>`).join('');
    } else {
        if(starBtn) starBtn.style.display = 'none'; 
        
        // 🚀 [수정] 오답 보기 생성 시 배열 형태 뜻 지원
        const otherWords = targetWords.filter(w => w.word !== data.word);
        let availableMeanings = otherWords.map(w => Array.isArray(w.meanings) ? w.meanings.join(', ') : (w.meaning || "오답"));
        
        let wrongChoices = [];
        while (wrongChoices.length < 3) {
            if (availableMeanings.length > 0) {
                const randomIdx = Math.floor(Math.random() * availableMeanings.length);
                wrongChoices.push(availableMeanings.splice(randomIdx, 1)[0]);
            } else {
                wrongChoices.push(`오답 ${wrongChoices.length + 1}`);
            }
        }
        
        const choices = [fullMeaning, ...wrongChoices].sort(() => Math.random() - 0.5);
        
        mBox.innerHTML = choices.map(c => {
            const isCorrect = (c === fullMeaning);
            return `
                <button class="choice-btn" 
                    style="font-size: 1.15rem !important; height: 70px !important; display: flex; align-items: center; justify-content: center; text-align: center; padding: 5px 15px !important; margin-bottom: 10px; line-height: 1.2; word-break: keep-all;" 
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
        currentIdx = 0; score = 0; studyLoopCount = 1;
        document.getElementById('session-tag').innerText = `Session 1 / 6`;
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
        showSystemMessage(`
            <div style="padding: 10px; text-align:center;">
                <div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold; margin-bottom:15px;">MISSION COMPLETE!</div>
                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #333;">
                    <div style="font-size:0.9rem; color:#888;">최종 테스트 정답률</div>
                    <div style="font-size:2rem; font-weight:bold; color:var(--neon-orange);">${accuracy}%</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${accuracy >= 80 ? `<button onclick="shareKakao()" style="width:100%; padding:16px; background:#fee500; color:#3c1e1e; border:none; border-radius:12px; font-weight:bold; font-size:1.1rem; cursor:pointer;">🟡 카톡으로 성과 공유하기</button>` : `<div style="color:#888; font-size:0.85rem; margin-bottom:10px;">80% 이상 득점 시 자랑하기가 활성화됩니다! 🔥</div>`}
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

function shareKakao() {
    if (typeof Kakao === 'undefined') return;
    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
        const currentUrl = window.location.origin; 
        Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: '⚡ 트리거 보카 목표 달성!',
                description: `${userName}님이 [${currentLevel === 'high' ? '고등' : '중등'} Day ${currentDay}]를 완수했습니다.\n최종 정답률: ${score} / ${targetWords.length}`,
                imageUrl: 'https://yourdomain.com/icon-512.png', link: { mobileWebUrl: currentUrl, webUrl: currentUrl },
            },
            buttons: [{ title: '나도 도전하기', link: { mobileWebUrl: currentUrl, webUrl: currentUrl } }],
        });
    } catch (e) {}
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }