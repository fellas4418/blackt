try {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
    }
} catch (e) { console.log("카카오 에러", e); }

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

function showSystemMessage(text) {
    const targetEl = document.getElementById('target');
    const meaningsEl = document.getElementById('meanings');
    
    if (targetEl) {
        targetEl.innerHTML = text;
        targetEl.style.fontSize = '1.0rem'; 
        targetEl.style.lineHeight = '1.4';
        targetEl.style.wordBreak = 'keep-all';
    }
    if (meaningsEl) meaningsEl.innerHTML = "";
}

function startCountdown(message, callback) {
    let count = 3;
    const renderHtml = (c) => `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:160px;">
            <div style="font-size:1.0rem; margin-bottom:15px;">${message}</div>
            <div style="font-size:5rem; font-weight:bold; color:var(--neon-orange); text-shadow: 0 0 20px var(--neon-orange); line-height:1;">${c}</div>
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
        const levelData = wordsData[currentLevel] || {};
        
        const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
        
        if (isReviewDay) {
            let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            targetWords = allWrongs.filter(w => w.level === currentLevel);
            if (targetWords.length === 0) {
                showSystemMessage("저장된 오답이 없습니다.<br>메인으로 돌아갑니다.");
                setTimeout(() => { location.href = 'index.html'; }, 2000);
                return;
            }
        } else {
            todayWords = levelData[currentDay] || [];
            if (todayWords.length === 0) {
                showSystemMessage("해당 Day의 단어 데이터가 없습니다!");
                setTimeout(() => { location.href = 'index.html'; }, 2000);
                return;
            }

            if (currentDay > 1 && currentSession === 1) {
                let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
                let preReviewWords = allWrongs.filter(w => w.level === currentLevel && (w.day === currentDay - 1 || w.day === currentDay - 2));
                
                if (preReviewWords.length > 0) {
                    isPreReviewMode = true;
                    targetWords = preReviewWords;
                    if (sessionTag) sessionTag.innerText = `🚨 이전 오답 테스트 (Day ${currentDay-2 < 1 ? 1 : currentDay-2}~${currentDay-1})`;
                    
                    startCountdown("🚨 사전 오답 테스트를 시작합니다.", startTest);
                    return; 
                }
            }
            targetWords = todayWords; 
        }

        if (sessionTag) {
            sessionTag.innerText = currentSession > 6 ? `추가 복습 모드` : `Session ${currentSession} / 6`;
        }

        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && currentSession <= 6) {
            showSystemMessage("잠시 쉬어주세요.");
            setTimeout(() => { location.href = 'index.html'; }, 1500);
        } else {
            startStudy(); 
        }
    } catch (err) {
        showSystemMessage("에러: " + err.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
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
    
    if (!data || !data.word) {
        console.error("데이터 형식 에러:", data);
        if (targetEl) targetEl.innerHTML = "데이터 오류";
        return;
    }

    const safeMeanings = Array.isArray(data.meanings) ? data.meanings : ["뜻 정보 없음"];
    const fullMeaning = safeMeanings.join(', ');

    targetEl.style.fontSize = ''; 
    targetEl.style.lineHeight = '';

    let titleHtml = `
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div style="display:flex; justify-content:center; align-items:center; gap:5px;">
                <span style="cursor:pointer;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</span>
                <button id="star-btn" style="background:none; border:none; font-size:1.6rem; cursor:pointer; color:var(--neon-orange); padding-bottom:5px;">☆</button>
            </div>
            <div class="ipa-text">${data.ipa || ''}</div>
        </div>
    `;
    
    targetEl.innerHTML = titleHtml;
    
    const starBtn = document.getElementById('star-btn');
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const isStarred = wrongWords.some(w => w.word === data.word && w.level === currentLevel);
    if(starBtn) {
        starBtn.innerText = isStarred ? "⭐" : "☆";
        starBtn.onclick = (e) => { 
            e.stopPropagation(); 
            toggleStar(data); 
        };
    }

    const mBox = document.getElementById('meanings');
    
    if (!isTest) {
        mBox.innerHTML = safeMeanings.map(m => `<div>${m}</div>`).join('');
    } else {
        if(starBtn) starBtn.style.display = 'none'; 
        
        const allOtherMeanings = targetWords.filter(w => w.word !== data.word).map(w => {
            return Array.isArray(w.meanings) ? w.meanings.join(', ') : "뜻 정보 없음";
        });
        
        let availableMeanings = [...allOtherMeanings]; 
        let wrongChoices = [];
        let fallbackCount = 1;
        
        while (wrongChoices.length < 3) {
            if (availableMeanings.length > 0) {
                const randomIdx = Math.floor(Math.random() * availableMeanings.length);
                wrongChoices.push(availableMeanings[randomIdx]);
                availableMeanings.splice(randomIdx, 1); 
            } else {
                wrongChoices.push(`다른 오답 뜻 ${fallbackCount}`);
                fallbackCount++;
            }
        }
        
        const choices = [fullMeaning, ...wrongChoices].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => {
            const isCorrect = (c === fullMeaning);
            return `<button class="choice-btn" onclick="handleAnswer(${isCorrect})">${c}</button>`;
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
        // [수정] 평일(isPreReviewMode)에는 맞혀도 지우지 않음. 
        // 오직 주말 복습일(isReviewDay) 본 테스트에서 정답을 맞혀야만 오답 리스트에서 최종 삭제.
        if (isReviewDay && idx > -1) {
            wrongWords.splice(idx, 1);
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    } else {
        // 틀렸을 때 리스트에 없으면 추가
        if (idx === -1) {
            wrongWords.push({ ...currentWordData, day: currentDay, level: currentLevel });
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    }
    currentIdx++;
    startTest();
}

function executeKakaoShare() {
    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
        const currentUrl = window.location.origin; 
        
        Kakao.Share.sendDefault({
            objectType: 'text',
            text: `🔥 ${userName}님이 Trigger Voca [Day ${currentDay}] 목표를 달성했습니다!\n👉 최종 테스트 정답률: ${score} / ${targetWords.length}`,
            link: { mobileWebUrl: currentUrl, webUrl: currentUrl },
            buttonTitle: '나도 도전하기',
        });
    } catch (e) {}
}

function shareKakao() {
    if (typeof Kakao === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
        script.onload = () => {
            Kakao.init('fbb1520306ffaad0a882e993109a801c');
            executeKakaoShare();
        };
        document.head.appendChild(script);
    } else {
        if (!Kakao.isInitialized()) Kakao.init('fbb1520306ffaad0a882e993109a801c');
        executeKakaoShare();
    }
}

function finishSession(didTest = true) {
    if (isPreReviewMode) {
        isPreReviewMode = false;
        targetWords = todayWords; 
        currentIdx = 0;
        score = 0;
        studyLoopCount = 1;
        document.getElementById('session-tag').innerText = `Session 1 / 6`;
        startCountdown("복습 완료! 👍<br>오늘의 단어를 시작할게요.", startStudy);
        return;
    }

    let currentSession = parseInt(localStorage.getItem(`trigger_session_${currentLevel}`)) || 1;
    let finishedSession = currentSession;
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;

    let stats = JSON.parse(localStorage.getItem(`trigger_stats_${currentLevel}`) || '{}');
    if (typeof stats[currentDay] === 'number') {
        stats[currentDay] = { progress: 6, accuracy: stats[currentDay] }; 
    }
    if (!stats[currentDay]) stats[currentDay] = { progress: 0, accuracy: 0 };
    
    stats[currentDay].progress = Math.max(stats[currentDay].progress, finishedSession);

    if (finishedSession >= 6 && didTest) {
        stats[currentDay].accuracy = Math.floor((score / targetWords.length) * 100);
        
        let currentStreak = parseInt(localStorage.getItem('trigger_streak')) || 0;
        let highestDay = parseInt(localStorage.getItem(`trigger_highest_day_${currentLevel}`)) || 0;
        if (currentDay > highestDay) {
            currentStreak++; // 스트릭(연속 출석)은 레벨 상관없이 전역 유지
            localStorage.setItem('trigger_streak', currentStreak);
            localStorage.setItem(`trigger_highest_day_${currentLevel}`, currentDay);
        }
    }
    localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));

    if (currentSession <= 6) {
        currentSession++;
        localStorage.setItem(`trigger_session_${currentLevel}`, currentSession);
        
        if (currentSession === 7) {
            let unlockedDay = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
            if (unlockedDay === currentDay) {
                localStorage.setItem(`trigger_unlocked_day_${currentLevel}`, unlockedDay + 1);
            }
        }
    }

    if (finishedSession >= 6) {
        showSystemMessage("🎉 오늘의 단어 6세션 최종 완료! 수고하셨습니다!<br><span style='font-size:0.8rem; color:#aaa; display:inline-block; margin-top:15px;'>카카오톡으로 성과를 공유해 주세요.</span>");
        setTimeout(() => {
            shareKakao();
            setTimeout(() => { location.href = 'index.html'; }, 3000); 
        }, 3000);
    } else {
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        showSystemMessage(didTest ? "테스트 완료!" : `${finishedSession} 세션 단어를 마쳤어요.<br>실력이 늘고 있어요.`);
        setTimeout(() => { location.href = 'index.html'; }, 2500);
    }
}