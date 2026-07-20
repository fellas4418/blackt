/**
 * 트리거 크레딧 — localStorage 기반 (단어 학습 보상)
 */
(function (global) {
    var STORAGE_BALANCE = 'trigger_credit_balance';
    var DAILY_BASE = 10;
    var ACCURACY_BONUS = 5;
    var ACCURACY_BONUS_MIN = 90;
    var WEEK_BONUS = 20;
    var KAKAO_BONUS = 5;
    var APP_SHARE_REFERRAL_BONUS = 50;

    function getBalance() {
        var n = parseInt(localStorage.getItem(STORAGE_BALANCE), 10);
        return isNaN(n) || n < 0 ? 0 : n;
    }

    function setBalance(n) {
        localStorage.setItem(STORAGE_BALANCE, String(Math.max(0, Math.floor(n))));
        updateDisplay();
    }

    function addCredit(amount, reason) {
        var amt = Math.floor(Number(amount) || 0);
        if (amt <= 0) return 0;
        var next = getBalance() + amt;
        setBalance(next);
        if (reason) {
            try {
                var log = JSON.parse(localStorage.getItem('trigger_credit_log') || '[]');
                if (!Array.isArray(log)) log = [];
                log.unshift({ t: Date.now(), a: amt, r: String(reason) });
                if (log.length > 30) log.length = 30;
                localStorage.setItem('trigger_credit_log', JSON.stringify(log));
            } catch (e) {}
        }
        return amt;
    }

    function normalizePhone(raw) {
        return String(raw || '').replace(/[^0-9]/g, '');
    }

    var REFERRAL_API_BASE = 'https://trigger-ocr-api.ohryee.workers.dev';
    var REFERRAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

    function referralIdFromPhone(phone) {
        var p = normalizePhone(phone);
        return p && /^010\d{8}$/.test(p) ? 'r' + p : '';
    }

    function getMyReferralId() {
        var fromPhone = referralIdFromPhone(localStorage.getItem('trigger_phone'));
        if (fromPhone) return fromPhone;
        var guest = localStorage.getItem('trigger_referral_guest_id');
        if (!guest) {
            guest = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            localStorage.setItem('trigger_referral_guest_id', guest);
        }
        return guest;
    }

    function persistReferredBy(ref) {
        ref = String(ref || '').trim();
        if (!ref) return;
        try {
            sessionStorage.setItem('trigger_referred_by', ref);
        } catch (e) {}
        try {
            localStorage.setItem('trigger_referred_by', ref);
            localStorage.setItem('trigger_referred_by_at', String(Date.now()));
        } catch (e) {}
    }

    function clearReferredBy() {
        try {
            sessionStorage.removeItem('trigger_referred_by');
        } catch (e) {}
        try {
            localStorage.removeItem('trigger_referred_by');
            localStorage.removeItem('trigger_referred_by_at');
        } catch (e) {}
    }

    function getReferredBy() {
        try {
            var fromSession = String(sessionStorage.getItem('trigger_referred_by') || '').trim();
            if (fromSession) return fromSession;
        } catch (e) {}
        try {
            var fromLs = String(localStorage.getItem('trigger_referred_by') || '').trim();
            var at = parseInt(localStorage.getItem('trigger_referred_by_at') || '0', 10) || 0;
            if (fromLs && at && Date.now() - at < REFERRAL_TTL_MS) return fromLs;
            if (fromLs && (!at || Date.now() - at >= REFERRAL_TTL_MS)) clearReferredBy();
        } catch (e) {}
        return '';
    }

    function captureReferralFromUrl() {
        try {
            var ref = new URLSearchParams(window.location.search).get('ref');
            ref = String(ref || '').trim();
            if (!ref) return;
            persistReferredBy(ref);
            var url = new URL(window.location.href);
            url.searchParams.delete('ref');
            window.history.replaceState({}, document.title, url.pathname + (url.search || '') + url.hash);
        } catch (e) {}
    }

    function postReferralApi(path, body) {
        var base = REFERRAL_API_BASE.replace(/\/$/, '');
        return fetch(base + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        })
            .then(function (res) {
                return res.json();
            })
            .catch(function () {
                return null;
            });
    }

    function reportReferralSignup(referrerId, refereePhone) {
        referrerId = String(referrerId || '').trim();
        var phone = normalizePhone(refereePhone);
        if (!referrerId || !/^010\d{8}$/.test(phone)) return;
        if (referrerId === referralIdFromPhone(phone)) return;
        clearReferredBy();
        postReferralApi('/api/referral/signup', {
            referrer_id: referrerId,
            referee_phone: phone
        });
    }

    function syncReferralCreditsFromServer() {
        var myId = getMyReferralId();
        if (!myId || myId.charAt(0) !== 'r') return Promise.resolve(0);
        return postReferralApi('/api/referral/claim', { referrer_id: myId }).then(function (data) {
            var count = data && Number(data.count) > 0 ? Number(data.count) : 0;
            if (!count) return 0;
            return addCredit(count * APP_SHARE_REFERRAL_BONUS, '앱 공유 · 신규 가입 ' + count + '명');
        });
    }

    function dayEarnKey(level, dayNum) {
        return 'trigger_credit_day_' + level + '_' + dayNum;
    }

    function weekEarnKey(level, weekNum) {
        return 'trigger_credit_week_' + level + '_' + weekNum;
    }

    function kakaoEarnKey() {
        return 'trigger_credit_kakao_' + new Date().toLocaleDateString();
    }

    function earnDailyComplete(level, dayNum, accuracy) {
        var acc = Number(accuracy) || 0;
        if (acc < 80) return { total: 0, parts: [] };
        var key = dayEarnKey(level, dayNum);
        if (localStorage.getItem(key) === '1') return { total: 0, parts: [], already: true };
        localStorage.setItem(key, '1');
        var parts = [];
        var sum = addCredit(DAILY_BASE, '당일 학습 완료 Day ' + dayNum);
        parts.push({ label: '당일 완료', amount: sum });
        if (acc >= ACCURACY_BONUS_MIN) {
            var b = addCredit(ACCURACY_BONUS, '정확도 ' + acc + '%');
            parts.push({ label: '정확도 보너스', amount: b });
            sum += b;
        }
        return { total: sum, parts: parts };
    }

    function tryWeekBonus(level, completedDay) {
        var day = Number(completedDay) || 0;
        if (day < 1 || day % 7 !== 0) return { total: 0, week: 0 };
        var weekNum = day / 7;
        var key = weekEarnKey(level, weekNum);
        if (localStorage.getItem(key) === '1') return { total: 0, week: weekNum, already: true };
        localStorage.setItem(key, '1');
        var amt = addCredit(WEEK_BONUS, weekNum + '주차 보너스');
        return { total: amt, week: weekNum };
    }

    function isWeekBonusClaimed(level, weekNum) {
        return localStorage.getItem(weekEarnKey(level, weekNum)) === '1';
    }

    function claimWeekBonus(level, weekNum) {
        var w = Number(weekNum) || 0;
        if (w < 1) return 0;
        var key = weekEarnKey(level, w);
        if (localStorage.getItem(key) === '1') return 0;
        localStorage.setItem(key, '1');
        return addCredit(WEEK_BONUS, w + '주차 보너스 (수동 수령)');
    }

    function earnKakaoShare() {
        var key = kakaoEarnKey();
        if (localStorage.getItem(key) === '1') return 0;
        localStorage.setItem(key, '1');
        return addCredit(KAKAO_BONUS, '카톡 공유');
    }

    function formatEarnedHtml(dailyResult, weekResult) {
        var lines = [];
        if (dailyResult && dailyResult.total > 0 && dailyResult.parts) {
            dailyResult.parts.forEach(function (p) {
                lines.push('+' + p.amount + ' ' + p.label);
            });
        }
        if (weekResult && weekResult.total > 0) {
            lines.push('+' + weekResult.total + ' ' + weekResult.week + '주차 보너스');
        }
        if (!lines.length) return '';
        var totalEarn = (dailyResult && dailyResult.total) || 0;
        totalEarn += (weekResult && weekResult.total) || 0;
        return (
            '<p class="study-complete-credit-earn">' +
            '◆ 트리거 크레딧 <strong>+' +
            totalEarn +
            '</strong><br><span class="study-complete-credit-parts">' +
            lines.join(' · ') +
            '</span></p>'
        );
    }

    function updateDisplay() {
        var bal = String(getBalance());
        var el = document.getElementById('trigger-credit-value');
        if (el) el.textContent = bal;
        var el2 = document.getElementById('trigger-credit-value-study');
        if (el2) el2.textContent = bal;
    }

    function fillCreditModal() {
        var balEl = document.getElementById('credit-modal-balance');
        if (balEl) balEl.textContent = String(getBalance());
        var dailyEl = document.getElementById('credit-modal-daily-amt');
        if (dailyEl) dailyEl.textContent = '+' + DAILY_BASE;
        var accEl = document.getElementById('credit-modal-acc-amt');
        if (accEl) accEl.textContent = '+' + ACCURACY_BONUS;
        var weekEl = document.getElementById('credit-modal-week-amt');
        if (weekEl) weekEl.textContent = '+' + WEEK_BONUS;
        var kakaoEl = document.getElementById('credit-modal-kakao-amt');
        if (kakaoEl) kakaoEl.textContent = '+' + KAKAO_BONUS;
        var shareEl = document.getElementById('credit-modal-share-amt');
        if (shareEl) shareEl.textContent = '+' + APP_SHARE_REFERRAL_BONUS;
    }

    function showCreditInfo() {
        var modal = document.getElementById('credit-modal');
        if (modal) {
            fillCreditModal();
            modal.style.display = 'flex';
            return;
        }
        alert(
            '◆ 트리거 크레딧\n\n' +
                '다양한 트리거 앱 이용을 통해 쌓이는 보상 포인트예요. 모은 크레딧은 트리거 앱 이용 금액 할인에 사용됩니다. (할인 연동 준비 중)\n\n' +
                '· 당일 학습 완료(80% 이상): +' +
                DAILY_BASE +
                '\n· 정확도 90% 이상: +' +
                ACCURACY_BONUS +
                ' 추가\n· 주차 완료(Day 7·14…): +' +
                WEEK_BONUS +
                '\n· 학습 완료 카톡 공유(하루 1회): +' +
                KAKAO_BONUS +
                '\n· 앱 공유 → 신규 가입: +' +
                APP_SHARE_REFERRAL_BONUS +
                '\n\n누적: ' +
                getBalance() +
                ' 크레딧'
        );
    }

    function closeCreditInfo() {
        var modal = document.getElementById('credit-modal');
        if (modal) modal.style.display = 'none';
    }

    captureReferralFromUrl();

    global.TriggerCredit = {
        getBalance: getBalance,
        addCredit: addCredit,
        earnDailyComplete: earnDailyComplete,
        tryWeekBonus: tryWeekBonus,
        isWeekBonusClaimed: isWeekBonusClaimed,
        claimWeekBonus: claimWeekBonus,
        earnKakaoShare: earnKakaoShare,
        formatEarnedHtml: formatEarnedHtml,
        updateDisplay: updateDisplay,
        showCreditInfo: showCreditInfo,
        closeCreditInfo: closeCreditInfo,
        getMyReferralId: getMyReferralId,
        captureReferralFromUrl: captureReferralFromUrl,
        getReferredBy: getReferredBy,
        persistReferredBy: persistReferredBy,
        clearReferredBy: clearReferredBy,
        reportReferralSignup: reportReferralSignup,
        syncReferralCreditsFromServer: syncReferralCreditsFromServer,
        WEEK_BONUS: WEEK_BONUS,
        APP_SHARE_REFERRAL_BONUS: APP_SHARE_REFERRAL_BONUS
    };
})(typeof window !== 'undefined' ? window : global);
