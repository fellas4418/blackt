(function () {
  const ADMIN_SESSION_LS = 'trigger_admin_mode_session';

  /** 새로고침 시 해제 · 같은 탭에서 페이지 이동 시에는 유지 */
  function reconcileAdminModeOnLoad() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const isReload = nav && nav.type === 'reload';
      const sessionActive = sessionStorage.getItem(ADMIN_SESSION_LS) === '1';
      if (isReload || !sessionActive) {
        localStorage.removeItem('trigger_admin_mode');
        if (isReload) sessionStorage.removeItem(ADMIN_SESSION_LS);
      }
    } catch (e) {}
  }

  reconcileAdminModeOnLoad();

  const TAP_COUNT = 5;
  const TAP_WINDOW_MS = 2500;

  function markAdminSession() {
    try {
      sessionStorage.setItem(ADMIN_SESSION_LS, '1');
    } catch (e) {}
  }

  function syncAdminUi() {
    if (typeof window.applyAdminPersistence === 'function') window.applyAdminPersistence();
    if (typeof examRptSyncAdminSection === 'function') examRptSyncAdminSection();
  }

  function applyAdminUnlock() {
    markAdminSession();
    if (typeof window.enableAdminMode === 'function') {
      window.enableAdminMode(true);
      return;
    }
    try {
      localStorage.setItem('trigger_admin_mode', 'true');
    } catch (e) {}
    syncAdminUi();
    alert('🛠️ 관리자 모드 활성화!\n선생님 메모·학생 의뢰 목록을 사용할 수 있습니다.\n(새로고침하면 해제됩니다)');
  }

  function initAdminSecretUnlock() {
    syncAdminUi();
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
      applyAdminUnlock();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminSecretUnlock);
  } else {
    initAdminSecretUnlock();
  }
})();
