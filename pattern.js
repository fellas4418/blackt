(function () {
    'use strict';

    var INTRO_BAR_MS = 7000;
    var COL_ROLES = ['s', 'v', 'o'];
    var COL_COMP = { s: '주어', o: '목적어', v: '서술어' };
    var COL_MARKER = { s: '은/는/이가', o: '을/를', v: '다' };
    var CHIPS_BY_ROLE = { s: ['은', '는', '이', '가'], o: ['을', '를'], v: ['다'] };

    var state = {
        data: null,
        variantIdx: 0,
        introDone: false,
        isRepeat: false,
        progressInterval: null,
        drillFilled: { s: false, o: false, v: false }
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

    function phaseChapterForRole(role) {
        if (role === 's') return 'Ⅰ';
        if (role === 'o') return 'Ⅱ';
        return 'Ⅲ';
    }

    function phaseLabelForStep(step) {
        var focus = getFocusRole(step);
        if (focus === 's') return '주어 변화';
        if (focus === 'o') return '목적어 변화';
        return '서술어 변화';
    }

    function isLearnMode() {
        return !state.introDone && state.variantIdx === 0 && !state.isRepeat;
    }

    function resetDrillFilled() {
        state.drillFilled = { s: false, o: false, v: false };
        if (isLearnMode()) {
            state.drillFilled = { s: true, o: true, v: true };
        }
    }

    function isDrillComplete() {
        return COL_ROLES.every(function (role) {
            return state.drillFilled[role];
        });
    }

    function getKorParts(korSlot, role) {
        if (!korSlot) return { word: '', particle: '' };
        if (korSlot.particle) {
            return { word: korSlot.word || '', particle: korSlot.particle };
        }
        if (role === 'v' && korSlot.word && korSlot.word.slice(-1) === '다') {
            return { word: korSlot.word.slice(0, -1), particle: '다' };
        }
        return { word: korSlot.word || '', particle: '' };
    }

    function playSentenceTts(text) {
        if (!text || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            var utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.92;
            window.speechSynthesis.speak(utterance);
        } catch (e) {}
    }

    function updatePhaseBadge(step, prevStep) {
        var badge = document.getElementById('pattern-phase-badge');
        if (!badge) return;
        var focus = getFocusRole(step);
        badge.innerHTML = '<span class="pattern-phase-badge-core">' +
            '<span class="pattern-phase-badge-ch">' + phaseChapterForRole(focus) + '</span>' +
            '<span class="pattern-phase-badge-txt">' + phaseLabelForStep(step) + '</span>' +
            '</span>';
        if (prevStep && getFocusRole(prevStep) !== getFocusRole(step)) {
            badge.classList.remove('is-switching');
            void badge.offsetWidth;
            badge.classList.add('is-switching');
            setTimeout(function () {
                badge.classList.remove('is-switching');
            }, 620);
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
            el.classList.toggle('is-dim', el.dataset.role !== focus);
        });
    }

    function renderEngHero(step, prevStep) {
        var el = document.getElementById('pattern-eng-hero');
        if (!el || !step) return;

        var highlightRole = prevStep ? getFlipRole(prevStep, step) : getFocusRole(step);
        var tokens = step.eng_tokens || [];

        if (tokens.length) {
            el.innerHTML = tokens.map(function (t, i) {
                var cls = 'pattern-hero-token';
                if (highlightRole && roleClass(t.role) === highlightRole) {
                    cls += ' is-changed is-snap-in';
                } else {
                    cls += ' is-dim';
                }
                var gap = i < tokens.length - 1 ? ' ' : '';
                return '<span class="' + cls + '">' + escapeHtml(t.text) + '</span>' + gap;
            }).join('');
        } else {
            el.textContent = step.eng || '';
        }

        el.classList.remove('is-enter');
        void el.offsetWidth;
        el.classList.add('is-enter');
    }

    function syncDrillHint() {
        var hint = document.getElementById('pattern-drill-hint');
        if (!hint) return;
        if (isLearnMode()) {
            hint.textContent = '문장 구조를 먼저 살펴보세요';
            hint.classList.add('is-learn');
            hint.classList.remove('is-done');
            return;
        }
        hint.classList.remove('is-learn');
        if (isDrillComplete()) {
            hint.textContent = '완성! 다음으로 넘어가 보세요 →';
            hint.classList.add('is-done');
        } else {
            hint.textContent = '조사를 골라 붙여 보세요';
            hint.classList.remove('is-done');
        }
    }

    function flashAllCards() {
        document.querySelectorAll('.pattern-col-inner').forEach(function (inner) {
            inner.classList.remove('is-complete-flash');
            void inner.offsetWidth;
            inner.classList.add('is-complete-flash');
        });
        var wrap = document.getElementById('pattern-progress-wrap');
        if (wrap) {
            wrap.classList.remove('is-step-complete');
            void wrap.offsetWidth;
            wrap.classList.add('is-step-complete');
        }
    }

    function onDrillAllComplete() {
        flashAllCards();
        syncDrillHint();
        updateNavUi();
        updateStepProgress();
    }

    function attachParticle(role, chip, expected) {
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (!col || state.drillFilled[role]) return;

        if (chip !== expected) {
            col.classList.remove('is-shake');
            void col.offsetWidth;
            col.classList.add('is-shake');
            return;
        }

        state.drillFilled[role] = true;

        var slot = col.querySelector('.pattern-kor-slot');
        if (slot) {
            slot.textContent = chip;
            slot.classList.remove('pattern-kor-slot');
            slot.classList.add('pattern-kor-particle', 'is-snapped');
        }

        var chipRow = col.querySelector('.pattern-chip-row');
        if (chipRow) chipRow.remove();

        col.classList.add('is-filled');

        if (isDrillComplete()) {
            onDrillAllComplete();
        } else {
            syncDrillHint();
            updateNavUi();
            updateStepProgress();
        }
    }

    function buildChipRow(role, expected) {
        var row = document.createElement('div');
        row.className = 'pattern-chip-row';
        CHIPS_BY_ROLE[role].forEach(function (chip) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pattern-chip';
            btn.textContent = chip;
            btn.addEventListener('click', function () {
                attachParticle(role, chip, expected);
            });
            row.appendChild(btn);
        });
        return row;
    }

    function fillKorEl(korEl, korSlot, role, learnMode) {
        korEl.innerHTML = '';
        if (!korSlot) return;

        var parts = getKorParts(korSlot, role);
        var wordSpan = document.createElement('span');
        wordSpan.className = 'pattern-kor-word';
        wordSpan.textContent = parts.word;
        korEl.appendChild(wordSpan);

        if (learnMode || state.drillFilled[role]) {
            var partSpan = document.createElement('span');
            partSpan.className = 'pattern-kor-particle' + (state.drillFilled[role] && !learnMode ? ' is-snapped' : '');
            partSpan.textContent = parts.particle;
            korEl.appendChild(partSpan);
        } else {
            var slotSpan = document.createElement('span');
            slotSpan.className = 'pattern-kor-slot';
            slotSpan.textContent = '?';
            korEl.appendChild(slotSpan);
        }
    }

    function buildCardDom(col, step, role, learnMode) {
        var korSlot = findKorByRole(step, role);
        if (!korSlot) return;

        var parts = getKorParts(korSlot, role);
        var inner = document.createElement('div');
        inner.className = 'pattern-col-inner';

        var compEl = document.createElement('div');
        compEl.className = 'pattern-col-comp';
        compEl.textContent = COL_COMP[role] || '';

        var korEl = document.createElement('div');
        korEl.className = 'pattern-col-kor';
        fillKorEl(korEl, korSlot, role, learnMode);

        var markerEl = document.createElement('div');
        markerEl.className = 'pattern-col-marker';
        markerEl.textContent = COL_MARKER[role] || '';

        inner.appendChild(compEl);
        inner.appendChild(korEl);
        inner.appendChild(markerEl);

        if (!learnMode && !state.drillFilled[role]) {
            inner.appendChild(buildChipRow(role, parts.particle));
        }

        col.appendChild(inner);
        if (state.drillFilled[role]) col.classList.add('is-filled');
    }

    function applyColWidths() {
        var wrap = document.getElementById('pattern-cols');
        if (!wrap) return;
        wrap.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    }

    function buildColsDom(step, prevStep) {
        var wrap = document.getElementById('pattern-cols');
        if (!wrap) return;

        resetDrillFilled();
        wrap.innerHTML = '';

        var learnMode = isLearnMode();

        COL_ROLES.forEach(function (role) {
            var korSlot = findKorByRole(step, role);
            if (!korSlot) return;

            var col = document.createElement('div');
            col.className = 'pattern-col pattern-col--' + role;
            col.dataset.role = role;
            buildCardDom(col, step, role, learnMode);
            wrap.appendChild(col);
        });

        renderEngHero(step, prevStep);
        applyFocusRole(step);
        updatePhaseBadge(step, prevStep);
        syncDrillHint();
        updateStepProgress();
        updateNavUi();

        if (step.eng) {
            playSentenceTts(step.eng);
        }
    }

    function animateChangedColumn(flipRole) {
        if (!flipRole) return;
        var col = document.querySelector('.pattern-col[data-role="' + flipRole + '"]');
        var inner = col && col.querySelector('.pattern-col-inner');
        if (!inner) return;
        inner.classList.remove('is-flip-in-left');
        void inner.offsetWidth;
        inner.classList.add('is-flip-in-left');
        setTimeout(function () {
            inner.classList.remove('is-flip-in-left');
        }, 280);
    }

    function setProgress(ratio) {
        var fill = document.getElementById('pattern-progress-fill');
        if (fill) fill.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';
    }

    function updateStepProgress() {
        var wrap = document.getElementById('pattern-progress-wrap');
        var fill = document.getElementById('pattern-progress-fill');
        if (!wrap || !fill || !state.data) return;

        if (!state.introDone && !state.isRepeat && state.variantIdx === 0) return;

        wrap.classList.remove('is-hidden', 'is-intro');
        var total = state.data.steps.length;
        var ratio = total > 1 ? state.variantIdx / (total - 1) : 1;
        fill.style.width = Math.min(100, Math.max(0, ratio * 100)) + '%';

        wrap.classList.toggle('is-drill-pending', !isLearnMode() && !isDrillComplete());
        wrap.classList.toggle('is-drill-done', !isLearnMode() && isDrillComplete());
    }

    function runIntroBar(onDone) {
        var wrap = document.getElementById('pattern-progress-wrap');
        if (wrap) {
            wrap.classList.remove('is-hidden', 'is-drill-pending', 'is-drill-done', 'is-step-complete');
            wrap.classList.add('is-intro');
        }
        var start = Date.now();
        setProgress(0);
        clearProgress();
        state.progressInterval = setInterval(function () {
            var elapsed = Date.now() - start;
            setProgress(elapsed / INTRO_BAR_MS);
            if (elapsed >= INTRO_BAR_MS) {
                clearProgress();
                setProgress(1);
                if (wrap) wrap.classList.remove('is-intro');
                if (onDone) onDone();
            }
        }, 50);
    }

    function hideIntroBar() {
        clearProgress();
        updateStepProgress();
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

        var canAdvance = isLearnMode() || isDrillComplete();
        if (btnNext) {
            btnNext.disabled = !canAdvance;
            btnNext.classList.toggle('is-ready', canAdvance && state.variantIdx < total - 1);
            if (state.variantIdx >= total - 1) {
                btnNext.textContent = '✓';
                btnNext.setAttribute('aria-label', '완료');
            } else {
                btnNext.textContent = '→';
                btnNext.setAttribute('aria-label', '다음');
            }
        }
    }

    function renderVariant(prevIdx, nextIdx) {
        var prevStep = prevIdx >= 0 ? state.data.steps[prevIdx] : null;
        var nextStep = state.data.steps[nextIdx];
        var flipRole = prevStep ? getFlipRole(prevStep, nextStep) : null;

        buildColsDom(nextStep, prevStep);
        animateChangedColumn(flipRole);
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
            updateStepProgress();
        }
    }

    function startSession() {
        state.variantIdx = 0;
        state.introDone = state.isRepeat;

        var step = currentStep();
        buildColsDom(step, null);
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
        if (!isLearnMode() && !isDrillComplete()) return;
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

    function syncGuideExpanded() {
        var guide = document.querySelector('.pattern-guide');
        var body = document.getElementById('pattern-guide-body');
        var head = document.getElementById('pattern-guide-head');
        var collapsed = body && body.classList.contains('is-collapsed');
        if (guide && body) {
            guide.classList.toggle('is-expanded', !collapsed);
        }
        if (head) {
            var fold = head.querySelector('.pattern-guide-fold');
            if (fold) fold.textContent = collapsed ? '탭하여 보기' : '탭하여 접기';
        }
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

        body.classList.remove('is-collapsed');
        syncGuideExpanded();

        if (head) {
            head.onclick = function () {
                body.classList.toggle('is-collapsed');
                syncGuideExpanded();
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
