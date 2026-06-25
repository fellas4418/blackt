(function () {
    /** 강사·토익 학생용 — 코드 추가·변경은 여기만 수정 */
    const TOEIC_UNLOCK_CODES = {
        noy: true,
    };
    const TAP_COUNT = 5;
    const TAP_WINDOW_MS = 2500;

    function normalizeCode(raw) {
        return String(raw || '').trim().replace(/\s+/g, '').toLowerCase();
    }

    function initToeicProgressIfNeeded() {
        if (!localStorage.getItem('trigger_current_day_toeic')) {
            localStorage.setItem('trigger_current_day_toeic', '1');
            localStorage.setItem('trigger_unlocked_day_toeic', '1');
            localStorage.setItem('trigger_session_toeic', '1');
        }
    }

    function enableToeicMode() {
        localStorage.setItem('trigger_level', 'toeic');
        localStorage.setItem('trigger_toeic_unlocked', '1');
        initToeicProgressIfNeeded();
        const maxDay = (typeof TriggerToeicSchedule !== 'undefined' && TriggerToeicSchedule.TOEIC_TOTAL_DAYS)
            ? TriggerToeicSchedule.TOEIC_TOTAL_DAYS
            : 54;
        ['trigger_current_day_toeic', 'trigger_unlocked_day_toeic'].forEach(function (key) {
            const v = parseInt(localStorage.getItem(key), 10);
            if (v > maxDay) localStorage.setItem(key, String(maxDay));
        });
        if (typeof window.applyToeicModeBadge === 'function') window.applyToeicModeBadge(true);
        if (typeof window.updateDashboardUI === 'function') window.updateDashboardUI();
    }

    window.applyToeicModeBadge = function (show) {
        const el = document.getElementById('toeic-mode-badge');
        if (!el) return;
        const active = show !== undefined ? show : localStorage.getItem('trigger_level') === 'toeic';
        el.style.display = active ? 'block' : 'none';
    };

    window.syncLevelOnLoad = function () {
        const lvl = localStorage.getItem('trigger_level') || 'middle';
        if (lvl === 'toeic') {
            const btnM = document.getElementById('btn-middle');
            const btnH = document.getElementById('btn-high');
            if (btnM) btnM.className = 'level-btn';
            if (btnH) btnH.className = 'level-btn';
            window.applyToeicModeBadge(true);
            const maxDay = TriggerToeicSchedule.TOEIC_TOTAL_DAYS;
            ['trigger_current_day_toeic', 'trigger_unlocked_day_toeic'].forEach(function (key) {
                const v = parseInt(localStorage.getItem(key), 10);
                if (v > maxDay) localStorage.setItem(key, String(maxDay));
            });
            if (typeof window.updateDashboardUI === 'function') window.updateDashboardUI();
            return;
        }
        window.applyToeicModeBadge(false);
        if (typeof window.selectLevel === 'function') window.selectLevel(lvl);
    };

    function tryUnlockToeic() {
        const raw = prompt('토익 모드 코드를 입력하세요.');
        if (raw === null) return;
        const code = normalizeCode(raw);
        if (!code || !TOEIC_UNLOCK_CODES[code]) {
            alert('코드를 확인해 주세요.');
            return;
        }
        enableToeicMode();
        alert('토익 모드가 활성화되었습니다.\n「학습 시작하기」로 시작하세요.');
    }

    function initToeicSecretUnlock() {
        let taps = 0;
        let tapTimer = null;
        document.addEventListener('click', function (ev) {
            const corner = ev.target.closest('[data-toeic-unlock-corner]');
            if (!corner) return;
            ev.preventDefault();
            ev.stopPropagation();
            taps++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(function () { taps = 0; }, TAP_WINDOW_MS);
            if (taps < TAP_COUNT) return;
            taps = 0;
            tryUnlockToeic();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToeicSecretUnlock);
    } else {
        initToeicSecretUnlock();
    }
})();
