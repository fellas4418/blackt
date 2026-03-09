let currentIdx = 0;
let score = 0;
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

// 페이지 로드 시 즉시 실행
window.onload = () => {
    // 단어 데이터가 아예 없을 경우 흰 화면 대신 에러를 띄워주는 안전 장치
    if (typeof wordsDB === 'undefined' || wordsDB.length === 0) {
        document.getElementById('target').innerText = "단어 파일 오류!";
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
    if (currentIdx >= wordsDB.length) {
        currentIdx = 0;
        alert("각인 완료! 5초 인출 테스트 시작.");
        startTest();
        return;
    }

    const data = wordsDB[currentIdx];
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
    if (currentIdx >= wordsDB.length) {
        finishSession();
        return;
    }

    const data = wordsDB[currentIdx];
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