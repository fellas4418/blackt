// ★★★ 카카오 SDK 초기화 (본인 앱 키 유지 필수) ★★★
if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    Kakao.init('YOUR_KAKAO_JAVASCRIPT_KEY'); 
}

let currentIdx = 0;
let score = 0;
let targetWords = []; 
let studyLoopCount = 1; // 1세션 내 단어 반복 횟수 제어용
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');
const sessionTag = document.getElementById('session-tag'); // study.html 상단 태그

// 날짜 초기화 및 현재 세션 확인
const today = new Date().toLocaleDateString();
if (localStorage.getItem('trigger_date') !== today) {
    localStorage.setItem('trigger_date', today);
    localStorage.setItem('trigger_session', '1');
}
let currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;

window.onload = () => {
    const selectedLevel = localStorage.getItem('trigger_level') || 'middle';
    
    if (typeof wordsData === 'undefined' || !wordsData[selectedLevel] || wordsData[selectedLevel].length === 0) {
        document.getElementById('target').innerText = "데이터 오류!";
        return;
    }

    targetWords = wordsData[selectedLevel]; 
    
    // 훈련장 화면 상단에 현재 세션 표시
    if (sessionTag) {
        sessionTag.innerText = `Session ${currentSession} / 5`;
    }

    if (currentSession > 5) {
        alert("오늘의 5회 세션을 모두 완료했습니다! 내일 다시 시도해주세요.");
        location.href = 'index.html';
        return;
    }

    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime && endTime - Date.now() > 0) {
        startCooldownTimer(endTime - Date.now());
    } else {
        if (mainBtn) mainBtn.style.display = 'none';
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
    // 1회독이 끝났을 때의 처리 (1세션 2회 반복 로직)
    if (currentIdx >= targetWords.length) {
        if (studyLoopCount < 2) {
            studyLoopCount++;
            currentIdx = 0; // 인덱스 초기화 후 바로 2회독 시작 (흐름 끊기지 않게 알림 생략)
            startStudy();
            return;
        } else {
            // 2회독 모두 끝나면 테스트 시작
            currentIdx = 0;
            alert(`각인 2회독 완료! Session ${currentSession} 인출 테스트를 시작합니다.`);
            startTest();
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
        finishSession();
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
        const choices = [data.meanings[0], "오답1", "오답2", "오답3"].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `<button class="choice-btn" onclick="handleAnswer('${c}' === '${data.meanings[0]}')">${c}</button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    clearInterval(window.currentTimer);
    if (isCorrect) score++;
    currentIdx++;
    startTest();
}

function shareKakao() {
    const userName = localStorage.getItem('trigger_name') || '학습자';
    Kakao.Share.sendDefault({
        objectType: 'text',
        text: `🔥 ${userName}님이 Trigger Voca 오늘의 목표 [5세션]을 완수했습니다!\n👉 마지막 정답률: ${score} / ${targetWords.length}`,
        link: {
            mobileWebUrl: 'https://blackt.pages.dev',
            webUrl: 'https://blackt.pages.dev',
        },
        buttonTitle: '나도 도전하기',
    });
}

function finishSession() {
    // 세션 종료 후 카운트 1 증가
    currentSession++;
    localStorage.setItem('trigger_session', currentSession);

    // 총 5회를 모두 마친 경우 (팝업 차단 우회용 confirm 팝업 적용)
    if (currentSession > 5) {
        if(confirm(`최종 결과: ${score} / ${targetWords.length}\n🎉 축하합니다! 오늘 목표인 5세션을 모두 완료했습니다.\n\n확인(OK)을 누르면 카카오톡으로 결과가 공유됩니다.`)) {
            shareKakao();
        }
        location.href = 'index.html'; // 팝업 닫히면 대시보드로 자동 복귀
    } else {
        // 아직 5회가 안 끝났으면 10분 쿨타임 시작
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        alert(`결과: ${score} / ${targetWords.length}\n10분 휴식 후 다음 세션(${currentSession}/5)이 시작됩니다.`);
        startCooldownTimer(COOL_DOWN_TIME);
    }
}

function startCooldownTimer(duration) {
    if (mainBtn) {
        mainBtn.style.display = 'block';
        mainBtn.disabled = true;
    }
    const timerInterval = setInterval(() => {
        const remaining = localStorage.getItem('blackt_cooldown') - Date.now();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem('blackt_cooldown');
            if (mainBtn) {
                mainBtn.disabled = false;
                mainBtn.innerText = "다음 세션 시작";
                mainBtn.style.borderColor = "var(--neon-orange)";
                mainBtn.style.color = "#fff";
                mainBtn.onclick = () => { mainBtn.style.display = 'none'; startStudy(); };
            }
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            if (mainBtn) {
                mainBtn.innerText = `뇌 고착 휴식 (${mins}:${secs < 10 ? '0' : ''}${secs})`;
                mainBtn.style.borderColor = "#444";
                mainBtn.style.color = "#666";
            }
        }
    }, 1000);
}