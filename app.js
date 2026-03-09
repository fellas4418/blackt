let currentIdx = 0;
let isTestMode = false;
let score = 0;

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

// 발음 재생 함수 (Web Speech API 활용)
function playPronunciation(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8; // 학습을 위해 약간 천천히
    window.speechSynthesis.speak(utterance);
}

// Step 2: 6초 각인 엔진
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
    
    // 발음 두 번 재생 (시작 시 한 번, 3초 후 한 번)
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

// Step 4: 5초 인출 마스터 테스트
function startTest() {
    if (currentIdx >= wordsDB.length) {
        alert(`최종 결과: ${score} / ${wordsDB.length}`);
        location.reload(); 
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
        // 오답 후보 생성 로직
        const choices = [data.meanings[0], "실행하다", "일관된", "분석하다"]
            .filter((v, i, a) => a.indexOf(v) === i) // 중복 제거
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);
        
        // 정답이 잘렸을 경우 강제 삽입
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
        playPronunciation("Correct"); // 정답 시 피드백
    }
    currentIdx++;
    startTest();
}

mainBtn.onclick = () => {
    mainBtn.style.display = 'none';
    startStudy();
};