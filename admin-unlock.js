(function () {
    /** 관리자 모드 — 코드 추가·변경은 여기만 수정 */
    const ADMIN_UNLOCK_CODES = {
        blacktadmin: true,
    };
    const TAP_COUNT = 5;
    const TAP_WINDOW_MS = 2500;

    function normalizeCode(raw) {
        return String(raw || '').trim().replace(/\s+/g, '').toLowerCase();
    }

    function applyAdminUnlock() {
        if (typeof window.enableAdminMode === 'function') {
            window.enableAdminMode(true);
            return;
        }
        try {
            localStorage.setItem('trigger_admin_mode', 'true');
        } catch (e) {}
        if (typeof examRptSyncAdminSection === 'function') {
            examRptSyncAdminSection();
        }
        alert('🛠️ 관리자 모드 활성화!\n선생님 메모·학생 의뢰 목록을 사용할 수 있습니다.');
    }

    function tryUnlockAdmin() {
        const raw = prompt('관리자 코드를 입력하세요.');
        if (raw === null) return;
        const code = normalizeCode(raw);
        if (!code || !ADMIN_UNLOCK_CODES[code]) {
            alert('코드를 확인해 주세요.');
            return;
        }
        applyAdminUnlock();
    }

    function initAdminSecretUnlock() {
        let taps = 0;
        let tapTimer = null;
        document.addEventListener('click', function (ev) {
            const corner = ev.target.closest('[data-admin-unlock-corner]');
            if (!corner) return;
            ev.preventDefault();
            ev.stopPropagation();
            taps++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(function () { taps = 0; }, TAP_WINDOW_MS);
            if (taps < TAP_COUNT) return;
            taps = 0;
            tryUnlockAdmin();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdminSecretUnlock);
    } else {
        initAdminSecretUnlock();
    }
})();
