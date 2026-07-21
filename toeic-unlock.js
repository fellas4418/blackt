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

    function isToeicFamilyLevel(level) {
        return level === 'toeic' || level === 'toeic_note';
    }

    function initToeicProgressIfNeeded() {
        if (!localStorage.getItem('trigger_current_day_toeic')) {
            localStorage.setItem('trigger_current_day_toeic', '1');
            localStorage.setItem('trigger_unlocked_day_toeic', '1');
            localStorage.setItem('trigger_session_toeic', '1');
        }
    }

    function initToeicNoteProgressIfNeeded() {
        if (!localStorage.getItem('trigger_current_day_toeic_note')) {
            localStorage.setItem('trigger_current_day_toeic_note', '1');
            localStorage.setItem('trigger_unlocked_day_toeic_note', '1');
            localStorage.setItem('trigger_session_toeic_note', '1');
        }
    }

    function clampToeicDayKeys() {
        const maxDay = (typeof TriggerToeicSchedule !== 'undefined' && TriggerToeicSchedule.TOEIC_TOTAL_DAYS)
            ? TriggerToeicSchedule.TOEIC_TOTAL_DAYS
            : 54;
        ['trigger_current_day_toeic', 'trigger_unlocked_day_toeic'].forEach(function (key) {
            const v = parseInt(localStorage.getItem(key), 10);
            if (v > maxDay) localStorage.setItem(key, String(maxDay));
        });
    }

    function clampToeicNoteDayKeys() {
        const maxDay = (typeof TriggerToeicSchedule !== 'undefined' && TriggerToeicSchedule.TOEIC_NOTE_TOTAL_DAYS)
            ? TriggerToeicSchedule.TOEIC_NOTE_TOTAL_DAYS
            : 4;
        ['trigger_current_day_toeic_note', 'trigger_unlocked_day_toeic_note'].forEach(function (key) {
            const v = parseInt(localStorage.getItem(key), 10);
            if (v > maxDay) localStorage.setItem(key, String(maxDay));
        });
    }

    window.isToeicUnlocked = function () {
        return localStorage.getItem('trigger_toeic_unlocked') === '1';
    };

    window.applyToeicLevelButton = function () {
        const btn = document.getElementById('btn-toeic');
        if (!btn) return;
        btn.style.display = window.isToeicUnlocked() ? '' : 'none';
        if (typeof applyThirdLevelSlot === 'function') applyThirdLevelSlot();
    };

    function enableToeicMode() {
        localStorage.setItem('trigger_toeic_unlocked', '1');
        initToeicProgressIfNeeded();
        initToeicNoteProgressIfNeeded();
        clampToeicDayKeys();
        clampToeicNoteDayKeys();
        window.applyToeicLevelButton();
        if (typeof window.selectLevel === 'function') {
            window.selectLevel('toeic');
        } else {
            localStorage.setItem('trigger_level', 'toeic');
            if (typeof window.applyToeicModeBadge === 'function') window.applyToeicModeBadge(true);
            if (typeof window.updateDashboardUI === 'function') window.updateDashboardUI();
        }
    }

    window.applyToeicModeBadge = function (show) {
        const el = document.getElementById('toeic-mode-badge');
        if (!el) return;
        const lvl = localStorage.getItem('trigger_level') || 'middle';
        const active = show !== undefined ? show : isToeicFamilyLevel(lvl);
        if (!active) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'block';
        if (lvl === 'toeic_note') {
            el.textContent = 'LC NOTE TRACK';
        } else {
            el.textContent = 'TOEIC TRACK';
        }
    };

    window.syncLevelOnLoad = function () {
        window.applyToeicLevelButton();
        let lvl = localStorage.getItem('trigger_level') || 'middle';
        if (isToeicFamilyLevel(lvl) && !window.isToeicUnlocked()) {
            lvl = 'middle';
            localStorage.setItem('trigger_level', 'middle');
        }
        if (isToeicFamilyLevel(lvl)) {
            initToeicProgressIfNeeded();
            initToeicNoteProgressIfNeeded();
            clampToeicDayKeys();
            clampToeicNoteDayKeys();
            if (typeof window.selectLevel === 'function') {
                window.selectLevel(lvl);
            } else {
                window.applyToeicModeBadge(true);
                if (typeof window.updateDashboardUI === 'function') window.updateDashboardUI();
            }
            return;
        }
        if (typeof window.selectLevel === 'function') {
            window.selectLevel(lvl);
        } else {
            window.applyToeicModeBadge(false);
        }
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
        alert('토익 모드가 활성화되었습니다.\n「LC 오답노트」 또는 「공식 커리큘럼」을 선택해 학습하세요.');
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
