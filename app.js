// 🚀 [글로벌 해결책] 모든 시스템 메시지의 크기를 강제로 고정하는 함수
function showSystemMessage(text) {
    const targetEl = document.getElementById('target');
    const meaningsEl = document.getElementById('meanings');
    
    if (targetEl) {
        targetEl.innerHTML = text;
        // 💡 중요: setProperty와 !important를 써서, 그 어떤 CSS 설정보다 우선하게 만듭니다.
        // 여기서 16px이나 18px로 원하시는 크기를 딱 한 번만 정하면 됩니다.
        targetEl.style.setProperty('font-size', '18px', 'important'); 
        targetEl.style.setProperty('text-shadow', 'none', 'important');
        targetEl.style.color = '#aaaaaa';
        targetEl.style.lineHeight = '1.6';
        targetEl.style.marginTop = '20px';
    }
    if (meaningsEl) meaningsEl.innerHTML = "";
}
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

// 🚀 [사이즈 최적화] 시스템 메시지 출력 함수 (작고 차분하게)
function showSystemMessage(text) {
    const targetEl = document.getElementById('target');
    const meaningsEl = document.getElementById('meanings');
    
    if (targetEl) {
        targetEl.innerHTML = text;
        // 시스템 메시지는 작고 네온 없이 처리
        targetEl.style.fontSize = '2.8rem'; 
        targetEl.style.textShadow = 'none';
        targetEl.style.color = '#aaa';
        targetEl.style.lineHeight = '1.5';
        targetEl.style.wordBreak = 'keep-all';
        targetEl.style.marginTop = '20px';
    }
    if (meaningsEl) meaningsEl.innerHTML = "";
}

// 🚀 [사이즈 최적화] 카운트다운 화면 (숫자만 크게, 문구는 작게)
function startCountdown(message, callback) {
    let count = 3;
    const renderHtml = (c) => `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:160px;">
            <div style="font-size:0.8rem; color:#888; margin-bottom:15px; text-shadow:none;">${message}</div>
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
                showSystemMessage(`Day ${currentDay}의<br>단어 데이터가 없습니다.`);
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
                    
                    startCountdown("사전 오답 테스트를 시작합니다.", startTest);
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
            showSystemMessage("잠시 쉬어주세요.<br>10분 뒤에 다시 열립니다.");
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

// 🚀 [사이즈 최적화] 메인 단어 학습 UI 업데이트
function updateUI(data, isTest = false) {
    const targetEl = document.getElementById('target');
    const mBox = document.getElementById('meanings');
    
    if (!data || !data.word) return;

    const safeMeanings = Array.isArray(data.meanings) ? data.meanings : ["뜻 정보 없음"];
    const fullMeaning = safeMeanings.join(', ');

    // 단어 화면에서는 다시 스타일 복구 (크고 네온 있게)
    targetEl.style.fontSize = '3rem'; 
    targetEl.style.textShadow = '0 0 15px #fff';
    targetEl.style.color = '#fff';
    targetEl.style.marginTop = '0px';

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
        // 학습 모드 뜻 크기 조정
        mBox.innerHTML = safeMeanings.map(m => `<div style="font-size:2.2rem; font-weight:bold; margin-bottom:15px;">${m}</div>`).join('');
    } else {
        if(starBtn) starBtn.style.display = 'none'; 
        
        const allOtherMeanings = targetWords.filter(w => w.word !== data.word).map(w => {
            return Array.isArray(w.meanings) ? w.meanings.join(', ') : "뜻 정보 없음";
        });
        
        let availableMeanings = [...allOtherMeanings]; 
        let wrongChoices = [];
        while (wrongChoices.length < 3) {
            if (availableMeanings.length > 0) {
                const randomIdx = Math.floor(Math.random() * availableMeanings.length);
                wrongChoices.push(availableMeanings[randomIdx]);
                availableMeanings.splice(randomIdx, 1); 
            } else {
                wrongChoices.push(`오답 ${wrongChoices.length + 1}`);
            }
        }
        
        const choices = [fullMeaning, ...wrongChoices].sort(() => Math.random() - 0.5);
        // 🚀 테스트 버튼 글자 크기 조정 (뜻이 길어질 경우 대비)
        mBox.innerHTML = choices.map(c => {
            const isCorrect = (c === fullMeaning);
            const fontSize = c.length > 15 ? '1.1rem' : '1.4rem';
            return `<button class="choice-btn" style="font-size:${fontSize} !important; padding:18px !important;" onclick="handleAnswer(${isCorrect})">${c}</button>`;
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
        currentIdx = 0;
        score = 0;
        studyLoopCount = 1;
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
        showSystemMessage("🎉 6세션 최종 완료! 수고하셨습니다!<br><span style='font-size:0.9rem; color:#888;'>결과를 친구들에게 자랑해 보세요.</span>");
        setTimeout(() => { shareKakao(); setTimeout(() => { location.href = 'index.html'; }, 3000); }, 2500);
    } else {
        localStorage.setItem('blackt_cooldown', Date.now() + COOL_DOWN_TIME);
        showSystemMessage(didTest ? "테스트 완료! 👍" : "세션 완료! 🔥<br>조금씩 실력이 늘고 있어요.");
        setTimeout(() => { location.href = 'index.html'; }, 2200);
    }
}

function shareKakao() {
    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
        const currentUrl = window.location.origin; 
        if (!Kakao.isInitialized()) Kakao.init('fbb1520306ffaad0a882e993109a801c');
        Kakao.Share.sendDefault({
            objectType: 'text',
            text: `🔥 ${userName}님이 Day ${currentDay} 목표를 달성했습니다!\n👉 최종 정답률: ${score} / ${targetWords.length}`,
            link: { mobileWebUrl: currentUrl, webUrl: currentUrl },
            buttonTitle: '나도 도전하기',
        });
    } catch (e) {}
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }