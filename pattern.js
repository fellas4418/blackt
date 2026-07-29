(function () {
    'use strict';

    var INTRO_BAR_MS = 7000;
    var DOCENT_LINE_MS = 8000;
    var DOCENT_EXAMPLE_MS = 9000;
    var DOCENT_BRIDGE_MS = 4500;
    var DOCENT_FADE_OUT_MS = 550;
    var DOCENT_FADE_GAP_MS = 120;
    var DOCENT_SEG_MS = 3200;
    var AUTO_NEXT_MS = 850;
    var ROLLING_PEEK_MS = 2000;
    var ROLLING_AUTO_MS = 2800;
    var ROLLING_REVEAL_MS = 900;
    var PAREN_BLINK_MS = 1400;
    var COL_COMP = { s: '주어', o: '목적어', c: '보어', v: '서술어' };
    var PARTICLE_POOL = ['은', '는', '이', '가', '을', '를', '다'];
    var SUBJECT_PARTICLES = { '은': 1, '는': 1, '이': 1, '가': 1 };
    var TOPIC_PARTICLES = { '은': 1, '는': 1 };
    var OBJECT_PARTICLES = { '을': 1, '를': 1 };
    var COMPLEMENT_PARTICLES = { '이': 1, '가': 1 };
    var VERB_PARTICLES = { '다': 1 };

    var INDEX_URL = 'data/pattern_index.json?v=20260728m';
    var SOUND_KEY = 'pattern_docent_sound';

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
        autoNextTimer: null,
        docentSoundOn: false,
        docentVoice: null,
        lastDocentSpeak: '',
        speakGen: 0,
        docentTransitioning: false,
        docentShownOnce: false,
        docentFadeTimer: null,
        docentBlockIdx: 0,
        docentBlockCount: 1,
        docentBlockSpeaks: null,
        rollingActive: false,
        rollingPhaseIdx: 0,
        rollingItemIdx: 0,
        rollingKorVisible: false,
        rollingTimer: null,
        rollingWaitingTap: false,
        docentReplayDone: false,
        docentReplaying: false,
        bridgeFromRolling: false,
        docentBlockReplayFlags: null,
        currentDocentItem: null
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
        return (
            !state.guideBeatDone &&
            !state.skipDocent &&
            !hasRolling() &&
            resolveGuidePoints().length > 0
        );
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

    /** 「…」 핵심어·예시를 색으로 강조 (escape 이후 HTML 문자열용) */
    function highlightCornerQuotes(escaped) {
        return String(escaped || '').replace(/「[^」]*」/g, function (m) {
            return (
                '<span class="pattern-docent-mark pattern-docent-mark--quote" style="background:none !important;padding:0 !important;border-radius:0 !important">' +
                m +
                '</span>'
            );
        });
    }

    function formatDocentPlainHtml(text) {
        return highlightCornerQuotes(escapeHtml(text || ''))
            .replace(/\(([^)\n]+)\)/g, function (_m, inner) {
                // 괄호 표기 없이 강조만
                return '<span class="pattern-docent-paren">' + inner + '</span>';
            })
            .replace(/\n/g, '<br>');
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
        var label = state.guideBeatActive ? '자리 표시' : '자리 표시하기';
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
            if (ch.docent_bridge_meta) {
                lines.push(
                    Object.assign(
                        {
                            role: '해석',
                            _chapterBridge: true
                        },
                        ch.docent_bridge_meta
                    )
                );
            } else if (ch.docent_bridge) {
                lines.push({
                    role: '해석',
                    text: ch.docent_bridge,
                    reveal: 'lines',
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

    function resolveReadings() {
        if (!state.data) return [];
        if (Array.isArray(state.data.readings) && state.data.readings.length) {
            return state.data.readings;
        }
        return readingsFromSteps(state.data.steps || []);
    }

    function readingsFromSteps(steps) {
        return (steps || []).map(function (step) {
            return {
                eng: step.eng || '',
                parts: partsFromEngTokens(step.eng_tokens),
                kor_parts: korPartsFromSlots(step.kor_slots)
            };
        });
    }

    function partsFromEngTokens(tokens) {
        var parts = [];
        (tokens || []).forEach(function (tok, i) {
            if (i > 0) parts.push({ text: ' ' });
            var piece = { text: tok.text || '' };
            if (tok.role) piece.mark = tok.role;
            parts.push(piece);
        });
        if (parts.length) parts.push({ text: '.' });
        return parts;
    }

    function korPartsFromSlots(slots) {
        var byRole = {};
        (slots || []).forEach(function (s) {
            byRole[s.role] = s;
        });
        var parts = [];
        var roles = state.data && state.data.roles;
        var prefer =
            roles && roles.indexOf('c') >= 0 && roles.indexOf('o') < 0
                ? ['주어', '보어', '서술어']
                : roles && roles.indexOf('c') >= 0 && roles.indexOf('o') >= 0
                  ? ['주어', '목적어', '보어', '서술어']
                  : ['주어', '목적어', '서술어'];
        prefer.forEach(function (roleName) {
            var s = byRole[roleName];
            if (!s) return;
            if (parts.length) parts.push({ text: ' ' });
            var w = s.word || '';
            var mark =
                roleName === '주어'
                    ? 's'
                    : roleName === '목적어'
                      ? 'o'
                      : roleName === '보어'
                        ? 'c'
                        : 'v';
            if (roleName === '서술어' && !s.particle && w.slice(-1) === '다') {
                parts.push({ text: w.slice(0, -1) });
                parts.push({ text: '다', mark: 'v' });
            } else {
                parts.push({ text: w });
                if (s.particle) parts.push({ text: s.particle, mark: mark });
            }
        });
        if (parts.length) parts.push({ text: '.' });
        return parts;
    }

    function readingToDocentItem(r, n) {
        var parts = r.parts && r.parts.length ? r.parts : null;
        var korParts = r.kor_parts && r.kor_parts.length ? r.kor_parts : null;
        var engPlain = (r.eng || plainFromParts(parts || [])).replace(/\.$/, '');
        var korPlain = (r.kor || plainFromParts(korParts || [])).replace(/\.$/, '');
        var item = {
            role: String(n),
            _reading: true
        };
        if (parts && korParts) {
            item.parts = parts;
            item.kor_parts = korParts;
        } else {
            item.text_parts = [
                { text: n + '. ' + engPlain + ' : ' + korPlain }
            ];
        }
        return item;
    }

    function hideReadingsGallery() {
        var gallery = document.getElementById('pattern-readings');
        var inner = document.querySelector('.pattern-docent-inner');
        if (gallery) gallery.classList.add('is-hidden');
        if (inner) inner.classList.remove('is-hidden');
        var el = document.getElementById('pattern-docent');
        if (el) el.classList.remove('is-readings');
    }

    function showReadingsGallery() {
        var readings = resolveReadings();
        if (!readings.length) {
            showDocentBridge();
            return;
        }
        state.docentPhase = 'readings';
        clearDocentTimer();
        stopDocentSpeech();

        var el = document.getElementById('pattern-docent');
        var gallery = document.getElementById('pattern-readings');
        var list = document.getElementById('pattern-readings-list');
        var inner = document.querySelector('.pattern-docent-inner');
        var hintEl = document.getElementById('pattern-docent-hint');
        var tapEl = document.getElementById('pattern-docent-tap');
        var stepEl = document.getElementById('pattern-docent-step');
        if (!gallery || !list) {
            showDocentBridge();
            return;
        }

        if (inner) inner.classList.add('is-hidden');
        if (el) {
            el.classList.add('is-readings', 'is-show');
            el.classList.remove('is-bridge', 'has-example', 'has-kor', 'has-closing');
        }
        gallery.classList.remove('is-hidden');

        list.innerHTML = readings
            .map(function (r, i) {
                var engHtml =
                    r.parts && r.parts.length
                        ? buildDocentMarkedHtml(r.parts, true)
                        : escapeHtml((r.eng || '').replace(/\.$/, '') + '.');
                var korHtml =
                    r.kor_parts && r.kor_parts.length
                        ? buildDocentMarkedHtml(r.kor_parts, true)
                        : escapeHtml(r.kor || '');
                return (
                    '<button type="button" class="pattern-readings-card" data-idx="' +
                    i +
                    '">' +
                    '<span class="pattern-readings-num">' +
                    (i + 1) +
                    '</span>' +
                    '<span class="pattern-readings-eng">' +
                    engHtml +
                    '</span>' +
                    '<span class="pattern-readings-kor">' +
                    korHtml +
                    '</span>' +
                    '<span class="pattern-readings-tap">탭 → 해석</span>' +
                    '</button>'
                );
            })
            .join('');

        if (tapEl) tapEl.textContent = '문장 탭 · 완료는 →';
        if (hintEl) hintEl.classList.remove('is-hidden');
        if (stepEl) {
            stepEl.textContent = '해석 ' + readings.length + '문장';
        }
        state.lastDocentSpeak = '영어를 탭하면 해석이 나옵니다.';
        scheduleDocentAdvance(DOCENT_LINE_MS, state.lastDocentSpeak);
    }

    function shouldSkipParticleDrill() {
        // 도슨트 패턴은 조사 붙이기 대신 해석 예문 갤러리로 마무리
        return hasDocent();
    }

    function hasRolling() {
        return !!(
            state.data &&
            Array.isArray(state.data.rolling) &&
            state.data.rolling.length
        );
    }

    function clearRollingTimer() {
        if (state.rollingTimer) {
            clearTimeout(state.rollingTimer);
            state.rollingTimer = null;
        }
    }

    function currentRollingPhase() {
        if (!hasRolling()) return null;
        return state.data.rolling[state.rollingPhaseIdx] || null;
    }

    function currentRollingItem() {
        var phase = currentRollingPhase();
        if (!phase || !Array.isArray(phase.items)) return null;
        return phase.items[state.rollingItemIdx] || null;
    }

    function rollingItemParts(item) {
        if (!item) return { eng: [], kor: [] };
        return {
            eng: item.parts && item.parts.length
                ? item.parts
                : partsFromEngTokens(item.eng_tokens || []),
            kor: item.kor_parts && item.kor_parts.length
                ? item.kor_parts
                : korPartsFromSlots(item.kor_slots || [])
        };
    }

    function buildRollingMarkedHtml(parts, focus, forceInlineColor) {
        if (!parts || !parts.length) return '';
        return parts
            .map(function (p) {
                if (!p.mark && /^[\n\r]*$/.test(String(p.text || ''))) {
                    return '';
                }
                var rawTextSrc = String(p.text || '');
                if (!p.mark && /^ +$/.test(rawTextSrc)) {
                    return rawTextSrc.replace(/ /g, '\u00A0');
                }
                var raw = escapeHtml(rawTextSrc);
                var t = (p.mark ? raw : highlightCornerQuotes(raw)).replace(/\n/g, '<br>');
                if (p.mark) {
                    var color = MARK_COLORS[p.mark] || '';
                    var isFocus = focus && p.mark === focus;
                    var isDim = focus && p.mark !== focus;
                    var styles = [
                        'background:none !important',
                        'padding:0 !important',
                        'border-radius:0 !important'
                    ];
                    if (forceInlineColor && color) {
                        styles.push('color:' + color + ' !important');
                        styles.push('-webkit-text-fill-color:' + color + ' !important');
                    }
                    return (
                        '<span class="pattern-docent-mark pattern-docent-mark--' +
                        escapeHtml(p.mark) +
                        (isFocus ? ' is-focus' : '') +
                        (isDim ? ' is-dim' : '') +
                        '" style="' +
                        styles.join(';') +
                        '">' +
                        t +
                        '</span>'
                    );
                }
                return t;
            })
            .join('');
    }

    function rollingKorPreferRoles() {
        var roles = state.data && state.data.roles;
        if (roles && roles.indexOf('c') >= 0 && roles.indexOf('o') < 0) {
            return ['주어', '보어', '서술어'];
        }
        if (roles && roles.indexOf('c') >= 0 && roles.indexOf('o') >= 0) {
            return ['주어', '목적어', '보어', '서술어'];
        }
        return ['주어', '목적어', '서술어'];
    }

    function korRoleToMark(roleName) {
        if (roleName === '주어') return 's';
        if (roleName === '목적어') return 'o';
        if (roleName === '보어') return 'c';
        return 'v';
    }

    function rollingEngSlots(item) {
        var tokens = item && item.eng_tokens;
        if (tokens && tokens.length) {
            return tokens.map(function (tok) {
                return {
                    text: tok.text || '',
                    mark: tok.role || ''
                };
            });
        }
        var parts = (item && item.parts) || [];
        return parts
            .filter(function (p) {
                return p.mark;
            })
            .map(function (p) {
                return { text: p.text || '', mark: p.mark };
            });
    }

    function rollingKorSlots(item) {
        var slots = item && item.kor_slots;
        if (slots && slots.length) {
            var byRole = {};
            slots.forEach(function (s) {
                byRole[s.role] = s;
            });
            return rollingKorPreferRoles()
                .map(function (roleName) {
                    var s = byRole[roleName];
                    if (!s) return null;
                    var mark = korRoleToMark(roleName);
                    var w = s.word || '';
                    var text;
                    if (roleName === '서술어' && !s.particle && w.slice(-1) === '다') {
                        text = w.slice(0, -1) + '다';
                    } else {
                        text = w + (s.particle || '');
                    }
                    return { text: text, mark: mark };
                })
                .filter(Boolean);
        }
        var parts = (item && item.kor_parts) || [];
        var grouped = [];
        var cur = null;
        parts.forEach(function (p) {
            if (!p.mark && !String(p.text || '').trim()) return;
            if (p.mark) {
                if (cur && cur.mark === p.mark) {
                    cur.text += p.text || '';
                } else {
                    cur = { text: p.text || '', mark: p.mark };
                    grouped.push(cur);
                }
            } else if (cur) {
                cur.text += p.text || '';
            }
        });
        return grouped;
    }

    function markToRoleKo(mark) {
        if (mark === 's') return '주어';
        if (mark === 'o') return '목적어';
        if (mark === 'c') return '보어';
        if (mark === 'v') return '서술어';
        return '';
    }

    function buildRollingSlotsHtml(slots, focus, withRoleLabel) {
        var n = (slots || []).length || 1;
        var cols = 'repeat(' + n + ', minmax(0, 1fr))';
        return (
            '<span class="pattern-rolling-line" style="grid-template-columns:' +
            cols +
            '">' +
            (slots || [])
                .map(function (slot) {
                    var mark = slot.mark || '';
                    var isFocus = focus && mark === focus;
                    var roleKo = markToRoleKo(mark);
                    var label = withRoleLabel && roleKo
                        ? '<span class="pattern-rolling-role">(' +
                          escapeHtml(roleKo) +
                          ')</span>'
                        : '';
                    return (
                        '<span class="pattern-rolling-slot-wrap">' +
                        '<span class="pattern-rolling-slot pattern-docent-mark' +
                        (mark ? ' pattern-docent-mark--' + escapeHtml(mark) : '') +
                        (isFocus ? ' is-focus' : ' is-dim') +
                        '">' +
                        escapeHtml(slot.text || '') +
                        '</span>' +
                        label +
                        '</span>'
                    );
                })
                .join('') +
            '</span>'
        );
    }

    function showRollingUi() {
        var el = document.getElementById('pattern-rolling');
        var nav = document.getElementById('pattern-rolling-nav');
        var docentHint = document.getElementById('pattern-docent-hint');
        if (el) el.classList.remove('is-hidden');
        if (nav) {
            nav.classList.remove('is-hidden');
            nav.setAttribute('aria-hidden', 'false');
        }
        if (docentHint) docentHint.classList.add('is-hidden');
    }

    function hideRollingUi() {
        var el = document.getElementById('pattern-rolling');
        var nav = document.getElementById('pattern-rolling-nav');
        if (el) el.classList.add('is-hidden');
        if (nav) {
            nav.classList.add('is-hidden');
            nav.setAttribute('aria-hidden', 'true');
        }
    }

    function updateRollingProgress() {
        if (!hasRolling()) return;
        var total = 0;
        var done = 0;
        state.data.rolling.forEach(function (phase, pi) {
            var n = (phase.items || []).length;
            total += n;
            if (pi < state.rollingPhaseIdx) done += n;
            else if (pi === state.rollingPhaseIdx) done += state.rollingItemIdx;
        });
        var wrap = document.getElementById('pattern-progress-wrap');
        var fill = document.getElementById('pattern-progress-fill');
        if (wrap) wrap.classList.remove('is-hidden', 'is-intro');
        if (fill) {
            fill.style.width =
                (total > 0 ? Math.min(100, (done / total) * 100) : 0) + '%';
        }
        var badge = document.getElementById('pattern-phase-badge');
        if (badge) {
            badge.textContent = '';
            badge.classList.add('is-hidden');
        }
    }

    function renderRollingFrame() {
        var phase = currentRollingPhase();
        var item = currentRollingItem();
        if (!phase || !item) return;

        var focus = phase.focus || '';
        var focusEl = document.getElementById('pattern-rolling-focus');
        var phaseEl = document.getElementById('pattern-rolling-phase');
        var particleEl = document.getElementById('pattern-rolling-particle');
        var engEl = document.getElementById('pattern-rolling-eng');
        var korEl = document.getElementById('pattern-rolling-kor');
        var capEl = document.getElementById('pattern-rolling-caption');
        var tapEl = document.getElementById('pattern-rolling-tap');

        if (focusEl) {
            var title = phase.title || COL_COMP[focus] || '';
            var hint = phase.particle_hint || '';
            focusEl.textContent = hint ? title + ' + ' + hint : title;
            focusEl.className =
                'pattern-rolling-focus' +
                (focus ? ' pattern-rolling-focus--' + focus : '');
        }
        if (phaseEl) {
            phaseEl.textContent = '';
            phaseEl.classList.add('is-hidden');
        }
        if (particleEl) {
            particleEl.textContent = '';
            particleEl.classList.add('is-hidden');
        }
        if (engEl) {
            var engSlots = rollingEngSlots(item);
            engEl.innerHTML = engSlots.length
                ? buildRollingSlotsHtml(engSlots, focus, true)
                : buildRollingMarkedHtml(rollingItemParts(item).eng, focus, true);
        }
        if (korEl) {
            var korSlots = rollingKorSlots(item);
            korEl.innerHTML = korSlots.length
                ? buildRollingSlotsHtml(korSlots, focus, false)
                : buildRollingMarkedHtml(rollingItemParts(item).kor, focus, true);
            korEl.classList.toggle('is-hidden', !state.rollingKorVisible);
        }
        if (capEl) {
            capEl.textContent = '';
            capEl.classList.add('is-hidden');
        }
        if (tapEl) {
            tapEl.textContent = '이전 · 다음';
        }
        updateRollingProgress();
    }

    function scheduleRolling(fn, ms) {
        clearRollingTimer();
        state.rollingTimer = setTimeout(fn, ms);
    }

    function beginRollingItem() {
        // 영문·해석 함께 보이며 하이라이트만 롤링
        state.rollingKorVisible = true;
        state.rollingWaitingTap = true;
        renderRollingFrame();
        scheduleRolling(goNextRollingItem, ROLLING_AUTO_MS);
    }

    function phasePeekMs() {
        var phase = currentRollingPhase();
        return (phase && phase.peek_ms) || ROLLING_PEEK_MS;
    }

    function advanceRollingAuto() {
        if (!state.rollingActive || state.rollingKorVisible) return;
        state.rollingKorVisible = true;
        state.rollingWaitingTap = false;
        renderRollingFrame();
        scheduleRolling(goNextRollingItem, ROLLING_REVEAL_MS);
    }

    function goNextRollingItem() {
        if (!state.rollingActive) return;
        clearRollingTimer();
        var phase = currentRollingPhase();
        if (!phase) {
            finishRolling();
            return;
        }
        if (state.rollingItemIdx < (phase.items || []).length - 1) {
            state.rollingItemIdx += 1;
            beginRollingItem();
            return;
        }
        if (state.rollingPhaseIdx < state.data.rolling.length - 1) {
            state.rollingPhaseIdx += 1;
            state.rollingItemIdx = 0;
            beginRollingItem();
            return;
        }
        finishRolling();
    }

    function goPrevRollingItem() {
        if (!state.rollingActive) return;
        clearRollingTimer();
        if (state.rollingItemIdx > 0) {
            state.rollingItemIdx -= 1;
            beginRollingItem();
            return;
        }
        if (state.rollingPhaseIdx > 0) {
            state.rollingPhaseIdx -= 1;
            var prev = state.data.rolling[state.rollingPhaseIdx];
            state.rollingItemIdx = Math.max(0, (prev.items || []).length - 1);
            beginRollingItem();
            return;
        }
        // 롤링 첫 칸 → 도슨트 마지막 컷으로
        clearRollingTimer();
        state.rollingActive = false;
        hideRollingUi();
        var page = document.querySelector('.pattern-page');
        if (page) page.classList.remove('is-rolling');
        showDocentOverlay();
        var lines = currentDocentLines();
        if (lines.length) {
            state.docentIdx = lines.length - 1;
            showDocentLine();
        }
    }

    function onRollingTap(e) {
        if (!state.rollingActive) return;
        clearRollingTimer();
        var el = document.getElementById('pattern-rolling');
        if (el && e && e.clientX != null) {
            var rect = el.getBoundingClientRect();
            var x = e.clientX - rect.left;
            if (x < rect.width / 3) {
                goPrevRollingItem();
                return;
            }
        }
        goNextRollingItem();
    }

    function startRolling() {
        hideReadingsGallery();
        hideDocentOverlay();
        state.rollingActive = true;
        state.bridgeFromRolling = false;
        state.rollingPhaseIdx = 0;
        state.rollingItemIdx = 0;
        state.introDone = true;
        state.rollingKorVisible = true;
        state.rollingWaitingTap = true;
        var page = document.querySelector('.pattern-page');
        if (page) page.classList.add('is-rolling');
        showRollingUi();
        beginRollingItem();
    }

    function resumeRollingAtEnd() {
        if (!hasRolling()) return;
        hideReadingsGallery();
        hideDocentOverlay();
        state.bridgeFromRolling = false;
        state.rollingActive = true;
        state.rollingPhaseIdx = Math.max(0, state.data.rolling.length - 1);
        var phase = state.data.rolling[state.rollingPhaseIdx];
        state.rollingItemIdx = Math.max(0, (phase.items || []).length - 1);
        state.introDone = true;
        state.rollingKorVisible = true;
        state.rollingWaitingTap = true;
        var page = document.querySelector('.pattern-page');
        if (page) page.classList.add('is-rolling');
        showRollingUi();
        beginRollingItem();
    }

    function finishRolling() {
        clearRollingTimer();
        state.rollingActive = false;
        state.bridgeFromRolling = false;
        hideRollingUi();
        var page = document.querySelector('.pattern-page');
        if (page) page.classList.remove('is-rolling');
        // 「~을 익혔습니다」 브릿지 없이 완료
        hideDocentOverlay();
        finishPattern();
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

    function plainFromParts(parts) {
        if (!parts || !parts.length) return '';
        return parts
            .map(function (p) {
                return p.text || '';
            })
            .join('')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // 짧은 예문(단어 5개 이하)은 한 줄 유지 — SVO/짧은 SVC까지 커버
    var EXAMPLE_ONELINE_MAX_WORDS = 5;

    function countExampleWords(parts) {
        var plain = plainFromParts(parts);
        if (!plain) return 0;
        return plain
            .replace(/[^\w\s가-힣'-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
    }

    function shouldExampleOneline(parts) {
        var plain = plainFromParts(parts);
        if (plain.length > 42) return false;
        var n = countExampleWords(parts);
        return n > 0 && n <= EXAMPLE_ONELINE_MAX_WORDS;
    }

    function stopDocentSpeech() {
        state.speakGen += 1;
        try {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) {}
    }

    function pickKoreanVoice() {
        if (!window.speechSynthesis) return null;
        var voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) return null;
        var prefer = [
            /google.*한국어/i,
            /microsoft.*sunhi/i,
            /microsoft.*injoon/i,
            /yuna/i,
            /heami/i,
            /ko-KR/i,
            /korean/i
        ];
        var i;
        var j;
        for (i = 0; i < prefer.length; i++) {
            for (j = 0; j < voices.length; j++) {
                if (
                    prefer[i].test(voices[j].name) ||
                    prefer[i].test(voices[j].lang)
                ) {
                    return voices[j];
                }
            }
        }
        for (j = 0; j < voices.length; j++) {
            if ((voices[j].lang || '').toLowerCase().indexOf('ko') === 0) {
                return voices[j];
            }
        }
        return null;
    }

    function ensureDocentVoice() {
        if (state.docentVoice) return state.docentVoice;
        state.docentVoice = pickKoreanVoice();
        return state.docentVoice;
    }

    function plainSpeak(text) {
        return String(text || '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** 빈 줄(\n\n) 기준. revealLines면 각 블록을 따로 공개 */
    function splitPlainDocentBlocks(text, revealLines) {
        var parts = String(text || '')
            .split(/\n\n+/)
            .map(function (s) {
                return s.trim();
            })
            .filter(Boolean);
        if (parts.length <= 1) return parts;
        if (revealLines) return parts;
        return [parts.slice(0, -1).join('\n\n'), parts[parts.length - 1]];
    }

    function splitTextPartsDocentBlocks(parts, revealLines) {
        var raw = [[]];
        (parts || []).forEach(function (p) {
            var chunks = String(p.text || '').split(/\n\n+/);
            chunks.forEach(function (chunk, i) {
                if (i > 0) raw.push([]);
                if (!chunk) return;
                var piece = { text: chunk };
                if (p.mark) piece.mark = p.mark;
                raw[raw.length - 1].push(piece);
            });
        });
        raw = raw.filter(function (block) {
            return (
                block.length &&
                block.some(function (x) {
                    return String(x.text || '').trim();
                })
            );
        });
        if (raw.length <= 1) return raw;
        if (revealLines) return raw;
        var upper = [];
        var i;
        for (i = 0; i < raw.length - 1; i++) {
            if (i > 0) upper.push({ text: '\n\n' });
            upper = upper.concat(raw[i]);
        }
        return [upper, raw[raw.length - 1]];
    }

    function setDocentBlocksVisible(upToIdx) {
        var textEl = document.getElementById('pattern-docent-text');
        if (!textEl) return;
        var segs = textEl.querySelectorAll('.pattern-docent-seg');
        var i;
        for (i = 0; i < segs.length; i++) {
            segs[i].classList.toggle('is-on', i <= upToIdx);
        }
        state.docentBlockIdx = upToIdx < 0 ? 0 : upToIdx;
        fitFormsKeylistWidth();
        scrollDocentLatestIntoView();
    }

    /** 새로 나온 아래 블록이 화면에 다 보이게 (위는 잘려도 OK) */
    function scrollDocentLatestIntoView() {
        var inner = document.querySelector('.pattern-docent-inner');
        var textEl = document.getElementById('pattern-docent-text');
        if (!inner || !textEl) return;
        var on = textEl.querySelectorAll('.pattern-docent-seg.is-on');
        if (!on.length) return;
        var seg = on[on.length - 1];
        requestAnimationFrame(function () {
            var pad = 14;
            var innerRect = inner.getBoundingClientRect();
            var segRect = seg.getBoundingClientRect();
            if (segRect.bottom > innerRect.bottom - pad) {
                inner.scrollTop += segRect.bottom - (innerRect.bottom - pad);
                return;
            }
            if (segRect.top < innerRect.top + pad) {
                inner.scrollTop += segRect.top - (innerRect.top + pad);
            }
        });
    }

    function revealNextDocentBlock(onDone) {
        if (state.docentBlockIdx >= state.docentBlockCount - 1) {
            if (onDone) onDone();
            return;
        }
        state.docentBlockIdx += 1;
        setDocentBlocksVisible(state.docentBlockIdx);
        var speaks = state.docentBlockSpeaks || [];
        var speak = speaks[state.docentBlockIdx] || '';
        state.lastDocentSpeak = speak;
        if (onDone) onDone(speak);
    }

    function scheduleDocentBlocksThenAdvance(finalDwell) {
        clearDocentTimer();

        function speakThen(speak, thenFn) {
            if (state.docentSoundOn && speak) {
                speakDocentText(speak, function () {
                    if (!state.docentPhase) return;
                    if (thenFn) {
                        state.docentTimer = setTimeout(thenFn, 700);
                    }
                });
                return;
            }
            stopDocentSpeech();
            if (thenFn) {
                state.docentTimer = setTimeout(thenFn, DOCENT_SEG_MS);
            }
        }

        // 같은 페이지 위→아래 블록만 자동 공개, 다음 페이지는 탭
        function revealRest() {
            if (!state.docentPhase) return;
            if (state.docentBlockIdx >= state.docentBlockCount - 1) {
                afterBlocks();
                return;
            }
            revealNextDocentBlock(function (speak) {
                var more = state.docentBlockIdx < state.docentBlockCount - 1;
                speakThen(speak || '', more ? revealRest : afterBlocks);
            });
        }

        var speak =
            (state.docentBlockSpeaks && state.docentBlockSpeaks[0]) ||
            state.lastDocentSpeak;
        state.lastDocentSpeak = speak || '';

        function afterBlocks() {
            runDocentReplayIfNeeded(function () {
                var cur = state.currentDocentItem;
                if (cur && cur.blink_paren && !cur.replay_lines) {
                    blinkParensInDocent(null, null);
                }
            });
        }

        var item = state.currentDocentItem;
        var flags = state.docentBlockReplayFlags || [];
        var firstReplay = -1;
        var fi;
        for (fi = 0; fi < flags.length; fi++) {
            if (flags[fi]) {
                firstReplay = fi;
                break;
            }
        }

        // 복습(+깜빡): keep만 보여준 뒤, 번호 한 줄씩 나오며 그 줄만 즉시 1회 깜빡
        if (item && item.replay_lines && item.blink_paren && firstReplay > 0) {
            setDocentBlocksVisible(firstReplay - 1);
            state.docentReplayDone = true;

            function revealBlinkChain(idx) {
                if (!state.docentPhase) return;
                if (idx >= state.docentBlockCount) {
                    state.docentReplaying = false;
                    return;
                }
                state.docentReplaying = true;
                setDocentBlocksVisible(idx);
                var segs = document.querySelectorAll('#pattern-docent-text .pattern-docent-seg');
                var seg = segs[idx];
                function goNext() {
                    state.docentTimer = setTimeout(function () {
                        revealBlinkChain(idx + 1);
                    }, 350);
                }
                if (seg && flags[idx]) {
                    blinkParensInDocent(seg, goNext);
                } else {
                    goNext();
                }
            }

            // 「다시 한번」 직후 짧게 두고 1번+깜빡 바로 시작
            stopDocentSpeech();
            if (state.docentSoundOn && speak) {
                speakDocentText(speak, function () {
                    if (!state.docentPhase) return;
                    state.docentTimer = setTimeout(function () {
                        revealBlinkChain(firstReplay);
                    }, 400);
                });
            } else {
                state.docentTimer = setTimeout(function () {
                    revealBlinkChain(firstReplay);
                }, 900);
            }
            return;
        }

        if (state.docentBlockCount <= 1) {
            speakThen(speak, afterBlocks);
            return;
        }
        speakThen(speak, revealRest);
    }

    function buildDocentSpeakText(item, isBridge) {
        item = item || {};
        var chunks = [];
        if (!isBridge && item.role) chunks.push(String(item.role));
        if (item.kor_parts && item.kor_parts.length) {
            chunks.push(plainFromParts(item.kor_parts));
        } else if (item.parts && item.parts.length && !item.kor_parts) {
            chunks.push(plainFromParts(item.parts));
        }
        if (item.text_parts && item.text_parts.length) {
            chunks.push(plainFromParts(item.text_parts));
        } else if (item.text) {
            chunks.push(
                String(item.text)
                    .replace(/\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
            );
        }
        return chunks.filter(Boolean).join('. ');
    }

    function speakDocentText(text, onEnd) {
        stopDocentSpeech();
        var gen = state.speakGen;
        state.lastDocentSpeak = text || '';
        if (!state.docentSoundOn || !text || !window.speechSynthesis) {
            if (onEnd) onEnd();
            return;
        }
        try {
            var u = new SpeechSynthesisUtterance(text);
            u.lang = 'ko-KR';
            u.rate = 0.95;
            u.pitch = 1;
            var voice = ensureDocentVoice();
            if (voice) u.voice = voice;
            var done = false;
            var finish = function () {
                if (done || gen !== state.speakGen) return;
                done = true;
                if (onEnd) onEnd();
            };
            u.onend = finish;
            u.onerror = finish;
            window.speechSynthesis.speak(u);
            setTimeout(finish, Math.min(45000, 1800 + text.length * 120));
        } catch (e) {
            if (gen === state.speakGen && onEnd) onEnd();
        }
    }

    function syncSoundBtn() {
        var btn = document.getElementById('pattern-sound-btn');
        if (!btn) return;
        btn.classList.toggle('is-on', !!state.docentSoundOn);
        btn.classList.toggle('is-off', !state.docentSoundOn);
        btn.setAttribute('aria-pressed', state.docentSoundOn ? 'true' : 'false');
        btn.textContent = state.docentSoundOn ? '소리 켬' : '소리 끔';
    }

    function setDocentSound(on) {
        state.docentSoundOn = !!on;
        localStorage.setItem(SOUND_KEY, state.docentSoundOn ? '1' : '0');
        syncSoundBtn();
        if (!state.docentSoundOn) {
            stopDocentSpeech();
            return;
        }
        try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
        } catch (e) {}
        ensureDocentVoice();
        if (state.docentPhase && state.lastDocentSpeak) {
            clearDocentTimer();
            scheduleDocentAdvance(DOCENT_LINE_MS, state.lastDocentSpeak);
        }
    }

    function scheduleDocentAdvance(ms, speakText) {
        clearDocentTimer();
        // 페이지 넘김은 탭만 — 여기서는 낭독만
        if (state.docentSoundOn && speakText) {
            speakDocentText(speakText);
            return;
        }
        stopDocentSpeech();
    }

    function clearDocentFadeTimer() {
        if (state.docentFadeTimer) {
            clearTimeout(state.docentFadeTimer);
            state.docentFadeTimer = null;
        }
    }

    function hideDocentOverlay() {
        var page = document.querySelector('.pattern-page');
        var el = document.getElementById('pattern-docent');
        clearDocentTimer();
        clearDocentFadeTimer();
        clearRollingTimer();
        stopDocentSpeech();
        state.docentPhase = null;
        state.docentTransitioning = false;
        state.docentShownOnce = false;
        state.docentBlockIdx = 0;
        state.docentBlockCount = 1;
        state.docentBlockSpeaks = null;
        state.rollingActive = false;
        hideRollingUi();
        if (page) {
            page.classList.remove('is-docent');
            page.classList.remove('is-rolling');
        }
        if (el) {
            el.classList.add('is-hidden');
            el.classList.remove('is-show', 'is-bridge', 'has-example', 'has-kor', 'has-closing', 'is-readings');
        }
        hideReadingsGallery();
    }

    var MARK_COLORS = {
        s: '#7aefff',
        v: '#ffe08a',
        o: '#ffb35c',
        c: '#d0b0ff',
        pos: '#7eef9a',
        term: '#7eef9a'
    };

    function buildDocentMarkedHtml(parts, forceInlineColor, opts) {
        opts = opts || {};
        if (!parts || !parts.length) return '';
        return parts
            .map(function (p) {
                if (!p.mark && /^[\n\r]*$/.test(String(p.text || ''))) {
                    return '';
                }
                var rawTextSrc = String(p.text || '');
                if (!p.mark && /^ +$/.test(rawTextSrc)) {
                    return rawTextSrc.replace(/ /g, '\u00A0');
                }
                var rawText = rawTextSrc.trim();
                var isKeyList =
                    !!p.mark &&
                    (p.mark === 'forms' || /^\d+\.\s/.test(rawText));
                var raw = escapeHtml(isKeyList ? rawText : rawTextSrc);
                var t = (p.mark ? raw : highlightCornerQuotes(raw)).replace(
                    /\n/g,
                    '<br>'
                );
                if (p.mark) {
                    var color = MARK_COLORS[p.mark] || '';
                    var isBracket = /^「[\s\S]*」$/.test(rawText);
                    var styles = [
                        'background:none !important',
                        'padding:0 !important',
                        'border-radius:0 !important'
                    ];
                    if (forceInlineColor && color && p.mark !== 'paren' && p.mark !== 'forms') {
                        styles.push('color:' + color + ' !important');
                        styles.push('-webkit-text-fill-color:' + color + ' !important');
                    }
                    if (opts.stripBrackets) {
                        t = t.replace(/「([^」]*)」/g, '$1');
                    }
                    // 독해 성분 목록: 해석(「-…」)만 색, 번호·성분명 무색
                    if (p.mark === 'paren' && !opts.interpOnly) {
                        t = t.replace(/「-[^」]+」/g, function (m) {
                            return (
                                '<span class="pattern-docent-mark pattern-docent-mark--quote pattern-docent-paren" style="background:none !important;padding:0 !important;border-radius:0 !important">' +
                                m +
                                '</span>'
                            );
                        });
                    }
                    // 이어서: 해석어(누가/-하다/무엇을)만 색, 꺽쇠 없음
                    if (p.mark === 'paren' && opts.interpOnly) {
                        t = t.replace(/(-하다|-다|누가|무엇을)/g, function (m) {
                            return (
                                '<span class="pattern-docent-mark pattern-docent-mark--quote pattern-docent-paren" style="background:none !important;padding:0 !important;border-radius:0 !important">' +
                                m +
                                '</span>'
                            );
                        });
                    }
                    // 문장 구조 3개(forms): 성분만 색, 번호 무색
                    if (p.mark === 'forms') {
                        t = t
                            .replace(/목적격\s*보어/g, function (m) {
                                return (
                                    '<span class="pattern-docent-mark pattern-docent-mark--c pattern-docent-paren" style="background:none !important;padding:0 !important;border-radius:0 !important;color:#d0b0ff">' +
                                    m +
                                    '</span>'
                                );
                            })
                            .replace(/주격\s*보어/g, function (m) {
                                return (
                                    '<span class="pattern-docent-mark pattern-docent-mark--c pattern-docent-paren" style="background:none !important;padding:0 !important;border-radius:0 !important;color:#d0b0ff">' +
                                    m +
                                    '</span>'
                                );
                            })
                            .replace(/목적어/g, function () {
                                return (
                                    '<span class="pattern-docent-mark pattern-docent-mark--o pattern-docent-paren" style="background:none !important;padding:0 !important;border-radius:0 !important;color:#ffb35c">' +
                                    '목적어</span>'
                                );
                            });
                    }
                    return (
                        '<span class="pattern-docent-mark pattern-docent-mark--' +
                        escapeHtml(p.mark) +
                        (isBracket ? ' pattern-docent-mark--bracket' : '') +
                        (isKeyList ? ' pattern-docent-mark--keylist' : '') +
                        '" style="' +
                        styles.join(';') +
                        '">' +
                        t +
                        '</span>'
                    );
                }
                return t;
            })
            .join('');
    }

    function fitFormsKeylistWidth() {
        var textEl = document.getElementById('pattern-docent-text');
        if (!textEl) return;
        // 숨긴 줄 포함 — 가장 긴 3번에 맞춰 세 줄 동일 크기
        var nodes = textEl.querySelectorAll(
            '.pattern-docent-mark--forms.pattern-docent-mark--keylist'
        );
        if (nodes.length < 1) return;
        var containerW = textEl.clientWidth;
        if (containerW < 40) return;
        var i;
        for (i = 0; i < nodes.length; i++) {
            nodes[i].style.fontSize = '';
            nodes[i].style.width = '100%';
            nodes[i].style.boxSizing = 'border-box';
        }
        var lo = 11;
        var hi = 34;
        var best = 14;
        var step;
        for (step = 0; step < 14; step++) {
            var mid = (lo + hi) / 2;
            var maxW = 0;
            for (i = 0; i < nodes.length; i++) {
                nodes[i].style.fontSize = mid + 'px';
                maxW = Math.max(maxW, nodes[i].scrollWidth);
            }
            if (maxW <= containerW) {
                best = mid;
                lo = mid;
            } else {
                hi = mid;
            }
        }
        for (i = 0; i < nodes.length; i++) {
            nodes[i].style.fontSize = best + 'px';
        }
    }

    function buildDocentMapHtml(cols) {
        return (
            '<div class="pattern-docent-map">' +
            (cols || [])
                .map(function (col) {
                    return (
                        '<div class="pattern-docent-map-col">' +
                        '<span class="pattern-docent-map-eng">' +
                        escapeHtml(col.eng || '') +
                        '</span>' +
                        '<span class="pattern-docent-map-arrow" aria-hidden="true">↓</span>' +
                        '<span class="pattern-docent-map-particle">' +
                        escapeHtml(col.particle || '') +
                        '</span>' +
                        '</div>'
                    );
                })
                .join('') +
            '</div>'
        );
    }

    function clearAllParenBlinks() {
        var textEl = document.getElementById('pattern-docent-text');
        if (!textEl) return;
        textEl.querySelectorAll('.pattern-docent-paren.is-blink').forEach(function (n) {
            n.classList.remove('is-blink');
        });
    }

    /** 노드마다 1회만 깜빡 → 켜진 채 유지하고 다음 노드 */
    function blinkNodesSequentially(nodes, onDone) {
        var list = Array.prototype.slice.call(nodes || []);
        var i = 0;

        function next() {
            if (!state.docentPhase) {
                clearAllParenBlinks();
                if (onDone) onDone();
                return;
            }
            if (i >= list.length) {
                clearAllParenBlinks();
                if (onDone) onDone();
                return;
            }
            var n = list[i];
            i += 1;
            clearAllParenBlinks();
            void n.offsetWidth;
            n.classList.add('is-blink');
            state.docentTimer = setTimeout(function () {
                n.classList.remove('is-blink');
                next();
            }, PAREN_BLINK_MS);
        }

        if (!list.length) {
            if (onDone) onDone();
            return;
        }
        next();
    }

    /** 여러 노드 동시 1회 깜빡 (3번 목적어+목적격 보어) */
    function blinkNodesTogether(nodes, onDone) {
        var list = Array.prototype.slice.call(nodes || []);
        if (!list.length) {
            if (onDone) onDone();
            return;
        }
        clearAllParenBlinks();
        list.forEach(function (n) {
            void n.offsetWidth;
            n.classList.add('is-blink');
        });
        state.docentTimer = setTimeout(function () {
            clearAllParenBlinks();
            if (onDone) onDone();
        }, PAREN_BLINK_MS);
    }

    function blinkParensInDocent(root, onDone) {
        var scope = root || document.getElementById('pattern-docent-text');
        if (!scope) {
            if (onDone) onDone();
            return;
        }
        var nodes = scope.querySelectorAll('.pattern-docent-paren');
        var plain = String(scope.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
        // 3번만: 목적어·목적격 보어 동시 깜빡
        if (/^3\.\s/.test(plain) && nodes.length > 1) {
            blinkNodesTogether(nodes, onDone);
            return;
        }
        blinkNodesSequentially(nodes, onDone);
    }

    function runDocentReplayIfNeeded(onDone) {
        var item = state.currentDocentItem;
        if (!item || !item.replay_lines || state.docentReplayDone) {
            if (onDone) onDone();
            return;
        }
        var textEl = document.getElementById('pattern-docent-text');
        if (!textEl) {
            if (onDone) onDone();
            return;
        }
        var allSegs = Array.prototype.slice.call(
            textEl.querySelectorAll('.pattern-docent-seg')
        );
        var replaySegs = Array.prototype.slice.call(
            textEl.querySelectorAll('.pattern-docent-seg.is-replay')
        );
        if (!replaySegs.length && allSegs.length > 1) {
            allSegs.forEach(function (seg) {
                var plain = String(seg.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (
                    /^(주어|서술어|목적어)\s*:/.test(plain) ||
                    /^\d+\.\s/.test(plain)
                ) {
                    seg.classList.add('is-replay');
                    replaySegs.push(seg);
                }
            });
        }
        if (!replaySegs.length) {
            state.docentReplayDone = true;
            if (onDone) onDone();
            return;
        }

        state.docentReplayDone = true;
        state.docentReplaying = true;

        // 복습 문구는 남기고, 성분 3개(또는 번호 줄)는 한꺼번에 숨김
        allSegs.forEach(function (seg) {
            if (seg.classList.contains('is-replay')) {
                seg.classList.remove('is-on');
            } else {
                seg.classList.add('is-on');
            }
        });

        var stepI = 0;
        function step() {
            if (!state.docentPhase) {
                state.docentReplaying = false;
                return;
            }
            if (stepI >= replaySegs.length) {
                clearAllParenBlinks();
                state.docentReplaying = false;
                if (onDone) onDone();
                return;
            }
            var seg = replaySegs[stepI];
            stepI += 1;
            seg.classList.add('is-on');
            scrollDocentLatestIntoView();
            if (item.blink_paren) {
                blinkParensInDocent(seg, function () {
                    state.docentTimer = setTimeout(step, 350);
                });
            } else {
                // 앞선 1차 공개와 같은 간격으로 순차 등장
                state.docentTimer = setTimeout(step, DOCENT_SEG_MS);
            }
        }
        // 3개가 같이 사라진 상태가 보이게 잠시 둔 뒤 순차 공개
        state.docentTimer = setTimeout(step, 900);
    }

    function ensureDocentReplayThen(nextFn) {
        var item = state.currentDocentItem;
        if (
            item &&
            item.replay_lines &&
            !state.docentReplayDone &&
            !state.docentReplaying
        ) {
            runDocentReplayIfNeeded(function () {
                if (nextFn) nextFn();
            });
            return;
        }
        if (state.docentReplaying) return;
        if (nextFn) nextFn();
    }

    function applyDocentContent(item, isBridge) {
        var el = document.getElementById('pattern-docent');
        var roleEl = document.getElementById('pattern-docent-role');
        var exampleEl = document.getElementById('pattern-docent-example');
        var korEl = document.getElementById('pattern-docent-example-kor');
        var mapEl = document.getElementById('pattern-docent-map');
        var textEl = document.getElementById('pattern-docent-text');
        var stepEl = document.getElementById('pattern-docent-step');
        var tapEl = document.getElementById('pattern-docent-tap');
        var hintEl = document.getElementById('pattern-docent-hint');
        if (!el || !textEl) return;

        item = item || {};
        state.currentDocentItem = item;
        state.docentReplayDone = false;
        state.docentReplaying = false;
        el.classList.toggle('is-bridge', !!isBridge);

        var hasMap =
            !isBridge && item.layout === 'map' && item.map_cols && item.map_cols.length;
        var hasExample = !isBridge && !hasMap && item.parts && item.parts.length;
        var hasKor = !isBridge && !hasMap && item.kor_parts && item.kor_parts.length;
        var hasClosing = !isBridge && item.layout === 'closing';
        el.classList.toggle('has-example', !!hasExample);
        el.classList.toggle('has-kor', !!hasKor);
        el.classList.toggle('has-map', !!hasMap);
        el.classList.toggle('has-closing', !!hasClosing);

        if (roleEl) {
            roleEl.textContent = isBridge ? '' : item.role || '';
            roleEl.className = 'pattern-docent-role';
        }
        if (mapEl) {
            if (hasMap) {
                mapEl.classList.remove('is-hidden');
                mapEl.innerHTML = (item.map_cols || [])
                    .map(function (col) {
                        var mark = col.mark || '';
                        var roleKo =
                            col.role_ko || markToRoleKo(mark) || '';
                        return (
                            '<div class="pattern-docent-map-col">' +
                            '<span class="pattern-docent-map-eng">' +
                            escapeHtml(col.eng || '') +
                            '</span>' +
                            '<span class="pattern-docent-map-arrow" aria-hidden="true">↓</span>' +
                            '<span class="pattern-docent-map-particle' +
                            (mark
                                ? ' pattern-docent-mark pattern-docent-mark--' +
                                  escapeHtml(mark)
                                : '') +
                            '">' +
                            escapeHtml(col.particle || '') +
                            '</span>' +
                            (roleKo
                                ? '<span class="pattern-docent-map-role' +
                                  (mark
                                      ? ' pattern-docent-mark pattern-docent-mark--' +
                                        escapeHtml(mark)
                                      : '') +
                                  '">(' +
                                  escapeHtml(roleKo) +
                                  ')</span>'
                                : '') +
                            '</div>'
                        );
                    })
                    .join('');
            } else {
                mapEl.innerHTML = '';
                mapEl.classList.add('is-hidden');
            }
        }
        if (exampleEl) {
            // 영어 예문: 성분색 없음 / 한글 해석만 색
            exampleEl.innerHTML = hasExample
                ? buildDocentMarkedHtml(item.parts, false)
                : '';
            exampleEl.classList.toggle(
                'is-oneline',
                !!(hasExample && shouldExampleOneline(item.parts))
            );
        }
        if (korEl) {
            korEl.innerHTML = hasKor
                ? buildDocentMarkedHtml(item.kor_parts, true)
                : '';
            korEl.classList.toggle(
                'is-oneline',
                !!(hasKor && shouldExampleOneline(item.kor_parts))
            );
        }

        var revealLines = item.reveal === 'lines' || !!item.reveal_lines;
        var markOpts = {};
        if (
            isBridge ||
            item._chapterBridge ||
            item.role === '이어서' ||
            item.role === '해석'
        ) {
            markOpts.interpOnly = true;
            markOpts.stripBrackets = true;
        }
        var blockHtmls = [];
        var blockSpeaks = [];
        if (item.text_parts && item.text_parts.length) {
            var partBlocks = splitTextPartsDocentBlocks(item.text_parts, revealLines);
            if (!partBlocks.length) partBlocks = [item.text_parts];
            blockHtmls = partBlocks.map(function (block) {
                return buildDocentMarkedHtml(block, false, markOpts);
            });
            blockSpeaks = partBlocks.map(function (block) {
                return plainFromParts(block);
            });
            state.docentBlockReplayFlags = partBlocks.map(function (block) {
                var plain = plainFromParts(block).replace(/\s+/g, ' ').trim();
                return (
                    /^(주어|서술어|목적어)\s*:/.test(plain) ||
                    /^\d+\.\s/.test(plain)
                );
            });
        } else {
            var plainBlocks = splitPlainDocentBlocks(item.text || '', revealLines);
            if (!plainBlocks.length && item.text) plainBlocks = [String(item.text)];
            blockHtmls = plainBlocks.map(function (plain) {
                var html = formatDocentPlainHtml(plain);
                if (markOpts.stripBrackets) {
                    html = html.replace(/「([^」]*)」/g, '$1');
                }
                return html;
            });
            blockSpeaks = plainBlocks.map(plainSpeak);
            state.docentBlockReplayFlags = plainBlocks.map(function (plain) {
                var t = String(plain || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return (
                    /^(주어|서술어|목적어)\s*:/.test(t) || /^\d+\.\s/.test(t)
                );
            });
        }

        if (!blockHtmls.length) {
            textEl.innerHTML = '';
            state.docentBlockCount = 1;
            state.docentBlockIdx = 0;
            state.docentBlockSpeaks = [''];
            state.docentBlockReplayFlags = [false];
        } else {
            var flags = state.docentBlockReplayFlags || [];
            textEl.innerHTML = blockHtmls
                .map(function (html, i) {
                    return (
                        '<span class="pattern-docent-seg' +
                        (i === 0 ? ' is-on' : '') +
                        (flags[i] ? ' is-replay' : '') +
                        '">' +
                        html +
                        '</span>'
                    );
                })
                .join('');
            state.docentBlockCount = blockHtmls.length;
            state.docentBlockIdx = 0;
            state.docentBlockSpeaks = blockSpeaks;
        }
        fitFormsKeylistWidth();
        requestAnimationFrame(fitFormsKeylistWidth);

        if (stepEl) {
            if (isBridge) {
                stepEl.textContent = '';
            } else {
                var total = currentDocentLines().length;
                stepEl.textContent = state.docentIdx + 1 + ' / ' + total;
            }
        }
        if (tapEl) {
            tapEl.textContent = '이전 · 다음';
        }
        if (hintEl) hintEl.classList.remove('is-hidden');

        var head = [];
        if (!isBridge && item.role) head.push(String(item.role));
        if (item.kor_parts && item.kor_parts.length) {
            head.push(plainFromParts(item.kor_parts));
        } else if (item.parts && item.parts.length && !item.kor_parts) {
            head.push(plainFromParts(item.parts));
        }
        var firstSpeak = (state.docentBlockSpeaks && state.docentBlockSpeaks[0]) || '';
        var lead = head.filter(Boolean).join('. ');
        state.lastDocentSpeak = lead
            ? lead + (firstSpeak ? '. ' + firstSpeak : '')
            : firstSpeak;
        if (state.docentBlockSpeaks && state.docentBlockSpeaks.length) {
            state.docentBlockSpeaks[0] = state.lastDocentSpeak;
        }
    }

    function renderDocentFrame(item, isBridge, onReady) {
        var el = document.getElementById('pattern-docent');
        if (!el) {
            if (onReady) onReady();
            return;
        }

        clearDocentFadeTimer();

        function reveal() {
            applyDocentContent(item, isBridge);
            void el.offsetWidth;
            el.classList.add('is-show');
            state.docentTransitioning = false;
            state.docentShownOnce = true;
            if (onReady) onReady();
        }

        // 첫 컷: 페이드 인만
        if (!state.docentShownOnce || !el.classList.contains('is-show')) {
            state.docentTransitioning = true;
            el.classList.remove('is-show');
            applyDocentContent(item, isBridge);
            void el.offsetWidth;
            state.docentFadeTimer = setTimeout(function () {
                el.classList.add('is-show');
                state.docentTransitioning = false;
                state.docentShownOnce = true;
                if (onReady) onReady();
            }, 40);
            return;
        }

        // 이후: 페이드 아웃 → 쉼 → 내용 교체 → 페이드 인
        state.docentTransitioning = true;
        stopDocentSpeech();
        el.classList.remove('is-show');
        state.docentFadeTimer = setTimeout(function () {
            state.docentFadeTimer = setTimeout(reveal, DOCENT_FADE_GAP_MS);
        }, DOCENT_FADE_OUT_MS);
    }

    function showDocentBridge(opts) {
        opts = opts || {};
        hideReadingsGallery();
        state.docentPhase = 'bridge';
        state.bridgeFromRolling = !!opts.fromRolling;
        clearDocentTimer();
        var ch = state.chapterMeta && state.chapterMeta.chapter;
        var meta = ch && ch.docent_bridge_meta;
        var item;
        // 롤링 종료 후·패턴 브릿지는 패턴 docent_bridge 사용 (대단원 이어서와 구분)
        if (!opts.fromRolling && meta && (meta.text_parts || meta.text)) {
            item = {
                text: meta.text,
                text_parts: meta.text_parts,
                reveal: meta.reveal || 'lines',
                replay_lines: !!meta.replay_lines,
                blink_paren: !!meta.blink_paren
            };
        } else {
            item = {
                text:
                    (state.data && state.data.docent_bridge) ||
                    '같은 모양으로 읽으면 됩니다.',
                reveal: 'lines'
            };
        }
        renderDocentFrame(item, true, function () {
            scheduleDocentBlocksThenAdvance(DOCENT_BRIDGE_MS);
        });
    }

    function showDocentLine() {
        var lines = currentDocentLines();
        if (state.docentIdx >= lines.length) {
            hideReadingsGallery();
            if (hasRolling()) {
                startRolling();
                return;
            }
            if (resolveReadings().length) {
                showReadingsGallery();
            } else {
                showDocentBridge();
            }
            return;
        }
        hideReadingsGallery();
        state.docentPhase = 'lines';
        var item = lines[state.docentIdx];
        var dwell =
            item._chapterBridge
                ? DOCENT_BRIDGE_MS
                : item.parts && item.parts.length
                  ? DOCENT_EXAMPLE_MS
                  : DOCENT_LINE_MS;
        clearDocentTimer();
        renderDocentFrame(item, false, function () {
            scheduleDocentBlocksThenAdvance(dwell);
        });
    }

    function advanceDocent() {
        if (state.docentTransitioning || state.docentReplaying) return;
        clearDocentTimer();
        stopDocentSpeech();
        if (state.docentPhase === 'readings') {
            hideReadingsGallery();
            showDocentBridge();
            return;
        }
        // 아직 안 연 블록 → 다음 줄 공개 (마지막이면 복습 재생)
        if (
            state.docentPhase &&
            state.docentBlockCount > 1 &&
            state.docentBlockIdx < state.docentBlockCount - 1
        ) {
            revealNextDocentBlock(function (speak) {
                state.lastDocentSpeak = speak || state.lastDocentSpeak;
                if (state.docentSoundOn && speak) {
                    speakDocentText(speak);
                }
                if (state.docentBlockIdx >= state.docentBlockCount - 1) {
                    // 「다시 한번」+ 성분 3개가 함께 보인 뒤 복습 재생
                    state.docentTimer = setTimeout(function () {
                        ensureDocentReplayThen(null);
                    }, 900);
                }
            });
            return;
        }
        // 블록은 다 열렸는데 복습 재생 전이면 복습 먼저
        if (
            state.docentPhase &&
            state.currentDocentItem &&
            state.currentDocentItem.replay_lines &&
            !state.docentReplayDone
        ) {
            ensureDocentReplayThen(null);
            return;
        }
        if (state.docentPhase === 'bridge') {
            if (shouldSkipParticleDrill()) {
                hideDocentOverlay();
                finishPattern();
            } else {
                onIntroComplete();
            }
            return;
        }
        if (state.docentPhase === 'lines') {
            state.docentIdx += 1;
            showDocentLine();
        }
    }

    function retreatDocent() {
        if (state.docentTransitioning) return;
        clearDocentTimer();
        stopDocentSpeech();
        if (state.docentPhase === 'readings') {
            hideReadingsGallery();
            var linesR = currentDocentLines();
            if (!linesR.length) return;
            state.docentIdx = linesR.length - 1;
            showDocentLine();
            return;
        }
        if (
            state.docentPhase &&
            state.docentBlockCount > 1 &&
            state.docentBlockIdx > 0
        ) {
            setDocentBlocksVisible(0);
            var speak =
                (state.docentBlockSpeaks && state.docentBlockSpeaks[0]) || '';
            state.lastDocentSpeak = speak;
            scheduleDocentBlocksThenAdvance(
                state.docentPhase === 'bridge' ? DOCENT_BRIDGE_MS : DOCENT_LINE_MS
            );
            return;
        }
        if (state.docentPhase === 'bridge') {
            if (state.bridgeFromRolling && hasRolling()) {
                resumeRollingAtEnd();
                return;
            }
            if (resolveReadings().length) {
                showReadingsGallery();
                return;
            }
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
        state.docentShownOnce = false;
        state.docentTransitioning = false;
        state.docentBlockIdx = 0;
        state.docentBlockCount = 1;
        state.docentBlockSpeaks = null;
        clearDocentFadeTimer();
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
            if (shouldSkipParticleDrill()) {
                finishPattern();
                return;
            }
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

        if (title) title.textContent = (state.data.title || '') + ' 완료';

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
        var guide = document.getElementById('pattern-guide') || document.querySelector('.pattern-guide');
        if (!body || !state.data) return;

        // 롤링·도슨트 패턴은 해석포인트(자리 표시) 패널 숨김
        if (guide) {
            var hideGuide = hasRolling() || hasDocent();
            guide.classList.toggle('is-hidden', hideGuide);
            var page = document.querySelector('.pattern-page');
            if (page) page.classList.toggle('is-no-guide', hideGuide);
            if (hideGuide) return;
        }

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

        var rollingEl = document.getElementById('pattern-rolling');
        if (rollingEl) {
            rollingEl.addEventListener('click', function (e) {
                e.stopPropagation();
                onRollingTap(e);
            });
        }

        var docentEl = document.getElementById('pattern-docent');
        if (docentEl) {
            docentEl.addEventListener('click', function (e) {
                if (!state.docentPhase || state.docentTransitioning) return;
                var card = e.target && e.target.closest
                    ? e.target.closest('.pattern-readings-card')
                    : null;
                if (card && state.docentPhase === 'readings') {
                    e.stopPropagation();
                    card.classList.toggle('is-open');
                    return;
                }
                var doneBtn = e.target && e.target.closest
                    ? e.target.closest('#pattern-readings-done')
                    : null;
                if (doneBtn && state.docentPhase === 'readings') {
                    e.stopPropagation();
                    advanceDocent();
                    return;
                }
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
            stopDocentSpeech();
            location.href = 'index.html?tab=reading';
        });

        var soundBtn = document.getElementById('pattern-sound-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                setDocentSound(!state.docentSoundOn);
            });
        }
        document.getElementById('pattern-complete-retry').addEventListener('click', function () {
            document.getElementById('pattern-complete').classList.remove('is-open');
            state.isRepeat = true;
            state.skipDocent = false;
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
        state.docentSoundOn = localStorage.getItem(SOUND_KEY) === '1';
        syncSoundBtn();

        if (window.speechSynthesis) {
            ensureDocentVoice();
            window.speechSynthesis.onvoiceschanged = function () {
                state.docentVoice = null;
                ensureDocentVoice();
            };
        }

        Promise.all([
            fetch(INDEX_URL).then(function (r) {
                return r.ok ? r.json() : null;
            }),
            fetch('data/patterns/' + id + '.json?v=20260728m').then(function (r) {
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
