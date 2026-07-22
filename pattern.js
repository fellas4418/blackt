(function () {
    'use strict';

    var INTRO_BAR_MS = 7000;
    var DOCENT_LINE_MS = 10000;
    var DOCENT_EXAMPLE_MS = 11000;
    var DOCENT_BRIDGE_MS = 6500;
    var AUTO_NEXT_MS = 850;
    var COL_COMP = { s: '주어', o: '목적어', c: '보어', v: '서술어' };
    var PARTICLE_POOL = ['은', '는', '이', '가', '을', '를', '다'];
    var SUBJECT_PARTICLES = { '은': 1, '는': 1, '이': 1, '가': 1 };
    var TOPIC_PARTICLES = { '은': 1, '는': 1 };
    var OBJECT_PARTICLES = { '을': 1, '를': 1 };
    var COMPLEMENT_PARTICLES = { '이': 1, '가': 1 };
    var VERB_PARTICLES = { '다': 1 };

    var INDEX_URL = 'data/pattern_index.json?v=20260722m';

    var state = {
        data: null,
        indexData: null,
        chapterMeta: null,
        docentLines: null,
        variantIdx: 0,
        introDone: false,
        isRepeat: false,
        progressInterval: null,
        drillFilled: {},
        selectedChip: null,
        usedChips: {},
        hoverRole: null,
        docentTimer: null,
        docentIdx: 0,
        docentPhase: null,
        skipDocent: false,
        guideBeatActive: false,
        guideBeatDone: false,
        autoNextTimer: null
    };

    function activeRoles() {
        if (state.data && Array.isArray(state.data.roles) && state.data.roles.length) {
            return state.data.roles.slice();
        }
        return ['s', 'v', 'o'];
    }

    function patternHasRole(role) {
        return activeRoles().indexOf(role) >= 0;
    }

    function emptyDrillFilled(filled) {
        var o = {};
        activeRoles().forEach(function (role) {
            o[role] = !!filled;
        });
        return o;
    }

    function markerFor(role) {
        if (role === 's') return patternHasRole('c') ? '은/는' : '은/는/이/가';
        if (role === 'o') return '을/를';
        if (role === 'c') return '이/가';
        return '다';
    }

    function roleLabelsHint() {
        return activeRoles()
            .map(function (r) {
                return COL_COMP[r] || r;
            })
            .join('·');
    }

    function clearProgress() {
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
    }

    function clearAutoNext() {
        if (state.autoNextTimer) {
            clearTimeout(state.autoNextTimer);
            state.autoNextTimer = null;
        }
    }

    function resolveGuidePoints() {
        if (!state.data) return [];
        var raw = state.data.guide_points;
        if (Array.isArray(raw) && raw.length) {
            return raw
                .map(function (p) {
                    if (!p) return null;
                    if (typeof p === 'string') {
                        return { mark: guessGuideMark(p), text: p };
                    }
                    return {
                        mark: p.mark || guessGuideMark(p.text || ''),
                        text: p.text || ''
                    };
                })
                .filter(function (p) {
                    return p && p.text;
                });
        }
        return (state.data.guide || [])
            .map(function (text) {
                return { mark: guessGuideMark(text), text: text };
            })
            .filter(function (p) {
                return p.text;
            });
    }

    function guessGuideMark(text) {
        var t = String(text || '');
        if (/주어/.test(t)) return 's';
        if (/목적어/.test(t)) return 'o';
        if (/보어/.test(t)) return 'c';
        if (/동사|서술/.test(t)) return 'v';
        return '';
    }

    function shouldShowGuideBeat() {
        return !state.guideBeatDone && !state.skipDocent && resolveGuidePoints().length > 0;
    }

    function collapseTopGuide() {
        var body = document.getElementById('pattern-guide-body');
        if (!body || !state.data) return;
        body.classList.add('is-collapsed');
        syncGuideExpanded();
        localStorage.setItem('pattern_guide_collapsed_' + state.data.id, '1');
    }

    function renderGuideBeat() {
        var beat = document.getElementById('pattern-guide-beat');
        var list = document.getElementById('pattern-guide-beat-list');
        if (!beat || !list) return;

        if (!state.guideBeatActive) {
            beat.classList.add('is-hidden');
            list.innerHTML = '';
            return;
        }

        list.innerHTML = resolveGuidePoints()
            .map(function (p) {
                var mark = p.mark ? ' pattern-guide-beat-mark--' + escapeHtml(p.mark) : '';
                return (
                    '<li><span class="pattern-guide-beat-mark' +
                    mark +
                    '">' +
                    escapeHtml(p.text) +
                    '</span></li>'
                );
            })
            .join('');
        beat.classList.remove('is-hidden');
    }

    function startGuideBeat() {
        state.guideBeatActive = true;
        state.introDone = true;
        collapseTopGuide();
        buildStepDom(currentStep());
        var stage = document.getElementById('pattern-stage');
        if (stage) {
            stage.classList.remove('is-enter');
            void stage.offsetWidth;
            stage.classList.add('is-enter');
        }
    }

    function endGuideBeat() {
        if (!state.guideBeatActive) return;
        state.guideBeatActive = false;
        state.guideBeatDone = true;
        buildStepDom(currentStep());
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
        if (role === 'c' || role === '보어') return 'c';
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

    function isLearnMode() {
        return !state.introDone && state.variantIdx === 0 && !state.isRepeat;
    }

    function resetDrillState() {
        state.drillFilled = emptyDrillFilled(false);
        state.selectedChip = null;
        state.usedChips = {};
        state.hoverRole = null;
        if (isLearnMode()) {
            state.drillFilled = emptyDrillFilled(true);
        }
    }

    function isDrillComplete() {
        return activeRoles().every(function (role) {
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

    function hasBatchim(word) {
        if (!word) return false;
        var code = word.charCodeAt(word.length - 1);
        if (code < 0xAC00 || code > 0xD7A3) return false;
        return (code - 0xAC00) % 28 !== 0;
    }

    function validParticlesForRole(word, role) {
        if (role === 'v') return ['다'];
        if (role === 's') {
            // 보어가 이/가를 쓰므로, 주·동·보에서는 주어를 은/는만 허용
            if (patternHasRole('c')) {
                return hasBatchim(word) ? ['은'] : ['는'];
            }
            return hasBatchim(word) ? ['은', '이'] : ['는', '가'];
        }
        if (role === 'c') {
            return hasBatchim(word) ? ['이'] : ['가'];
        }
        return hasBatchim(word) ? ['을'] : ['를'];
    }

    function isValidParticleForRole(word, role, chip) {
        return validParticlesForRole(word, role).indexOf(chip) >= 0;
    }

    function batchimErrorMessage(role, word) {
        if (role === 's') {
            if (patternHasRole('c')) {
                if (hasBatchim(word)) return '받침이 있어요. 주어에는 은을 붙여요';
                return '받침이 없어요. 주어에는 는을 붙여요';
            }
            if (hasBatchim(word)) {
                return '받침이 있어요. 주어에는 은·이 중 하나를 붙여요';
            }
            return '받침이 없어요. 주어에는 는·가 중 하나를 붙여요';
        }
        if (role === 'o') {
            if (hasBatchim(word)) return '받침이 있어요. 목적어에는 을을 붙여요';
            return '받침이 없어요. 목적어에는 를을 붙여요';
        }
        if (role === 'c') {
            if (hasBatchim(word)) return '받침이 있어요. 보어에는 이를 붙여요';
            return '받침이 없어요. 보어에는 가를 붙여요';
        }
        return '서술어는 ~다로 끝내요';
    }

    function findKorByRole(step, role) {
        return (step.kor_slots || []).find(function (s) {
            return roleClass(s.role) === role;
        });
    }

    function particleAllowedForRole(role, chip) {
        if (role === 's') {
            if (patternHasRole('c')) return !!TOPIC_PARTICLES[chip];
            return !!SUBJECT_PARTICLES[chip];
        }
        if (role === 'o') return !!OBJECT_PARTICLES[chip];
        if (role === 'c') return !!COMPLEMENT_PARTICLES[chip];
        return !!VERB_PARTICLES[chip];
    }

    function roleErrorMessage(role, chip) {
        if (role === 's') {
            if (OBJECT_PARTICLES[chip]) return '목적어 조사(을·를)는 주어에 붙이지 않아요';
            if (COMPLEMENT_PARTICLES[chip] && patternHasRole('c')) {
                return '보어 조사(이·가)는 주어에 붙이지 않아요. 주어에는 은·는이에요';
            }
            if (VERB_PARTICLES[chip]) return '서술어(~다)는 주어 자리에 붙이지 않아요';
            if (patternHasRole('c')) return '주어에는 은·는 중 하나를 붙여요';
            return '주어에는 은·는·이·가 중 하나를 붙여요';
        }
        if (role === 'o') {
            if (SUBJECT_PARTICLES[chip]) return '주어 조사(은·는·이·가)는 목적어에 붙이지 않아요';
            if (VERB_PARTICLES[chip]) return '서술어(~다)는 목적어에 붙이지 않아요';
            return '목적어에는 을·를 중 하나를 붙여요';
        }
        if (role === 'c') {
            if (TOPIC_PARTICLES[chip]) return '주어 조사(은·는)은 보어에 붙이지 않아요';
            if (OBJECT_PARTICLES[chip]) return '목적어 조사(을·를)는 보어에 붙이지 않아요';
            if (VERB_PARTICLES[chip]) return '서술어(~다)는 보어 자리에 붙이지 않아요';
            return '보어에는 이·가 중 하나를 붙여요';
        }
        if (SUBJECT_PARTICLES[chip]) return '주어·보어 조사는 서술어에 붙이지 않아요';
        if (OBJECT_PARTICLES[chip]) return '목적어 조사(을·를)는 서술어에 붙이지 않아요';
        return '서술어는 ~다로 끝내요';
    }

    function updatePhaseBadge() {
        var badge = document.getElementById('pattern-phase-badge');
        if (!badge || !state.data) return;
        var total = state.data.steps.length;
        var label = state.guideBeatActive ? '해석 포인트' : '자리 표시하기';
        badge.innerHTML = '<span class="pattern-phase-badge-core">' +
            '<span class="pattern-phase-badge-ch">' + (state.variantIdx + 1) + '/' + total + '</span>' +
            '<span class="pattern-phase-badge-txt">' + label + '</span>' +
            '</span>';
    }

    function syncEngHighlight() {
        var learn = isLearnMode();
        var tokens = document.querySelectorAll('.pattern-eng-tok');
        tokens.forEach(function (tok) {
            var role = tok.dataset.role;
            var filled = !!state.drillFilled[role];
            var done = filled && !learn && !state.guideBeatActive;
            var lit = state.guideBeatActive || state.hoverRole === role;
            tok.classList.toggle('is-done', done);
            tok.classList.toggle('is-lit', lit && !done);
            tok.classList.toggle('is-await', !!state.selectedChip && !filled && !learn && !state.guideBeatActive);
        });

        document.querySelectorAll('.pattern-col').forEach(function (col) {
            var role = col.dataset.role;
            col.classList.toggle('is-eng-sync', state.hoverRole === role);
        });
    }

    function setHoverRole(role) {
        state.hoverRole = role || null;
        syncEngHighlight();
    }

    function onEngTokenClick(role) {
        if (state.guideBeatActive) {
            endGuideBeat();
            return;
        }
        if (!role) return;
        setHoverRole(role);
        if (isLearnMode()) return;
        if (state.selectedChip && !state.drillFilled[role]) {
            applyParticleToRole(role, state.selectedChip);
            return;
        }
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (col) {
            col.classList.remove('is-shake');
            void col.offsetWidth;
            col.classList.add('is-shake');
        }
    }

    function renderEngHero(step) {
        var el = document.getElementById('pattern-eng-hero');
        if (!el || !step) return;

        el.innerHTML = '';
        var tokens = step.eng_tokens || [];

        if (tokens.length) {
            tokens.forEach(function (t, i) {
                if (i > 0) el.appendChild(document.createTextNode(' '));
                var role = roleClass(t.role);
                var span = document.createElement('span');
                span.className = 'pattern-eng-tok pattern-eng-tok--' + role;
                span.dataset.role = role;
                span.textContent = t.text || '';
                span.addEventListener('pointerenter', function () {
                    setHoverRole(role);
                });
                span.addEventListener('pointerleave', function () {
                    if (state.hoverRole === role) setHoverRole(null);
                });
                span.addEventListener('click', function () {
                    onEngTokenClick(role);
                });
                el.appendChild(span);
            });
        } else {
            el.textContent = step.eng || '';
        }

        el.classList.remove('is-enter');
        void el.offsetWidth;
        el.classList.add('is-enter');
        syncEngHighlight();
    }

    function syncDrillHint(msg, kind) {
        var hint = document.getElementById('pattern-drill-hint');
        if (!hint) return;
        hint.classList.remove('is-learn', 'is-done', 'is-error', 'is-ok');
        if (state.guideBeatActive) {
            hint.textContent = '자리 규칙을 확인한 뒤, 탭하면 연습이 시작됩니다';
            hint.classList.add('is-learn');
            return;
        }
        if (isLearnMode()) {
            hint.textContent = '문장 구조를 먼저 살펴보세요';
            hint.classList.add('is-learn');
            return;
        }
        if (msg) {
            hint.textContent = msg;
            if (kind === 'error') hint.classList.add('is-error');
            if (kind === 'ok') hint.classList.add('is-ok');
            return;
        }
        if (isDrillComplete()) {
            hint.textContent = '잘 표시했습니다';
            hint.classList.add('is-done');
        } else if (state.selectedChip) {
            hint.textContent =
                '「' + state.selectedChip + '」→ 붙일 칸(' + roleLabelsHint() + ')을 탭하세요';
        } else {
            hint.textContent = '조사를 고른 뒤, 맞는 칸에 붙여 보세요';
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
        renderParticlePool();
        clearAutoNext();
        state.autoNextTimer = setTimeout(function () {
            state.autoNextTimer = null;
            if (!state.data) return;
            if (state.variantIdx >= state.data.steps.length - 1) {
                finishPattern();
            } else {
                goToVariant(state.variantIdx + 1);
            }
        }, AUTO_NEXT_MS);
    }

    function shakeCol(role) {
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (!col) return;
        col.classList.remove('is-shake');
        void col.offsetWidth;
        col.classList.add('is-shake');
    }

    function applyParticleToRole(role, chip) {
        var step = currentStep();
        var col = document.querySelector('.pattern-col[data-role="' + role + '"]');
        if (!col || state.drillFilled[role] || isLearnMode() || state.guideBeatActive) return;

        if (!particleAllowedForRole(role, chip)) {
            shakeCol(role);
            syncDrillHint(roleErrorMessage(role, chip), 'error');
            return;
        }

        var korSlot = findKorByRole(step, role);
        var word = korSlot ? (korSlot.word || '') : '';
        if (!isValidParticleForRole(word, role, chip)) {
            shakeCol(role);
            syncDrillHint(batchimErrorMessage(role, word), 'error');
            return;
        }

        state.drillFilled[role] = true;
        state.usedChips[chip] = true;
        state.selectedChip = null;

        var slot = col.querySelector('.pattern-kor-slot');
        if (slot) {
            slot.textContent = chip;
            slot.classList.remove('pattern-kor-slot');
            slot.classList.add('pattern-kor-particle', 'is-snapped');
        }

        col.classList.add('is-filled');
        col.classList.remove('is-target');
        syncEngHighlight();

        if (isDrillComplete()) {
            onDrillAllComplete();
        } else {
            syncDrillHint('자리에 잘 붙었습니다.', 'ok');
            setTimeout(function () { syncDrillHint(); }, 900);
            updateNavUi();
            updateStepProgress();
            renderParticlePool();
        }
    }

    function onPoolChipClick(chip) {
        if (isLearnMode() || state.guideBeatActive || state.usedChips[chip]) return;
        state.selectedChip = state.selectedChip === chip ? null : chip;
        document.querySelectorAll('.pattern-col').forEach(function (col) {
            col.classList.toggle('is-target', !!state.selectedChip && !state.drillFilled[col.dataset.role]);
        });
        renderParticlePool();
        syncDrillHint();
        syncEngHighlight();
    }

    function onCardClick(role) {
        if (isLearnMode() || state.guideBeatActive || state.drillFilled[role]) return;
        if (!state.selectedChip) {
            syncDrillHint('아래에서 조사를 먼저 고르세요', 'error');
            shakeCol(role);
            return;
        }
        applyParticleToRole(role, state.selectedChip);
    }

    function renderParticlePool() {
        var pool = document.getElementById('pattern-pool');
        var wrap = document.getElementById('pattern-pool-wrap');
        if (!pool || !wrap) return;

        if (isLearnMode() || state.guideBeatActive) {
            wrap.classList.add('is-hidden');
            return;
        }
        wrap.classList.remove('is-hidden');

        pool.innerHTML = '';
        PARTICLE_POOL.forEach(function (chip) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pattern-chip';
            btn.textContent = chip;
            if (state.usedChips[chip]) {
                btn.disabled = true;
                btn.classList.add('is-used');
            } else if (state.selectedChip === chip) {
                btn.classList.add('is-selected');
            }
            btn.addEventListener('click', function () {
                onPoolChipClick(chip);
            });
            pool.appendChild(btn);
        });
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
        markerEl.textContent = markerFor(role);

        inner.appendChild(compEl);
        inner.appendChild(korEl);
        inner.appendChild(markerEl);
        col.appendChild(inner);

        col.addEventListener('pointerenter', function () {
            setHoverRole(role);
        });
        col.addEventListener('pointerleave', function () {
            if (state.hoverRole === role) setHoverRole(null);
        });

        if (!learnMode && !state.guideBeatActive && !state.drillFilled[role]) {
            col.classList.add('is-tappable');
            col.addEventListener('click', function () {
                onCardClick(role);
            });
        }

        if (state.drillFilled[role]) col.classList.add('is-filled');
    }

    function buildStepDom(step) {
        var wrap = document.getElementById('pattern-cols');
        if (!wrap) return;

        clearAutoNext();
        resetDrillState();
        wrap.innerHTML = '';

        var learnMode = isLearnMode();

        if (!state.guideBeatActive) {
            activeRoles().forEach(function (role) {
                var korSlot = findKorByRole(step, role);
                if (!korSlot) return;

                var col = document.createElement('div');
                col.className = 'pattern-col pattern-col--' + role;
                col.dataset.role = role;
                buildCardDom(col, step, role, learnMode);
                wrap.appendChild(col);
            });
        }

        wrap.classList.toggle('is-hidden', !!state.guideBeatActive);
        renderEngHero(step);
        renderGuideBeat();
        updatePhaseBadge();
        renderParticlePool();
        syncDrillHint();
        updateStepProgress();
        updateNavUi();
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

        var showNav = state.introDone && !state.guideBeatActive;
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

    function goToVariant(idx) {
        if (!state.data || idx < 0 || idx >= state.data.steps.length) return;
        clearAutoNext();
        state.variantIdx = idx;
        state.guideBeatActive = false;
        buildStepDom(state.data.steps[idx]);
    }

    function onIntroComplete() {
        state.introDone = true;
        hideDocentOverlay();
        hideIntroBar();
        if (shouldShowGuideBeat()) {
            startGuideBeat();
            return;
        }
        state.guideBeatDone = true;
        state.guideBeatActive = false;
        buildStepDom(currentStep());
        var stage = document.getElementById('pattern-stage');
        if (stage) {
            stage.classList.remove('is-enter');
            void stage.offsetWidth;
            stage.classList.add('is-enter');
        }
    }

    function chapterPatterns(ch) {
        var list = [];
        if (!ch) return list;
        if (ch.patterns) {
            ch.patterns.forEach(function (p) {
                list.push(p);
            });
        }
        if (ch.sections) {
            ch.sections.forEach(function (sec) {
                (sec.patterns || []).forEach(function (p) {
                    list.push(p);
                });
            });
        }
        return list;
    }

    function findChapterForPattern(patternId) {
        var chapters = (state.indexData && state.indexData.chapters) || [];
        for (var i = 0; i < chapters.length; i++) {
            var pats = chapterPatterns(chapters[i]);
            for (var j = 0; j < pats.length; j++) {
                if (pats[j].id === patternId) {
                    return { chapter: chapters[i], patternIndex: j, patterns: pats };
                }
            }
        }
        return null;
    }

    function isChapterFirstPattern() {
        return !!(state.chapterMeta && state.chapterMeta.patternIndex === 0);
    }

    function buildDocentLines() {
        var lines = [];
        var ch = state.chapterMeta && state.chapterMeta.chapter;
        // 대단원 첫 패턴일 때만 대단원 개괄을 앞에 붙임
        if (isChapterFirstPattern() && ch && Array.isArray(ch.docent) && ch.docent.length) {
            lines = lines.concat(ch.docent);
            if (ch.docent_bridge) {
                lines.push({
                    role: '이어서',
                    text: ch.docent_bridge,
                    _chapterBridge: true
                });
            }
        }
        if (state.data && Array.isArray(state.data.docent) && state.data.docent.length) {
            lines = lines.concat(state.data.docent);
        }
        state.docentLines = lines;
        return lines;
    }

    function hasDocent() {
        var lines = state.docentLines;
        if (!lines) lines = buildDocentLines();
        return !!(lines && lines.length);
    }

    function currentDocentLines() {
        if (!state.docentLines) buildDocentLines();
        return state.docentLines || [];
    }

    function clearDocentTimer() {
        if (state.docentTimer) {
            clearTimeout(state.docentTimer);
            state.docentTimer = null;
        }
    }

    function showDocentOverlay() {
        var page = document.querySelector('.pattern-page');
        var el = document.getElementById('pattern-docent');
        if (page) page.classList.add('is-docent');
        if (el) el.classList.remove('is-hidden');
    }

    function hideDocentOverlay() {
        var page = document.querySelector('.pattern-page');
        var el = document.getElementById('pattern-docent');
        clearDocentTimer();
        state.docentPhase = null;
        if (page) page.classList.remove('is-docent');
        if (el) {
            el.classList.add('is-hidden');
            el.classList.remove('is-show', 'is-bridge', 'has-example', 'has-kor');
        }
    }

    function buildDocentMarkedHtml(parts) {
        if (!parts || !parts.length) return '';
        return parts
            .map(function (p) {
                var t = escapeHtml(p.text || '').replace(/\n/g, '<br>');
                if (p.mark) {
                    return (
                        '<span class="pattern-docent-mark pattern-docent-mark--' +
                        escapeHtml(p.mark) +
                        '">' +
                        t +
                        '</span>'
                    );
                }
                return t;
            })
            .join('');
    }

    function renderDocentFrame(item, isBridge) {
        var el = document.getElementById('pattern-docent');
        var roleEl = document.getElementById('pattern-docent-role');
        var exampleEl = document.getElementById('pattern-docent-example');
        var korEl = document.getElementById('pattern-docent-example-kor');
        var textEl = document.getElementById('pattern-docent-text');
        var stepEl = document.getElementById('pattern-docent-step');
        var tapEl = document.getElementById('pattern-docent-tap');
        if (!el || !textEl) return;

        item = item || {};
        el.classList.remove('is-show');
        el.classList.toggle('is-bridge', !!isBridge);

        var hasExample = !isBridge && item.parts && item.parts.length;
        var hasKor = !isBridge && item.kor_parts && item.kor_parts.length;
        el.classList.toggle('has-example', !!hasExample);
        el.classList.toggle('has-kor', !!hasKor);

        if (roleEl) roleEl.textContent = isBridge ? '' : item.role || '';
        if (exampleEl) {
            exampleEl.innerHTML = hasExample ? buildDocentMarkedHtml(item.parts) : '';
        }
        if (korEl) {
            korEl.innerHTML = hasKor ? buildDocentMarkedHtml(item.kor_parts) : '';
        }

        if (isBridge) {
            textEl.textContent = item.text || '';
        } else if (item.text_parts && item.text_parts.length) {
            textEl.innerHTML = buildDocentMarkedHtml(item.text_parts);
        } else {
            textEl.textContent = item.text || '';
        }

        if (stepEl) {
            if (isBridge) {
                stepEl.textContent = '';
            } else {
                var total = currentDocentLines().length;
                stepEl.textContent = state.docentIdx + 1 + ' / ' + total;
            }
        }
        if (tapEl) {
            if (isBridge) {
                tapEl.textContent = '왼쪽 탭 · 이전  ·  준비가 되면 탭하세요';
            } else if (state.docentIdx > 0) {
                tapEl.textContent = '왼쪽 탭 · 이전  ·  탭하면 이어집니다';
            } else {
                tapEl.textContent = '천천히 읽고, 탭하면 이어집니다';
            }
        }

        void el.offsetWidth;
        el.classList.add('is-show');
    }

    function scheduleDocentAdvance(ms) {
        clearDocentTimer();
        state.docentTimer = setTimeout(function () {
            advanceDocent();
        }, ms);
    }

    function showDocentBridge() {
        state.docentPhase = 'bridge';
        var bridge =
            (state.data && state.data.docent_bridge) ||
            '이제 해석 연습으로 들어갑니다.';
        renderDocentFrame({ text: bridge }, true);
        scheduleDocentAdvance(DOCENT_BRIDGE_MS);
    }

    function showDocentLine() {
        var lines = currentDocentLines();
        if (state.docentIdx >= lines.length) {
            showDocentBridge();
            return;
        }
        state.docentPhase = 'lines';
        var item = lines[state.docentIdx];
        renderDocentFrame(item, false);
        var dwell =
            item._chapterBridge
                ? DOCENT_BRIDGE_MS
                : item.parts && item.parts.length
                  ? DOCENT_EXAMPLE_MS
                  : DOCENT_LINE_MS;
        scheduleDocentAdvance(dwell);
    }

    function advanceDocent() {
        if (state.docentPhase === 'bridge') {
            clearDocentTimer();
            onIntroComplete();
            return;
        }
        if (state.docentPhase === 'lines') {
            state.docentIdx += 1;
            showDocentLine();
        }
    }

    function retreatDocent() {
        if (state.docentPhase === 'bridge') {
            var lines = currentDocentLines();
            if (!lines.length) return;
            state.docentIdx = lines.length - 1;
            showDocentLine();
            return;
        }
        if (state.docentPhase === 'lines' && state.docentIdx > 0) {
            state.docentIdx -= 1;
            showDocentLine();
        }
    }

    function startDocent() {
        buildDocentLines();
        state.docentIdx = 0;
        state.docentPhase = 'lines';
        showDocentOverlay();
        showDocentLine();
    }

    function startSession() {
        clearAutoNext();
        state.variantIdx = 0;
        state.guideBeatActive = false;
        state.guideBeatDone = false;

        // 도슨트 있는 패턴: 목차 「연습」 진입 시 항상 설명부터 (완료 여부 무관)
        // 「한 번 더」만 skipDocent로 스킵
        if (hasDocent() && !state.skipDocent) {
            state.introDone = false;
            var nav = document.getElementById('pattern-nav');
            if (nav) nav.classList.add('is-hidden');
            var wrap = document.getElementById('pattern-progress-wrap');
            if (wrap) wrap.classList.add('is-hidden');
            startDocent();
            return;
        }

        if (hasDocent() || state.isRepeat) {
            state.introDone = true;
            state.guideBeatDone = true;
            hideDocentOverlay();
            buildStepDom(currentStep());
            hideIntroBar();
            return;
        }

        // 도슨트 없는 패턴 첫 진입: 기존 7초 학습 모드
        state.introDone = false;
        hideDocentOverlay();
        var nav2 = document.getElementById('pattern-nav');
        if (nav2) nav2.classList.add('is-hidden');
        buildStepDom(currentStep());
        runIntroBar(onIntroComplete);
    }

    function goNext() {
        if (state.guideBeatActive) return;
        if (!isLearnMode() && !isDrillComplete()) return;
        clearAutoNext();
        if (state.variantIdx >= state.data.steps.length - 1) {
            finishPattern();
            return;
        }
        goToVariant(state.variantIdx + 1);
    }

    function goPrev() {
        if (state.guideBeatActive) return;
        if (state.variantIdx <= 0) return;
        clearAutoNext();
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

        var docentEl = document.getElementById('pattern-docent');
        if (docentEl) {
            docentEl.addEventListener('click', function (e) {
                if (!state.docentPhase) return;
                var rect = docentEl.getBoundingClientRect();
                var x = (e.clientX != null ? e.clientX : 0) - rect.left;
                if (x < rect.width / 3) {
                    retreatDocent();
                } else {
                    advanceDocent();
                }
            });
        }

        var guideBeat = document.getElementById('pattern-guide-beat');
        if (guideBeat) {
            guideBeat.addEventListener('click', function () {
                endGuideBeat();
            });
        }

        var engHero = document.getElementById('pattern-eng-hero');
        if (engHero) {
            engHero.addEventListener('click', function () {
                if (state.guideBeatActive) endGuideBeat();
            });
        }

        document.getElementById('pattern-back').addEventListener('click', function () {
            location.href = 'index.html?tab=reading';
        });
        document.getElementById('pattern-complete-retry').addEventListener('click', function () {
            document.getElementById('pattern-complete').classList.remove('is-open');
            state.isRepeat = true;
            state.skipDocent = true;
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
        state.skipDocent = false;

        Promise.all([
            fetch(INDEX_URL).then(function (r) {
                return r.ok ? r.json() : null;
            }),
            fetch('data/patterns/' + id + '.json?v=20260722m').then(function (r) {
                if (!r.ok) throw new Error('missing');
                return r.json();
            })
        ])
            .then(function (results) {
                state.indexData = results[0];
                state.data = results[1];
                state.chapterMeta = findChapterForPattern(id);
                state.docentLines = null;
                buildDocentLines();

                document.title = 'TRIGGER · ' + (state.data.title || '독해');
                var label = document.getElementById('pattern-chapter-label');
                if (label) {
                    label.innerHTML =
                        '<strong>' +
                        escapeHtml(state.data.chapter) +
                        '</strong> · ' +
                        escapeHtml(state.data.title);
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
