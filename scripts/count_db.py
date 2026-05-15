import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
m = json.loads((root / "data/merged_market_headwords.json").read_text(encoding="utf-8"))
p = json.loads((root / "data/passage_phrases.json").read_text(encoding="utf-8"))
words = m.get("words") or {}
phrases = p.get("phrases") or {}

# phrases with space = real idiom-ish
phrase_multi = sum(1 for k in phrases if " " in k)
phrase_single = len(phrases) - phrase_multi

# junk: very long or starts with digit
junk = sum(1 for k in phrases if len(k) > 50 or re.match(r"^\d", k))

print("=== 오늘 추가 (기존 worddata 제외) ===")
print("단어 표제어 (market_headwords):", len(words))
print("숙어/구문 (passage_phrases) 총:", len(phrases))
print("  - 공백 있는 구문:", phrase_multi)
print("  - 한 단어처럼 저장된 것:", phrase_single)
print("  - 길이/형식 이상 후보:", junk)

# worddata unique
all_wd = set()
for f in ["worddata.js", "worddata_middle.js", "worddata_high.js"]:
    fp = root / f
    if not fp.exists():
        continue
    t = fp.read_text(encoding="utf-8", errors="ignore")
    for w in re.findall(r'"word"\s*:\s*"([^"]+)"', t):
        all_wd.add(w.lower().strip())
print("\n=== 기존 worddata (참고) ===")
print("고유 영단어 수:", len(all_wd))

# overlap
mset = set(words.keys())
pset = set(phrases.keys())
print("\n=== 겹침 ===")
print("단어장∩숙어(같은 표기):", len(mset & pset))
