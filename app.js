// 카카오 SDK 방어 및 초기화
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

// ★ 무한 로딩 방지용 방탄 앱 실행 함수
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
        
        // ★ 5일 진도 vs 2일 복습 분기 로직
        const currentDay = parseInt(localStorage.getItem('trigger_current_day')) || 1;
        const selectedLevel = localStorage.getItem('trigger_level') || 'middle';
        
        if (currentDay === 6 || currentDay === 7) {
            // Day 6, 7은 오답 노트에서 데이터 장전
            targetWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            if (targetWords.length === 0) {
                alert("🎉 저장된 오답이 없습니다! 주말 복습이 완벽히 끝났습니다.");
                location.href = 'index.html';
                return;
            }
        } else {
            // Day 1~5는 새 진도 장전
            if (typeof wordsData === 'undefined' || !wordsData[selectedLevel] || wordsData[selectedLevel].length === 0) {
                document.getElementById('target').innerText = "단어 데이터 파일 로딩 실패!";
                return;
            }
            targetWords = wordsData[selectedLevel]; 
        }

        if (sessionTag) {
            sessionTag.innerText = currentSession > 6 ? `추가 복습 모드` : `Session ${currentSession} / 6`;
        }

        const endTime = localStorage.getItem('blackt_cooldown');
        if (endTime && endTime - Date.now() > 0 && currentSession <= 6) {
            alert("현재 쿨타임 중입니다. 메인 화면으로 이동합니다.");
            location.href = 'index.html';
        } else {
            startStudy(); 
        }
    } catch (err) {
        // 에러 발생 시 무한 로딩 대신 에러 원인을 화면에 강제 출력
        const targetEl = document.getElementById('target');
        if(targetEl) targetEl.innerText = "로딩 에러: " + err.message;
    }
}

// 브라우저 캐시 무시하고 안전하게 실행
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
    } catch(e) {} // 음성 에러는 무시하고 진행
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
            if (currentSession === 3 || currentSession === 6 || currentSession > 6) {
                alert(`각인 완료! 인출(4지선다) 테스트를 시작합니다.`);
                startTest();
            } else {
                alert(`각인 완료! (테스트 없이 쿨타임으로 넘어갑니다)`);
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

function updateUI(data, isTest = false) {
    document.getElementById('target').innerText = data.word;
    document.getElementById('ipa').innerText = data.ipa || '';
    const mBox = document.getElementById('meanings');
    
    const fullMeaning = data.meanings ? data.meanings.join(', ') : '뜻 없음';
    
    if (!isTest) {
        mBox.innerHTML = data.meanings.map(m => `<div>${m}</div>`).join('');
    } else {
        const allOtherMeanings = targetWords.filter(w => w.word !== data.word).map(w => w.meanings.join(', '));
        let wrongChoices = [];
        
        while (wrongChoices.length < 3) {
            if (allOtherMeanings.length > 0) {
                const randomMeaning = allOtherMeanings[Math.floor(Math.random() * allOtherMeanings.length)];
                if(!wrongChoices.includes(randomMeaning)) wrongChoices.push(randomMeaning);
            } else {
                wrongChoices.push(`다른 오답 뜻 ${wrongChoices.length + 1}`);
            }
        }
        
        const choices = [fullMeaning, ...wrongChoices].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `<button class="choice-btn" onclick="handleAnswer('${c}' === '${fullMeaning}')">${c}</button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    clearInterval(window.currentTimer);
    if (isCorrect) {
        score++;
    } else {
        let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
        const currentWordData = targetWords[currentIdx];
        const isAlreadySaved = wrongWords.some(w => w.word === currentWordData.word);
        if (!isAlreadySaved) {
            wrongWords.push(currentWordData);
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
    } catch (e) { alert("카카오 공유 에러: " + e.message); }
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
    let currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
    if (currentSession <= 6) {
        currentSession++;
        localStorage.setItem('trigger_session', currentSession);
        
        if (currentSession === 7) {
            let unlockedDay = parseInt(localStorage.getItem('trigger_unlocked_day')) || 1;
            if (unlockedDay < 7) {
                localStorage.setItem('trigger_unlocked_day', unlockedDay + 1);
            }
        }
    }

    if (currentSession > 6) {
        setTimeout(() => {
            const wantShare = confirm(`최종 테스트 결과: ${score} / ${targetWords.length}\n🎉 총 6세션을 완수했습니다!\n확인(OK)을 누르면 카톡으로 공유됩니다.`);
            if(wantShare) {
                shareKakao();
                setTimeout(() => { location.href = 'index.html'; }, 3000); 
            } else { location.href = 'index.html'; }
        }, 300);
    } else {
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        
        if (didTest) {
            alert(`테스트 완료! (정답: ${score}/${targetWords.length})\n10분 쿨타임이 시작됩니다.`);
        } else {
            alert(`학습 완료! 10분 쿨타임이 시작됩니다.`);
        }
        location.href = 'index.html'; 
    }
}