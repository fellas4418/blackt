// 카카오 SDK 방어 및 초기화
try {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
    }
} catch (e) { console.log("카카오 초기화 대기 중", e); }

let currentIdx = 0;
let score = 0;
let targetWords = []; 
let studyLoopCount = 1; 
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const bar = document.getElementById('bar');
const sessionTag = document.getElementById('session-tag'); 

const footer = document.querySelector('.footer');
if (footer) footer.style.display = 'none';

const today = new Date().toLocaleDateString();
if (localStorage.getItem('trigger_date') !== today) {
    localStorage.setItem('trigger_date', today);
    localStorage.setItem('trigger_session', '1');
}
// ★ 총 세션이 6회로 늘어납니다.
let currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;

window.onload = () => {
    const selectedLevel = localStorage.getItem('trigger_level') || 'middle';
    
    if (typeof wordsData === 'undefined' || !wordsData[selectedLevel] || wordsData[selectedLevel].length === 0) {
        document.getElementById('target').innerText = "데이터 오류!";
        return;
    }
    targetWords = wordsData[selectedLevel]; 
    
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
};

function playPronunciation(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
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
            // ★ 3세션과 6세션에만 4지선다 테스트 진행
            if (currentSession === 3 || currentSession === 6 || currentSession > 6) {
                alert(`각인 완료! Session ${currentSession} 인출(4지선다) 테스트를 시작합니다.`);
                startTest();
            } else {
                // 테스트 없는 세션은 바로 종료 처리
                alert(`각인 완료! (이번 세션은 테스트 없이 쿨타임으로 넘어갑니다)`);
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
        finishSession(true); // 테스트를 치르고 종료함을 명시
        return;
    }

    const data = targetWords[currentIdx];
    updateUI(data, true);

    let time = 5000; 
    const interval = setInterval(() => {
        time -= 100;
        if(bar) bar.style.width = (time / 5000 * 100) + "%";
        if (time <= 0) { clearInterval(interval); handleAnswer(false); }
    }, 100);
    window.currentTimer = interval;
}

function updateUI(data, isTest = false) {
    document.getElementById('target').innerText = data.word;
    document.getElementById('ipa').innerText = data.ipa;
    const mBox = document.getElementById('meanings');
    
    if (!isTest) {
        mBox.innerHTML = data.meanings.map(m => `<div>${m}</div>`).join('');
    } else {
        // ★ 지능형 4지선다 오답 생성 로직
        const allOtherMeanings = targetWords.map(w => w.meanings[0]).filter(m => m !== data.meanings[0]);
        let wrongChoices = [];
        
        while (wrongChoices.length < 3) {
            if (allOtherMeanings.length > 0) {
                // 다른 단어가 있으면 거기서 뜻을 무작위로 뽑아옴
                const randomMeaning = allOtherMeanings[Math.floor(Math.random() * allOtherMeanings.length)];
                if(!wrongChoices.includes(randomMeaning)) wrongChoices.push(randomMeaning);
            } else {
                // 초고속 테스트용(단어가 1개뿐일 때) 임시 오답
                wrongChoices.push(`오답 ${wrongChoices.length + 1}`);
            }
        }
        
        const choices = [data.meanings[0], ...wrongChoices].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `<button class="choice-btn" onclick="handleAnswer('${c}' === '${data.meanings[0]}')">${c}</button>`).join('');
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
        Kakao.Share.sendDefault({
            objectType: 'text',
            text: `🔥 ${userName}님이 Trigger Voca 최종 목표 [6세션]을 완수했습니다!\n👉 마지막 인출 테스트 정답률: ${score} / ${targetWords.length}`,
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

// didTest 파라미터를 추가하여 테스트를 친 세션과 안 친 세션을 구분
function finishSession(didTest = true) {
    if (currentSession <= 6) {
        currentSession++;
        localStorage.setItem('trigger_session', currentSession);
    }

    if (currentSession > 6) {
        setTimeout(() => {
            const wantShare = confirm(`최종 테스트 결과: ${score} / ${targetWords.length}\n🎉 총 6세션을 모두 완수했습니다!\n확인(OK)을 누르면 카카오톡으로 공유됩니다.`);
            if(wantShare) {
                shareKakao();
                setTimeout(() => { location.href = 'index.html'; }, 3000); 
            } else { location.href = 'index.html'; }
        }, 300);
    } else {
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        
        if (didTest) {
            alert(`인출 테스트 완료! (정답: ${score}/${targetWords.length})\n쿨타임이 시작되어 메인 화면으로 돌아갑니다.`);
        } else {
            alert(`학습 완료! (다음 세션을 위해 메인 화면으로 돌아갑니다)`);
        }
        location.href = 'index.html'; 
    }
}