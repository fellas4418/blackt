// 카카오 SDK 에러 방어 및 초기화
try {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        // 여기에 사용자님의 실제 카카오 JavaScript 키를 넣습니다.
        Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
    }
} catch (e) { 
    console.log("카카오 초기화 대기 중", e); 
}

let currentIdx = 0;
let score = 0;
let targetWords = []; 
let studyLoopCount = 1; 
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const bar = document.getElementById('bar');
const sessionTag = document.getElementById('session-tag'); 

// ★ 훈련 시작 버튼(footer) 완전히 숨기기
const footer = document.querySelector('.footer');
if (footer) footer.style.display = 'none';

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
        sessionTag.innerText = currentSession > 5 ? `추가 복습 모드` : `Session ${currentSession} / 5`;
    }

    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime && endTime - Date.now() > 0 && currentSession <= 5) {
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
            alert(`각인 완료! 인출 테스트를 시작합니다.`);
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

function shareKakao() {
    try {
        if (typeof Kakao === 'undefined') {
            alert("카카오 스크립트를 불러오지 못했습니다. 애드블록 등을 끄고 시도해주세요.");
            return;
        }

        if (!Kakao.isInitialized()) {
            Kakao.init('fbb1520306ffaad0a882e993109a801c'); 
        }

        const userName = localStorage.getItem('trigger_name') || '학습자';
        Kakao.Share.sendDefault({
            objectType: 'text',
            text: `🔥 ${userName}님이 Trigger Voca 오늘의 목표 [5세션]을 완수했습니다!\n👉 마지막 정답률: ${score} / ${targetWords.length}`,
            link: { mobileWebUrl: 'https://blackt.pages.dev', webUrl: 'https://blackt.pages.dev' },
            buttonTitle: '나도 도전하기',
        });
    } catch (e) {
        // ★ 상세 에러 원인 표출
        alert("카카오 공유 에러: " + e.message + "\n(도메인 등록 여부를 확인해주세요)");
    }
}

function finishSession() {
    if (currentSession <= 5) {
        currentSession++;
        localStorage.setItem('trigger_session', currentSession);
    }

    if (currentSession > 5) {
        setTimeout(() => {
            const wantShare = confirm(`최종 결과: ${score} / ${targetWords.length}\n🎉 5세션 완수!\n확인(OK)을 누르면 카카오톡으로 결과가 공유됩니다.`);
            
            if(wantShare) {
                shareKakao();
                // ★ 팝업 킬(Kill) 방지: 카톡 창이 뜰 시간 2.5초 확보
                setTimeout(() => {
                    location.href = 'index.html';
                }, 2500); 
            } else {
                location.href = 'index.html'; 
            }
        }, 300);
    } else {
        const endTime = Date.now() + COOL_DOWN_TIME;
        localStorage.setItem('blackt_cooldown', endTime);
        alert(`테스트 완료! (정답: ${score}/${targetWords.length})\n쿨타임이 시작되어 메인 화면으로 돌아갑니다.`);
        location.href = 'index.html'; 
    }
}