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

// ★ 사전 복습(Pre-Review) 모드 제어 변수
let isPreReviewMode = false;
let todayWords = [];

function initApp() {
    try {
        const bar = document.getElementById('bar');
        const sessionTag = document.getElementById('session-tag'); 
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        const today = new Date().toLocaleDateString();
        if (localStorage.getItem('trigger_date') !== today) {
            localStorage.setItem('trigger_date', today);
            localStorage.setItem('trigger_session', '1');
        }
        let currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
        
        const currentDay = parseInt(localStorage.getItem('trigger_current_day')) || 1;
        const selectedLevel = localStorage.getItem('trigger_level') || 'middle';
        
        // 데이터가 Day별 객체로 변경됨
        const levelData = wordsData[selectedLevel] || {};
        
        if (currentDay === 6 || currentDay === 7) {
            targetWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            if (targetWords.length === 0) {
                document.getElementById('target').innerText = "저장된 오답이 없습니다. 메인으로 돌아갑니다.";
                setTimeout(() => { location.href = 'index.html'; }, 1500);
                return;
            }
        } else {
            todayWords = levelData[currentDay] || [];
            if (todayWords.length === 0) {
                document.getElementById('target').innerText = "해당 Day의 단어 데이터가 없습니다!";
                return;
            }

            // ★ 핵심 로직: 진도 시작 전 (Day 2 이상 & 1세션일 때) 전일/전전일 오답 강제 인터셉트
            if (currentDay > 1 && currentSession === 1) {
                let savedWrongs = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
                let preReviewWords = savedWrongs.filter(w => w.day === currentDay - 1 || w.day === currentDay - 2);
                
                if (preReviewWords.length > 0) {
                    isPreReviewMode = true;
                    targetWords = preReviewWords;
                    if (sessionTag) sessionTag.innerText = `🚨 사전 오답 복습 (Day ${currentDay-2}~${currentDay-1})`;
                    alert(`Day ${currentDay} 진도 시작 전, 과거의 오답 및 별표 단어를 먼저 복습합니다!`);
                    startStudy();
                    return; // 사전 복습 모드로 진입하며 아래 로직 스킵
                }
            }
            targetWords = todayWords; 
        }

        if (sessionTag) {
            sessionTag.innerText = currentSession > 6 ? `추가 복습 모드` : `Session ${currentSession} / 6`;
        }

        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && currentSession <= 6) {
            document.getElementById('target').innerText = "쿨타임 중입니다. 돌아갑니다.";
            setTimeout(() => { location.href = 'index.html'; }, 1000);
        } else {
            startStudy(); 
        }
    } catch (err) {
        const targetEl = document.getElementById('target');
        if(targetEl) targetEl.innerText = "에러: " + err.message;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function playPronunciation(text) {
    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
    } catch(e) {} 
}

function startStudy() {
    if (currentIdx >= targetWords.length) {
        // ★ 사전 복습 모드는 1회독 후 바로 테스트로 넘김 (시간 단축)
        if (isPreReviewMode && studyLoopCount < 1) {
            studyLoopCount++;
            currentIdx = 0; 
            startStudy();
            return;
        } else if (!isPreReviewMode && studyLoopCount < 2) {
            studyLoopCount++;
            currentIdx = 0; 
            startStudy();
            return;
        } else {
            currentIdx = 0;
            const currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
            
            if (isPreReviewMode || currentSession === 3 || currentSession === 6 || currentSession > 6) {
                document.getElementById('target').innerText = "4지선다 테스트 준비 중...";
                document.getElementById('ipa').innerText = "";
                document.getElementById('meanings').innerHTML = "";
                setTimeout(startTest, 1200);
            } else {
                document.getElementById('target').innerText = "각인 완료! 세션을 종료합니다...";
                document.getElementById('ipa').innerText = "";
                document.getElementById('meanings').innerHTML = "";
                setTimeout(() => finishSession(false), 1200);
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
        time -= 100;
        const bar = document.getElementById('bar');
        if(bar) bar.style.width = (time / 5000 * 100) + "%";
        if (time <= 0) { clearInterval(interval); handleAnswer(false); }
    }, 100);
    window.currentTimer = interval;
}

// ★ 별표(⭐) 토글 로직 추가
function toggleStar(wordObj) {
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentDay = parseInt(localStorage.getItem('trigger_current_day')) || 1;
    const idx = wrongWords.findIndex(w => w.word === wordObj.word);
    
    const starBtn = document.getElementById('star-btn');
    if (idx > -1) {
        wrongWords.splice(idx, 1); 
        if(starBtn) starBtn.innerText = "☆";
    } else {
        wrongWords.push({ ...wordObj, day: currentDay }); 
        if(starBtn) starBtn.innerText = "⭐";
    }
    localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
}

function updateUI(data, isTest = false) {
    // UI에 별표 버튼 동적 삽입
    let titleHtml = `${data.word} <button id="star-btn" style="background:none; border:none; font-size:1.5rem; cursor:pointer; vertical-align:middle; color:var(--neon-orange);">☆</button>`;
    document.getElementById('target').innerHTML = titleHtml;
    
    // 별표 상태 체크 및 이벤트 바인딩
    const starBtn = document.getElementById('star-btn');
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const isStarred = wrongWords.some(w => w.word === data.word);
    starBtn.innerText = isStarred ? "⭐" : "☆";
    starBtn.onclick = () => toggleStar(data);

    document.getElementById('ipa').innerText = data.ipa || '';
    const mBox = document.getElementById('meanings');
    
    const fullMeaning = data.meanings ? data.meanings.join(', ') : '뜻 없음';
    
    if (!isTest) {
        mBox.innerHTML = data.meanings.map(m => `<div>${m}</div>`).join('');
    } else {
        // 테스트 중에는 별표 버튼 숨김
        starBtn.style.display = 'none'; 
        const allOtherMeanings = targetWords.filter(w => w.word !== data.word).map(w => w.meanings.join(', '));
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
    const currentDay = parseInt(localStorage.getItem('trigger_current_day')) || 1;
    let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
    const currentWordData = targetWords[currentIdx];
    const idx = wrongWords.findIndex(w => w.word === currentWordData.word);

    if (isCorrect) {
        score++;
        // ★ 사전 복습에서 정답을 맞추면 오답 노트에서 해방시켜 줌 (성취감 제공)
        if (isPreReviewMode && idx > -1) {
            wrongWords.splice(idx, 1);
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    } else {
        if (idx === -1) {
            // 틀리면 오답에 '발생한 Day' 꼬리표를 달아서 저장
            wrongWords.push({ ...currentWordData, day: currentDay });
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    }
    currentIdx++;
    startTest();
}

function executeKakaoShare() {
    try {
        const userName = localStorage.getItem('trigger_name') || '학습자';
        const currentDay = localStorage.getItem('trigger_current_day') || 1;
        Kakao.Share.sendDefault({
            objectType: 'text',
            text: `🔥 ${userName}님이 Trigger Voca [Day ${currentDay}]를 완수했습니다!\n👉 최종 정답률: ${score} / ${targetWords.length}`,
            link: { mobileWebUrl: 'https://blackt.pages.dev', webUrl: 'https://blackt.pages.dev' },
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
    // ★ 사전 복습 모드 종료 처리: 대시보드로 가지 않고 바로 오늘 진도(1세션) 시작
    if (isPreReviewMode) {
        isPreReviewMode = false;
        targetWords = todayWords; 
        currentIdx = 0;
        score = 0;
        studyLoopCount = 1;
        document.getElementById('session-tag').innerText = `Session 1 / 6`;
        document.getElementById('target').innerText = "사전 복습 완료! 오늘 진도를 시작합니다.";
        setTimeout(startStudy, 1500);
        return;
    }

    let currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
    let finishedSession = currentSession;

    if (currentSession <= 6) {
        currentSession++;
        localStorage.setItem('trigger_session', currentSession);
        
        if (currentSession === 7) {
            let unlockedDay = parseInt(localStorage.getItem('trigger_unlocked_day')) || 1;
            const currentDay = parseInt(localStorage.getItem('trigger_current_day')) || 1;
            // 해당 Day를 끝냈을 때만 다음 Day 언락
            if (unlockedDay === currentDay) {
                localStorage.setItem('trigger_unlocked_day', unlockedDay + 1);
            }
        }
    }

    const targetEl = document.getElementById('target');
    const ipaEl = document.getElementById('ipa');
    const meaningsEl = document.getElementById('meanings');
    if(ipaEl) ipaEl.innerText = "";
    if(meaningsEl) meaningsEl.innerHTML = "";

    if (finishedSession >= 6) {
        targetEl.innerText = "🎉 6세션 완수! 카카오톡 호출 중...";
        setTimeout(() => {
            shareKakao();
            setTimeout(() => { location.href = 'index.html'; }, 3000); 
        }, 1500);
    } else {
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        
        targetEl.innerText = didTest ? "테스트 완료! 메인 화면으로 돌아갑니다." : "학습 완료! 메인 화면으로 돌아갑니다.";
        setTimeout(() => { location.href = 'index.html'; }, 1500);
    }
}