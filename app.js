let currentIdx = 0;
let score = 0;
const COOL_DOWN_TIME = 10 * 60 * 1000; 

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

window.onload = () => {
    const endTime = localStorage.getItem('blackt_cooldown');
    if (endTime && endTime - Date.now() > 0) startCooldownTimer(endTime - Date.now());
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
    mainBtn.style.display = 'block';
    mainBtn.disabled = true;
    const timerInterval = setInterval(() => {
        const remaining = localStorage.getItem('blackt_cooldown') - Date.now();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem('blackt_cooldown');
            mainBtn.disabled = false;
            mainBtn.innerText = "다음 세션 시작";
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            mainBtn.innerText = `뇌 고착 휴식 (${mins}:${secs < 10 ? '0' : ''}${secs})`;
        }
    }, 1000);
}

mainBtn.onclick = () => { mainBtn.style.display = 'none'; startStudy(); };