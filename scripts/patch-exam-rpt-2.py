# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "analysis.html"
t = p.read_text(encoding="utf-8")

if "function examRptRenderReasonStats" not in t:
    insert = r"""
        function examRptRenderReasonStats() {
            const el = document.getElementById('exam-rpt-reason-stats');
            if (!el) return;
            const counts = {};
            EXAM_RPT_REASON_OPTIONS.forEach(function (label) {
                counts[label] = 0;
            });
            let wrongCnt = 0;
            examRptQuestions.forEach(function (q) {
                if (q.type === 'essay' || !examRptWrong[q.number]) return;
                wrongCnt += 1;
                (examRptReasons[q.number] || []).forEach(function (label) {
                    if (counts[label] != null) counts[label] += 1;
                });
            });
            const entries = EXAM_RPT_REASON_OPTIONS.map(function (label) {
                return { label: label, count: counts[label] || 0 };
            })
                .filter(function (e) { return e.count > 0; })
                .sort(function (a, b) { return b.count - a.count; });
            if (!wrongCnt) {
                el.innerHTML = '<span style="color:#666;font-size:0.85rem;">오답 문항을 표시하면 통계가 나타납니다.</span>';
                return;
            }
            if (!entries.length) {
                el.innerHTML = '<span style="color:#888;font-size:0.85rem;">오답 원인을 체크하면 내가 자주 틀리는 이유가 집계됩니다.</span>';
                return;
            }
            const max = entries[0].count;
            let html = '<motion style="font-size:0.82rem;color:#ffcc80;font-weight:bold;margin:0 0 8px 0;">오답 원인 통계</TAG><div style="display:flex;flex-direction:column;gap:6px;">';
            entries.forEach(function (e) {
                const pct = max > 0 ? Math.round((e.count / max) * 100) : 0;
                html +=
                    '<ROW style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#ddd;">' +
                    '<span style="min-width:88px;color:#eee;">' + escapeHtml(e.label) + '</span>' +
                    '<BAR style="flex:1;height:10px;background:#222;border-radius:5px;overflow:hidden;">' +
                    '<FILL style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#ff9a5c,#ff4444);"></FILL></BAR>' +
                    '<span style="min-width:28px;text-align:right;color:#ffcc80;">' + e.count + '</span></ROW>';
            });
            html += '</WRAP>';
            el.innerHTML = html
                .replace(/motion/g, 'motion')
                .replace(/<\/TAG>/g, '</motion>')
                .replace(/<motion /g, '<div ')
                .replace(/<ROW /g, '<div ')
                .replace(/<\/ROW>/g, '</div>')
                .replace(/<BAR /g, '<motion ')
                .replace(/<\/BAR>/g, '</motion>')
                .replace(/<FILL /g, '<div ')
                .replace(/<\/FILL>/g, '</div>')
                .replace(/<WRAP>/g, '<div>')
                .replace(/<\/WRAP>/g, '</div>')
                .replace(/motion/g, 'motion');
        }

"""
    insert = insert.replace("motion", "div").replace("</motion>", "</div>")
    insert = insert.replace("<motion ", "<motion ").replace("motion", "motion")  # noop cleanup
    # simpler: use TAG placeholders then replace
    insert = r"""
        function examRptRenderReasonStats() {
            const el = document.getElementById('exam-rpt-reason-stats');
            if (!el) return;
            const counts = {};
            EXAM_RPT_REASON_OPTIONS.forEach(function (label) { counts[label] = 0; });
            let wrongCnt = 0;
            examRptQuestions.forEach(function (q) {
                if (q.type === 'essay' || !examRptWrong[q.number]) return;
                wrongCnt += 1;
                (examRptReasons[q.number] || []).forEach(function (label) {
                    if (counts[label] != null) counts[label] += 1;
                });
            });
            const entries = EXAM_RPT_REASON_OPTIONS.map(function (label) {
                return { label: label, count: counts[label] || 0 };
            }).filter(function (e) { return e.count > 0; })
              .sort(function (a, b) { return b.count - a.count; });
            if (!wrongCnt) {
                el.innerHTML = '<span style="color:#666;font-size:0.85rem;">오답 문항을 표시하면 통계가 나타납니다.</span>';
                return;
            }
            if (!entries.length) {
                el.innerHTML = '<span style="color:#888;font-size:0.85rem;">오답 원인을 체크하면 내가 자주 틀리는 이유가 집계됩니다.</span>';
                return;
            }
            const max = entries[0].count;
            const parts = ['<p style="font-size:0.82rem;color:#ffcc80;font-weight:bold;margin:0 0 8px 0;">오답 원인 통계</p>'];
            entries.forEach(function (e) {
                const pct = max > 0 ? Math.round((e.count / max) * 100) : 0;
                parts.push(
                    '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#ddd;margin-bottom:6px;">' +
                    '<span style="min-width:88px;">' + escapeHtml(e.label) + '</span>' +
                    '<span style="flex:1;display:block;height:10px;background:#222;border-radius:5px;overflow:hidden;">' +
                    '<span style="display:block;width:' + pct + '%;height:10px;background:linear-gradient(90deg,#ff9a5c,#ff4444);"></span></span>' +
                    '<span style="min-width:24px;text-align:right;color:#ffcc80;">' + e.count + '</span></motion>'
                );
            });
            el.innerHTML = parts.join('').replace(/motion/g, 'div');
        }

"""
    t = t.replace("        function examRptRenderReasons() {", insert + "        function examRptRenderReasons() {", 1)

t = t.replace(
    "                    examRptReasons[n] = arr;\n                };\n            });\n        }",
    "                    examRptReasons[n] = arr;\n                    examRptRenderReasonStats();\n                };\n            });\n            examRptRenderReasonStats();\n        }",
    1,
)

if "headlineEl" not in t:
    t = t.replace(
        "            const el = document.getElementById('exam-rpt-score-summary');\n            if (el) {",
        "            const headlineEl = document.getElementById('exam-rpt-score-headline');\n"
        "            if (headlineEl) {\n"
        "                headlineEl.innerHTML =\n"
        "                    '<span style=\"color:#39ff14;\">' + fmt(t.totalEarn) + '</span> / ' +\n"
        "                    fmt(t.totalPts) + '점 <span style=\"font-size:0.95rem;color:#ffcc80;\">(' + fmt(t.totalAcc) + '%)</span>';\n"
        "            }\n"
        "            const el = document.getElementById('exam-rpt-score-summary');\n"
        "            if (el) {",
        1,
    )

if "q._inferred" not in t:
    t = t.replace(
        "const rowStyle = wrongActive ? 'background:rgba(255,68,68,0.12);' : '';",
        "const rowStyle = wrongActive ? 'background:rgba(255,68,68,0.12);' : (q._inferred ? 'background:rgba(255,204,128,0.08);' : '');",
        1,
    )
    t = t.replace(
        "return '<tr style=\"' + rowStyle + '\"><td style=\"padding:8px;border-bottom:1px solid #222;\">' + n + '</td>",
        "const numCell = n + (q._inferred ? ' <span style=\"font-size:0.7rem;color:#ffb347;\">보정</span>' : '');\n"
        "                return '<tr style=\"' + rowStyle + '\"><td style=\"padding:8px;border-bottom:1px solid #222;\">' + numCell + '</td>",
        1,
    )
    t = t.replace(
        "let hintText = '인식된 배점 합계: ' + examRptFmt1(totalPts) + '점';",
        "const inferredNums = examRptQuestions.filter(function (q) { return q._inferred; }).map(function (q) { return q.number; });\n"
        "                let hintText = '인식된 배점 합계: ' + examRptFmt1(totalPts) + '점 · 문항 ' + examRptQuestions.length + '개';\n"
        "                if (inferredNums.length) hintText += '\\n번호 ' + inferredNums.join(', ') + '은(는) 누락 보정입니다. 배점을 확인해 주세요.';",
        1,
    )

old_gen = (
    "        async function examRptGenDiagnosis() {\n"
    "            const btn = document.getElementById('exam-rpt-gen-diagnosis');\n"
    "            if (btn) {\n"
    "                btn.disabled = true;\n"
    "            }\n"
    "            try {"
)
new_gen = (
    "        async function examRptGenDiagnosis() {\n"
    "            const btn = document.getElementById('exam-rpt-gen-diagnosis');\n"
    "            const diagOut = document.getElementById('exam-rpt-ai-diagnosis');\n"
    "            if (btn) {\n"
    "                btn.disabled = true;\n"
    "                startLoadingText(btn, EXAM_RPT_DIAG_LOADING_MESSAGES);\n"
    "            }\n"
    "            if (diagOut) {\n"
    "                diagOut.innerHTML = '<p style=\"display:flex;align-items:center;gap:10px;color:#aaa;\">"
    "AI 진단 생성 중…<span class=\"inline-spinner\" aria-hidden=\"true\"></span></p>';\n"
    "            }\n"
    "            try {"
)
if old_gen in t:
    t = t.replace(old_gen, new_gen, 1)
    t = t.replace(
        "            } finally {\n                if (btn) btn.disabled = false;\n                examRptSyncDiagnosisButton();\n            }\n        }\n\n        function copyTextForShareFallback",
        "            } finally {\n                if (btn) stopLoadingText(false, btn, 'AI 진단 생성');\n                examRptSyncDiagnosisButton();\n            }\n        }\n\n        function copyTextForShareFallback",
        1,
    )

p.write_text(t, encoding="utf-8")
print("patch-2 ok")
