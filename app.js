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
const COOL_DOWN_TIME = 3 * 60 * 1000; 

let isPreReviewMode = false;
let todayWords = [];
let isMuted = localStorage.getItem('trigger_muted') === 'true';
let isPaused = false;
const currentLevel = localStorage.getItem('trigger_level') || 'middle';
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

// [수정] 안내 팝업 제어 함수 추가
function openGuide() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'flex';
}

function closeGuide() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('hasSeenGuide_2026', 'true');
}

function initApp() {
    wakeUpTTS(); 
    
    // [수정] 최초 1회 안내 팝업 노출 로직
    const hasSeenGuide = localStorage.getItem('hasSeenGuide_2026');
    if (!hasSeenGuide) {
        setTimeout(openGuide, 1500);
    }

    try {
        const sessionTag = document.getElementById('session-tag'); 
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        const muteBtn = document.getElementById('mute-toggle-btn');
        if (muteBtn) muteBtn.innerText = isMuted ? '🔇' : '🔊';

        const today = new Date().toLocaleDateString();
        
        const startDayKey = `trigger_start_day_${currentLevel}_${today}`;
        if (!localStorage.getItem(startDayKey)) {
            const currentUnlocked = parseInt(localStorage.getItem(`trigger_unlocked_day_${currentLevel}`)) || 1;
            localStorage.setItem(startDayKey, currentUnlocked);
        }
        const startDay = parseInt(localStorage.getItem(startDayKey));

        if (localStorage.getItem('trigger_date') !== today) {
            localStorage.setItem('trigger_date', today);
            localStorage.setItem('trigger_session_middle', '1');
            localStorage.setItem('trigger_session_high', '1');
            localStorage.setItem('trigger_unlocked_extra_today_middle', '0');
            localStorage.setItem('trigger_unlocked_extra_today_high', '0');
        }
        
        let currentSession = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
        const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
        
        let week = Math.ceil(currentDay / 7);
        let localDay = currentDay % 7 === 0 ? 7 : currentDay % 7;
        
        let dayData = null;
        if (typeof wordsData !== 'undefined' && wordsData[currentLevel] && wordsData[currentLevel]["week" + week]) {
            dayData = wordsData[currentLevel]["week" + week][String(localDay)];
        }

        if (!dayData || (startDay && currentDay >= startDay + 3)) {
            if (startDay && currentDay >= startDay + 3) {
                showSystemMessage(`뇌의 휴식이 필요합니다! 🧠<br>하루 최대 3일치까지만 학습 가능합니다.<br>내일 이어서 완주해 볼까요?`);
            } else {
                showSystemMessage(`Day ${currentDay} 데이터를<br>불러올 수 없습니다.`);
            }
            setTimeout(() => { location.href = 'index.html'; }, 2500);
            return;
        }

        const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);

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
            if (currentDay % 7 === 6) {
                todayWords = allReviewWords.slice(0, halfIndex);
            } else if (currentDay % 7 === 0) {
                todayWords = allReviewWords.slice(halfIndex);
            }
        } else {
            todayWords = dayData || []; 
        }

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
            
            if (currentSessionVal === 'final') {
                sessionTag.innerText = `최종 테스트 사이클 🔥`;
                sessionTag.style.color = "var(--neon-orange)";
            } else if (isReviewDay) {
                let sNum = parseInt(currentSessionVal) || 1;
                let displaySession = sNum >= 6 ? 2 : 1;
                sessionTag.innerText = sNum > 6 ? `자유 복습 모드` : `${displaySession} / 2 사이클 (주말복습)`;
                sessionTag.style.color = "";
            } else {
                let sNum = parseInt(currentSessionVal) || 1;
                sessionTag.innerText = sNum > 6 ? `자유 복습 모드` : `${sNum} / 6 사이클 진행 중`;
                sessionTag.style.color = "";
            }
        }

        if (localStorage.getItem('trigger_jump_test') === 'true') {
            localStorage.removeItem('trigger_jump_test'); 
            currentIdx = 0; 
            studyLoopCount = 2; 
            startCountdown("곧 테스트를 시작합니다.", startTest);
            return; 
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
    // [수정] 1사이클 내 1회/2회 반복 에너지 슬롯 연동
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
            const currentSession = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
            const sNum = Number(currentSession); 

            if (sNum === 3 || sNum === 6 || currentSession === 'final') {
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
    const headerEl = document.querySelector('.header'); 
    
    if (!targetEl || !mBox || !data) return;

    const oldCounter = document.getElementById('session-counter');
    if (oldCounter) oldCounter.remove();

    const currentNum = currentIdx + 1;
    const totalNum = targetWords.length;

    const counterHtml = `
        <div id="session-counter" style="text-align: center; margin-top: 10px; font-family: 'Pretendard', sans-serif;">
            <div style="font-size: 1.1rem; color: #555; font-weight: 800; margin-bottom: 2px; letter-spacing: 1px;">
                오늘의 단어 순서
            </div>
            <div style="font-size: 1rem; color: #aaa; font-weight: bold;">
                <span style="color: var(--neon-blue); font-size: 1.2rem;">${currentNum}</span> 
                <span style="color: #444; font-size: 0.8rem; margin: 0 3px;">/</span> 
                ${totalNum}
            </div>
        </div>
    `;
    
    if (headerEl) {
        headerEl.insertAdjacentHTML('beforeend', counterHtml);
    }

    let safeMeanings = Array.isArray(data.meanings) ? data.meanings : (data.meaning ? [data.meaning] : ["뜻 확인 필요"]);
    const fullMeaning = safeMeanings.join(', ');

    targetEl.style.setProperty('font-size', '3.3rem', 'important'); 
    targetEl.style.setProperty('text-shadow', '0 0 15px #fff', 'important');
    targetEl.style.setProperty('color', '#fff', 'important');
    targetEl.style.setProperty('margin-top', '0px', 'important');

    if (!isTest) {
        targetEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="display:flex; justify-content:center; align-items:center;">
                    <span style="font-size:1.8rem; visibility:hidden; pointer-events:none;">☆</span>
                    <span style="cursor:pointer; margin:0 10px;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</span>
                    <button id="star-btn" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:var(--neon-orange); padding-bottom:5px;">☆</button>
                </div>
                <div class="ipa-text" style="font-size:1.2rem; color:#888; margin-top:8px;">${data.ipa || ''}</div>
            </div>`;
        mBox.innerHTML = safeMeanings.map(m => `<div style="font-size:2.2rem; font-weight:bold; margin-bottom:15px;">${m}</div>`).join('');
        
        const starBtn = document.getElementById('star-btn');
        if(starBtn) {
            let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            const isStarred = wrongWords.some(w => w.word === data.word && w.level === currentLevel);
            starBtn.innerText = isStarred ? "⭐" : "☆";
            starBtn.onclick = (e) => { e.stopPropagation(); toggleStar(data); };
        }
    } else {
        targetEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:3.3rem; font-weight:bold; cursor:pointer;" onclick="playPronunciation('${data.word.replace(/'/g, "\\'")}', true)">${data.word}</div>
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
                <button class="choice-btn" style="font-size: 1.4rem !important; height: 75px !important; margin-bottom: 12px; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 5px 15px !important; line-height: 1.2; word-break: keep-all;" 
                onclick="handleAnswer(${c === fullMeaning})">${c}</button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    if (window.currentTimer) clearInterval(window.currentTimer);
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentWordData = targetWords[currentIdx];
    
    if (!currentWordData) return;
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);

    if (isCorrect) {
        score++;
        if (isReviewDay) {
            const idx = wrongWords.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
            if (idx > -1) {
                wrongWords.splice(idx, 1);
                localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
            }
        }
    } else {
        const idx = wrongWords.findIndex(w => w.word === currentWordData.word && w.level === currentLevel);
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
    let currentSessionRaw = localStorage.getItem(`trigger_session_${currentLevel}`) || '1';
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    
    const isReviewDay = (currentDay % 7 === 6 || currentDay % 7 === 0);
    const today = new Date().toLocaleDateString();
    
    let totalSessions = isReviewDay ? 2 : 6;
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

    let currentSessionDisplay = finishedNum >= totalSessions ? "완료 👑" : `${finishedNum} / ${totalSessions} 사이클`;
    stats[currentDay].status = currentSessionDisplay;

    const level = currentLevel;
    const allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const stillWrongCount = allWrongs.filter(w => w.level === level && w.day === currentDay && w.isWrong === true).length;
    const totalCount = (todayWords && todayWords.length > 0) ? todayWords.length : targetWords.length;
    let finalCorrectCount = totalCount - stillWrongCount;

    if (finalCorrectCount < 0) finalCorrectCount = 0;
    if (finalCorrectCount > totalCount) finalCorrectCount = totalCount;
    const accuracy = Math.floor((finalCorrectCount / totalCount) * 100);

    if (didTest && accuracy < 80 && (currentSessionRaw === '6' || (isReviewDay && currentSessionRaw === '2'))) {
        localStorage.setItem(`trigger_session_${currentLevel}`, 'final'); 
        showSystemMessage(`
            <div style="text-align:center;">
                <div style="font-size:1.5rem; color:var(--neon-orange); font-weight:bold;">아쉬운 점수! ${accuracy}%</div>
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

        showSystemMessage(`<div style="text-align:center;"><div style="font-size:1.5rem; color:var(--neon-green); font-weight:bold;">학습 완료! ${accuracy}%</div><button onclick="shareKakao()" style="width:100%; padding:16px; background:#fee500; border-radius:12px; margin-top:20px; border:none; font-weight:bold;">🟡 카톡 공유</button><button onclick="location.href='index.html'" style="margin-top:20px; background:none; border:none; color:#888; text-decoration:underline;">종료하기</button></div>`);
    } else {
        localStorage.setItem(`trigger_session_${currentLevel}`, finishedNum + 1);
        localStorage.setItem('blackt_cooldown', Date.now() + COOL_DOWN_TIME);
        localStorage.setItem(`trigger_stats_${currentLevel}`, JSON.stringify(stats));
        
        showSystemMessage("사이클 완료! 🔥");
        setTimeout(() => { location.href = 'index.html'; }, 2200);
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
    let allWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentDay = parseInt(localStorage.getItem(`trigger_current_day_${currentLevel}`)) || 1;
    let retryList = allWrongs.filter(w => w.level === currentLevel && w.day === currentDay);
    if (retryList.length < 1) retryList = todayWords;
    
    targetWords = retryList;
    currentIdx = 0;
    studyLoopCount = 2; 

    const sessionTag = document.getElementById('session-tag');
    if (sessionTag) {
        sessionTag.innerText = `최후의 사이클 1 / 1`;
        sessionTag.style.color = "var(--neon-orange)";
    }
    
    startStudy();
}

function shareKakao() {
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) return;
    
    const userName = localStorage.getItem('trigger_name') || '학습자';
    const currentDay = localStorage.getItem(`trigger_current_day_${currentLevel}`) || 1;
    const shareUrl = window.location.origin; 
    const acc = Math.floor((score/targetWords.length)*100);

    Kakao.Share.sendDefault({
        objectType: 'feed',
        content: { 
            title: `🔥 [${userName}]님, 오늘의 단어 완벽 마스터!`, 
            description: `🏅 정답률: ${acc}% (압도적 성적)\n📅 Day ${currentDay} 루틴 6사이클 완주 성공`, 
            imageUrl: 'https://blackt.pages.dev/images/share-cycles.png',
            link: { 
                mobileWebUrl: shareUrl, 
                webUrl: shareUrl 
            } 
        }
    });
}

function jumpToFinish() {
    const lvl = localStorage.getItem('trigger_level') || 'middle';
    localStorage.setItem('trigger_session_' + lvl, '6'); 
    localStorage.removeItem('blackt_cooldown');
    localStorage.setItem('trigger_jump_test', 'true');
    location.reload();
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }

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