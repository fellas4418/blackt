(function () {
    'use strict';

    var TIMING = {
        thinkMs: 5000,
        thinkMsFirst: 8000,
        thinkMsRepeat: 4000,
        revealMinMs: 6000,
        revealMinMsFirst: 8000,
        revealMinMsRepeat: 5000,
        revealAutoNextMs: 15000
    };

    var state = {
        data: null,
        stepIdx: 0,
        phase: 'think',
        timers: [],
        highlightIdx: -1,
        isRepeat: false,
        progressInterval: null
    };

    function clearTimers() {
        state.timers.forEach(clearTimeout);
        state.timers = [];
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
    }

    function schedule(fn, ms) {
        var id = setTimeout(fn, ms);
        state.timers.push(id);
        return id;
    }

    function getPatternId() {
        return new URLSearchParams(location.search).get('p') || 'svo';
    }

    function isDoneBefore(id) {
        return localStorage.getItem('pattern_done_' + id) === '1';
    }

    function markDone(id) {
        localStorage.setItem('pattern_done_' + id, '1');
    }

    function getThinkMs() {
        if (state.stepIdx === 0 && !state.isRepeat) return TIMING.thinkMsFirst;
        if (state.isRepeat) return TIMING.thinkMsRepeat;
        return TIMING.thinkMs;
    }

    function getRevealMinMs() {
        if (state.stepIdx === 0 && !state.isRepeat) return TIMING.revealMinMsFirst;
        if (state.isRepeat) return TIMING.revealMinMsRepeat;
        return TIMING.revealMinMs;
    }

    function roleClass(role) {
        if (role === 's' || role === '주어') return 's';
        if (role === 'o' || role === '목적어') return 'o';
        return 'v';
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderEng(step) {
        var el = document.getElementById('pattern-eng');
        if (!el) return;
        el.innerHTML = '';
        (step.eng_tokens || []).forEach(function (tok, i) {
            if (i > 0) el.appendChild(document.createTextNode(' '));
            var span = document.createElement('span');
            span.className =
                'pattern-eng-token pattern-eng-token--' + roleClass(tok.role);
            span.textContent = tok.text;
            span.dataset.maps = String(tok.maps);
            span.addEventListener('click', function (e) {
                e.stopPropagation();
                highlightPair(tok.maps);
            });
            el.appendChild(span);
        });
    }

    function renderKor(step) {
        var wrap = document.getElementById('pattern-kor-wrap');
        if (!wrap) return;
        wrap.innerHTML = '';
        wrap.classList.remove('is-visible');

        var rowWords = document.createElement('div');
        rowWords.className = 'pattern-kor-row pattern-kor-row--words';

        var rowRules = document.createElement('div');
        rowRules.className = 'pattern-kor-row';

        var rowRoles = document.createElement('div');
        rowRoles.className = 'pattern-kor-row';

        (step.kor_slots || []).forEach(function (slot, idx) {
            var rc = roleClass(slot.role);

            function cell(content, extra) {
                var c = document.createElement('div');
                c.className = 'pattern-kor-slot pattern-kor-slot--' + rc + (extra || '');
                c.dataset.idx = String(idx);
                c.innerHTML = content;
                return c;
            }

            rowWords.appendChild(
                cell(
                    '<div class="pattern-kor-word">' +
                        escapeHtml(slot.word + (slot.particle || '')) +
                        '</div>',
                    ' kor-word-cell'
                )
            );
            rowRules.appendChild(
                cell('<div class="pattern-kor-rule">' + escapeHtml(slot.rule || '') + '</div>')
            );
            rowRoles.appendChild(
                cell('<div class="pattern-kor-role">(' + escapeHtml(slot.role || '') + ')</div>')
            );
        });

        wrap.appendChild(rowWords);
        wrap.appendChild(rowRules);
        wrap.appendChild(rowRoles);
    }

    function highlightPair(korIdx) {
        if (state.phase !== 'reveal') return;
        state.highlightIdx = korIdx;
        document.querySelectorAll('.pattern-eng-token').forEach(function (el) {
            el.classList.toggle('is-lit', el.dataset.maps === String(korIdx));
        });
        document.querySelectorAll('.pattern-kor-slot.kor-word-cell').forEach(function (el) {
            var on = el.dataset.idx === String(korIdx);
            el.classList.toggle('is-lit', on);
            el.classList.toggle('is-dim', !on && state.highlightIdx >= 0);
        });
    }

    function clearHighlight() {
        state.highlightIdx = -1;
        document.querySelectorAll('.pattern-eng-token').forEach(function (el) {
            el.classList.remove('is-lit');
        });
        document.querySelectorAll('.pattern-kor-slot').forEach(function (el) {
            el.classList.remove('is-lit', 'is-dim');
        });
    }

    function setProgress(ratio) {
        var fill = document.getElementById('pattern-progress-fill');
        if (fill) fill.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';
    }

    function runProgressBar(ms, onDone) {
        var start = Date.now();
        setProgress(0);
        state.progressInterval = setInterval(function () {
            var elapsed = Date.now() - start;
            setProgress(elapsed / ms);
            if (elapsed >= ms) {
                clearInterval(state.progressInterval);
                state.progressInterval = null;
                setProgress(1);
                if (onDone) onDone();
            }
        }, 50);
    }

    function setPhase(phase) {
        state.phase = phase;
        var btnReveal = document.getElementById('pattern-btn-reveal');
        var btnNext = document.getElementById('pattern-btn-next');
        var korWrap = document.getElementById('pattern-kor-wrap');

        if (phase === 'think') {
            if (korWrap) korWrap.classList.remove('is-visible');
            if (btnReveal) {
                btnReveal.style.display = '';
                btnReveal.disabled = false;
            }
            if (btnNext) {
                btnNext.style.display = 'none';
                btnNext.disabled = true;
            }
            clearHighlight();
            runProgressBar(getThinkMs(), function () {
                showReveal();
            });
        } else if (phase === 'reveal') {
            if (korWrap) korWrap.classList.add('is-visible');
            if (btnReveal) btnReveal.style.display = 'none';
            if (btnNext) {
                btnNext.style.display = '';
                btnNext.disabled = true;
            }
            runProgressBar(getRevealMinMs(), function () {
                if (btnNext) btnNext.disabled = false;
            });
            schedule(function () {
                if (state.phase === 'reveal') goNextStep();
            }, TIMING.revealAutoNextMs);
        }
    }

    function showReveal() {
        clearTimers();
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
        setPhase('reveal');
    }

    function goNextStep() {
        clearTimers();
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
        state.stepIdx++;
        if (state.stepIdx >= state.data.steps.length) {
            finishPattern();
            return;
        }
        loadStep();
    }

    function loadStep() {
        var step = state.data.steps[state.stepIdx];
        var counter = document.getElementById('pattern-step-counter');
        if (counter) {
            counter.textContent = state.stepIdx + 1 + ' / ' + state.data.steps.length;
        }
        renderEng(step);
        renderKor(step);
        setPhase('think');
    }

    function finishPattern() {
        markDone(state.data.id);
        var overlay = document.getElementById('pattern-complete');
        var title = document.getElementById('pattern-complete-title');
        var nextBtn = document.getElementById('pattern-complete-next');

        if (title) title.textContent = (state.data.title || '') + ' 연습 완료';

        if (nextBtn && state.data.next && state.data.next.ready) {
            nextBtn.textContent = '다음: ' + state.data.next.title;
            nextBtn.style.display = '';
            nextBtn.onclick = function () {
                location.href = 'pattern.html?p=' + encodeURIComponent(state.data.next.id);
            };
        } else if (nextBtn) {
            nextBtn.style.display = 'none';
        }

        if (overlay) overlay.classList.add('is-open');
    }

    function renderGuide() {
        var head = document.getElementById('pattern-guide-head');
        var body = document.getElementById('pattern-guide-body');
        if (!body || !state.data) return;

        body.innerHTML =
            '<ul>' +
            (state.data.guide || [])
                .map(function (line) {
                    return '<li>' + escapeHtml(line) + '</li>';
                })
                .join('') +
            '</ul>';

        var collapsed = localStorage.getItem('pattern_guide_collapsed_' + state.data.id) === '1';
        body.classList.toggle('is-collapsed', collapsed);

        if (head) {
            head.onclick = function () {
                body.classList.toggle('is-collapsed');
                localStorage.setItem(
                    'pattern_guide_collapsed_' + state.data.id,
                    body.classList.contains('is-collapsed') ? '1' : '0'
                );
            };
        }
    }

    function bindUi() {
        var btnReveal = document.getElementById('pattern-btn-reveal');
        var btnNext = document.getElementById('pattern-btn-next');
        var stage = document.getElementById('pattern-stage');

        if (btnReveal) {
            btnReveal.addEventListener('click', function () {
                if (state.phase === 'think') showReveal();
            });
        }
        if (btnNext) {
            btnNext.addEventListener('click', function () {
                if (!btnNext.disabled && state.phase === 'reveal') goNextStep();
            });
        }
        if (stage) {
            stage.addEventListener('click', function (e) {
                if (e.target.closest('button, .pattern-eng-token')) return;
                if (state.phase === 'think') showReveal();
            });
        }

        document.getElementById('pattern-back').addEventListener('click', function () {
            location.href = 'index.html?tab=reading';
        });
        document.getElementById('pattern-complete-retry').addEventListener('click', function () {
            document.getElementById('pattern-complete').classList.remove('is-open');
            state.stepIdx = 0;
            state.isRepeat = true;
            loadStep();
        });
        document.getElementById('pattern-complete-toc').addEventListener('click', function () {
            location.href = 'index.html?tab=reading';
        });
        document.getElementById('pattern-complete-close').addEventListener('click', function () {
            document.getElementById('pattern-complete').classList.remove('is-open');
            location.href = 'index.html?tab=reading';
        });
    }

    function showError(msg) {
        var stage = document.getElementById('pattern-stage');
        if (stage) {
            stage.innerHTML = '<div class="pattern-error">' + escapeHtml(msg) + '</div>';
        }
    }

    function init() {
        var id = getPatternId();
        state.isRepeat = isDoneBefore(id);

        fetch('data/patterns/' + id + '.json')
            .then(function (r) {
                if (!r.ok) throw new Error('missing');
                return r.json();
            })
            .then(function (data) {
                state.data = data;
                document.title = 'TRIGGER · ' + (data.title || '독해');
                var label = document.getElementById('pattern-chapter-label');
                if (label) {
                    label.innerHTML =
                        '<strong>' +
                        escapeHtml(data.chapter) +
                        '</strong> · ' +
                        escapeHtml(data.title);
                }
                renderGuide();
                bindUi();
                loadStep();
            })
            .catch(function () {
                showError('연습 데이터를 불러오지 못했습니다.');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
