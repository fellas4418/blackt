# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "analysis.html"
t = p.read_text(encoding="utf-8")
n = 0

def sub(old, new, label):
    global t, n
    if old not in t:
        raise SystemExit("MISSING: " + label)
    t = t.replace(old, new, 1)
    n += 1

# HTML: reason stats, score headline, essay pie wrap, admin section
sub(
    '                <div id="exam-rpt-wrong-reasons"></div>\n            </div>\n            <div class="result-card">\n                <span class="result-label">성적 요약</span>\n                <div id="exam-rpt-score-summary"',
    '                <div id="exam-rpt-wrong-reasons"></div>\n                <div id="exam-rpt-reason-stats" style="margin-top:14px;padding-top:12px;border-top:1px solid #333;"></div>\n            </div>\n            <div class="result-card">\n                <span class="result-label">성적 요약</span>\n                <div id="exam-rpt-score-headline" style="font-size:1.35rem;font-weight:bold;color:#fff;margin:0 0 10px 0;line-height:1.4;"></div>\n                <div id="exam-rpt-score-summary"',
    "reason-stats",
)

sub(
    '                    <div style="text-align:center; width:100%; max-width:220px;">\n                        <canvas id="exam-rpt-pie-essay" width="184" height="184" style="max-width:100%;"></canvas>\n                    </div>',
    '                    <div id="exam-rpt-pie-essay-wrap" style="text-align:center; width:100%; max-width:220px;">\n                        <canvas id="exam-rpt-pie-essay" width="184" height="184" style="max-width:100%;"></canvas>\n                    </div>',
    "essay-wrap",
)

sub(
    '''            <div class="result-card" id="exam-rpt-admin-section" style="display:none;">
                <span class="result-label">선생님(관리자) 메모</span>
                <p class="guide-text" style="font-size:0.8rem; color:#888; margin:0 0 10px 0;">관리자 모드에서만 보입니다. 학생 화면·인쇄·PDF에는 넣지 않습니다. 학생이 리포트를 저장하면 서버 접수함에 쌓이며, 아래에서 확인한 뒤 코멘트를 남길 수 있습니다.</p>
                <label style="font-size:0.78rem;color:#777;display:block;margin:0 0 8px 0;">관리자 API 키 (Cloudflare Worker API_SECRET_KEY)
                    <input type="password" id="exam-rpt-admin-api-key" class="auth-input" style="width:100%;margin-top:4px;box-sizing:border-box;" placeholder="wrangler secret put API_SECRET_KEY 값" autocomplete="off">
                </label>
                <button type="button" id="exam-rpt-admin-load-list"''',
    '''            <div class="result-card" id="exam-rpt-admin-section" style="display:none;">
                <span class="result-label">선생님 메모</span>
                <p class="guide-text" style="font-size:0.8rem; color:#888; margin:0 0 10px 0;">학생이 「리포트 저장」을 하면 접수 목록에 쌓입니다. 원장·관리자만 아래에서 확인·코멘트할 수 있습니다.</p>
                <input type="password" id="exam-rpt-admin-api-key" style="display:none;" autocomplete="off">
                <button type="button" id="exam-rpt-admin-load-list"''',
    "admin-section",
)

EXAM_PROMPT_OLD = """        const EXAM_RPT_EXTRACT_PROMPT =
            'You extract structure from Korean school English exam paper photos.\\n' +
            'Return ONLY valid JSON (no markdown) with this exact shape:\\n' +
            '{\"questions\":[{\"number\":1,\"type\":\"multiple\",\"points\":2.5},{\"number\":2,\"type\":\"essay\",\"points\":10}]}\\n' +
            'Rules:\\n' +
            '- \"number\": visible problem index (integer). Each numbered item appears once only.\\n' +
            '- \"type\": \"multiple\" for 객관식·선택·빈칸 고르기 등, \"essay\" for 서술·논술·장문·단답 서술.\\n' +
            '- \"points\": read the score printed at the end of each question line (e.g. 2.5점, [3점], (4.5)). Use decimals when shown; do not round to integers.\\n' +
            '- Do not count sub-parts twice; use the score shown for the whole numbered item.\\n' +
            '- Merge pages: include every numbered item you can read across all images.\\n' +
            '- If unreadable, omit that item (do not guess numbers).';"""

EXAM_PROMPT_NEW = """        const EXAM_RPT_EXTRACT_PROMPT =
            'You extract structure from Korean school English exam paper photos.\\n' +
            'Return ONLY valid JSON (no markdown) with this exact shape:\\n' +
            '{\"questions\":[{\"number\":1,\"type\":\"multiple\",\"points\":2.5},{\"number\":2,\"type\":\"essay\",\"points\":10}]}\\n' +
            'Rules:\\n' +
            '- \"number\": the main question number printed on the paper (1, 2, 3 …). Each number exactly once.\\n' +
            '- Include EVERY consecutive number from 1 through the highest number visible (e.g. 30 questions → numbers 1–30, count=30). Do not skip a number because it is on another page.\\n' +
            '- \"type\": \"multiple\" for 객관식·선택·빈칸 고르기·일치불일치 등, \"essay\" ONLY for 서술·논술·장문·단답 서술 blocks.\\n' +
            '- \"points\": 배점 at the end of each question line (2.5점, [3], (4)). Decimals allowed. Sum of all points should match the exam total (often 100).\\n' +
            '- Do not count (1)(2) sub-items as separate questions; one row per main number.\\n' +
            '- Merge all uploaded images; scan headers/footers for missed numbers.\\n' +
            '- If one number is unreadable, omit only that number (do not guess).';"""

if EXAM_PROMPT_OLD in t:
    sub(EXAM_PROMPT_OLD, EXAM_PROMPT_NEW, "prompt")
else:
    raise SystemExit("MISSING: prompt block")

HELPERS = r'''
        function examRptMedianPoints(list, typeFilter) {
            const pts = list
                .filter(function (q) {
                    return !typeFilter || q.type === typeFilter;
                })
                .map(function (q) {
                    return Number(q.points) || 0;
                })
                .filter(function (p) {
                    return p > 0;
                })
                .sort(function (a, b) {
                    return a - b;
                });
            if (!pts.length) return 2.5;
            const mid = Math.floor(pts.length / 2);
            return pts.length % 2 ? pts[mid] : examRptRound1((pts[mid - 1] + pts[mid]) / 2);
        }

        function examRptFillMissingQuestions(list) {
            if (!list.length) return list;
            const nums = list.map(function (q) {
                return q.number;
            });
            const min = Math.min.apply(null, nums);
            const max = Math.max.apply(null, nums);
            const have = new Set(nums);
            const guess = examRptMedianPoints(list, 'multiple');
            const added = [];
            for (let n = min; n <= max; n++) {
                if (!have.has(n)) {
                    added.push({ number: n, type: 'multiple', points: guess, _inferred: true });
                }
            }
            if (!added.length) return list;
            return list.concat(added).sort(function (a, b) {
                return a.number - b.number;
            });
        }

'''

if "function examRptFillMissingQuestions" not in t:
    sub(
        "        function examRptParsePoints(value) {",
        HELPERS + "        function examRptParsePoints(value) {",
        "helpers",
    )

sub(
    """        function examRptParsePoints(value) {
            if (value == null) return 0;
            const s = String(value).replace(/점/g, '').replace(/[^\\d.]/g, ' ').trim().split(/\\s+/)[0];
            const n = parseFloat(s);
            if (!Number.isFinite(n) || n < 0) return 0;
            return examRptRound1(n);
        }""",
    """        function examRptParsePoints(value) {
            if (value == null) return 0;
            const raw = String(value).replace(/,/g, '.').replace(/점/g, '');
            const matches = raw.match(/\\d+(?:\\.\\d+)?/g);
            const n = matches && matches.length ? parseFloat(matches[matches.length - 1]) : parseFloat(raw);
            if (!Number.isFinite(n) || n < 0) return 0;
            return examRptRound1(n);
        }""",
    "parsePoints",
)

sub(
    """            return Array.from(map.values()).sort((a, b) => a.number - b.number);
        }

        async function examRptExtractViaGeminiProxy() {""",
    """            let out = Array.from(map.values()).sort((a, b) => a.number - b.number);
            out.forEach(function (q) {
                if ((Number(q.points) || 0) <= 0) q.points = examRptMedianPoints(out, q.type === 'essay' ? 'essay' : 'multiple');
            });
            return examRptFillMissingQuestions(out);
        }

        async function examRptExtractViaGeminiProxy() {""",
    "normalize-return",
)

sub(
    """            if (earned > 0) parts.push({ v: earned, c: '#39ff14' });
            if (lost > 0) parts.push({ v: lost, c: '#ff4444' });""",
    """            const earnedColor = centerLabel === '서술형' ? '#ff9a5c' : '#39ff14';
            if (earned > 0) parts.push({ v: earned, c: earnedColor });
            if (lost > 0) parts.push({ v: lost, c: '#ff4444' });""",
    "essay-pie-color",
)

sub(
    """            examRptDrawTwoPartPie(document.getElementById('exam-rpt-pie-essay'), ee, t.esPts, '서술형');
        }""",
    """            const essayWrap = document.getElementById('exam-rpt-pie-essay-wrap');
            if (essayWrap) essayWrap.style.display = t.esCnt > 0 ? 'block' : 'none';
            if (t.esCnt > 0) {
                examRptDrawTwoPartPie(document.getElementById('exam-rpt-pie-essay'), ee, t.esPts, '서술형');
            }
        }""",
    "essay-wrap-visibility",
)

sub(
    """            if (!apiKey) throw new Error('관리자 API 키를 입력해 주세요.');""",
    """            if (!apiKey) throw new Error('원장·관리자 전용입니다. API 연동이 이 기기에 설정되어 있지 않습니다.');""",
    "admin-key-msg",
)

DIAG_LOADING = """
        const EXAM_RPT_DIAG_LOADING_MESSAGES = [
            '오답 패턴을 정리하고 있어요.',
            '취약 유형을 분석 중이에요.',
            '거의 다 됐어요! 진단 문장을 쓰는 중이에요.'
        ];
"""

if "EXAM_RPT_DIAG_LOADING_MESSAGES" not in t:
    sub("        const EXAM_RPT_LOADING_MESSAGES = [", DIAG_LOADING + "        const EXAM_RPT_LOADING_MESSAGES = [", "diag-msgs")

p.write_text(t, encoding="utf-8")
print("applied", n, "replacements to analysis.html")
