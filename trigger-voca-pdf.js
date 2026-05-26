/**
 * 보카 단어장 인쇄/PDF — 3버전(풀카드·영만·한만), 범위 선택
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

    function getLastClearedDay(level) {
        var ud = parseInt(localStorage.getItem('trigger_unlocked_day_' + level), 10) || 1;
        var cd = parseInt(localStorage.getItem('trigger_current_day_' + level), 10) || 1;
        var sess = parseInt(localStorage.getItem('trigger_session_' + level), 10) || 1;
        if (ud > 1) return Math.min(70, ud - 1);
        if (sess > 5) return Math.min(70, cd);
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

    function pdfWordMarkHtml(allWrongs, level, dayNum, wordStr) {
        var rec = allWrongs.find(function (r) {
            return r && r.level === level && String(r.word) === String(wordStr) && Number(r.day) === Number(dayNum);
        });
        if (!rec) return '';
        var labels = [];
        if (rec.isWrong) labels.push('오답');
        if (rec.isStarred) labels.push('별표');
        if (!labels.length) return '';
        return ' <span style="font-size:8pt;font-weight:bold;color:#b71c1c;">[' + labels.join('·') + ']</span>';
    }

    function resolveDayList(level, range, customFrom, customTo) {
        var last = getLastClearedDay(level);
        var days = [];
        if (range === 'today') {
            days = [last];
        } else if (range === 'week') {
            var weekStart = Math.floor((last - 1) / 7) * 7 + 1;
            var weekEnd = Math.min(weekStart + 6, last);
            for (var d = weekStart; d <= weekEnd; d++) days.push(d);
        } else if (range === 'all') {
            for (var a = 1; a <= last; a++) days.push(a);
        } else if (range === 'custom') {
            var from = Math.max(1, Math.min(70, parseInt(customFrom, 10) || 1));
            var to = Math.max(1, Math.min(70, parseInt(customTo, 10) || from));
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
                    '<strong style="font-size:10pt;">' +
                    escapeHtml(w.word) +
                    '</strong>' +
                    mark +
                    '<div style="font-size:9pt;margin-top:4px;color:#333;">' +
                    escapeHtml(wordMeanStr(w)) +
                    '</div>';
            } else if (mode === 'en') {
                inner = '<strong style="font-size:10.5pt;">' + escapeHtml(w.word) + '</strong>' + mark;
            } else {
                inner = '<span style="font-size:10.5pt;">' + escapeHtml(wordMeanStr(w)) + '</span>' + mark;
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

    var MODE_TITLES = { full: '① 영단어 + 뜻 (4칸)', en: '② 영단어만 (뜻 회상)', ko: '③ 한글만 (단어 회상)' };

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
            '<p style="font-size:10pt;color:#666;">TRIGGER BLACK</p></div>';

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
