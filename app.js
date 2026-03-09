let currentIdx = 0;
let isTestMode = false;
let score = 0;
const COOL_DOWN_TIME = 10 * 60 * 1000; // 10분 설정

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

// [추가] 페이지 로드 시 쿨타임 상태 확인
window.onload = () => {
    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime) {
        const remaining = endTime - Date.now();
        if (remaining > 0) {
            startCooldownTimer(remaining);
        }
    }
};

function playPronunciation(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
}

// Step 2: 6초 각인 엔진 (기존 유지)
function startStudy() {
    if (currentIdx >= wordsDB.length) {
        currentIdx = 0;
        isTestMode = true;
        alert("각인 완료! 이제 5초 인출 테스트를 시작합니다.");
        startTest();
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data);
    
    playPronunciation(data.word);
    setTimeout(() => playPronunciation(data.word), 3000);

    let time = 6000;
    const interval = setInterval(() => {
        time -= 100;
        bar.style.width = (time / 6000 * 100) + "%";
        
        const step = 6000 / data.meanings.length;
        const activeIdx = Math.floor((6000 - time) / step);
        const items = document.querySelectorAll('#meanings div');
        items.forEach((item, i) => item.classList.toggle('active', i === activeIdx));

        if (time <= 0) {
            clearInterval(interval);
            currentIdx++;
            setTimeout(startStudy, 500);
        }
    }, 100);
}

// Step 4: 5초 인출 테스트 (기존 유지)
function startTest() {
    if (currentIdx >= wordsDB.length) {
        finishSession(); // 결과 보고 및 쿨타임 시작으로 변경
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data, true);

    let time = 5000; 
    const interval = setInterval(() => {
        time -= 100;
        bar.style.width = (time / 5000 * 100) + "%";
        if (time <= 0) {
            clearInterval(interval);
            handleAnswer(false);
        }
    }, 100);
    window.currentTimer = interval;
}

function updateUI(data, isTest = false) {
    document.getElementById('display').className = `mode-${data.type}`;
    document.getElementById('target').innerText = data.word;
    document.getElementById('ipa').innerText = data.ipa;
    
    const mBox = document.getElementById('meanings');
    if (!isTest) {
        mBox.innerHTML = data.meanings.map(m => `<div>${m}</div>`).join('');
    } else {
        const choices = [data.meanings[0], "실행하다", "일관된", "분석하다"]
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);
        if (!choices.includes(data.meanings[0])) choices[0] = data.meanings[0];

        mBox.innerHTML = choices.map(c => 
            `<button class="choice-btn" onclick="handleAnswer('${c}' === '${data.meanings[0]}')">${c}</button>`
        ).join('');
    }
}

function handleAnswer(isCorrect) {
    clearInterval(window.currentTimer);
    if (isCorrect) {
        score++;
        playPronunciation("Correct");
    }
    currentIdx++;
    startTest();
}

// [추가] 세션 종료 및 쿨타임 기록
function finishSession() {
    const endTime = Date.now() + COOL_DOWN_TIME;
    localStorage.setItem('blackt_cooldown', endTime);
    alert(`최종 결과: ${score} / ${wordsDB.length}\n10분간 뇌 고착 휴식을 시작합니다.`);
    startCooldownTimer(COOL_DOWN_TIME);
}

// [추가] 쿨타임 타이머 구동
function startCooldownTimer(duration) {
    mainBtn.style.display = 'block';
    mainBtn.disabled = true;
    
    const timerInterval = setInterval(() => {
        const remaining = localStorage.getItem('blackt_cooldown') - Date.now();

        if (remaining <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem('blackt_cooldown');
            mainBtn.disabled = false;
            mainBtn.innerText = "다음 세션 시작";
            mainBtn.style.background = "var(--noun)";
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            mainBtn.innerText = `뇌 고착 휴식 중 (${mins}:${secs < 10 ? '0' : ''}${secs})`;
            mainBtn.style.background = "#334155";
        }
    }, 1000);
}

mainBtn.onclick = () => {
    mainBtn.style.display = 'none';
    startStudy();
};