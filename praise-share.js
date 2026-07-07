/**
 * 카톡 칭찬 링크(pc) · 배지 · 복사용 축하 멘트 (analysis / index / study 공용)
 */
(function (global) {
    var BADGES = [
        { emoji: '◆', title: '몰입형', blurb: '한 번 시작하면 깊게 파는 타입이에요.' },
        { emoji: '◇', title: '성실형', blurb: '맡은 걸 꾸준히 해내는 타입이에요.' },
        { emoji: '▣', title: '개근형', blurb: '빠짐없이 매일 챙기는 타입이에요.' },
        { emoji: '▲', title: '끈기형', blurb: '지쳐도 포기하지 않는 타입이에요.' },
        { emoji: '◉', title: '집중형', blurb: '흐트러짐 없이 오늘에만 몰두하는 타입이에요.' },
        { emoji: '◎', title: '만점형', blurb: '테스트·정확도에서 실력을 보여 주는 타입이에요.' },
        { emoji: '⬡', title: '마라톤형', blurb: '길어도 끝까지 가는 타입이에요.' },
        { emoji: '◈', title: '불도저형', blurb: '어려워도 밀어붙이는 타입이에요.' }
    ];

    function fnv1a32(str) {
        var h = 2166136261 >>> 0;
        var s = String(str || '');
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    }

    function getWeekNewWordsPool(level, weekNum) {
        var wd = global.wordsData;
        if (!wd || !wd[level]) return [];
        var weekData = wd[level]['week' + weekNum];
        if (!weekData) return [];
        var pool = [];
        var seen = new Set();
        for (var localD = 1; localD <= 5; localD++) {
            var dayData = weekData[String(localD)];
            if (!Array.isArray(dayData)) continue;
            for (var i = 0; i < dayData.length; i++) {
                var w = dayData[i];
                var key = String((w && w.word) || '').trim().toLowerCase();
                if (!key || seen.has(key)) continue;
                seen.add(key);
                pool.push(w);
            }
        }
        return pool;
    }

    function isToeicLevel(level) {
        return level === 'toeic';
    }

    function isReviewDayForLevel(level, absoluteDay) {
        if (global.TriggerToeicSchedule && global.TriggerToeicSchedule.isReviewDay) {
            return global.TriggerToeicSchedule.isReviewDay(level, absoluteDay);
        }
        var day = parseInt(absoluteDay, 10) || 0;
        if (isToeicLevel(level)) return day > 0 && day % 6 === 0;
        var local = day % 7 === 0 ? 7 : day % 7;
        return local === 6 || local === 7;
    }

    function getReviewWordsForDay(level, absoluteDay) {
        if (global.TriggerToeicSchedule && global.TriggerToeicSchedule.isToeicLevel && global.TriggerToeicSchedule.isToeicLevel(level)) {
            if (!global.TriggerToeicSchedule.isReviewDay(level, absoluteDay)) return [];
            return global.TriggerToeicSchedule.buildToeicReviewWords(level, absoluteDay);
        }
        var localDay = absoluteDay % 7 === 0 ? 7 : absoluteDay % 7;
        if (localDay !== 6 && localDay !== 7) return [];
        var weekNum = Math.ceil(absoluteDay / 7);
        var pool = getWeekNewWordsPool(level, weekNum);
        if (!pool.length) return [];
        var halfIndex = Math.ceil(pool.length / 2);
        if (localDay === 6) return pool.slice(0, halfIndex);
        return pool.slice(halfIndex);
    }

    function getWordsForDay(level, absoluteDay) {
        var wd = global.wordsData;
        if (!wd || !wd[level]) return [];
        if (isToeicLevel(level)) {
            var toeicWeek = global.TriggerToeicSchedule && global.TriggerToeicSchedule.weekNumForLevel
                ? global.TriggerToeicSchedule.weekNumForLevel(level, absoluteDay)
                : Math.ceil(absoluteDay / 6);
            var toeicLocal = global.TriggerToeicSchedule && global.TriggerToeicSchedule.localDayForLevel
                ? global.TriggerToeicSchedule.localDayForLevel(level, absoluteDay)
                : (((absoluteDay - 1) % 6) + 1);
            if (isReviewDayForLevel(level, absoluteDay)) {
                return getReviewWordsForDay(level, absoluteDay);
            }
            var toeicWeekData = wd[level]['week' + toeicWeek];
            if (!toeicWeekData) return [];
            var toeicDayData = toeicWeekData[String(toeicLocal)];
            return Array.isArray(toeicDayData) ? toeicDayData : [];
        }
        var week = Math.ceil(absoluteDay / 7);
        var localDay = absoluteDay % 7 === 0 ? 7 : absoluteDay % 7;
        if (localDay === 6 || localDay === 7) {
            var fromPool = getReviewWordsForDay(level, absoluteDay);
            if (fromPool.length) return fromPool;
        }
        var weekData = wd[level]['week' + week];
        if (!weekData) return [];
        var dayData = weekData[String(localDay)];
        if (!dayData) return [];
        if ((localDay === 6 || localDay === 7) && !Array.isArray(dayData)) {
            var legacy = dayData.test || [];
            var half = Math.ceil(legacy.length / 2);
            return localDay === 6 ? legacy.slice(0, half) : legacy.slice(half);
        }
        return Array.isArray(dayData) ? dayData : [];
    }

    function normalizeLevel(level) {
        var lv = String(level || 'middle').trim().toLowerCase();
        if (lv === 'high') return 'high';
        if (lv === 'toeic') return 'toeic';
        return 'middle';
    }

    function levelLabelFor(levelOrCtx) {
        var lv =
            levelOrCtx && typeof levelOrCtx === 'object'
                ? normalizeLevel(levelOrCtx.l)
                : normalizeLevel(levelOrCtx);
        if (lv === 'high') return '고등단어';
        if (lv === 'toeic') return '토익단어';
        return '중등단어';
    }

    function statsFromStorage(kind) {
        var level = '';
        try {
            level = global.localStorage.getItem('trigger_level') || 'middle';
        } catch (e) {
            level = 'middle';
        }
        var userName = '학습자';
        try {
            userName = (global.localStorage.getItem('trigger_name') || '학습자').trim() || '학습자';
        } catch (e2) {}
        var displayDay = 1;
        try {
            displayDay = parseInt(global.localStorage.getItem('trigger_current_day_' + level), 10) || 1;
            if (global.localStorage.getItem('trigger_session_' + level) === '1' && displayDay > 1) displayDay--;
        } catch (e3) {}
        var learnedTotal = 0;
        var unlockedDay = 1;
        try {
            unlockedDay = parseInt(global.localStorage.getItem('trigger_unlocked_day_' + level), 10) || 1;
        } catch (e4) {}
        for (var i = 1; i < unlockedDay; i++) {
            if (isReviewDayForLevel(level, i)) continue;
            learnedTotal += getWordsForDay(level, i).length;
        }
        var accuracy = null;
        try {
            var stats = JSON.parse(global.localStorage.getItem('trigger_stats_' + level) || '{}');
            var dayStat = stats[String(displayDay)];
            if (dayStat != null && typeof dayStat === 'object' && dayStat.accuracy != null) {
                accuracy = Math.min(100, Math.max(0, parseInt(dayStat.accuracy, 10) || 0));
            }
        } catch (e5) {}
        var base = {
            n: userName.slice(0, 48),
            d: Math.min(999, Math.max(1, displayDay)),
            t: Math.min(999999, Math.max(0, learnedTotal)),
            k: kind === 'exam' ? 'exam' : 'voca',
            l: normalizeLevel(level)
        };
        if (accuracy != null) base.a = accuracy;
        var meta = praiseMetaFromCtx(base);
        base.b = meta.b;
        base.m = meta.m;
        return base;
    }

    function praiseMetaFromCtx(ctx) {
        var c = ctx || {};
        var seed =
            String(c.n || '') +
            '|' +
            Number(c.d) +
            '|' +
            Number(c.t) +
            '|' +
            String(c.k || 'voca');
        var h = fnv1a32(seed);
        return {
            b: (h >>> 0) % BADGES.length,
            m: ((h >>> 13) >>> 0) % 8
        };
    }

    function encodePc(ctx) {
        if (!ctx || typeof ctx !== 'object') return '';
        var seed =
            String(ctx.n || '') +
            '|' +
            Number(ctx.d) +
            '|' +
            Number(ctx.t) +
            '|' +
            String(ctx.k || 'voca') +
            '|' +
            Date.now();
        var h = fnv1a32(seed);
        var payload = {
            n: String(ctx.n || '학습자').slice(0, 48),
            d: Math.min(999, Math.max(1, parseInt(ctx.d, 10) || 1)),
            t: Math.min(999999, Math.max(0, parseInt(ctx.t, 10) || 0)),
            k: ctx.k === 'exam' ? 'exam' : 'voca',
            l: normalizeLevel(ctx.l),
            b: (h >>> 0) % BADGES.length,
            m: ((h >>> 13) >>> 0) % 8
        };
        if (ctx.a != null && ctx.a !== '') {
            payload.a = Math.min(100, Math.max(0, parseInt(ctx.a, 10) || 0));
        }
        try {
            return global
                .btoa(global.unescape(global.encodeURIComponent(JSON.stringify(payload))))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        } catch (e) {
            return '';
        }
    }

    function decodePc(s) {
        if (!s || typeof s !== 'string') return null;
        try {
            var b = s.replace(/-/g, '+').replace(/_/g, '/');
            while (b.length % 4) b += '=';
            var o = JSON.parse(global.decodeURIComponent(global.escape(global.atob(b))));
            if (!o || typeof o !== 'object') return null;
            return {
                n: String(o.n || '학습자').slice(0, 48),
                d: Math.min(999, Math.max(1, parseInt(o.d, 10) || 1)),
                t: Math.min(999999, Math.max(0, parseInt(o.t, 10) || 0)),
                k: o.k === 'exam' ? 'exam' : 'voca',
                l: normalizeLevel(o.l),
                b: Math.abs(parseInt(o.b, 10) || 0) % BADGES.length,
                m: Math.abs(parseInt(o.m, 10) || 0) % 8,
                a:
                    o.a != null && o.a !== ''
                        ? Math.min(100, Math.max(0, parseInt(o.a, 10) || 0))
                        : null
            };
        } catch (e2) {
            return null;
        }
    }

    function badgeFor(ctx) {
        var c = ctx || {};
        var idx = c.b;
        if (idx == null || isNaN(idx)) {
            idx = praiseMetaFromCtx(c).b;
        }
        idx = ((idx % BADGES.length) + BADGES.length) % BADGES.length;
        return BADGES[idx] || BADGES[0];
    }

    var HEADLINES = [
        '{{name}}님, 오늘 Day {{day}}까지 해냈어요. 누적 {{total}}단어 — 오늘의 학습 유형: {{emoji}} {{badge}}',
        '{{name}}님, 꾸준함이 보여요. (Day {{day}} · {{total}}단어) {{emoji}} {{badge}}',
        '{{emoji}} {{badge}}! {{name}}님, 오늘도 한 바퀴 끝냈어요. Day {{day}}, 총 {{total}}단어.',
        '{{name}}님, Day {{day}} 학습 완료 · 지금까지 {{total}}단어. 오늘 유형 {{emoji}} {{badge}}',
        '{{name}}님, 쌓인 게 벌써 {{total}}단어예요. 오늘 Day {{day}} — {{emoji}} {{badge}}',
        '{{name}}님 오늘 기록: Day {{day}}, {{total}}단어. 오늘의 학습 유형 {{emoji}} {{badge}}',
        '{{name}}님, 오늘 한 줄: "끝까지 해냈다" — Day {{day}} / {{total}}단어 / {{badge}} {{emoji}}',
        '{{emoji}} 응원 전달! {{name}}님 · Day {{day}} · {{total}}단어 · 「{{badge}}」'
    ];

    function sub(tpl, ctx, badge) {
        var b = badge || badgeFor(ctx);
        return tpl
            .replace(/\{\{name\}\}/g, ctx.n)
            .replace(/\{\{day\}\}/g, String(ctx.d))
            .replace(/\{\{total\}\}/g, String(ctx.t))
            .replace(/\{\{badge\}\}/g, b.title)
            .replace(/\{\{emoji\}\}/g, b.emoji);
    }

    function headlineFor(ctx) {
        return sub(HEADLINES[ctx.m % HEADLINES.length], ctx, badgeFor(ctx));
    }

    function copyWarm(ctx) {
        var b = badgeFor(ctx);
        var lines = [
            '{{name}}님, 오늘 Day {{day}}까지 해낸 거 정말 대단해요. 늘 응원해요. (오늘 유형 {{emoji}} {{badge}} · 누적 {{total}}단어)',
            '{{name}}님, 매일 조금씩 모여 벌써 {{total}}단어예요. 오늘 Day {{day}}도 수고 많았어요. {{emoji}} {{badge}}',
            '{{name}}님에게: 힘들 때일수록 지금처럼 해냈다는 게 멋있어요. Day {{day}} · {{badge}} {{emoji}} · {{total}}단어, 함께 가요.',
            '{{name}}님, 오늘도 목표까지 왔네요 (Day {{day}}). 과정이 자랑스러워요. {{emoji}} {{badge}} · {{total}}단어',
            '{{name}}님 늘 응원해요. Day {{day}}, 누적 {{total}}단어 — 오늘의 학습 유형 {{emoji}} {{badge}}!',
            '{{name}}님, 피곤했을 텐데 끝까지 했죠? 그 마음이 제일 예뻐요. Day {{day}} · {{total}}단어 · {{badge}} {{emoji}}',
            '{{name}}님에게 보내는 박수 👏 Day {{day}} 완료, {{total}}단어. {{emoji}} {{badge}} 최고예요.',
            '{{name}}님, 오늘도 한 걸음 전진! Day {{day}} · {{total}}단어. {{emoji}} 「{{badge}}」 응원해요.'
        ];
        return sub(lines[ctx.m % lines.length], ctx, b);
    }

    function copyFun(ctx) {
        var b = badgeFor(ctx);
        var lines = [
            '{{name}}님 대박… Day {{day}} 클리어?! 누적 {{total}}단어 · {{emoji}} {{badge}} 등장!',
            '오늘의 주인공 {{name}}님! Day {{day}} · {{total}}단어 · {{emoji}} {{badge}}',
            '{{name}}님 이 속도면 금방 늘겠는데요 ⚡ Day {{day}} / {{total}}단어 / {{badge}}',
            '{{emoji}} 들려요? {{name}}님 실력 올라가는 소리… Day {{day}} · {{total}}단어 · {{badge}}',
            '{{name}}님 오늘 Day {{day}}, {{total}}단어 — 기록 갱신각 📸 {{badge}} {{emoji}}',
            '{{name}}님 오늘 단어 뇌에 각인 완료? Day {{day}} · {{total}}단어 — {{badge}} {{emoji}} 인정?',
            '{{name}}님, 오늘 키워드: 성취감 폭발! Day {{day}} · {{badge}} {{emoji}} · {{total}}단어',
            '텐션 넘치는 하루 {{name}}님! Day {{day}} 뚝딱 · {{total}}단어 · {{emoji}} {{badge}}'
        ];
        return sub(lines[ctx.m % lines.length], ctx, b);
    }

    function copyShort(ctx) {
        var b = badgeFor(ctx);
        var lines = [
            '{{name}}님 오늘도 고생했어요 👏 Day {{day}} · {{total}}단어 · {{emoji}} {{badge}}',
            '{{name}}님 짱 👍 Day {{day}} / {{total}}단어 / {{badge}}',
            '{{emoji}} {{name}}님 오늘도 완주! Day {{day}} · {{total}}단어 · {{badge}}',
            '{{name}}님 응원해요 💚 D{{day}} · {{total}} · {{badge}}',
            '{{name}}님 수고! {{day}}일차 ✅ {{total}}단어 · {{badge}}',
            '{{emoji}} {{name}}님 최고 · D{{day}} · {{total}} · {{badge}}',
            '{{name}}님 오늘도 해냄 🔥 {{day}} · {{total}} · {{badge}}',
            '{{badge}} {{name}}님 👏 {{day}}/{{total}}'
        ];
        return sub(lines[ctx.m % lines.length], ctx, b);
    }

    /** @returns {{ headline: string, blurb: string, copies: string[], labels: string[] }} */
    function uiPack(ctx) {
        var bdg = badgeFor(ctx);
        return {
            emoji: bdg.emoji,
            badgeTitle: bdg.title,
            blurb: bdg.blurb,
            headline: headlineFor(ctx),
            copies: [copyWarm(ctx), copyFun(ctx), copyShort(ctx)],
            labels: ['따뜻한 칭찬', '재미있게', '짧게']
        };
    }

    function isKakaoInAppBrowser() {
        return /KAKAO/i.test(String((global.navigator && global.navigator.userAgent) || ''));
    }

    /** 칭찬 복사 후 카톡 채팅으로 복귀 (인앱 브라우저 닫기 시도) */
    function returnToKakaoInApp() {
        var ua = String((global.navigator && global.navigator.userAgent) || '');
        if (isKakaoInAppBrowser()) {
            if (/iPhone|iPad|iPod/i.test(ua)) {
                global.location.href = 'kakaoweb://closeBrowser';
            } else {
                global.location.href = 'kakaotalk://inappbrowser/close';
            }
            global.setTimeout(function () {
                try {
                    if (global.document && global.document.visibilityState === 'visible' && global.history.length > 1) {
                        global.history.back();
                    }
                } catch (e2) {}
            }, 700);
            return true;
        }
        try {
            global.close();
        } catch (e3) {}
        return false;
    }

    global.TriggerPraise = {
        BADGES: BADGES,
        statsFromStorage: statsFromStorage,
        encodePc: encodePc,
        decodePc: decodePc,
        badgeFor: badgeFor,
        headlineFor: headlineFor,
        uiPack: uiPack,
        isKakaoInAppBrowser: isKakaoInAppBrowser,
        returnToKakaoInApp: returnToKakaoInApp,
        /** shareKakao 전용 카톡 설명 한 줄 추가 */
        kakaoSubtitleLine: function (ctx) {
            var b = badgeFor(ctx);
            var lv = levelLabelFor(ctx);
            if (ctx.k === 'exam') {
                return '시험 리포트까지! ' + lv + ' · 오늘의 학습 유형: ' + b.emoji + ' ' + b.title;
            }
            return lv + ' · 오늘의 학습 유형: ' + b.emoji + ' ' + b.title;
        },
        levelLabelFor: levelLabelFor,
        normalizeLevel: normalizeLevel
    };
})(typeof window !== 'undefined' ? window : this);
