// app.js - Step 4: 5초 인출 마스터 테스트 엔진
let testScore = 0;
let testCurrent = 0;
const TEST_TIME = 5000; // 5초 설정

function startTest() {
    if (testCurrent >= wordsDB.length) {
        showResult();
        return;
    }

    const data = wordsDB[testCurrent];
    const display = document.getElementById('display');
    const meaningBox = document.getElementById('meanings');
    const bar = document.getElementById('bar');
    
    // UI 초기화: 단어만 표시
    display.className = `mode-${data.type} test-mode`;
    document.getElementById('target').innerText = data.word;
    document.getElementById('ipa').innerText = data.ipa;
    
    // 객관식 보기 생성 (정답 1개 + 오답 3개 섞기)
    const choices = generateChoices(data.meanings[0]);
    meaningBox.innerHTML = choices.map(c => 
        `<button class="choice-btn" onclick="checkAnswer('${c}', '${data.meanings[0]}')">${c}</button>`
    ).join('');

    // 5초 타이머 시작
    let startTime = Date.now();
    const timerInterval = setInterval(() => {
        let elapsed = Date.now() - startTime;
        let progress = (elapsed / TEST_TIME) * 100;
        bar.style.width = (100 - progress) + "%";

        if (elapsed >= TEST_TIME) {
            clearInterval(timerInterval);
            nextQuestion(false); // 타임아웃 오답 처리
        }
    }, 50);

    window.currentTimer = timerInterval;
}

function checkAnswer(selected, correct) {
    clearInterval(window.currentTimer);
    if (selected === correct) testScore++;
    nextQuestion(true);
}

function nextQuestion(isAnswered) {
    testCurrent++;
    setTimeout(startTest, 500);
}

function showResult() {
    alert(`테스트 완료! 결과: ${testScore} / ${wordsDB.length}`);
    // 결과 전송 버튼 활성화 로직 추가 예정
}

// 보기 생성용 유틸리티 함수
function generateChoices(correctAnswer) {
    let choices = [correctAnswer];
    // 실제 구현 시에는 wordsDB에서 랜덤하게 오답을 가져오도록 보완합니다.
    choices.push("오답1", "오답2", "오답3"); 
    return choices.sort(() => Math.random() - 0.5);
}