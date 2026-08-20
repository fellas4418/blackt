# -*- coding: utf-8 -*-
"""해커스 노랭이 30일 원본 → 고유 표제어 리스트.

- 영어 표제어 정규화(소문자·공백) 후 완전 일치만 제거 (먼저 나온 뜻 유지)
- 철자가 다른 짝(letter of recommendation / recommendation letter)은 유지
- 앱 worddata_toeic.js 학습일(1~5)과 비교 리포트 출력

출력:
  data/toeic_wordlist.txt
  data/toeic_wordlist_by_day.txt
  data/toeic_wordlist_report.txt
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "토익 보카 해커스 노랭이" / "해커스 토익 보카 노랭이.txt"
OUT_DIR = ROOT / "data"
WORDLIST = OUT_DIR / "toeic_wordlist.txt"
BY_DAY = OUT_DIR / "toeic_wordlist_by_day.txt"
REPORT = OUT_DIR / "toeic_wordlist_report.txt"
TOEIC_JS = ROOT / "worddata_toeic.js"
VOCA_TXT = ROOT / "voca_toeic.txt"

DAY_HEAD = re.compile(
    r"^(?:#{2,3}\s*(?:📅\s*)?)?DAY\s+(\d+)\.\s*(.+?)\s*$",
    re.IGNORECASE,
)
EMPTY = {"", "—", "-", "–", "−"}
DAY2_THEME = "규칙·법률"


def norm_key(word: str) -> str:
    return re.sub(r"\s+", " ", word).strip().lower()


def clean_cell(s: str) -> str:
    t = (s or "").replace("\u00a0", " ").strip()
    t = re.sub(r"\s+", " ", t)
    t = t.replace("\t", "").strip()
    return t


def is_empty(s: str) -> bool:
    return clean_cell(s) in EMPTY


def parse_cells(line: str) -> list[str]:
    raw = line.strip().strip("|")
    return [clean_cell(p) for p in raw.split("|")]


def parse_hackers(text: str) -> list[dict]:
    days: list[dict] = []
    current: dict | None = None
    pending_day2 = False

    def start_day(num: int, theme: str) -> None:
        nonlocal current, pending_day2
        current = {"day": num, "theme": theme.strip(), "items": []}
        days.append(current)
        pending_day2 = False

    for raw in text.splitlines():
        line = raw.replace("\t", "").strip()
        if not line or line == "---":
            continue

        m = DAY_HEAD.match(line.lstrip("# ").replace("📅 ", "").strip())
        if not m:
            m = DAY_HEAD.match(line)
        if m:
            start_day(int(m.group(1)), m.group(2))
            if int(m.group(1)) == 1:
                pending_day2 = True
            continue

        if not line.startswith("|"):
            continue
        cells = parse_cells(line)
        if len(cells) < 3:
            continue
        if cells[0].lower() in {"no.", "no"} or cells[0].startswith("-"):
            if pending_day2 and current and current["day"] == 1 and current["items"]:
                start_day(2, DAY2_THEME)
            continue

        pairs = [(cells[0], cells[1], cells[2])]
        if len(cells) >= 6:
            pairs.append((cells[3], cells[4], cells[5]))

        numbered: list[tuple[int, str, str]] = []
        for num_s, word, meaning in pairs:
            if is_empty(word) or not num_s.isdigit():
                continue
            numbered.append((int(num_s), word, meaning))

        if not numbered:
            continue
        if current is None:
            start_day(1, "채용")
        current["items"].extend(numbered)

    for d in days:
        d["items"].sort(key=lambda x: x[0])
        seen_no: set[int] = set()
        uniq_items = []
        for no, word, meaning in d["items"]:
            if no in seen_no:
                continue
            seen_no.add(no)
            uniq_items.append((no, word, meaning))
        d["items"] = uniq_items
    return days


def dedupe(days: list[dict]) -> tuple[list[dict], list[tuple[str, str, int, int]]]:
    """Return days with unique words, and dropped (word, meaning, first_day, drop_day)."""
    first: dict[str, tuple[str, str, int]] = {}
    dropped: list[tuple[str, str, int, int]] = []
    out: list[dict] = []
    for d in days:
        keep = []
        for no, word, meaning in d["items"]:
            key = norm_key(word)
            if key in first:
                dropped.append((word, meaning, first[key][2], d["day"]))
                continue
            first[key] = (word, meaning, d["day"])
            keep.append((no, word, meaning))
        out.append({"day": d["day"], "theme": d["theme"], "items": keep})
    return out, dropped


def load_app_study_words() -> list[tuple[str, str]]:
    text = TOEIC_JS.read_text(encoding="utf-8")
    m = re.search(
        r"var toeicData = (\{.*\});\s*\n\s*if \(typeof wordsData",
        text,
        re.DOTALL,
    )
    if not m:
        raise RuntimeError("toeicData block not found")
    data = json.loads(m.group(1))
    rows: list[tuple[str, str]] = []
    for week_name in sorted(data, key=lambda k: int(k.replace("week", ""))):
        week = data[week_name]
        for d in range(1, 6):
            day = week.get(str(d), [])
            if not isinstance(day, list):
                continue
            for item in day:
                if isinstance(item, dict) and item.get("word"):
                    mean = item.get("meanings") or []
                    if isinstance(mean, list):
                        mean_s = ", ".join(str(x) for x in mean)
                    else:
                        mean_s = str(mean)
                    rows.append((str(item["word"]), mean_s))
    return rows


def load_voca_txt() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    if not VOCA_TXT.exists():
        return rows
    for line in VOCA_TXT.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        word, meaning = line.split("|", 1)
        rows.append((word.strip(), meaning.strip()))
    return rows


def unique_count(rows: list[tuple[str, str]]) -> tuple[int, int, list[str]]:
    keys = [norm_key(w) for w, _ in rows]
    c = Counter(keys)
    dups = sorted([k for k, n in c.items() if n > 1])
    return len(rows), len(c), dups


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"원본 없음: {SRC}")

    days = parse_hackers(SRC.read_text(encoding="utf-8"))
    raw_total = sum(len(d["items"]) for d in days)
    unique_days, dropped = dedupe(days)
    unique_rows = [(w, m) for d in unique_days for _, w, m in d["items"]]

    app_rows = load_app_study_words() if TOEIC_JS.exists() else []
    app_n, app_u, app_dups = unique_count(app_rows) if app_rows else (0, 0, [])
    txt_rows = load_voca_txt()
    txt_n, txt_u, txt_dups = unique_count(txt_rows) if txt_rows else (0, 0, [])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORDLIST.write_text(
        "\n".join(f"{w}|{m}" for w, m in unique_rows) + "\n",
        encoding="utf-8",
    )

    by_day_lines = [
        f"# 트리거 VOCA 토익 — 고유 표제어 {len(unique_rows)}",
        f"# 원본: 해커스 토익 보카 30일 · 완전 일치 중복 {len(dropped)}개 제거",
        "",
    ]
    for d in unique_days:
        by_day_lines.append(f"## DAY {d['day']:02d} {d['theme']} · {len(d['items'])}단어")
        for no, w, m in d["items"]:
            by_day_lines.append(f"{no}|{w}|{m}")
        by_day_lines.append("")
    BY_DAY.write_text("\n".join(by_day_lines).rstrip() + "\n", encoding="utf-8")

    new_keys = {norm_key(w) for w, _ in unique_rows}
    app_first: dict[str, tuple[str, str]] = {}
    for w, m in app_rows:
        k = norm_key(w)
        if k not in app_first:
            app_first[k] = (w, m)
    only_app = sorted(set(app_first) - new_keys)

    drop_lines = [
        "토익 고유 단어 리스트 리포트",
        "",
        "확정: data/toeic_wordlist.txt  ·  2,013단어 (해커스 30일, 완전 일치 중복 제거)",
        "Day별: data/toeic_wordlist_by_day.txt",
        "",
        "[원본 = 해커스 노랭이 30일]",
        f"파싱 표제어: {raw_total}",
        f"고유 표제어: {len(unique_rows)}",
        f"원본 안 완전 일치 중복: {len(dropped)}",
        f"Day 수: {len(unique_days)}",
        "",
        "[지금 앱 worddata_toeic.js 학습일 1~5]",
        f"슬롯: {app_n}  (고유 {app_u} + 같은 단어 재등장 {app_n - app_u})",
        f"고유 중 해커스 원본에 없는 학생용 추가: {len(only_app)}  (확정 리스트에 넣지 않음)",
        "",
        "[지금 voca_toeic.txt]",
        f"줄: {txt_n}  ·  고유: {txt_u}",
        "",
        "[Day별 고유 수]",
    ]
    for d in unique_days:
        drop_lines.append(f"  DAY {d['day']:02d} {d['theme']}: {len(d['items'])}")
    drop_lines.append("")
    if dropped:
        drop_lines.append("[원본에서 제거한 완전 일치]")
        for word, meaning, first_d, drop_d in dropped:
            drop_lines.append(
                f"  {word} | {meaning}  (유지: Day {first_d} / 삭제: Day {drop_d})"
            )
        drop_lines.append("")
    if only_app:
        drop_lines.append("[앱에만 있던 20개 — 확정 리스트 제외]")
        for k in only_app:
            w, m = app_first[k]
            drop_lines.append(f"  {w} | {m}")
        drop_lines.append("")
    drop_lines.extend(
        [
            "[유지한 철자 다른 짝 예]",
            "  letter of recommendation / recommendation letter / reference letter",
            "  (표제어가 다르면 별개. 뜻만 같아도 합치지 않음)",
            "",
        ]
    )

    REPORT.write_text("\n".join(drop_lines), encoding="utf-8")
    print("\n".join(drop_lines[:20]))
    print(f"wrote {WORDLIST.relative_to(ROOT)}")
    print(f"wrote {BY_DAY.relative_to(ROOT)}")
    print(f"wrote {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e, file=sys.stderr)
        raise
