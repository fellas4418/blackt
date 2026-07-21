# -*- coding: utf-8 -*-
"""LC 오답노트 별도 트랙: worddata_toeic_note.js 생성 + 공식 week1 Day1~4 원복."""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import importlib.util

_patch_path = os.path.join(ROOT, "scripts", "patch-toeic-note-week1.py")
_spec = importlib.util.spec_from_file_location("patch_toeic_note_week1", _patch_path)
_patch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_patch)
NOTE_DAYS = _patch.NOTE_DAYS
format_day_block = _patch.format_day_block
to_entries = _patch.to_entries

TOEIC_JS = os.path.join(ROOT, "worddata_toeic.js")
NOTE_JS = os.path.join(ROOT, "worddata_toeic_note.js")
BACKUP_JSON = os.path.join(ROOT, "data", "toeic_week1_days1-4_official_backup.json")


def restore_official_week1(js_text: str, backup: dict) -> str:
    new_days_block = "\n".join(format_day_block(k, backup[k]) for k in ("1", "2", "3", "4"))
    pattern = re.compile(
        r'(\s*"week1": \{\n)\s*"1": \[[\s\S]*?\],\s*"2": \[[\s\S]*?\],\s*"3": \[[\s\S]*?\],\s*"4": \[[\s\S]*?\],',
        re.MULTILINE,
    )
    if not pattern.search(js_text):
        raise RuntimeError("week1 days 1-4 block not found for restore")
    return pattern.sub(r"\1" + new_days_block.rstrip(",") + ",", js_text, count=1)


def build_note_js() -> str:
    week1 = {k: to_entries(v) for k, v in NOTE_DAYS.items()}
    data = {"week1": week1}
    inner = json.dumps(data, ensure_ascii=False, indent=2)
    inner = inner.replace('"week1"', '"week1"', 1)
    lines = [
        "(function () {",
        "  var toeicNoteData = " + inner + ";",
        '  if (typeof wordsData !== "undefined") {',
        "    wordsData.toeic_note = toeicNoteData;",
        "  } else if (typeof window !== \"undefined\") {",
        "    window.wordsData = window.wordsData || {};",
        "    window.wordsData.toeic_note = toeicNoteData;",
        "  }",
        "})();",
        "",
    ]
    return "\n".join(lines)


def main():
    if not os.path.isfile(BACKUP_JSON):
        raise SystemExit("backup missing: " + BACKUP_JSON)

    with open(BACKUP_JSON, encoding="utf-8") as f:
        backup = json.load(f)

    with open(TOEIC_JS, encoding="utf-8") as f:
        js_text = f.read()

    restored = restore_official_week1(js_text, backup)
    with open(TOEIC_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(restored)
    print("restored official week1 day1-4:", TOEIC_JS)

    note_js = build_note_js()
    with open(NOTE_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(note_js)
    total = sum(len(v) for v in NOTE_DAYS.values())
    print("wrote", NOTE_JS, "words:", total)


if __name__ == "__main__":
    main()
