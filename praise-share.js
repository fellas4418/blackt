/**
 * 카톡 칭찬 링크(pc) · 배지 · 복사용 축하 멘트 (analysis / index / study 공용)
 */
(function (global) {
    var BADGES = [
        { emoji: '🏆', title: '오늘의 집중왕', blurb: '한 번 시작하면 끝까지 밀어붙이는 힘이에요.' },
        { emoji: '⭐', title: '별빛 복습왕', blurb: '꾸준함이 가장 큰 무기예요.' },
        { emoji: '🔥', title: '목표 불태우기', blurb: '오늘도 할 일을 끝까지 해냈어요.' },
        { emoji: '🚀', title: '성장 로켓', blurb: '한 걸음 한 걸음, 확실히 올라가고 있어요.' },
        { emoji: '💎', title: '단단한 루틴', blurb: '매일의 작은 습관이 쌓였어요.' },
        { emoji: '🌈', title: '멀티 성취러', blurb: '여러 일을 정리하면서도 학습을 지켰어요.' },
        { emoji: '🎯', title: '타깃 헌터', blurb: '오늘의 목표를 정확히 찍었어요.' },
        { emoji: '🦁', title: '용기 있는 도전자', blurb: '부담 속에서도 앞으로 나아갔어요.' }
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

    function getReviewWordsForDay(level, absoluteDay) {
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
            if (i % 7 === 6 || i % 7 === 0) continue;
            learnedTotal += getWordsForDay(level, i).length;
        }
        return {
            n: userName.slice(0, 48),
            d: Math.min(999, Math.max(1, displayDay)),
            t: Math.min(999999, Math.max(0, learnedTotal)),
            k: kind === 'exam' ? 'exam' : 'voca'
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
            b: (h >>> 0) % BADGES.length,
            m: ((h >>> 13) >>> 0) % 8
        };
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
                b: Math.abs(parseInt(o.b, 10) || 0) % BADGES.length,
                m: Math.abs(parseInt(o.m, 10) || 0) % 8
            };
        } catch (e2) {
            return null;
        }
    }

    function badgeFor(ctx) {
        return BADGES[ctx.b % BADGES.length];
    }

    var HEADLINES = [
        '{{name}}님, 오늘 Day {{day}}까지 밀어냈어요. 누적 {{total}}단어 — {{emoji}} {{badge}} 배지!',
        '{{name}}님, 꾸준함이 보여요. (Day {{day}} · 누적 {{total}}단어) 오늘의 칭찬: {{emoji}} {{badge}}',
        '{{emoji}} {{badge}}! {{name}}님은 오늘도 한 덩어리를 끝냈어요. Day {{day}}, 총 {{total}}단어 클리어.',
        '대단해요 {{name}}님! Day {{day}} 학습 완료 · 지금까지 {{total}}단어. {{emoji}} {{badge}}',
        '{{name}}님, 조금씩 쌓인 게 {{total}}단어예요. 오늘은 Day {{day}}! {{emoji}} {{badge}} 가자!',
        '와! {{name}}님 오늘 기록: Day {{day}}, 누적 {{total}}단어. 칭찬 스티커 {{emoji}} {{badge}}',
        '{{name}}님, 오늘의 한 줄: "끝까지했다" — Day {{day}} / {{total}}단어 / {{badge}} {{emoji}}',
        '{{emoji}} 칭찬 도착! {{name}}님 · Day {{day}} · {{total}}단어 · 테마 「{{badge}}」'
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
            '{{name}}님, 오늘 Day {{day}}까지 해낸 거 진짜 대단해요. 늘 응원하고 있어요. ({{emoji}} {{badge}} · 누적 {{total}}단어)',
            '{{name}}님, 매일 조금씩이 모여서 벌써 {{total}}단어예요. 오늘 Day {{day}}도 수고 많았어요. {{emoji}} {{badge}}',
            '{{name}}님에게: 힘들 때일수록 지금처럼 해냈다는 게 멋있어요. Day {{day}} · {{badge}} {{emoji}} · {{total}}단어 함께 가요.',
            '{{name}}님, 오늘도 목표까지 왔네요 (Day {{day}}). 결과보다 과정이 자랑스러워요. {{emoji}} {{badge}} · {{total}}단어',
            '{{name}}님 늘 응원해요. 오늘 기록 Day {{day}}, 누적 {{total}}단어 — {{emoji}} {{badge}} 배지 받아요!',
            '{{name}}님, 피곤했을 텐데 밀어붙였죠? 그 마음이 제일 예뻐요. Day {{day}} · {{total}}단어 · {{badge}} {{emoji}}',
            '{{name}}님에게 보내는 따뜻한 박수 👏 Day {{day}} 완료, {{total}}단어. {{emoji}} {{badge}} 최고예요.',
            '{{name}}님, 오늘도 한 걸음 전진! Day {{day}} · {{total}}단어. {{emoji}} 「{{badge}}」 칭찬해요.'
        ];
        return sub(lines[ctx.m % lines.length], ctx, b);
    }

    function copyFun(ctx) {
        var b = badgeFor(ctx);
        var lines = [
            '{{name}}님 미쳤다… Day {{day}} 클리어?! 누적 {{total}}단어 {{emoji}} {{badge}} 등장!',
            '오늘의 MVP {{name}}님! Day {{day}} · {{total}}단어 · 칭찬 세례 {{emoji}} {{badge}}',
            '{{name}}님 이 속도면 다음 스테이지도 금방이네요 ⚡ Day {{day}} / {{total}}단어 / {{badge}}',
            '{{emoji}} 들려요? 그건 {{name}}님 실력 업데이트 소리… Day {{day}} · {{total}}단어 · {{badge}}',
            '{{name}}님 한 컷 찍어야 해요 📸 오늘 Day {{day}}, {{total}}단어 레전드 찍었음!',
            '{{name}}님 오늘 뇌 업그레이드 완료? Day {{day}} · {{total}}단어 — {{badge}} {{emoji}} 인정?',
            '{{name}}님, 오늘의 키워드: 성취감 폭발! Day {{day}} · {{badge}} {{emoji}} · {{total}}단어',
            '박진감 넘치는 하루 {{name}}님! Day {{day}} 뚝딱 · {{total}}단어 적립 {{emoji}} {{badge}}'
        ];
        return sub(lines[ctx.m % lines.length], ctx, b);
    }

    function copyShort(ctx) {
        var b = badgeFor(ctx);
        var lines = [
            '{{name}}님 오늘도 고생했어요 👏 Day {{day}} · {{total}}단어 · {{emoji}}',
            '{{name}}님 짱 👍 Day {{day}} / {{total}}단어 / {{badge}}',
            '{{emoji}} {{name}}님 오늘도 완주! Day{{day}}·{{total}}어휘',
            '{{name}}님 칭찬해요 💚 D{{day}} · {{total}} · {{badge}}',
            '{{name}}님 수고링! {{day}}일차 ✅ {{total}}단어',
            '{{emoji}} {{name}} 최고 · D{{day}} · {{total}}',
            '{{name}} 오늘도 해냄 🔥 {{day}}·{{total}}',
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
            labels: ['🤗 따뜻하게 복사', '⚡ 신나게 복사', '✨ 짧게 복사']
        };
    }

    global.TriggerPraise = {
        BADGES: BADGES,
        statsFromStorage: statsFromStorage,
        encodePc: encodePc,
        decodePc: decodePc,
        badgeFor: badgeFor,
        headlineFor: headlineFor,
        uiPack: uiPack,
        /** shareKakao 전용 카톡 설명 한 줄 추가 */
        kakaoSubtitleLine: function (ctx) {
            var b = badgeFor(ctx);
            if (ctx.k === 'exam') {
                return '시험 리포트까지! 오늘의 배지 후보: ' + b.emoji + ' ' + b.title;
            }
            return '오늘의 배지 후보: ' + b.emoji + ' ' + b.title;
        }
    };
})(typeof window !== 'undefined' ? window : this);
