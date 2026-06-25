(function () {
    'use strict';

    var INTRO_BAR_MS = 7000;

    var state = {
        data: null,
        variantIdx: 0,
        introDone: false,
        isRepeat: false,
        progressInterval: null,
        highlightIdx: -1
    };

    function clearProgress() {
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
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

    function currentStep() {
        return state.data.steps[state.variantIdx];
    }

    function getFocusRole(step) {
        if (!step) return 's';
        if (step.focus) return step.focus;
        var ch = step.change || '';
        if (ch === 'o') return 'o';
        if (ch === 'v') return 'v';
        return 's';
    }

    function applyFocusRole(step) {
        var focus = getFocusRole(step);
        document.querySelectorAll('.pattern-eng-token').forEach(function (el) {
            var on = el.classList.contains('pattern-eng-token--' + focus);
            el.classList.toggle('is-focus', on);
        });
        document.querySelectorAll('.pattern-kor-slot.kor-word-cell').forEach(function (el) {
            var on = el.classList.contains('pattern-kor-slot--' + focus);
            el.classList.toggle('is-focus', on);
        });
    }

    function hintForStep(step, isFirst) {
        if (!step) return '';
        if (isFirst) return '주어에 색이 들어간 부분을 영어·해석과 함께 읽어 보세요';
        var ch = step.change || '';
        if (ch === 'o') return '→ 목적어만 바뀌었어요. 해석도 목적어 부분만 바뀝니다';
        if (ch === 's') return '→ 주어만 바뀌었어요. 해석도 주어 부분만 바뀝니다';
        if (ch === 'v') return '→ 동사만 바뀌었어요. 해석도 동사 부분만 바뀝니다';
        if (ch === 'len') return '→ 문장이 조금 길어졌어요';
        return '→ 눌러서 다음으로, ← 눌러서 이전으로';
    }

    function findChangedTokenIndices(prevStep, nextStep) {
        var indices = [];
        var prev = prevStep && prevStep.eng_tokens ? prevStep.eng_tokens : [];
        var next = nextStep && nextStep.eng_tokens ? nextStep.eng_tokens : [];
        var len = Math.max(prev.length, next.length);
        for (var i = 0; i < len; i++) {
            var pt = prev[i] ? prev[i].text : '';
            var nt = next[i] ? next[i].text : '';
            if (pt !== nt) indices.push(i);
        }
        return indices;
    }

    function findChangedKorIndices(prevStep, nextStep) {
        var indices = [];
        var prev = prevStep && prevStep.kor_slots ? prevStep.kor_slots : [];
        var next = nextStep && nextStep.kor_slots ? nextStep.kor_slots : [];
        var len = Math.max(prev.length, next.length);
        for (var i = 0; i < len; i++) {
            var pw = (prev[i] && prev[i].word) || '';
            var pp = (prev[i] && prev[i].particle) || '';
            var nw = (next[i] && next[i].word) || '';
            var np = (next[i] && next[i].particle) || '';
            if (pw + pp !== nw + np) indices.push(i);
        }
        return indices;
    }

    function buildEngDom(step) {
        var el = document.getElementById('pattern-eng');
        if (!el) return;
        el.innerHTML = '';
        (step.eng_tokens || []).forEach(function (tok, i) {
            if (i > 0) el.appendChild(document.createTextNode(' '));
            var span = document.createElement('span');
            span.className =
                'pattern-eng-token pattern-eng-token--' + roleClass(tok.role);
            span.textContent = tok.text;
            span.dataset.tokenIdx = String(i);
            span.dataset.maps = String(tok.maps);
            span.addEventListener('click', function (e) {
                e.stopPropagation();
                highlightPair(tok.maps);
            });
            el.appendChild(span);
        });
    }

    function updateEngTokens(step, changedIndices) {
        var tokens = step.eng_tokens || [];
        changedIndices.forEach(function (i) {
            var tok = tokens[i];
            if (!tok) return;
            var span = document.querySelector(
                '.pattern-eng-token[data-token-idx="' + i + '"]'
            );
            if (!span) return;
            span.textContent = tok.text;
            span.classList.add('is-changing');
            span.classList.add('is-lit');
            setTimeout(function () {
                span.classList.remove('is-changing');
            }, 700);
        });
    }

    function buildKorDom(step) {
        var wrap = document.getElementById('pattern-kor-wrap');
        if (!wrap) return;
        wrap.innerHTML = '';

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

    function updateKorSlots(step, changedIndices) {
        var slots = step.kor_slots || [];
        changedIndices.forEach(function (i) {
            var slot = slots[i];
            if (!slot) return;
            var cells = document.querySelectorAll('.pattern-kor-slot[data-idx="' + i + '"]');
            cells.forEach(function (cell) {
                if (cell.classList.contains('kor-word-cell')) {
                    var wordEl = cell.querySelector('.pattern-kor-word');
                    if (wordEl) {
                        wordEl.textContent = slot.word + (slot.particle || '');
                    }
                    cell.classList.add('is-changing', 'is-lit');
                    setTimeout(function () {
                        cell.classList.remove('is-changing');
                    }, 700);
                }
            });
        });
    }

    function highlightPair(korIdx) {
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
            el.classList.remove('is-lit', 'is-dim');
        });
        document.querySelectorAll('.pattern-kor-slot').forEach(function (el) {
            el.classList.remove('is-lit', 'is-dim');
        });
    }

    function setProgress(ratio) {
        var fill = document.getElementById('pattern-progress-fill');
        if (fill) fill.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';
    }

    function runIntroBar(onDone) {
        var wrap = document.getElementById('pattern-progress-wrap');
        if (wrap) wrap.classList.remove('is-hidden');
        var start = Date.now();
        setProgress(0);
        clearProgress();
        state.progressInterval = setInterval(function () {
            var elapsed = Date.now() - start;
            setProgress(elapsed / INTRO_BAR_MS);
            if (elapsed >= INTRO_BAR_MS) {
                clearProgress();
                setProgress(1);
                if (onDone) onDone();
            }
        }, 50);
    }

    function hideIntroBar() {
        clearProgress();
        var wrap = document.getElementById('pattern-progress-wrap');
        if (wrap) wrap.classList.add('is-hidden');
    }

    function updateNavUi() {
        var nav = document.getElementById('pattern-nav');
        var hint = document.getElementById('pattern-nav-hint');
        var btnPrev = document.getElementById('pattern-btn-prev');
        var btnNext = document.getElementById('pattern-btn-next');
        var counter = document.getElementById('pattern-step-counter');
        var total = state.data.steps.length;
        var step = currentStep();

        if (counter) {
            counter.textContent = state.variantIdx + 1 + ' / ' + total;
        }

        var showNav = state.introDone;
        if (nav) nav.classList.toggle('is-hidden', !showNav);
        if (hint) {
            hint.classList.toggle('is-hidden', !showNav);
            hint.textContent = hintForStep(step, state.variantIdx === 0 && showNav);
        }

        if (btnPrev) btnPrev.disabled = state.variantIdx <= 0;
        if (btnNext) {
            btnNext.disabled = false;
            if (state.variantIdx >= total - 1) {
                btnNext.textContent = '✓';
                btnNext.setAttribute('aria-label', '완료');
            } else {
                btnNext.textContent = '→';
                btnNext.setAttribute('aria-label', '다음');
            }
        }
    }

    function applyStepDom(prevIdx, nextIdx) {
        var prevStep = prevIdx >= 0 ? state.data.steps[prevIdx] : null;
        var nextStep = state.data.steps[nextIdx];

        if (prevIdx < 0) {
            buildEngDom(nextStep);
            buildKorDom(nextStep);
        } else {
            var engChanged = findChangedTokenIndices(prevStep, nextStep);
            var korChanged = findChangedKorIndices(prevStep, nextStep);
            if (engChanged.length === 0 && korChanged.length === 0) {
                buildEngDom(nextStep);
                buildKorDom(nextStep);
            } else {
                updateEngTokens(nextStep, engChanged);
                updateKorSlots(nextStep, korChanged);
            }
        }

        applyFocusRole(nextStep);
        clearHighlight();
        updateNavUi();
    }

    function renderVariant(prevIdx, nextIdx, skipFlip) {
        if (skipFlip || prevIdx < 0) {
            applyStepDom(prevIdx, nextIdx);
            return;
        }

        var stage = document.getElementById('pattern-stage');
        if (!stage) {
            applyStepDom(prevIdx, nextIdx);
            return;
        }

        stage.classList.remove('is-flip-in');
        stage.classList.add('is-flip-out');

        setTimeout(function () {
            applyStepDom(prevIdx, nextIdx);
            stage.classList.remove('is-flip-out');
            stage.classList.add('is-flip-in');
            setTimeout(function () {
                stage.classList.remove('is-flip-in');
            }, 340);
        }, 300);
    }

    function goToVariant(idx) {
        if (!state.data || idx < 0 || idx >= state.data.steps.length) return;
        var prevIdx = state.variantIdx;
        state.variantIdx = idx;
        renderVariant(prevIdx, idx);
    }

    function onIntroComplete() {
        state.introDone = true;
        hideIntroBar();
        if (state.data.steps.length > 1) {
            goToVariant(1);
        } else {
            updateNavUi();
        }
    }

    function startSession() {
        state.variantIdx = 0;
        state.introDone = state.isRepeat;

        var step = currentStep();
        buildEngDom(step);
        buildKorDom(step);
        applyFocusRole(step);
        updateNavUi();

        if (state.isRepeat) {
            hideIntroBar();
            var hint = document.getElementById('pattern-nav-hint');
            if (hint) {
                hint.classList.remove('is-hidden');
                hint.textContent = '← → 로 바뀌는 부분을 확인해 보세요';
            }
        } else {
            var nav = document.getElementById('pattern-nav');
            if (nav) nav.classList.add('is-hidden');
            var hintEl = document.getElementById('pattern-nav-hint');
            if (hintEl) {
                hintEl.classList.remove('is-hidden');
                hintEl.textContent = hintForStep(step, true);
            }
            runIntroBar(onIntroComplete);
        }
    }

    function goNext() {
        if (state.variantIdx >= state.data.steps.length - 1) {
            finishPattern();
            return;
        }
        goToVariant(state.variantIdx + 1);
    }

    function goPrev() {
        if (state.variantIdx <= 0) return;
        goToVariant(state.variantIdx - 1);
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
        document.getElementById('pattern-btn-prev').addEventListener('click', goPrev);
        document.getElementById('pattern-btn-next').addEventListener('click', goNext);

        document.getElementById('pattern-back').addEventListener('click', function () {
            location.href = 'index.html?tab=reading';
        });
        document.getElementById('pattern-complete-retry').addEventListener('click', function () {
            document.getElementById('pattern-complete').classList.remove('is-open');
            state.isRepeat = true;
            startSession();
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
                startSession();
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
