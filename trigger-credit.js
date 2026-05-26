/**
 * 트리거 크레딧 — localStorage 기반 (단어 학습 보상)
 */
(function (global) {
    var STORAGE_BALANCE = 'trigger_credit_balance';
    var DAILY_BASE = 10;
    var ACCURACY_BONUS = 5;
    var ACCURACY_BONUS_MIN = 90;
    var WEEK_BONUS = 50;
    var KAKAO_BONUS = 3;

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
            '<p style="color:var(--neon-orange);font-size:0.95rem;margin-top:14px;line-height:1.5;">' +
            '◆ 트리거 크레딧 <strong style="color:#fff;">+' +
            totalEarn +
            '</strong><br><span style="color:#aaa;font-size:0.85rem;">' +
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

    function showCreditInfo() {
        alert(
            '◆ 트리거 크레딧\n\n' +
                '단어 학습을 완료하면 쌓이는 보상 포인트예요.\n' +
                '모은 크레딧은 문법·할인 등에 사용됩니다. (연동 일정은 추후 안내)\n\n' +
                '【 쌓는 방법 】\n' +
                '· 당일 학습 완료(80% 이상): +' +
                DAILY_BASE +
                '\n· 정확도 90% 이상: +' +
                ACCURACY_BONUS +
                ' 추가\n· 주차 완료(Day 7·14…): +' +
                WEEK_BONUS +
                '\n· 카톡 공유(하루 1회): +' +
                KAKAO_BONUS +
                '\n\n누적: ' +
                getBalance() +
                ' 크레딧'
        );
    }

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
        WEEK_BONUS: WEEK_BONUS
    };
})(typeof window !== 'undefined' ? window : global);
