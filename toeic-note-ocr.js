(function (g) {
    'use strict';

    var STORAGE_KEY = 'trigger_toeic_note_user_days';
    var WORKER_URL = 'https://trigger-ocr-api.ohryee.workers.dev';
    var IMAGE_MAX_LONG = 1600;
    var JPEG_QUALITY = 0.88;
    var BASE_DAYS = 4;
    var WORDS_PER_DAY = 40;

    var pendingBase64 = '';
    var pendingPreviewUrl = '';

    function loadUserDays() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function saveUserDays(days) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(days || {}));
    }

    function dayKeys(days) {
        return Object.keys(days || {})
            .map(function (k) { return parseInt(k, 10); })
            .filter(function (n) { return n > 0; })
            .sort(function (a, b) { return a - b; });
    }

    function getTotalDays(baseDays) {
        var base = parseInt(baseDays, 10) || BASE_DAYS;
        var keys = dayKeys(loadUserDays());
        if (!keys.length) return base;
        return Math.max(base, keys[keys.length - 1]);
    }

    function getDayWords(absoluteDay) {
        var day = String(parseInt(absoluteDay, 10) || 0);
        var days = loadUserDays();
        var list = days[day];
        return Array.isArray(list) ? list : null;
    }

    function getNextDayNumber(baseDays) {
        return getTotalDays(baseDays) + 1;
    }

    function normalizeEntries(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function (x) {
            var word = x && x.word ? String(x.word).trim() : '';
            var meanings = [];
            if (Array.isArray(x && x.meanings)) {
                meanings = x.meanings.map(function (m) { return String(m).trim(); }).filter(Boolean);
            } else if (x && x.meaning) {
                meanings = [String(x.meaning).trim()].filter(Boolean);
            }
            return { word: word, meanings: meanings };
        }).filter(function (x) { return x.word && x.meanings.length; });
    }

    function chunkWords(list, size) {
        var chunks = [];
        var n = parseInt(size, 10) || WORDS_PER_DAY;
        for (var i = 0; i < list.length; i += n) {
            chunks.push(list.slice(i, i + n));
        }
        return chunks;
    }

    function formatChunkPlan(total, startDay) {
        var partCounts = [];
        var remain = total;
        while (remain > 0) {
            partCounts.push(remain >= WORDS_PER_DAY ? WORDS_PER_DAY : remain);
            remain -= partCounts[partCounts.length - 1];
        }
        var endDay = startDay + partCounts.length - 1;
        if (partCounts.length === 1) {
            return {
                confirm: 'Day ' + startDay + '에 ' + total + '개를 추가할까요?',
                statusSuffix: ''
            };
        }
        return {
            confirm: total + '개를 Day ' + startDay + '~' + endDay + '에 나눠 저장할까요? (' + partCounts.join('+') + ')',
            statusSuffix: ' · Day ' + partCounts.length + '개(최대 ' + WORDS_PER_DAY + '개씩)로 나눠 저장'
        };
    }

    function formatSaveSummary(result) {
        if (!result || !result.days.length) return '';
        if (result.days.length === 1) {
            return 'Day ' + result.firstDay + '에 ' + result.total + '개 추가했어요.';
        }
        var detail = result.days.map(function (d) {
            return 'Day ' + d.day + ' ' + d.count + '개';
        }).join(', ');
        return result.total + '개를 ' + detail + '로 나눠 저장했어요.';
    }

    function addDaysChunked(words, startDayNum) {
        var normalized = normalizeEntries(words);
        if (!normalized.length) return null;
        var startDay = parseInt(startDayNum, 10) || getNextDayNumber(BASE_DAYS);
        var chunks = chunkWords(normalized, WORDS_PER_DAY);
        var days = loadUserDays();
        var saved = [];
        for (var c = 0; c < chunks.length; c++) {
            var dayInt = startDay + c;
            days[String(dayInt)] = chunks[c];
            saved.push({ day: dayInt, count: chunks[c].length });
        }
        saveUserDays(days);

        var firstDay = saved[0].day;
        var lastDay = saved[saved.length - 1].day;
        var unlocked = parseInt(localStorage.getItem('trigger_unlocked_day_toeic_note'), 10) || 1;
        if (lastDay >= unlocked) {
            localStorage.setItem('trigger_unlocked_day_toeic_note', String(lastDay));
            var cur = parseInt(localStorage.getItem('trigger_current_day_toeic_note'), 10) || 1;
            if (cur < firstDay) {
                localStorage.setItem('trigger_current_day_toeic_note', String(firstDay));
                localStorage.setItem('trigger_session_toeic_note', '1');
            }
        }
        return {
            total: normalized.length,
            days: saved,
            firstDay: firstDay,
            lastDay: lastDay
        };
    }

    function addDay(words, dayNum) {
        var startDay = dayNum || getNextDayNumber(BASE_DAYS);
        var result = addDaysChunked(words, startDay);
        if (!result || !result.days.length) return null;
        return { day: result.firstDay, count: result.days[0].count, result: result };
    }

    function compressImageFile(file, done) {
        if (!file) { done(null); return; }
        var blobUrl = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            try {
                var nw = img.naturalWidth || img.width || 0;
                var nh = img.naturalHeight || img.height || 0;
                URL.revokeObjectURL(blobUrl);
                if (!nw || !nh) { done(null); return; }
                var long = Math.max(nw, nh);
                var scale = long > IMAGE_MAX_LONG ? IMAGE_MAX_LONG / long : 1;
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(nw * scale));
                canvas.height = Math.max(1, Math.round(nh * scale));
                var ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
                done({ dataUrl: dataUrl, base64: dataUrl.split(',')[1] });
            } catch (e) {
                URL.revokeObjectURL(blobUrl);
                done(null);
            }
        };
        img.onerror = function () {
            URL.revokeObjectURL(blobUrl);
            done(null);
        };
        img.src = blobUrl;
    }

    function buildExtractPrompt() {
        return [
            'You extract TOEIC LC vocabulary from a handwritten or printed wrong-answer notebook photo.',
            'Typical layout: English word/phrase in one column, Korean meaning beside it.',
            'Read order: top to bottom in the left column, then top to bottom in the right column.',
            'If entries are clearly paired left-right on each row, read row by row top to bottom.',
            '',
            'Output ONLY valid JSON (no markdown):',
            '{"words":[{"word":"English word or phrase","meanings":["Korean meaning"]}]}',
            '',
            'Rules:',
            '- Keep multi-word phrases with spaces (e.g. "get in touch with", "as opposed to").',
            '- Preserve capitalization from the notebook when visible.',
            '- meanings: Korean only; omit pronunciation notes like (발음: …).',
            '- Skip completely illegible lines; do not invent words.',
            '- Include every readable vocabulary entry in order.'
        ].join('\n');
    }

    function parseGeminiWords(data) {
        var text = '';
        try {
            text = data.candidates[0].content.parts[0].text;
        } catch (e) {
            return [];
        }
        var parsed;
        try {
            parsed = JSON.parse(String(text).trim());
        } catch (e2) {
            var s = String(text);
            var a = s.indexOf('{');
            var b = s.lastIndexOf('}');
            if (a === -1 || b === -1) return [];
            try { parsed = JSON.parse(s.slice(a, b + 1)); } catch (e3) { return []; }
        }
        return normalizeEntries(parsed.words || parsed.items || []);
    }

    function requestExtract(base64) {
        var payload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: buildExtractPrompt() },
                    { inline_data: { mime_type: 'image/jpeg', data: base64 } }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        };
        var base = WORKER_URL.replace(/\/$/, '');
        var urls = [base + '/api/analyze', base + '/'];
        return urls.reduce(function (chain, url) {
            return chain.catch(function () {
                return fetch(url, {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(function (r) {
                    return r.json().then(function (d) {
                        if (!r.ok) {
                            var msg = (d && (d.error && d.error.message)) ? d.error.message : ('HTTP ' + r.status);
                            throw new Error(msg);
                        }
                        return d;
                    });
                });
            });
        }, Promise.reject(new Error('start')));
    }

    function el(id) {
        return document.getElementById(id);
    }

    function setImportStatus(msg, isError) {
        var status = el('toeic-note-import-status');
        if (!status) return;
        status.textContent = msg || '';
        status.style.color = isError ? '#ff8888' : '#aaa';
    }

    function renderPreviewList(words) {
        var box = el('toeic-note-import-preview');
        if (!box) return;
        if (!words || !words.length) {
            box.innerHTML = '<p style="color:#666;font-size:0.85rem;margin:0;">추출된 단어가 없습니다.</p>';
            return;
        }
        var html = words.map(function (w, i) {
            return '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed #333;font-size:0.88rem;">' +
                '<span style="color:#8cf;min-width:24px;">' + (i + 1) + '.</span>' +
                '<span style="color:#fff;flex:1;">' + escapeHtml(w.word) + '</span>' +
                '<span style="color:#ccc;flex:1;">' + escapeHtml(w.meanings[0]) + '</span>' +
                '</div>';
        }).join('');
        box.innerHTML = html;
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showSection(level) {
        var section = el('toeic-note-import-section');
        if (!section) return;
        var show = level === 'toeic_note';
        section.style.display = show ? 'block' : 'none';
        if (show) {
            var nextDay = getNextDayNumber(BASE_DAYS);
            var hint = el('toeic-note-import-day-hint');
            if (hint) {
                hint.textContent = '다음 추가 Day: ' + nextDay + ' · 현재 총 ' + getTotalDays(BASE_DAYS) + '일 · 하루 최대 ' + WORDS_PER_DAY + '개';
            }
        }
    }

    function openFilePicker(capture) {
        var input = el('toeic-note-photo-input');
        if (!input) return;
        input.value = '';
        if (capture) {
            input.setAttribute('capture', 'environment');
        } else {
            input.removeAttribute('capture');
        }
        input.click();
    }

    function onFileSelected(file) {
        if (!file) return;
        setImportStatus('사진 준비 중…', false);
        compressImageFile(file, function (out) {
            if (!out || !out.base64) {
                setImportStatus('사진을 불러오지 못했어요.', true);
                return;
            }
            pendingBase64 = out.base64;
            pendingPreviewUrl = out.dataUrl;
            var img = el('toeic-note-import-thumb');
            if (img) {
                img.src = out.dataUrl;
                img.style.display = 'block';
            }
            var runBtn = el('toeic-note-import-run');
            if (runBtn) runBtn.style.display = 'block';
            setImportStatus('「단어 추출하기」를 눌러 주세요.', false);
        });
    }

    var extractedWords = [];

    function runExtract() {
        if (!pendingBase64) {
            alert('사진을 먼저 선택해 주세요.');
            return;
        }
        var runBtn = el('toeic-note-import-run');
        var saveBtn = el('toeic-note-import-save');
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '추출 중…'; }
        if (saveBtn) saveBtn.style.display = 'none';
        setImportStatus('AI가 노트를 읽는 중… (10~30초)', false);
        requestExtract(pendingBase64).then(function (data) {
            extractedWords = parseGeminiWords(data);
            renderPreviewList(extractedWords);
            if (!extractedWords.length) {
                setImportStatus('단어를 찾지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.', true);
            } else {
                var planHint = formatChunkPlan(extractedWords.length, getNextDayNumber(BASE_DAYS));
                setImportStatus(extractedWords.length + '개 추출됨' + planHint.statusSuffix + '. 확인 후 「Day에 추가」를 눌러 주세요.', false);
                if (saveBtn) saveBtn.style.display = 'block';
            }
        }).catch(function (err) {
            setImportStatus('추출 실패: ' + (err && err.message ? err.message : '다시 시도해 주세요.'), true);
            extractedWords = [];
            renderPreviewList([]);
        }).finally(function () {
            if (runBtn) { runBtn.disabled = false; runBtn.textContent = '단어 추출하기'; }
        });
    }

    function saveExtractedDay() {
        if (!extractedWords.length) {
            alert('추출된 단어가 없습니다.');
            return;
        }
        var nextDay = getNextDayNumber(BASE_DAYS);
        var plan = formatChunkPlan(extractedWords.length, nextDay);
        if (!confirm(plan.confirm)) return;
        var result = addDaysChunked(extractedWords, nextDay);
        if (!result) {
            alert('저장할 단어가 없습니다.');
            return;
        }
        extractedWords = [];
        pendingBase64 = '';
        pendingPreviewUrl = '';
        var img = el('toeic-note-import-thumb');
        if (img) { img.src = ''; img.style.display = 'none'; }
        var runBtn = el('toeic-note-import-run');
        if (runBtn) runBtn.style.display = 'none';
        var saveBtn = el('toeic-note-import-save');
        if (saveBtn) saveBtn.style.display = 'none';
        renderPreviewList([]);
        var summary = formatSaveSummary(result);
        setImportStatus(summary, false);
        showSection('toeic_note');
        if (typeof updateDashboardUI === 'function') updateDashboardUI();
        alert(summary + '\n「학습 시작하기」로 바로 학습할 수 있습니다.');
    }

    function resolveToeicNoteWords(staticWords, absoluteDay) {
        var user = getDayWords(absoluteDay);
        if (user && user.length) return user;
        return staticWords;
    }

    function initUi() {
        var input = el('toeic-note-photo-input');
        if (input && !input.__toeicNoteBound) {
            input.__toeicNoteBound = true;
            input.addEventListener('change', function () {
                if (input.files && input.files[0]) onFileSelected(input.files[0]);
            });
        }
        var cam = el('toeic-note-import-camera');
        var gal = el('toeic-note-import-gallery');
        var run = el('toeic-note-import-run');
        var save = el('toeic-note-import-save');
        if (cam && !cam.__toeicNoteBound) {
            cam.__toeicNoteBound = true;
            cam.addEventListener('click', function () { openFilePicker(true); });
        }
        if (gal && !gal.__toeicNoteBound) {
            gal.__toeicNoteBound = true;
            gal.addEventListener('click', function () { openFilePicker(false); });
        }
        if (run && !run.__toeicNoteBound) {
            run.__toeicNoteBound = true;
            run.addEventListener('click', runExtract);
        }
        if (save && !save.__toeicNoteBound) {
            save.__toeicNoteBound = true;
            save.addEventListener('click', saveExtractedDay);
        }
    }

    g.TriggerToeicNoteOcr = {
        STORAGE_KEY: STORAGE_KEY,
        BASE_DAYS: BASE_DAYS,
        WORDS_PER_DAY: WORDS_PER_DAY,
        addDaysChunked: addDaysChunked,
        loadUserDays: loadUserDays,
        getTotalDays: getTotalDays,
        getDayWords: getDayWords,
        getNextDayNumber: getNextDayNumber,
        resolveToeicNoteWords: resolveToeicNoteWords,
        syncUi: showSection,
        initUi: initUi
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUi);
    } else {
        initUi();
    }
})(typeof window !== 'undefined' ? window : globalThis);
