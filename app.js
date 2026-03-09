let currentIdx = 0;
let score = 0;
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

// [핵심 수정] 페이지 로드 시 대기 없이 '즉시' 각인 엔진 자동 시작
window.onload = () => {
    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime && endTime - Date.now() > 0) {
        startCooldownTimer(endTime - Date.now());
    } else {
        // 쿨타임이 아니면 버튼을 숨기고 즉시 단어 학습 시작
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

// Step 2: 6초 각인 엔진
function startStudy() {
    if (currentIdx >= wordsDB.length) {
        currentIdx = 0;
        alert("각인 완료! 5초 인출 테스트 시작.");
        startTest();
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data); 
    
    // 뜻 한 번에 모두 표시
    const items = document.querySelectorAll('#meanings div');
    items.forEach(item => item.classList.add('active'));

    // 자동 음성 발음 2번 (시작 즉시, 3초 뒤)
    playPronunciation(data.word);
    setTimeout(() => playPronunciation(data.word), 3000);

    let time = 6000;
    const interval = setInterval(() => {
        time -= 100;
        bar.style.width = (time / 6000 * 100) + "%";

        if (time <= 0) {
            clearInterval(interval);
            currentIdx++;
            setTimeout(startStudy, 500);
        }
    }, 100);
}

// Step 4: 5초 인출 테스트
function startTest() {
    if (currentIdx >= wordsDB.length) {
        finishSession();
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data, true);

    let time = 5000; 
    const interval = setInterval(() => {
        time -= 100;
        bar.style.width = (time / 5000 * 100) + "%";
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
        const choices = [data.meanings[0], "실행하다", "일관된", "분석하다"].sort(() => Math.random() - 0.5);
        mBox.innerHTML = choices.map(c => `<button class="choice-btn" onclick="handleAnswer('${c}' === '${data.meanings[0]}')">${c}</button>`).join('');
    }
}

function handleAnswer(isCorrect) {
    clearInterval(window.currentTimer);
    if (isCorrect) score++;
    currentIdx++;
    startTest();
}

function finishSession() {
    const endTime = Date.now() + COOL_DOWN_TIME;
    localStorage.setItem('blackt_cooldown', endTime);
    alert(`결과: ${score} / ${wordsDB.length}\n10분 휴식 시작.`);
    startCooldownTimer(COOL_DOWN_TIME);
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
            }
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            if (mainBtn) mainBtn.innerText = `뇌 고착 휴식 (${mins}:${secs < 10 ? '0' : ''}${secs})`;
        }
    }, 1000);
}

// 만약을 대비한 수동 시작 버튼 로직 유지
if(mainBtn) {
    mainBtn.onclick = () => { mainBtn.style.display = 'none'; startStudy(); };
}