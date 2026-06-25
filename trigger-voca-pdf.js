/**
 * 보카 단어장 인쇄/PDF — 3버전(①영단어+뜻·②영만·③한만), 범위 선택
 */
(function (global) {
    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function wordMeanStr(w) {
        if (!w) return '';
        if (Array.isArray(w.meanings)) return w.meanings.join(', ');
        if (w.meanings) return String(w.meanings);
        if (w.mean) return String(w.mean);
        return '';
    }

    function getWordsForDay(level, day) {
        if (typeof global.getWordsForDay === 'function') {
            return global.getWordsForDay(level, day) || [];
        }
        return [];
    }

    function vocaMaxDays(level) {
        if (typeof TriggerToeicSchedule !== 'undefined') return TriggerToeicSchedule.vocaTotalDays(level);
        return 70;
    }

    function getLastClearedDay(level) {
        var ud = parseInt(localStorage.getItem('trigger_unlocked_day_' + level), 10) || 1;
        var cd = parseInt(localStorage.getItem('trigger_current_day_' + level), 10) || 1;
        var sess = parseInt(localStorage.getItem('trigger_session_' + level), 10) || 1;
        var cap = vocaMaxDays(level);
        if (ud > 1) return Math.min(cap, ud - 1);
        if (sess > 5) return Math.min(cap, cd);
        return Math.max(1, cd - 1);
    }

    function getWrongMarks(level) {
        try {
            var arr = JSON.parse(localStorage.getItem('trigger_wrong_words') || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function getMasterWrongDb() {
        try {
            var arr = JSON.parse(localStorage.getItem('trigger_master_wrong_db') || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function getMasterWrongCount(level, wordStr) {
        var key = String(wordStr || '').trim().toLowerCase();
        if (!key) return 0;
        var db = getMasterWrongDb();
        for (var i = 0; i < db.length; i++) {
            var row = db[i];
            if (!row || row.level !== level) continue;
            if (String(row.word || '').trim().toLowerCase() !== key) continue;
            return Math.max(0, parseInt(row.wrongCount, 10) || 0);
        }
        return 0;
    }

    function lookupWordMeanings(level, dayNum, wordStr) {
        var key = String(wordStr || '').trim().toLowerCase();
        var words = getWordsForDay(level, dayNum);
        for (var i = 0; i < words.length; i++) {
            if (String(words[i].word || '').trim().toLowerCase() === key) {
                return wordMeanStr(words[i]);
            }
        }
        return '';
    }

    /** 인쇄 범위 Day 중 오답·별표 단어 (틀린 횟수 내림차순) */
    function collectReviewWords(level, days, allWrongs) {
        var daySet = {};
        days.forEach(function (d) {
            daySet[Number(d)] = true;
        });
        var byKey = {};
        allWrongs.forEach(function (r) {
            if (!r || r.level !== level) return;
            if (!daySet[Number(r.day)]) return;
            if (!r.isWrong && !r.isStarred) return;
            var key = String(r.word || '').trim().toLowerCase();
            if (!key) return;
            var wc = getMasterWrongCount(level, r.word);
            if (!byKey[key]) {
                var mean = wordMeanStr(r);
                if (!mean) mean = lookupWordMeanings(level, r.day, r.word);
                byKey[key] = {
                    word: r.word,
                    meanings: mean,
                    wrongCount: wc,
                    isWrong: !!r.isWrong,
                    isStarred: !!r.isStarred
                };
            } else {
                byKey[key].isWrong = byKey[key].isWrong || !!r.isWrong;
                byKey[key].isStarred = byKey[key].isStarred || !!r.isStarred;
                byKey[key].wrongCount = Math.max(byKey[key].wrongCount, wc);
                if (!byKey[key].meanings) {
                    byKey[key].meanings = wordMeanStr(r) || lookupWordMeanings(level, r.day, r.word);
                }
            }
        });
        var list = Object.keys(byKey).map(function (k) {
            return byKey[k];
        });
        list.sort(function (a, b) {
            if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
            return String(a.word || '').localeCompare(String(b.word || ''), 'ko');
        });
        return list;
    }

    function buildReviewSectionHtml(reviewList) {
        if (!reviewList.length) return '';
        var rows = reviewList
            .map(function (item, idx) {
                var tags = [];
                if (item.isWrong) tags.push('오답');
                if (item.isStarred) tags.push('★');
                var tagHtml = tags.length
                    ? ' <span style="font-size:8pt;color:#666;">(' + escapeHtml(tags.join('·')) + ')</span>'
                    : '';
                return (
                    '<tr>' +
                    '<td style="border:1px solid #000;padding:8px;text-align:center;width:8%;">' +
                    (idx + 1) +
                    '</td>' +
                    '<td style="border:1px solid #000;padding:8px 12px;text-align:left;font-weight:bold;font-size:11pt;">' +
                    escapeHtml(item.word) +
                    tagHtml +
                    '</td>' +
                    '<td style="border:1px solid #000;padding:8px 12px;text-align:left;font-size:10pt;">' +
                    escapeHtml(item.meanings || '') +
                    '</td>' +
                    '<td style="border:1px solid #000;padding:8px;text-align:center;width:14%;font-weight:bold;">' +
                    (item.wrongCount > 0 ? item.wrongCount : '—') +
                    '</td>' +
                    '</tr>'
                );
            })
            .join('');
        return (
            '<div style="page-break-inside:avoid;">' +
            '<h2 style="font-size:16pt;color:#000;border-bottom:2px solid #000;padding-bottom:8px;margin:0 0 12px;">복습 필요 단어</h2>' +
            '<p style="font-size:9.5pt;color:#555;margin:0 0 14px;line-height:1.45;">' +
            '인쇄 범위에서 <strong>오답</strong>·<strong>★별표</strong>한 단어를 틀린 횟수 순으로 모았습니다. (별표만 한 단어는 횟수 —)' +
            '</p>' +
            '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">' +
            '<thead><tr style="background:#f2f2f2;">' +
            '<th style="border:1px solid #000;padding:8px;font-size:10pt;">번호</th>' +
            '<th style="border:1px solid #000;padding:8px;font-size:10pt;">영단어</th>' +
            '<th style="border:1px solid #000;padding:8px;font-size:10pt;">뜻</th>' +
            '<th style="border:1px solid #000;padding:8px;font-size:10pt;">틀린 횟수</th>' +
            '</tr></thead><tbody>' +
            rows +
            '</tbody></table></div>'
        );
    }

    function getWordMarkRecord(allWrongs, level, dayNum, wordStr) {
        var key = String(wordStr || '').trim().toLowerCase();
        if (!key) return null;
        var fallback = null;
        for (var i = 0; i < allWrongs.length; i++) {
            var r = allWrongs[i];
            if (!r || r.level !== level) continue;
            if (String(r.word || '').trim().toLowerCase() !== key) continue;
            if (Number(r.day) === Number(dayNum)) return r;
            if (!fallback) fallback = r;
        }
        return fallback;
    }

    function pdfWordMarkHtml(allWrongs, level, dayNum, wordStr) {
        var rec = getWordMarkRecord(allWrongs, level, dayNum, wordStr);
        if (!rec || (!rec.isWrong && !rec.isStarred)) return '';
        var parts = [];
        if (rec.isWrong) {
            parts.push(
                '<span style="display:inline-block;font-size:7pt;font-weight:700;color:#b71c1c;background:#ffebee;border:1px solid #ef9a9a;padding:0 4px;border-radius:3px;margin-left:2px;vertical-align:middle;">오답</span>'
            );
        }
        if (rec.isStarred) {
            parts.push(
                '<span style="display:inline-block;font-size:7pt;font-weight:700;color:#e65100;background:#fff8e1;border:1px solid #ffcc80;padding:0 4px;border-radius:3px;margin-left:2px;vertical-align:middle;">★별표</span>'
            );
        }
        return '<span style="display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center;margin-left:2px;">' + parts.join('') + '</span>';
    }

    function resolveDayList(level, range, customFrom, customTo) {
        var last = getLastClearedDay(level);
        var days = [];
        if (range === 'today') {
            days = [last];
        } else if (range === 'week') {
            var weekStart;
            var weekEnd;
            if (typeof TriggerToeicSchedule !== 'undefined' && TriggerToeicSchedule.isToeicLevel(level)) {
                weekStart = Math.floor((last - 1) / 6) * 6 + 1;
                weekEnd = Math.min(weekStart + 5, last);
            } else {
                weekStart = Math.floor((last - 1) / 7) * 7 + 1;
                weekEnd = Math.min(weekStart + 6, last);
            }
            for (var d = weekStart; d <= weekEnd; d++) days.push(d);
        } else if (range === 'all') {
            for (var a = 1; a <= last; a++) days.push(a);
        } else if (range === 'custom') {
            var cap = vocaMaxDays(level);
            var from = Math.max(1, Math.min(cap, parseInt(customFrom, 10) || 1));
            var to = Math.max(1, Math.min(cap, parseInt(customTo, 10) || from));
            if (from > to) {
                var t = from;
                from = to;
                to = t;
            }
            to = Math.min(to, last);
            for (var c = from; c <= to; c++) days.push(c);
        }
        return days.filter(function (d, i, arr) {
            return arr.indexOf(d) === i;
        });
    }

    function buildGridHtml(words, mode, allWrongs, level, dayNum) {
        if (!words.length) return '';
        var cells = [];
        words.forEach(function (w) {
            var mark = pdfWordMarkHtml(allWrongs, level, dayNum, w.word);
            var inner = '';
            if (mode === 'full') {
                inner =
                    '<div style="line-height:1.25;">' +
                    '<strong style="font-size:10pt;">' +
                    escapeHtml(w.word) +
                    '</strong>' +
                    mark +
                    '</div>' +
                    '<div style="font-size:9pt;margin-top:4px;color:#333;">' +
                    escapeHtml(wordMeanStr(w)) +
                    '</div>';
            } else if (mode === 'en') {
                inner =
                    '<div style="line-height:1.3;"><strong style="font-size:10.5pt;">' +
                    escapeHtml(w.word) +
                    '</strong>' +
                    mark +
                    '</div>';
            } else {
                inner =
                    '<div style="line-height:1.3;"><span style="font-size:10.5pt;">' +
                    escapeHtml(wordMeanStr(w)) +
                    '</span>' +
                    mark +
                    '</div>';
            }
            cells.push('<div class="pdf-cell" style="border:1px solid #ccc;padding:8px 6px;min-height:52px;box-sizing:border-box;">' + inner + '</div>');
        });
        while (cells.length % 4 !== 0) {
            cells.push('<div class="pdf-cell" style="border:1px solid #eee;min-height:52px;"></div>');
        }
        return (
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">' +
            cells.join('') +
            '</div>'
        );
    }

    var MODE_TITLES = {
        full: '① 영단어+뜻 (4칸)',
        en: '② 영단어만 (뜻 회상)',
        ko: '③ 한글만 (단어 회상)'
    };

    function buildPrintHtml(opts) {
        var level = opts.level || 'middle';
        var days = opts.days || [];
        var versions = opts.versions || ['full', 'en', 'ko'];
        var titleExtra = opts.titleExtra || '';
        var allWrongs = getWrongMarks(level);
        var levelLabel = level === 'high' ? '고등' : '중등';

        var html =
            '<div style="text-align:center;padding:16px 0 20px;border:2px solid #000;margin-bottom:24px;">' +
            '<h1 style="font-size:22pt;margin:0;color:#000;">TRIGGER VOCA · 단어장</h1>' +
            '<p style="font-size:12pt;margin-top:8px;color:#000;">' +
            levelLabel +
            ' · ' +
            escapeHtml(titleExtra) +
            '</p>' +
            '<p style="font-size:10pt;color:#666;">TRIGGER BLACK</p>' +
            '<p style="font-size:9.5pt;color:#555;margin-top:10px;line-height:1.45;">※ 단어 옆 <strong style="color:#b71c1c;">오답</strong>·<strong style="color:#e65100;">★별표</strong>는 이 기기에 저장된 테스트·별표 기록입니다.</p></div>';

        versions.forEach(function (mode, vi) {
            if (vi > 0) html += '<div class="page-break" style="page-break-before:always;"></div>';
            html += '<h2 style="font-size:14pt;color:#000;border-bottom:2px solid #000;padding-bottom:6px;margin:0 0 16px;">' + MODE_TITLES[mode] + '</h2>';

            days.forEach(function (dayNum) {
                var words = getWordsForDay(level, dayNum);
                if (!words.length) return;
                html +=
                    '<div style="page-break-inside:avoid;margin-bottom:18px;">' +
                    '<div style="font-size:13pt;font-weight:bold;margin-bottom:8px;color:#000;">Day ' +
                    dayNum +
                    ' <span style="font-size:10pt;font-weight:normal;color:#666;">(' +
                    words.length +
                    '어)</span></div>';
                html += buildGridHtml(words, mode, allWrongs, level, dayNum);
                html += '</div>';
            });
        });

        var reviewList = collectReviewWords(level, days, allWrongs);
        if (reviewList.length) {
            html += '<div class="page-break" style="page-break-before:always;"></div>';
            html += buildReviewSectionHtml(reviewList);
        }

        return html;
    }

    function printHtml(html) {
        var printArea = document.getElementById('print-area');
        if (!printArea) {
            alert('인쇄 영역을 찾지 못했습니다. 메인(보카) 화면에서 다시 시도해 주세요.');
            return false;
        }
        printArea.innerHTML = html;
        printArea.style.display = 'block';
        setTimeout(function () {
            global.print();
            printArea.style.display = 'none';
        }, 120);
        return true;
    }

    function print(opts) {
        var days = opts.days || [];
        if (!days.length) {
            alert('인쇄할 Day가 없습니다. 학습을 완료한 뒤 다시 시도해 주세요.');
            return;
        }
        var hasWords = false;
        days.forEach(function (d) {
            if (getWordsForDay(opts.level, d).length) hasWords = true;
        });
        if (!hasWords) {
            alert('선택한 범위에 단어가 없습니다.');
            return;
        }
        var html = buildPrintHtml(opts);
        printHtml(html);
    }

    function versionsFromSelect(val) {
        if (val === 'full') return ['full'];
        if (val === 'en') return ['en'];
        if (val === 'ko') return ['ko'];
        return ['full', 'en', 'ko'];
    }

    function optionsFromForm(level) {
        var rangeEl = document.getElementById('pdf-range-select');
        var verEl = document.getElementById('pdf-version-select');
        var range = rangeEl ? rangeEl.value : 'today';
        var ver = verEl ? verEl.value : 'all';
        var fromEl = document.getElementById('pdf-day-from');
        var toEl = document.getElementById('pdf-day-to');
        var days = resolveDayList(level, range, fromEl && fromEl.value, toEl && toEl.value);
        var rangeLabels = { today: '오늘(마지막 완료)', week: '이번 주', all: '클리어 전체', custom: 'Day ' + days[0] + '–' + days[days.length - 1] };
        return {
            level: level,
            days: days,
            versions: versionsFromSelect(ver),
            titleExtra: rangeLabels[range] || '단어장'
        };
    }

    function printFromForm(level) {
        print(optionsFromForm(level || localStorage.getItem('trigger_level') || 'middle'));
    }

    function printToday(level, completedDay, versionVal) {
        var day = Number(completedDay) || getLastClearedDay(level);
        print({
            level: level,
            days: [day],
            versions: versionsFromSelect(versionVal || 'all'),
            titleExtra: 'Day ' + day + ' 당일'
        });
    }

    global.TriggerVocaPdf = {
        getLastClearedDay: getLastClearedDay,
        resolveDayList: resolveDayList,
        buildPrintHtml: buildPrintHtml,
        print: print,
        printFromForm: printFromForm,
        printToday: printToday,
        optionsFromForm: optionsFromForm
    };

    global.printVocaWordbookFromForm = function () {
        printFromForm();
    };

    global.onPdfRangeChange = function () {
        var sel = document.getElementById('pdf-range-select');
        var box = document.getElementById('pdf-custom-range');
        if (!box || !sel) return;
        box.style.display = sel.value === 'custom' ? 'flex' : 'none';
    };
})(typeof window !== 'undefined' ? window : global);
