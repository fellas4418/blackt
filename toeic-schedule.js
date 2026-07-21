(function (g) {
    const TOEIC_TOTAL_DAYS = 54;
    const TOEIC_NOTE_TOTAL_DAYS = 4;
    const TOEIC_REVIEW_CAP = 80;
    const MIDDLE_HIGH_TOTAL_DAYS = 70;

    function isToeicLevel(level) {
        return level === 'toeic';
    }

    function isToeicNoteLevel(level) {
        return level === 'toeic_note';
    }

    function isToeicFamily(level) {
        return isToeicLevel(level) || isToeicNoteLevel(level);
    }

    function vocaTotalDays(level) {
        if (isToeicNoteLevel(level)) {
            var base = TOEIC_NOTE_TOTAL_DAYS;
            if (typeof g.TriggerToeicNoteOcr !== 'undefined') {
                return g.TriggerToeicNoteOcr.getTotalDays(base);
            }
            return base;
        }
        if (isToeicLevel(level)) return TOEIC_TOTAL_DAYS;
        return MIDDLE_HIGH_TOTAL_DAYS;
    }

    function isReviewDay(level, absoluteDay) {
        const day = parseInt(absoluteDay, 10) || 0;
        if (isToeicNoteLevel(level)) return false;
        if (isToeicLevel(level)) return day > 0 && day <= TOEIC_TOTAL_DAYS && day % 6 === 0;
        const local = day % 7 === 0 ? 7 : day % 7;
        return local === 6 || local === 7;
    }

    function toeicBlockAndLocal(absoluteDay) {
        const d = parseInt(absoluteDay, 10) || 1;
        return {
            block: Math.ceil(d / 6),
            localDay: ((d - 1) % 6) + 1
        };
    }

    function weekNumForLevel(level, absoluteDay) {
        if (isToeicNoteLevel(level)) return 1;
        if (isToeicLevel(level)) return toeicBlockAndLocal(absoluteDay).block;
        return Math.ceil(absoluteDay / 7);
    }

    function localDayForLevel(level, absoluteDay) {
        if (isToeicNoteLevel(level)) return parseInt(absoluteDay, 10) || 1;
        if (isToeicLevel(level)) return toeicBlockAndLocal(absoluteDay).localDay;
        return absoluteDay % 7 === 0 ? 7 : absoluteDay % 7;
    }

    function shuffleArr(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function getToeicBlockNewPool(level, absoluteDay) {
        if (typeof wordsData === 'undefined' || !wordsData[level]) return [];
        const bl = toeicBlockAndLocal(absoluteDay);
        const weekData = wordsData[level]['week' + bl.block];
        if (!weekData) return [];
        let pool = [];
        for (let d = 1; d <= 5; d++) {
            const dayData = weekData[String(d)];
            if (Array.isArray(dayData)) pool = pool.concat(dayData);
        }
        return pool;
    }

    function buildToeicReviewWords(level, absoluteDay) {
        const pool = getToeicBlockNewPool(level, absoluteDay);
        if (!pool.length) return [];

        const poolMap = {};
        pool.forEach(function (w) {
            if (w && w.word) poolMap[w.word] = w;
        });

        let wrongWords = [];
        try {
            wrongWords = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
        } catch (e) {}

        const priority = [];
        const added = {};
        wrongWords.forEach(function (w) {
            if (!w || w.level !== level) return;
            if (!poolMap[w.word]) return;
            if (!(w.isWrong || w.isStarred)) return;
            if (added[w.word]) return;
            priority.push(poolMap[w.word]);
            added[w.word] = true;
        });

        let rest = pool.filter(function (w) {
            return w && w.word && !added[w.word];
        });
        rest = shuffleArr(rest);

        const result = priority.slice(0, TOEIC_REVIEW_CAP);
        for (let i = 0; i < rest.length && result.length < TOEIC_REVIEW_CAP; i++) {
            result.push(rest[i]);
        }
        return result;
    }

    function completedBlocks(level, unlockedDay) {
        const ud = parseInt(unlockedDay, 10) || 1;
        if (isToeicNoteLevel(level)) return 0;
        if (!isToeicLevel(level)) return Math.floor((ud - 1) / 7);
        return Math.floor((ud - 1) / 6);
    }

    function routineTitle(level) {
        if (isToeicNoteLevel(level)) {
            var total = vocaTotalDays(level);
            return '📅 LC 오답노트 (' + total + '일)';
        }
        if (isToeicLevel(level)) return '📅 54일 완성 도전하기';
        return '📅 10주 완성 도전하기';
    }

    g.TriggerToeicSchedule = {
        TOEIC_TOTAL_DAYS: TOEIC_TOTAL_DAYS,
        TOEIC_NOTE_TOTAL_DAYS: TOEIC_NOTE_TOTAL_DAYS,
        TOEIC_REVIEW_CAP: TOEIC_REVIEW_CAP,
        isToeicLevel: isToeicLevel,
        isToeicNoteLevel: isToeicNoteLevel,
        isToeicFamily: isToeicFamily,
        vocaTotalDays: vocaTotalDays,
        isReviewDay: isReviewDay,
        toeicBlockAndLocal: toeicBlockAndLocal,
        weekNumForLevel: weekNumForLevel,
        localDayForLevel: localDayForLevel,
        getToeicBlockNewPool: getToeicBlockNewPool,
        buildToeicReviewWords: buildToeicReviewWords,
        completedBlocks: completedBlocks,
        routineTitle: routineTitle
    };
})(typeof window !== 'undefined' ? window : globalThis);
