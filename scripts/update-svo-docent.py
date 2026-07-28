# -*- coding: utf-8 -*-
"""Update ch01 intro + svo (주·서·목) only."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "pattern_index.json"
SVO = ROOT / "data" / "patterns" / "svo.json"


def step(eng, tokens, slots):
    return {"eng": eng, "eng_tokens": tokens, "kor_slots": slots}


def slot(word, particle, role, rule):
    return {"word": word, "particle": particle, "role": role, "rule": rule}


def kor_s(word, p="는"):
    return [slot(word, p, "주어", "은/는")]


def kor_o(word, p="를"):
    return [slot(word, p, "목적어", "을/를")]


def kor_v(word):
    return [slot(word, "", "서술어", "-다")]


index = json.loads(INDEX.read_text(encoding="utf-8"))
ch01 = index["chapters"][0]

ch01["docent"] = [
    {
        "role": "독해",
        "reveal": "lines",
        "text_parts": [
            {
                "text": "영어 문장에서 「역할」을 의미하는 문장성분에는 네 가지가 있습니다.\n\n"
            },
            {
                "text": "1. 주어 — 누가 (은/는/이/가)\n\n2. 서술어 — 무엇을 한다 (~다)\n\n3. 목적어 — 무엇을 (을/를)\n\n4. 주격 보어 — 주어의 상태·정체를 보충\n\n5. 목적격 보어 — 목적어의 상태·정체를 보충",
                "mark": "paren",
            },
        ],
    },
    {
        "role": "세 가지 모양",
        "reveal": "lines",
        "text_parts": [
            {"text": "문장 구조는 세 가지입니다.\n\n"},
            {
                "text": "1. 주어 - 서술어 - (목적어)\n\n2. 주어 - 서술어 - (주격 보어)\n\n3. 주어 - 서술어 - (목적어 - 목적격 보어)",
                "mark": "paren",
            },
        ],
    },
    {
        "role": "복습",
        "reveal": "lines",
        "replay_lines": True,
        "blink_paren": True,
        "text_parts": [
            {"text": "다시 한번 복습합니다.\n\n"},
            {
                "text": "1. 주어 - 서술어 - (목적어)\n\n2. 주어 - 서술어 - (주격 보어)\n\n3. 주어 - 서술어 - (목적어 - 목적격 보어)",
                "mark": "paren",
            },
        ],
    },
]

ch01["docent_bridge"] = (
    "첫번째 주어 - 서술어 - 목적어부터 살펴 봅니다.\n\n"
    "주어: (누가)\n\n"
    "서술어: (-다)\n\n"
    "목적어: (무엇을)\n\n"
    "다시 한번 복습합니다."
)
# bridge needs special flags - store as structured on chapter
ch01["docent_bridge_meta"] = {
    "reveal": "lines",
    "replay_lines": True,
    "blink_paren": True,
    "text_parts": [
        {"text": "첫번째 주어 - 서술어 - 목적어부터 살펴 봅니다.\n\n"},
        {
            "text": "주어: (누가)\n\n서술어: (-다)\n\n목적어: (무엇을)",
            "mark": "paren",
        },
        {"text": "\n\n다시 한번 복습합니다."},
    ],
    "replay_parts": [
        {"text": "주어: (누가)\n\n서술어: (-다)\n\n목적어: (무엇을)", "mark": "paren"}
    ],
}

svo = {
    "id": "svo",
    "chapter": "01",
    "title": "주·동·목",
    "subtitle": "누가 · -하다 · 무엇을",
    "roles": ["s", "v", "o"],
    "docent": [
        {
            "role": "패턴",
            "layout": "map",
            "parts": [
                {"text": "People", "mark": "s"},
                {"text": " "},
                {"text": "want", "mark": "v"},
                {"text": " "},
                {"text": "love", "mark": "o"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "사람"},
                {"text": "은", "mark": "s"},
                {"text": " "},
                {"text": "사랑"},
                {"text": "을", "mark": "o"},
                {"text": " "},
                {"text": "원하"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "map_cols": [
                {"eng": "People", "particle": "은/는/이/가", "mark": "s"},
                {"eng": "want", "particle": "-다", "mark": "v"},
                {"eng": "love", "particle": "을/를", "mark": "o"},
            ],
            "text_parts": [
                {"text": "주어 - 서술어 - "},
                {"text": "목적어", "mark": "o"},
                {"text": " 형태의 예문입니다."},
            ],
        },
        {
            "role": "연습",
            "parts": [
                {"text": "People", "mark": "s"},
                {"text": " "},
                {"text": "want", "mark": "v"},
                {"text": " "},
                {"text": "love", "mark": "o"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "사람"},
                {"text": "은", "mark": "s"},
                {"text": " "},
                {"text": "사랑"},
                {"text": "을", "mark": "o"},
                {"text": " "},
                {"text": "원하"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {
                    "text": "주어 → 서술어 → 목적어 순으로, 한 자리씩만 바꿔 보며 해석합니다."
                }
            ],
        },
    ],
    "docent_bridge": "주·동·목 모양을 익혔습니다.\n다음은 주·동·보입니다.",
    "guide": ["주어 → 은/는/이/가", "목적어 → 을/를", "서술어 → ~다"],
    "rolling": [
        {
            "title": "주어",
            "focus": "s",
            "particle_hint": "은/는/이/가",
            "caption": "주어만 바뀝니다. 주어에는 은/는/이/가를 붙입니다.",
            "items": [
                step(
                    "People want love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("원한다"),
                ),
                step(
                    "Dogs want love.",
                    [
                        {"text": "Dogs", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("강아지") + kor_o("사랑") + kor_v("원한다"),
                ),
                step(
                    "Kids want love.",
                    [
                        {"text": "Kids", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("아이") + kor_o("사랑") + kor_v("원한다"),
                ),
                step(
                    "Mario wants love.",
                    [
                        {"text": "Mario", "maps": 0, "role": "s"},
                        {"text": "wants", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("마리오") + kor_o("사랑") + kor_v("원한다"),
                ),
            ],
        },
        {
            "title": "서술어",
            "focus": "v",
            "particle_hint": "-다",
            "caption": "서술어만 바뀝니다. 서술어는 항상 ~다로 끝냅니다.",
            "items": [
                step(
                    "People want love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("원한다"),
                ),
                step(
                    "People hate love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "hate", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("싫어한다"),
                ),
                step(
                    "People need love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "need", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("필요하다"),
                ),
                step(
                    "People like love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "like", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("좋아한다"),
                ),
            ],
        },
        {
            "title": "목적어",
            "focus": "o",
            "particle_hint": "을/를",
            "caption": "목적어만 바뀝니다. 목적어에는 을/를을 붙입니다.",
            "items": [
                step(
                    "People want love.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "love", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("사랑") + kor_v("원한다"),
                ),
                step(
                    "People want peace.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "peace", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("평화") + kor_v("원한다"),
                ),
                step(
                    "People want freedom.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "freedom", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("자유") + kor_v("원한다"),
                ),
                step(
                    "People want music.",
                    [
                        {"text": "People", "maps": 0, "role": "s"},
                        {"text": "want", "maps": 2, "role": "v"},
                        {"text": "music", "maps": 1, "role": "o"},
                    ],
                    kor_s("사람") + kor_o("음악", "을") + kor_v("원한다"),
                ),
            ],
        },
    ],
    "steps": [],
    "next": {"id": "svc", "title": "주·동·보", "ready": True},
}

INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
SVO.write_text(json.dumps(svo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("updated pattern_index + svo")
