# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

import fitz

ROOT = Path(r"g:\트리거 앱\시중 단어 교재\고등")
OUT_INDEX = Path(__file__).resolve().parent.parent / "data" / "merged_market_headwords.json"
WORD = re.compile(r"\b[a-z][a-z'-]{1,28}\b", re.I)


def norm(w: str) -> str:
    w = re.sub(r"[^a-z'-]", "", str(w).lower().strip())
    return w if len(w) >= 2 else ""


def main() -> None:
    index = {}
    if OUT_INDEX.exists():
        payload = json.loads(OUT_INDEX.read_text(encoding="utf-8"))
        index = payload.get("words") or {}
        meta = payload.get("meta") or {}
    else:
        meta = {}

    pdfs = sorted(ROOT.glob("*.pdf"))
    added = 0
    for p in pdfs:
        tag = "pdf:" + p.stem[:24]
        doc = fitz.open(p)
        text = "".join(page.get_text() for page in doc)
        doc.close()
        for m in WORD.finditer(text):
            w = norm(m.group(0))
            if not w:
                continue
            if w not in index:
                index[w] = {"sources": []}
                added += 1
            if tag not in index[w]["sources"]:
                index[w]["sources"].append(tag)

    words = sorted(index.keys())
    meta["count"] = len(words)
    meta["pdf_files"] = [p.name for p in pdfs]
    payload = {"meta": meta, "words": {w: index[w] for w in words}}
    OUT_INDEX.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PDFs: {len(pdfs)}, new headwords from PDF pass: ~{added}, total: {len(words)}")


if __name__ == "__main__":
    main()
