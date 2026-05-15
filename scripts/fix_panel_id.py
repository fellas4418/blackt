from pathlib import Path

p = Path(__file__).resolve().parent.parent / "analysis.html"
t = p.read_text(encoding="utf-8")
needle = '<div class="result-content">${keywordHtml}</div>'
repl = '<motioniv id="passage-keyword-panel" class="result-content">${keywordHtml}</motioniv></motioniv>'
# fix typo in repl
repl = '<div id="passage-keyword-panel" class="result-content">${keywordHtml}</div>'
if needle in t:
    t = t.replace(needle, repl, 1)
    p.write_text(t, encoding="utf-8")
    print("ok")
else:
    i = t.find("keywordHtml")
    print("missing", repr(t[i - 80 : i + 30]) if i >= 0 else "n/a")
