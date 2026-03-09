// ★★★ 카카오 SDK 초기화 (본인 앱 키 유지 필수) ★★★
if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    Kakao.init('YOUR_KAKAO_JAVASCRIPT_KEY'); 
}

let currentIdx = 0;
let score = 0;
let targetWords = []; 
let studyLoopCount = 1; 
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const bar = document.getElementById('bar');
const sessionTag = document.getElementById('session-tag'); 

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
        // 훈련장 진입 시 쿨타임이면 메인으로 쫓아냄
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
    
    if (isCorrect) {
        score++;
    } else {
        // [복습 시스템] 틀린 단어 로컬스토리지에 오답 노트로 저장
        let wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
        const currentWordData = targetWords[currentIdx];
        
        // 이미 틀린 단어가 중복으로 들어가는 것을 방지
        const isAlreadySaved = wrongWords.some(w => w.word === currentWordData.word);
        if (!isAlreadySaved) {
            wrongWords.push(currentWordData);
            localStorage.setItem('trigger_wrong_words', JSON.stringify(wrongWords));
        }
    }
    
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
    currentSession++;
    localStorage.setItem('trigger_session', currentSession);

    if (currentSession > 5) {
        if(confirm(`최종 결과: ${score} / ${targetWords.length}\n🎉 축하합니다! 오늘 목표인 5세션을 모두 완료했습니다.\n\n확인(OK)을 누르면 카카오톡으로 결과가 공유됩니다.`)) {
            shareKakao();
        }
        location.href = 'index.html'; 
    } else {
        // 10분 쿨타임 기록 후 메인 대시보드로 즉시 쫓아냄
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        alert(`테스트 완료! (정답: ${score}/${targetWords.length})\n10분 쿨타임이 시작되어 메인 화면으로 돌아갑니다.`);
        location.href = 'index.html'; 
    }
}