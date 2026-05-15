# -*- coding: utf-8 -*-
"""Merge market wordbook files into English headword index only. Does NOT modify worddata.js."""
import json
import re
import csv
from pathlib import Path

ROOT = Path(r"g:\트리거 앱\시중 단어 교재")
OUT = Path(__file__).resolve().parent.parent / "data" / "merged_market_headwords.json"

WORD_RE = re.compile(r"[a-z][a-z'-]*", re.I)


def norm(w: str) -> str:
    w = str(w or "").strip().lower()
    w = re.sub(r"[^a-z'-]", "", w)
    if len(w) < 2 or w in ("ll",):
        return ""
    return w


def add(index: dict, word: str, source: str) -> None:
    w = norm(word)
    if not w:
        return
    if w not in index:
        index[w] = {"sources": []}
    if source not in index[w]["sources"]:
        index[w]["sources"].append(source)


def parse_txt_lines(path: Path, source: str, index: dict) -> None:
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        w = line.split("|")[0].split("\t")[0].strip()
        add(index, w, source)


def parse_csv_like(path: Path, source: str, index: dict) -> None:
    text = path.read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.search(r'word:\s*""([^"]+)""', line, re.I)
        if m:
            add(index, m.group(1), source)
            continue
        m = re.search(r'"Word"\s*:\s*"([^"]+)"', line, re.I)
        if m:
            add(index, m.group(1), source)
            continue
        if "," in line:
            parts = next(csv.reader([line]))
            if parts:
                add(index, parts[0], source)


def parse_json_array(path: Path, source: str, index: dict) -> None:
    data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    if not isinstance(data, list):
        return
    for row in data:
        if not isinstance(row, dict):
            continue
        w = row.get("Word") or row.get("word") or row.get("eng")
        add(index, w, source)


def parse_xlsx(path: Path, source: str, index: dict) -> None:
    try:
        import openpyxl
    except ImportError:
        print(f"SKIP (no openpyxl): {path.name}")
        return
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            for cell in row:
                if cell is None:
                    continue
                s = str(cell).strip()
                if not s:
                    continue
                if re.match(r"^[A-Za-z][A-Za-z\s'-]*$", s) and len(s) < 40:
                    add(index, s.split()[0], source)
                else:
                    for m in WORD_RE.finditer(s.lower()):
                        add(index, m.group(0), source)
    wb.close()


def collect_files() -> list[tuple[Path, str]]:
    items: list[tuple[Path, str]] = []
    if not ROOT.exists():
        return items

    patterns = [
        ("중고등통합 최종_worddata/중등 최종.txt", "중등최종txt"),
        ("중고등통합 최종_worddata/고등 최종.txt", "고등최종txt"),
        ("제미나이 중학단어_통합/중학1200_1개 최종.csv", "중학1200csv"),
        ("제미나이 중학단어_통합/TriggerVoca_1200_Final.csv", "Trigger1200csv"),
        ("제미나이 중학단어_통합/TriggerVoca_1200_Final.json", "Trigger1200json"),
        ("고등/TriggerVoca_High_2000.json", "Trigger2000json"),
        ("고등/TriggerVoca_High_2000.csv", "Trigger2000csv"),
        ("고등/TriggerVoca_High_2000_1개최종.csv", "Trigger2000최종csv"),
        ("중학/BOOSTER VOCA 중등기본 어휘리스트.xlsx", "BOOSTER기본"),
        ("중학/BOOSTER VOCA 중등실력_어휘리스트.xlsx", "BOOSTER실력"),
        ("중학/BOOSTER VOCA 중등완성_어휘리스트.xlsx", "BOOSTER완성"),
        ("중학/중학영단어 표제어리스트_기본.xlsx", "표제어기본"),
        ("중학/중학영단어 표제어리스트_실력.xlsx", "표제어실력"),
    ]
    for rel, tag in patterns:
        p = ROOT / rel
        if p.exists():
            items.append((p, tag))
    return items


def main() -> None:
    index: dict = {}
    files = collect_files()
    for path, source in files:
        ext = path.suffix.lower()
        try:
            if ext == ".txt":
                parse_txt_lines(path, source, index)
            elif ext == ".json":
                parse_json_array(path, source, index)
            elif ext in (".csv",):
                parse_csv_like(path, source, index)
            elif ext in (".xlsx", ".xls"):
                parse_xlsx(path, source, index)
            print(f"OK {source}: {path.name}")
        except Exception as e:
            print(f"ERR {source}: {e}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    words = sorted(index.keys())
    payload = {
        "meta": {
            "note": "English headwords only, no meanings. No source priority. For passage filter lookup.",
            "source_files": [f"{s}:{p.name}" for p, s in files],
            "count": len(words),
        },
        "words": {w: index[w] for w in words},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(words)} headwords -> {OUT}")


if __name__ == "__main__":
    main()
