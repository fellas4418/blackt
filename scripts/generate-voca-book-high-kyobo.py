"""고등 Trigger VOCA 내지 — 중등 교보와 동일 구성(목차·HOW TO·발음·Day·REVIEW·혼동·INDEX·판권).

하루 40단어 = 간지 · STUDY LOG · TEST/PRACTICE(1–20) · TEST/PRACTICE(21–40) → Day당 6쪽.
판형: 교보 188×254 (--bookk 로 부크크 가능).

출력: 단어장 PDF/고등/고등_내지_교보.pdf
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "scripts" / "generate-voca-book-b5-sample.py"
OUT_HIGH = ROOT / "단어장 PDF" / "고등"

HIGH_WORDS_PER_DAY = 40
HIGH_PAGES_PER_DAY = 6  # 간지·로그·T·P·T·P
HIGH_PART = 20
HIGH_RANDOM_SEED = 20260804


def load_book_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("voca_book_b5", SAMPLE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"모듈 로드 실패: {SAMPLE}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["voca_book_b5"] = mod
    spec.loader.exec_module(mod)
    return mod


def load_high_meta(mod: ModuleType) -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    meta_path = ROOT / "data" / "high_book_meta.json"
    pron: dict[str, tuple[str, str]] = dict(mod.HIGH_PRON)
    pos: dict[str, str] = {}
    if not meta_path.exists():
        raise FileNotFoundError(
            f"{meta_path} 없음. 먼저: python scripts/build-high-book-meta.py"
        )
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    for word, row in meta.items():
        pron[word] = (row["ipa"], row["ko"])
        pos[word] = row["meaning_pos"]
    return pron, pos


def apply_high_confusables(mod: ModuleType) -> None:
    path = ROOT / "data" / "high_confusables.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    spelling = []
    for a, ta, b, tb in data["spelling"]:
        spelling.append((a, ta, b, tb))
    derivation = []
    pos_map: dict[str, str] = {}
    for a, pa, b, pb in data["derivation"]:
        derivation.append((a, pa, b, pb))
        pos_map[a] = pa
        pos_map[b] = pb
    mod.CONFUSABLE_SPELLING = spelling
    mod.CONFUSABLE_DERIVATION = derivation
    mod.CONFUSABLE_POS = pos_map
    mod.CONFUSABLE_KO_PRON = {}
    mod.CONFUSABLE_MEANING_OVERRIDE = {}


def first_day_page(*, include_covers: bool) -> int:
    return 5 if include_covers else 4


def build_contents_entries(
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool,
) -> list[tuple[str, int, int, int]]:
    first = first_day_page(include_covers=include_covers)
    return [
        (
            f"DAY {day_no:02d}",
            len(rows),
            first + (day_no - 1) * HIGH_PAGES_PER_DAY,
            first + (day_no - 1) * HIGH_PAGES_PER_DAY + HIGH_PAGES_PER_DAY - 1,
        )
        for day_no, rows in enumerate(days, 1)
    ]


def build_back_matter_note(
    mod: ModuleType,
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool,
) -> str:
    day_count = len(days)
    word_count = sum(len(rows) for rows in days)
    first = first_day_page(include_covers=include_covers)
    round1_end = first + day_count * HIGH_PAGES_PER_DAY - 1
    review_div = round1_end + 1
    review_start = review_div + 1
    review_end = review_start + day_count - 1
    conf_div = review_end + 1
    spelling_pages = mod.confusable_pair_page_count(len(mod.CONFUSABLE_SPELLING))
    derivation_pages = mod.confusable_pair_page_count(len(mod.CONFUSABLE_DERIVATION))
    conf_end = conf_div + spelling_pages + derivation_pages
    index_div = conf_end + 1
    index_end = index_div + mod.index_page_count(word_count)
    return (
        f"REVIEW {review_div}–{review_end}  ·  "
        f"혼동 어휘 {conf_div}–{conf_end}  ·  "
        f"INDEX {index_div}–{index_end}"
    )


def draw_day_block(
    mod: ModuleType,
    c,
    *,
    day_no: int,
    rows: list[tuple[str, str]],
    page_no: int,
    pronunciations: dict[str, tuple[str, str]],
    part_label_prefix: str = "",
) -> int:
    """간지 · LOG · (TEST+PRACTICE)×2. 다음 page_no 반환."""
    mod.draw_day_divider(
        c, level_tag="고등", day_no=day_no, rows=rows, page_no=page_no
    )
    page_no += 1
    mod.draw_day_log_page(
        c,
        level_tag="고등",
        day_no=day_no,
        word_count=len(rows),
        page_no=page_no,
    )
    page_no += 1
    parts = [
        ("1–20", rows[:HIGH_PART], 1),
        ("21–40", rows[HIGH_PART:], 21),
    ]
    for part_label, part_rows, start_index in parts:
        label = f"{part_label_prefix}{part_label}" if part_label_prefix else part_label
        mod.draw_test_page(
            c,
            level_tag="고등",
            day_no=day_no,
            part_label=label,
            rows=part_rows,
            start_index=start_index,
            page_no=page_no,
        )
        page_no += 1
        mod.draw_practice_page(
            c,
            level_tag="고등",
            day_no=day_no,
            part_label=label,
            rows=part_rows,
            pronunciations=pronunciations,
            page_no=page_no,
        )
        page_no += 1
    return page_no


def build_high_days_pdf(
    mod: ModuleType,
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool = False,
    kyobo: bool = True,
) -> Path:
    global_b5_bookk = mod.B5_BOOKK
    if kyobo:
        mod.B5 = mod.B5_KYOBO
        mod.CONFUSABLE_COMPACT = True
    else:
        mod.B5 = global_b5_bookk
        mod.CONFUSABLE_COMPACT = False

    apply_high_confusables(mod)
    pron, pos = load_high_meta(mod)
    mod.POS_MEANINGS = pos

    OUT_HIGH.mkdir(parents=True, exist_ok=True)
    day_count = len(days)
    word_count = sum(len(rows) for rows in days)
    random_days = mod.shuffle_days_for_random_review(days, seed=HIGH_RANDOM_SEED)
    first = first_day_page(include_covers=include_covers)

    if kyobo and not include_covers:
        out_name = "고등_내지_교보.pdf"
    elif kyobo:
        out_name = "고등_교보.pdf"
    else:
        out_name = "고등.pdf" if include_covers else "고등_내지.pdf"
    out_path = mod.resolve_output_path(OUT_HIGH / out_name)

    c = mod.canvas.Canvas(str(out_path), pagesize=mod.B5, pageCompression=1)
    size_note = "교보 B5 188×254" if kyobo else "부크크 B5 182×257"
    c.setTitle(f"트리거 보카 고등 Day 01-{day_count:02d} {size_note}")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject(f"{size_note} 고등 단어장 내지 (1회독 + 랜덤 · 부분컬러=혼동)")
    c.setCreator("TRIGGER VOCA Book Generator")

    conf_color_start = conf_color_end = 0
    if include_covers:
        mod.draw_cover(
            c,
            level_en="HIGH SCHOOL",
            level_ko="고등",
            day_label=f"DAY 01–{day_count:02d} · {word_count} WORDS",
            words_note="1회독 + 랜덤 1회독 · 하루 40단어(20+20).",
        )

    contents_page_no = 2 if include_covers else 1
    contents = build_contents_entries(days, include_covers=include_covers)
    mod.draw_contents_page(
        c,
        level_tag="고등",
        entries=contents,
        page_no=contents_page_no,
        footer_note=build_back_matter_note(mod, days, include_covers=include_covers),
    )
    mod.draw_howto_page(
        c,
        level_tag="고등",
        page_no=contents_page_no + 1,
        words_per_day=HIGH_WORDS_PER_DAY,
    )
    mod.draw_pronunciation_guide(c, level_tag="고등", page_no=contents_page_no + 2)

    page_no = first
    for day_no, rows in enumerate(days, 1):
        page_no = draw_day_block(
            mod, c, day_no=day_no, rows=rows, page_no=page_no, pronunciations=pron
        )

    mod.draw_random_review_divider(
        c,
        level_tag="고등",
        day_count=day_count,
        word_count=word_count,
        page_no=page_no,
    )
    page_no += 1
    # 랜덤: 중등과 같이 Day당 TEST 1장(40단어). 행 높이는 자동 조절.
    for day_no, rows in enumerate(random_days, 1):
        mod.draw_test_page(
            c,
            level_tag="고등",
            day_no=day_no,
            part_label="RANDOM",
            rows=rows,
            start_index=1,
            page_no=page_no,
        )
        page_no += 1

    meanings = {word: meaning for day_rows in days for word, meaning in day_rows}
    if page_no % 2 == 0:
        width, height = mod.B5
        c.setFillColor(mod.white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        mod.draw_page_footer(c, page_no, "고등")
        c.showPage()
        page_no += 1
    mod.draw_confusables_howto_page(c, level_tag="고등", page_no=page_no)
    page_no += 1
    mod.draw_confusables_divider(c, level_tag="고등", page_no=page_no)
    page_no += 1
    conf_color_start = page_no
    page_no = mod.draw_confusables_spelling_page(
        c, level_tag="고등", page_no=page_no, meanings=meanings, pronunciations=pron
    )
    page_no = mod.draw_confusables_derivation_page(
        c, level_tag="고등", page_no=page_no, meanings=meanings, pronunciations=pron
    )
    while (page_no - 1) % 2 == 1:
        width, height = mod.B5
        c.setFillColor(mod.white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        mod.draw_page_footer(c, page_no, "고등")
        c.showPage()
        page_no += 1
    conf_color_end = page_no - 1
    color_pages = conf_color_end - conf_color_start + 1
    if color_pages > 10:
        print(
            f"[경고] 혼동 표 컬러 구간 {color_pages}쪽 (p.{conf_color_start}~{conf_color_end}). "
            "교보 부분컬러 한도 10쪽 초과."
        )

    index_entries = mod.build_word_index_entries(
        days,
        first_day_page=first,
        pages_per_day=HIGH_PAGES_PER_DAY,
    )
    mod.draw_index_divider(
        c, level_tag="고등", word_count=word_count, page_no=page_no
    )
    page_no += 1
    page_no = mod.draw_index_pages(
        c, level_tag="고등", entries=index_entries, start_page_no=page_no
    )
    if kyobo:
        mod.draw_colophon_page(
            c,
            level_tag="고등",
            page_no=page_no,
            title="Trigger VOCA 고등",
            words_line=f"DAY 01–{day_count:02d} · {word_count} WORDS",
            isbn=None,  # 신청 전이면 판권에서 생략
            price="16,000원",
        )
        page_no += 1
    if include_covers:
        mod.draw_back_cover(c)
    c.save()

    if kyobo and not include_covers:
        note = OUT_HIGH / "고등_교보_부분컬러_안내.txt"
        lines = [
            "교보 바로출판 POD — 고등 부분 컬러 요청 안내 (초안)",
            "",
            f"내지 파일: {out_path.name}",
            "판형: 188×254 mm (교보 B5/46배판)",
            f"총 페이지: {page_no - 1}쪽",
            "",
            f"혼동 구간: p.{conf_color_start}~p.{conf_color_end} ({color_pages}쪽)",
            "",
            "혼동 안내·간지 = 흑백 (부분컬러에 포함하지 않음)",
            "배치: 안내(홀수) → 간지(짝수) → 표(홀수~짝수 컬러)",
            "Step2: 내지인쇄 = 흑백",
            "Step5 요청 사항 예시:",
            f"p.{conf_color_start}(홀수페이지)~p.{conf_color_end}(짝수페이지) 부분 컬러 적용 요청",
            "",
            "※ PDF 파일 페이지 순서 기준 (인쇄 쪽번호 아님)",
            "※ 판권 ISBN은 발급 후 반영 예정",
            "※ 표지는 중등과 별도 전개도로 제작",
            "",
        ]
        note.write_text("\n".join(lines), encoding="utf-8")
        print(f"부분컬러 안내: {note}")
        print(f"혼동 구간: p.{conf_color_start}~p.{conf_color_end} ({color_pages}쪽)")

    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bookk", action="store_true", help="부크크 182×257 (기본은 교보)")
    args = parser.parse_args()

    mod = load_book_module()
    mod.register_fonts()

    words = mod.load_words(ROOT / "voca_high.txt")
    days = mod.chunk_days(words, HIGH_WORDS_PER_DAY)
    pron, _ = load_high_meta(mod)
    for day_rows in days:
        mod.validate_pronunciations(day_rows, pron)

    path = build_high_days_pdf(mod, days, include_covers=False, kyobo=not args.bookk)
    print(f"고등 B5 내지: {path}")


if __name__ == "__main__":
    main()
