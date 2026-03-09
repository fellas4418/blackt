let currentIdx = 0;
let isTestMode = false;
let score = 0;

const mainBtn = document.getElementById('main-action');
const bar = document.getElementById('bar');

// Step 2: 6초 주입 엔진
function startStudy() {
    if (currentIdx >= wordsDB.length) {
        currentIdx = 0; // 테스트를 위해 인덱스 초기화
        isTestMode = true;
        alert("주입 완료! 이제 5초 인출 테스트를 시작합니다.");
        startTest();
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data);
    
    let time = 6000;
    const interval = setInterval(() => {
        time -= 100;
        bar.style.width = (time / 6000 * 100) + "%";
        
        // 뜻 순차 하이라이트
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

// Step 4: 5초 인출 마스터 테스트 (수정됨)
function startTest() {
    if (currentIdx >= wordsDB.length) {
        alert(`최종 결과: ${score} / ${wordsDB.length}`);
        location.reload(); // 리셋
        return;
    }

    const data = wordsDB[currentIdx];
    updateUI(data, true);

    let time = 5000; // 5초 제한 [cite: 2026-03-04]
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
        // 5초 테스트용 객관식 생성
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

mainBtn.onclick = () => {
    mainBtn.style.display = 'none';
    startStudy();
};