(function () {
    'use strict';

    var INTRO_BAR_MS = 7000;
    var COL_ROLES = ['s', 'o', 'v'];

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

    function roleLabelParts(step) {
        var focus = getFocusRole(step);
        if (focus === 's') return { comp: '주어', marker: '은/는/이가' };
        if (focus === 'o') return { comp: '목적어', marker: '을/를' };
        return { comp: '서술어', marker: '다' };
    }

    function fillKorEl(korEl, korSlot, role) {
        korEl.innerHTML = '';
        if (!korSlot) return;

        var wordSpan = document.createElement('span');
        wordSpan.className = 'pattern-kor-word';
        var partSpan = document.createElement('span');
        partSpan.className = 'pattern-kor-particle';

        if (korSlot.particle) {
            wordSpan.textContent = korSlot.word;
            partSpan.textContent = korSlot.particle;
            korEl.appendChild(wordSpan);
            korEl.appendChild(partSpan);
        } else if (role === 'v' && korSlot.word && korSlot.word.slice(-1) === '다') {
            wordSpan.textContent = korSlot.word.slice(0, -1);
            partSpan.textContent = '다';
            korEl.appendChild(wordSpan);
            korEl.appendChild(partSpan);
        } else {
            wordSpan.textContent = korSlot.word;
            korEl.appendChild(wordSpan);
        }
    }

    function findEngByRole(step, role) {
        return (step.eng_tokens || []).find(function (t) {
            return roleClass(t.role) === role;
        });
    }

    function findKorByRole(step, role) {
        return (step.kor_slots || []).find(function (s) {
            return roleClass(s.role) === role;
        });
    }

    function roleContentChanged(prevStep, nextStep, role) {
        var pe = findEngByRole(prevStep, role);
        var ne = findEngByRole(nextStep, role);
        var pk = findKorByRole(prevStep, role);
        var nk = findKorByRole(nextStep, role);
        if (pe && ne && pe.text !== ne.text) return true;
        if (pk && nk) {
            var pt = (pk.word || '') + (pk.particle || '');
            var nt = (nk.word || '') + (nk.particle || '');
            if (pt !== nt) return true;
        }
        return false;
    }

    function getFlipRole(prevStep, nextStep) {
        var ch = nextStep.change || '';
        if (ch === 's' || ch === 'o' || ch === 'v') {
            if (roleContentChanged(prevStep, nextStep, ch)) return ch;
        }
        for (var i = 0; i < COL_ROLES.length; i++) {
            var r = COL_ROLES[i];
            if (roleContentChanged(prevStep, nextStep, r)) return r;
        }
        return null;
    }

    function applyFocusRole(step) {
        var focus = getFocusRole(step);
        document.querySelectorAll('.pattern-col').forEach(function (el) {
            el.classList.toggle('is-focus', el.dataset.role === focus);
        });
    }

    function updateRoleLabel(step) {
        var label = document.getElementById('pattern-role-label');
        if (!label) return;
        var p = roleLabelParts(step);
        label.innerHTML =
            '<span class="pattern-role-comp">' +
            escapeHtml(p.comp) +
            '</span><span class="pattern-role-plus">+</span><span class="pattern-role-marker">' +
            escapeHtml(p.marker) +
            '</span>';
    }

    var measureEng;
    var measureKor;

    function ensureMeasurer() {
        if (measureEng) return;
        var box = document.createElement('div');
        box.id = 'pattern-measure';
        box.setAttribute('aria-hidden', 'true');
        box.style.cssText =
            'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;';
        measureEng = document.createElement('span');
        measureEng.className = 'pattern-col-eng';
        measureKor = document.createElement('span');
        measureKor.className = 'pattern-col-kor';
        box.appendChild(measureEng);
        box.appendChild(measureKor);
        document.body.appendChild(box);
    }

    function applyColWidths() {
        var wrap = document.getElementById('pattern-cols');
        if (!wrap || !state.data) return;
        ensureMeasurer();

        var widths = { s: 0, o: 0, v: 0 };
        state.data.steps.forEach(function (step) {
            COL_ROLES.forEach(function (role) {
                var eng = findEngByRole(step, role);
                var kor = findKorByRole(step, role);
                if (eng) {
                    measureEng.textContent = eng.text;
                    widths[role] = Math.max(widths[role], measureEng.offsetWidth);
                }
                if (kor) {
                    measureKor.textContent = kor.word + (kor.particle || '');
                    widths[role] = Math.max(widths[role], measureKor.offsetWidth);
                }
            });
        });

        var gap = 5;
        var sum = widths.s + widths.o + widths.v;
        var gaps = gap * (COL_ROLES.length - 1);
        var stage = wrap.parentElement;
        var avail = stage ? stage.clientWidth : wrap.clientWidth;
        var factor = 1;
        if (sum + gaps > avail && avail > 0 && sum > 0) {
            factor = (avail - gaps) / sum;
        }

        wrap.style.gridTemplateColumns = COL_ROLES.map(function (role) {
            return Math.ceil(widths[role] * factor) + 'px';
        }).join(' ');
    }

    function buildColsDom(step) {
        var wrap = document.getElementById('pattern-cols');
        if (!wrap) return;
        wrap.innerHTML = '';

        COL_ROLES.forEach(function (role) {
            var engTok = findEngByRole(step, role);
            var korSlot = findKorByRole(step, role);
            if (!engTok && !korSlot) return;

            var col = document.createElement('div');
            col.className = 'pattern-col pattern-col--' + role;
            col.dataset.role = role;

            var inner = document.createElement('div');
            inner.className = 'pattern-col-inner';

            var engEl = document.createElement('div');
            engEl.className = 'pattern-col-eng';
            var engSpan = document.createElement('span');
            engSpan.className = 'pattern-eng-token pattern-eng-token--' + role;
            engSpan.textContent = engTok ? engTok.text : '';
            engEl.appendChild(engSpan);

            var korEl = document.createElement('div');
            korEl.className = 'pattern-col-kor';
            fillKorEl(korEl, korSlot, role);

            inner.appendChild(engEl);
            inner.appendChild(korEl);
            col.appendChild(inner);
            wrap.appendChild(col);
        });

        applyFocusRole(step);
        updateRoleLabel(step);
    }

    function updateColContent(step, role) {
        var engTok = findEngByRole(step, role);
        var korSlot = findKorByRole(step, role);
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (!col) return;

        var engSpan = col.querySelector('.pattern-eng-token');
        var korEl = col.querySelector('.pattern-col-kor');
        if (engSpan && engTok) engSpan.textContent = engTok.text;
        if (korEl && korSlot) fillKorEl(korEl, korSlot, role);
    }

    function flipColumn(role, updateFn) {
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (!col) {
            updateFn();
            return;
        }
        var inner = col.querySelector('.pattern-col-inner');
        if (!inner) {
            updateFn();
            return;
        }

        inner.classList.remove('is-flip-in');
        inner.classList.add('is-flip-out');

        setTimeout(function () {
            updateFn();
            inner.classList.remove('is-flip-out');
            inner.classList.add('is-flip-in');
            setTimeout(function () {
                inner.classList.remove('is-flip-in');
            }, 340);
        }, 300);
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
        var btnPrev = document.getElementById('pattern-btn-prev');
        var btnNext = document.getElementById('pattern-btn-next');
        var counter = document.getElementById('pattern-step-counter');
        var total = state.data.steps.length;

        if (counter) {
            counter.textContent = state.variantIdx + 1 + ' / ' + total;
        }

        var showNav = state.introDone;
        if (nav) nav.classList.toggle('is-hidden', !showNav);

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

        if (prevIdx < 0 || !prevStep) {
            buildColsDom(nextStep);
        } else {
            var flipRole = getFlipRole(prevStep, nextStep);
            if (flipRole) {
                updateColContent(nextStep, flipRole);
            } else {
                buildColsDom(nextStep);
            }
            applyFocusRole(nextStep);
            updateRoleLabel(nextStep);
        }

        updateNavUi();
    }

    function renderVariant(prevIdx, nextIdx) {
        if (prevIdx < 0) {
            applyStepDom(prevIdx, nextIdx);
            return;
        }

        var prevStep = state.data.steps[prevIdx];
        var nextStep = state.data.steps[nextIdx];
        var flipRole = getFlipRole(prevStep, nextStep);

        if (flipRole) {
            flipColumn(flipRole, function () {
                updateColContent(nextStep, flipRole);
                applyFocusRole(nextStep);
                updateRoleLabel(nextStep);
                updateNavUi();
            });
        } else {
            applyStepDom(prevIdx, nextIdx);
        }
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
        buildColsDom(step);
        updateNavUi();

        if (state.isRepeat) {
            hideIntroBar();
        } else {
            var nav = document.getElementById('pattern-nav');
            if (nav) nav.classList.add('is-hidden');
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
                applyColWidths();
                window.addEventListener('resize', applyColWidths);
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
