(function () {
    'use strict';

    var INDEX_URL = 'data/pattern_index.json?v=20260722m';

    var indexData = null;

    function isPatternDone(id) {
        return localStorage.getItem('pattern_done_' + id) === '1';
    }

    function flattenPatterns(chapters) {
        var list = [];
        (chapters || []).forEach(function (ch) {
            if (ch.patterns) {
                ch.patterns.forEach(function (p) {
                    list.push({ chapter: ch, pattern: p });
                });
            }
            if (ch.sections) {
                ch.sections.forEach(function (sec) {
                    (sec.patterns || []).forEach(function (p) {
                        list.push({ chapter: ch, section: sec, pattern: p });
                    });
                });
            }
        });
        return list;
    }

    function findFirstReady() {
        var all = flattenPatterns(indexData && indexData.chapters);
        for (var i = 0; i < all.length; i++) {
            if (all[i].pattern.ready) return all[i].pattern.id;
        }
        return null;
    }

    function goPattern(id) {
        if (!id) return;
        location.href = 'pattern.html?p=' + encodeURIComponent(id);
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderPatternRow(p) {
        var done = isPatternDone(p.id);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pt-toc-pattern' + (done ? ' is-done' : '');
        if (!p.ready) btn.disabled = true;

        var title = document.createElement('span');
        title.className = 'pt-toc-pattern-title';
        title.textContent = (done ? '✓ ' : '') + p.title;

        var badge = document.createElement('span');
        badge.className = 'pt-toc-badge ' + (p.ready ? 'pt-toc-badge--ready' : 'pt-toc-badge--soon');
        badge.textContent = p.ready ? '연습' : '준비 중';

        btn.appendChild(title);
        btn.appendChild(badge);

        if (p.ready) {
            btn.addEventListener('click', function () {
                goPattern(p.id);
            });
        }

        return btn;
    }

    function renderChapter(ch) {
        var wrap = document.createElement('div');
        wrap.className = 'pt-toc-chapter';

        var head = document.createElement('div');
        head.className = 'pt-toc-ch-head';
        head.innerHTML =
            '<span class="pt-toc-ch-title"><span class="pt-toc-ch-num">' +
            ch.id +
            '</span>' +
            escapeHtml(ch.title) +
            '</span><span class="pt-toc-chevron">▼</span>';

        var body = document.createElement('div');
        body.className = 'pt-toc-ch-body';

        if (ch.sections) {
            ch.sections.forEach(function (sec) {
                var label = document.createElement('div');
                label.className = 'pt-toc-section-label';
                label.textContent = sec.title;
                body.appendChild(label);
                (sec.patterns || []).forEach(function (p) {
                    body.appendChild(renderPatternRow(p));
                });
            });
        } else if (ch.patterns) {
            ch.patterns.forEach(function (p) {
                body.appendChild(renderPatternRow(p));
            });
        }

        head.addEventListener('click', function () {
            wrap.classList.toggle('is-open');
        });

        wrap.appendChild(head);
        wrap.appendChild(body);
        return wrap;
    }

    function renderToc(data) {
        var root = document.getElementById('pattern-toc-root');
        if (!root) return;
        root.innerHTML = '';

        (data.chapters || []).forEach(function (ch, idx) {
            var el = renderChapter(ch);
            if (idx === 0) el.classList.add('is-open');
            root.appendChild(el);
        });
    }

    function loadAndRender() {
        var root = document.getElementById('pattern-toc-root');
        if (!root) return;

        fetch(INDEX_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('index');
                return r.json();
            })
            .then(function (data) {
                indexData = data;
                renderToc(data);
            })
            .catch(function () {
                root.innerHTML =
                    '<p style="color:#888;padding:16px;text-align:center;">목차를 불러오지 못했습니다.</p>';
            });
    }

    function startFromBeginning() {
        if (!indexData) {
            goPattern('svo');
            return;
        }
        var id = findFirstReady();
        if (id) goPattern(id);
    }

    window.PatternToc = {
        init: loadAndRender,
        startFromBeginning: startFromBeginning,
        refresh: loadAndRender
    };

    if (document.getElementById('pattern-toc-root')) {
        loadAndRender();
    }
})();
