<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trigger Voca - Neon</title>
    <link rel="stylesheet" href="style.css">
    <style>
        #login-modal, #wrong-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.95); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; transition: opacity 0.5s; }
        .login-card { background: var(--card-bg-color); border: 1px solid var(--neon-blue); box-shadow: var(--glow-blue); border-radius: 20px; padding: 30px; width: 85%; max-width: 400px; text-align: center; max-height: 80vh; overflow-y: auto; }
        .login-title { font-size: 1.8rem; font-weight: bold; margin-bottom: 20px; text-shadow: var(--glow-text); }
        .input-group { margin-bottom: 15px; text-align: left; }
        .input-label { font-size: 0.9rem; color: #888; margin-bottom: 5px; display: block; }
        .neon-input { width: 100%; box-sizing: border-box; padding: 12px; background: #000; border: 1px solid #444; border-radius: 10px; color: #fff; font-size: 1rem; transition: 0.3s; }
        .neon-input:focus { outline: none; border-color: var(--neon-blue); box-shadow: 0 0 10px rgba(0,243,255,0.3); }
        .checkbox-group { display: flex; align-items: center; gap: 10px; margin: 20px 0; font-size: 0.9rem; color: #aaa; text-align: left; }
        .login-btn { width: 100%; padding: 15px; background: transparent; border: 2px solid var(--neon-green); color: #fff; font-size: 1.1rem; font-weight: bold; border-radius: 12px; cursor: pointer; box-shadow: var(--glow-green); margin-top: 10px;}
        #welcome-msg { text-align: center; color: var(--neon-blue); font-size: 1.1rem; margin-bottom: 20px; text-shadow: 0 0 5px var(--neon-blue); }
        .clickable-card { cursor: pointer; transition: 0.2s; }
        .clickable-card:active { transform: scale(0.95); }
    </style>
</head>
<body class="dashboard-bg">
    
    <div id="login-modal" style="display:none;">
        <div class="login-card">
            <div class="login-title">Trigger Voca</div>
            <div class="input-group"><span class="input-label">이름 (실명)</span><input type="text" id="user-name" class="neon-input"></div>
            <div class="input-group"><span class="input-label">전화번호 (선택)</span><input type="tel" id="user-phone" class="neon-input"></div>
            <div class="checkbox-group"><input type="checkbox" id="agree-privacy"><label for="agree-privacy">개인정보 수집 동의</label></div>
            <button class="login-btn" onclick="handleLogin()">시작하기</button>
        </div>
    </div>

    <div id="wrong-modal" style="display:none; z-index: 2000;">
        <div class="login-card" style="border-color: var(--neon-green); box-shadow: 0 0 15px var(--neon-green);">
            <div class="login-title" style="color:var(--neon-green); text-shadow: 0 0 10px var(--neon-green);">오답 노트</div>
            <div id="wrong-list" style="text-align:left; color:#fff; margin-bottom:20px; font-size:1.1rem; line-height:1.8;"></div>
            <button class="login-btn" onclick="document.getElementById('wrong-modal').style.display='none'">닫기</button>
        </div>
    </div>

    <div class="dashboard-container">
        <div class="logo">Trigger<br>Voca</div>
        <div id="welcome-msg"></div>

        <div class="card level-section">
            <div class="level-title">학습 레벨 선택</div>
            <div class="level-buttons">
                <button class="level-btn active" id="btn-middle" onclick="selectLevel('middle')">📚 중등단어</button>
                <button class="level-btn" id="btn-high" onclick="selectLevel('high')">🎓 고등단어</button>
            </div>
        </div>

        <div class="card study-section">
            <div class="map-icon">🗺️</div>
            <div class="study-title">오늘의 학습</div>
            <div class="target-words">목표 단어: <span class="target-count" id="target-count-display">0개</span></div>
            <button class="start-btn" id="start-btn-main" onclick="location.href='study.html'">학습 시작하기</button>
        </div>

        <div class="info-row">
            <div class="card info-card">
                <div class="info-title title-orange">내 단어장</div>
                <div class="info-count" id="total-word-count">0 단어</div>
            </div>
            <div class="card info-card clickable-card" onclick="showWrongWords()">
                <div class="info-title title-green">오답/별표 (클릭)</div>
                <div class="info-count" id="wrong-word-count">0 단어</div>
            </div>
        </div>

        <div class="card routine-section">
            <div class="routine-header">📅 7일 루틴 (80% 통과제)</div>
            <ul class="routine-list" id="routine-list-container">
            </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; display: flex; flex-direction: column; gap: 12px; align-items: center;">
            <button onclick="localStorage.setItem('trigger_session', '3'); localStorage.removeItem('blackt_cooldown'); location.reload();" style="background: none; border: none; color: var(--neon-blue); text-decoration: underline; cursor: pointer; font-size: 0.95rem; font-weight: bold;">
                ⏩ 3세션으로 강제 스킵 (첫 테스트 진입)
            </button>
            <button onclick="localStorage.setItem('trigger_session', '6'); localStorage.removeItem('blackt_cooldown'); location.reload();" style="background: none; border: none; color: var(--neon-orange); text-decoration: underline; cursor: pointer; font-size: 0.95rem; font-weight: bold;">
                ⏩ 6세션으로 강제 스킵 (최종 테스트 진입)
            </button>
            <button onclick="localStorage.clear(); location.reload();" style="background: none; border: none; color: #555; text-decoration: underline; cursor: pointer; font-size: 0.85rem;">
                🔄 모든 데이터 완전 초기화
            </button>
        </div>

    </div>

    <script src="wordData.js"></script>
    <script>
        const today = new Date().toLocaleDateString();
        if (localStorage.getItem('trigger_date') !== today) {
            localStorage.setItem('trigger_date', today);
            localStorage.setItem('trigger_session', '1');
        }

        // ★ Day 리스트 자동 렌더링 함수 추가
        function renderRoutine() {
            let unlockedDay = parseInt(localStorage.getItem('trigger_unlocked_day')) || 1;
            const container = document.getElementById('routine-list-container');
            if (!container) return;
            
            let html = '';
            for(let i=1; i<=7; i++) {
                if (i < unlockedDay) {
                    html += `<li class="routine-item"><span class="day-label">Day ${i}</span><button class="routine-action-btn" style="border-color:#444; color:#aaa;" onclick="location.href='study.html'">완료</button></li>`;
                } else if (i === unlockedDay) {
                    html += `<li class="routine-item"><span class="day-label">Day ${i}</span><button class="routine-action-btn active" onclick="location.href='study.html'">시작</button></li>`;
                } else {
                    html += `<li class="routine-item"><span class="day-label">Day ${i}</span><button class="routine-action-btn" onclick="unlockDay(this, ${i})">🔒 잠김</button></li>`;
                }
            }
            container.innerHTML = html;
        }

        function showWrongWords() {
            const wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            const listContainer = document.getElementById('wrong-list');
            if(wrongWords.length === 0) {
                listContainer.innerHTML = "<p style='text-align:center; color:#888;'>오늘 저장된 오답이 없습니다.</p>";
            } else {
                listContainer.innerHTML = wrongWords.map(w => `<div style="padding:10px 0; border-bottom:1px solid #333;"><strong>${w.word}</strong> <span style="color:#888; font-size:0.9rem;">${w.meanings.join(', ')}</span></div>`).join('');
            }
            document.getElementById('wrong-modal').style.display = 'flex';
        }

        function unlockDay(btn, day) {
            if(confirm(`Day ${day}의 잠금을 강제로 해제하시겠습니까?`)) {
                localStorage.setItem('trigger_unlocked_day', day);
                renderRoutine();
            }
        }

        function updateDashboardUI() {
            const wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            document.getElementById('wrong-word-count').innerText = wrongWords.length + " 단어";

            const endTime = localStorage.getItem('blackt_cooldown');
            const startBtn = document.getElementById('start-btn-main');
            const currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
            
            if (window.cooldownInterval) clearInterval(window.cooldownInterval);

            if (currentSession > 6) {
                startBtn.disabled = false;
                startBtn.innerText = "추가 복습하기 (자유 학습)";
                startBtn.style.borderColor = "var(--neon-blue)";
                startBtn.style.boxShadow = "var(--glow-blue)";
                startBtn.style.color = "#fff";
                startBtn.onclick = () => location.href='study.html';
            } else if (endTime && endTime - Date.now() > 0) {
                startBtn.disabled = true;
                startBtn.style.borderColor = "#444";
                startBtn.style.boxShadow = "none";
                startBtn.style.color = "#666";
                startBtn.onclick = null; 
                
                window.cooldownInterval = setInterval(() => {
                    const remaining = endTime - Date.now();
                    if (remaining <= 0) {
                        clearInterval(window.cooldownInterval);
                        localStorage.removeItem('blackt_cooldown');
                        startBtn.disabled = false;
                        startBtn.innerText = "학습 시작하기";
                        startBtn.style.borderColor = "var(--neon-orange)";
                        startBtn.style.boxShadow = "var(--glow-orange)";
                        startBtn.style.color = "#fff";
                        startBtn.onclick = () => location.href='study.html';
                    } else {
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        startBtn.innerText = `쿨타임 중 (${mins}:${secs < 10 ? '0' : ''}${secs})`;
                    }
                }, 1000);
            }
            // ★ UI 업데이트 시 루틴 리스트도 다시 그려줌
            renderRoutine();
        }

        function checkLoginStatus() {
            const savedName = localStorage.getItem('trigger_name');
            const currentSession = parseInt(localStorage.getItem('trigger_session')) || 1;
            const modal = document.getElementById('login-modal');
            const welcomeMsg = document.getElementById('welcome-msg');

            if (savedName) {
                modal.style.display = 'none';
                welcomeMsg.innerText = currentSession > 6 
                    ? `환영합니다, ${savedName}님! 🔥 (오늘 6회 완수!)` 
                    : `환영합니다, ${savedName}님! 🔥 (오늘 진행도: ${currentSession}/6 세션)`;
            } else {
                modal.style.display = 'flex';
            }
            updateDashboardUI();
        }

        function handleLogin() {
            const name = document.getElementById('user-name').value.trim();
            const agree = document.getElementById('agree-privacy').checked;
            if (!name) return alert("이름을 입력해주세요.");
            if (!agree) return alert("개인정보 수집에 동의하셔야 합니다.");
            localStorage.setItem('trigger_name', name);
            checkLoginStatus(); 
        }

        function selectLevel(level) {
            localStorage.setItem('trigger_level', level);
            document.getElementById('btn-middle').className = "level-btn";
            document.getElementById('btn-high').className = "level-btn";
            document.getElementById('btn-' + level).className = "level-btn active";

            if (typeof wordsData !== 'undefined' && wordsData[level]) {
                const count = wordsData[level].length;
                document.getElementById('total-word-count').innerText = count + " 단어";
                document.getElementById('target-count-display').innerText = count + "개";
            }
        }

        window.onload = function() {
            checkLoginStatus();
            selectLevel(localStorage.getItem('trigger_level') || 'middle');
        }
    </script>
</body>
</html>