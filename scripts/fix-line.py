from pathlib import Path
p = Path(__file__).resolve().parent.parent / "analysis.html"
lines = p.read_text(encoding="utf-8").splitlines()
for i, line in enumerate(lines):
    if "parts.join('').replace" in line:
        lines[i] = "            el.innerHTML = parts.join('');"
        print("fixed line", i + 1)
p.write_text("\n".join(lines) + "\n", encoding="utf-8")
