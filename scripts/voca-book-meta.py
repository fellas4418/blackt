"""교보 단어장 — 레벨별 서지·표지 메타 (ISBN·발행일·정식명)."""

from __future__ import annotations

from typing import TypedDict


class LevelBookMeta(TypedDict):
    level: str
    formal_title: str
    main_title: str
    subtitle: str
    isbn_hyphen: str
    isbn_digits: str
    pub_date: str
    price_label: str
    price_colophon: str
    day_label_cover: str
    words_line_colophon: str


# 중등 — 교보 등록 완료 (2026-07-31)
MIDDLE_KYOBO: LevelBookMeta = {
    "level": "중등",
    "formal_title": "트리거 VOCA 중등",
    "main_title": "트리거 VOCA",
    "subtitle": "Trigger VOCA",
    "isbn_hyphen": "979-11-993384-0-1",
    "isbn_digits": "9791199338401",
    "pub_date": "2026년 7월 31일",
    "price_label": "값 16,000원",
    "price_colophon": "16,000원",
    "day_label_cover": "DAY 01–50 · 1200 WORDS",
    "words_line_colophon": "Trigger VOCA · DAY 01–50 · 1,200 WORDS",
}

# 고등 — ISBN 979-11-993384-1-8 · 정가 19,000원 · 발행일 2026-08-18
HIGH_KYOBO: LevelBookMeta = {
    "level": "고등",
    "formal_title": "트리거 VOCA 고등",
    "main_title": "트리거 VOCA",
    "subtitle": "Trigger VOCA",
    "isbn_hyphen": "979-11-993384-1-8",
    "isbn_digits": "9791199338418",
    "pub_date": "2026년 8월 18일",
    "price_label": "값 19,000원",
    "price_colophon": "19,000원",
    "day_label_cover": "DAY 01–50 · 2000 WORDS",
    "words_line_colophon": "Trigger VOCA · DAY 01–50 · 2,000 WORDS",
}


def meta_for_level(level: str) -> LevelBookMeta:
    if level == "고등":
        return HIGH_KYOBO
    return MIDDLE_KYOBO
