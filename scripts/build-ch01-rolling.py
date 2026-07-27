# -*- coding: utf-8 -*-
"""Chapter 01 patterns: minimal docent + rolling drills."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "patterns"
INDEX = ROOT / "data" / "pattern_index.json"


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


def kor_c(word, p="이"):
    return [slot(word, p, "보어", "이/가")]


def kor_c_게(stem):
    return [slot(stem, "게", "보어", "게")]


def kor_c_라고(stem):
    return [slot(stem, "라고", "보어", "라고")]


def kor_c_다고(stem):
    return [slot(stem, "다고", "보어", "다고")]


svo = {
    "id": "svo",
    "chapter": "01",
    "title": "주·동·목",
    "subtitle": "누가 · -하다 · 무엇을",
    "roles": ["s", "v", "o"],
    "docent": [
        {
            "role": "패턴",
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
                {"text": "1번 모양입니다.\n\n"},
                {"text": "People", "mark": "s"},
                {"text": " "},
                {"text": "want", "mark": "v"},
                {"text": " "},
                {"text": "love", "mark": "o"},
                {"text": ".\n색만 따라가 보세요."},
            ],
        },
        {
            "role": "독해 공식",
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
            "text_parts": [{"text": "읽는 공식: 누가 · -하다 · 무엇을"}],
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
                    "text": "이제 주어 → 서술어 → 목적어 순으로, 한 자리씩만 바꿔 보며 읽습니다.\n해석을 잠깐 보여 준 뒤 가립니다. 탭하면 다시 나옵니다."
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
            ],
        },
    ],
    "steps": [],
    "next": {"id": "svc", "title": "주·동·보", "ready": True},
}

svc = {
    "id": "svc",
    "chapter": "01",
    "title": "주·동·보",
    "subtitle": "누가 · (되다) · 무엇이",
    "roles": ["s", "v", "c"],
    "docent": [
        {
            "role": "패턴",
            "parts": [
                {"text": "Mario", "mark": "s"},
                {"text": " "},
                {"text": "became", "mark": "v"},
                {"text": " "},
                {"text": "a hero", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "마리오"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "영웅"},
                {"text": "이", "mark": "c"},
                {"text": " "},
                {"text": "되었"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {"text": "2번 모양입니다.\n\n"},
                {"text": "Mario", "mark": "s"},
                {"text": " "},
                {"text": "became", "mark": "v"},
                {"text": " "},
                {"text": "a hero", "mark": "c"},
                {"text": ".\n색만 따라가 보세요."},
            ],
        },
        {
            "role": "독해 공식",
            "parts": [
                {"text": "Mario", "mark": "s"},
                {"text": " "},
                {"text": "became", "mark": "v"},
                {"text": " "},
                {"text": "a hero", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "마리오"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "영웅"},
                {"text": "이", "mark": "c"},
                {"text": " "},
                {"text": "되었"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [{"text": "읽는 공식: 누가 · (되다) · 무엇이"}],
        },
        {
            "role": "주격보어",
            "parts": [
                {"text": "You", "mark": "s"},
                {"text": " "},
                {"text": "look", "mark": "v"},
                {"text": " "},
                {"text": "happy", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "너"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "행복"},
                {"text": "이", "mark": "c"},
                {"text": " "},
                {"text": "보인"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {"text": "보어는 "},
                {"text": "주어", "mark": "s"},
                {"text": "의 상태·정체를 설명합니다.\n그래서 "},
                {"text": "주격보어", "mark": "c"},
                {"text": "라고 부릅니다.\n이제 보어만 바꿔 봅니다."},
            ],
        },
    ],
    "docent_bridge": "주·동·보 모양을 익혔습니다.\n다음은 주·동·목·보입니다.",
    "guide": ["주어 → 은/는", "보어 → 이/가", "서술어 → ~다"],
    "rolling": [
        {
            "title": "주격보어",
            "focus": "c",
            "particle_hint": "이/가",
            "caption": "보어만 바뀝니다. 주어의 상태·정체를 설명하므로 주격보어입니다.",
            "items": [
                step(
                    "Mario became a hero.",
                    [
                        {"text": "Mario", "maps": 0, "role": "s"},
                        {"text": "became", "maps": 2, "role": "v"},
                        {"text": "a hero", "maps": 1, "role": "c"},
                    ],
                    kor_s("마리오") + kor_c("영웅") + kor_v("되었다"),
                ),
                step(
                    "Luna became a singer.",
                    [
                        {"text": "Luna", "maps": 0, "role": "s"},
                        {"text": "became", "maps": 2, "role": "v"},
                        {"text": "a singer", "maps": 1, "role": "c"},
                    ],
                    kor_s("루나") + kor_c("가수", "가") + kor_v("되었다"),
                ),
                step(
                    "She became happy.",
                    [
                        {"text": "She", "maps": 0, "role": "s"},
                        {"text": "became", "maps": 2, "role": "v"},
                        {"text": "happy", "maps": 1, "role": "c"},
                    ],
                    kor_s("그녀") + kor_c("행복") + kor_v("되었다"),
                ),
                step(
                    "You look happy.",
                    [
                        {"text": "You", "maps": 0, "role": "s"},
                        {"text": "look", "maps": 2, "role": "v"},
                        {"text": "happy", "maps": 1, "role": "c"},
                    ],
                    kor_s("너") + kor_c("행복") + kor_v("보인다"),
                ),
                step(
                    "The milk went bad.",
                    [
                        {"text": "The milk", "maps": 0, "role": "s"},
                        {"text": "went", "maps": 2, "role": "v"},
                        {"text": "bad", "maps": 1, "role": "c"},
                    ],
                    kor_s("우유") + kor_c("상함") + kor_v("되었다"),
                ),
            ],
        }
    ],
    "steps": [],
    "next": {"id": "svoc", "title": "주·동·목·보", "ready": True},
}

svoc = {
    "id": "svoc",
    "chapter": "01",
    "title": "주·동·목·보",
    "subtitle": "누가 · -하다 · 무엇을 · ~하게/으로",
    "roles": ["s", "v", "o", "c"],
    "docent": [
        {
            "role": "패턴",
            "parts": [
                {"text": "Mom", "mark": "s"},
                {"text": " "},
                {"text": "made", "mark": "v"},
                {"text": " "},
                {"text": "me", "mark": "o"},
                {"text": " "},
                {"text": "happy", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "엄마"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "나"},
                {"text": "를", "mark": "o"},
                {"text": " "},
                {"text": "행복하"},
                {"text": "게", "mark": "c"},
                {"text": " "},
                {"text": "만들"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {"text": "3번 모양입니다.\n\n"},
                {"text": "Mom", "mark": "s"},
                {"text": " "},
                {"text": "made", "mark": "v"},
                {"text": " "},
                {"text": "me", "mark": "o"},
                {"text": " "},
                {"text": "happy", "mark": "c"},
                {"text": ".\n색만 따라가 보세요."},
            ],
        },
        {
            "role": "독해 공식",
            "parts": [
                {"text": "Mom", "mark": "s"},
                {"text": " "},
                {"text": "made", "mark": "v"},
                {"text": " "},
                {"text": "me", "mark": "o"},
                {"text": " "},
                {"text": "happy", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "엄마"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "나"},
                {"text": "를", "mark": "o"},
                {"text": " "},
                {"text": "행복하"},
                {"text": "게", "mark": "c"},
                {"text": " "},
                {"text": "만들"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {"text": "읽는 공식: 누가 · -하다 · 무엇을 · ~하게/으로"}
            ],
        },
        {
            "role": "목적격보어",
            "parts": [
                {"text": "I", "mark": "s"},
                {"text": " "},
                {"text": "keep", "mark": "v"},
                {"text": " "},
                {"text": "my room", "mark": "o"},
                {"text": " "},
                {"text": "clean", "mark": "c"},
                {"text": "."},
            ],
            "kor_parts": [
                {"text": "나"},
                {"text": "는", "mark": "s"},
                {"text": " "},
                {"text": "내 방"},
                {"text": "을", "mark": "o"},
                {"text": " "},
                {"text": "깨끗하"},
                {"text": "게", "mark": "c"},
                {"text": " "},
                {"text": "유지한"},
                {"text": "다", "mark": "v"},
                {"text": "."},
            ],
            "text_parts": [
                {"text": "보어는 "},
                {"text": "목적어", "mark": "o"},
                {"text": "의 상태를 설명합니다.\n그래서 "},
                {"text": "목적격보어", "mark": "c"},
                {"text": "입니다.\nkeep it clean → it(목적어)이 clean(깨끗한) 상태라는 뜻입니다."},
            ],
        },
    ],
    "docent_bridge": "문장 성분 연습을 마쳤습니다.",
    "guide": [
        "주어 → 은/는",
        "목적어 → 을/를",
        "목적격보어 → ~하게/~이라고",
        "서술어 → ~다",
    ],
    "rolling": [
        {
            "title": "목적어",
            "focus": "o",
            "particle_hint": "을/를",
            "caption": "목적어만 바뀝니다. clean은 그대로 — 목적어의 상태를 설명합니다.",
            "items": [
                step(
                    "I keep my room clean.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "my room", "maps": 1, "role": "o"},
                        {"text": "clean", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("내 방", "을") + kor_c_게("깨끗하") + kor_v("유지한다"),
                ),
                step(
                    "I keep the door clean.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "the door", "maps": 1, "role": "o"},
                        {"text": "clean", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("문", "을") + kor_c_게("깨끗하") + kor_v("유지한다"),
                ),
                step(
                    "I keep it clean.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "it", "maps": 1, "role": "o"},
                        {"text": "clean", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("그것", "을") + kor_c_게("깨끗하") + kor_v("유지한다"),
                ),
            ],
        },
        {
            "title": "목적격보어",
            "focus": "c",
            "particle_hint": "~하게",
            "caption": "목적격보어만 바뀝니다. my room은 그대로 — 방의 상태가 바뀝니다.",
            "items": [
                step(
                    "I keep my room clean.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "my room", "maps": 1, "role": "o"},
                        {"text": "clean", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("내 방", "을") + kor_c_게("깨끗하") + kor_v("유지한다"),
                ),
                step(
                    "I keep my room tidy.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "my room", "maps": 1, "role": "o"},
                        {"text": "tidy", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("내 방", "을") + kor_c_게("정돈되") + kor_v("유지한다"),
                ),
                step(
                    "I keep my room open.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "my room", "maps": 1, "role": "o"},
                        {"text": "open", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("내 방", "을") + kor_c_게("열린") + kor_v("유지한다"),
                ),
            ],
        },
        {
            "title": "동사",
            "focus": "v",
            "particle_hint": "keep / call / find",
            "caption": "동사만 바뀝니다. 목적어·보어 패턴은 같습니다.",
            "items": [
                step(
                    "I keep my room clean.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "keep", "maps": 3, "role": "v"},
                        {"text": "my room", "maps": 1, "role": "o"},
                        {"text": "clean", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("내 방", "을") + kor_c_게("깨끗하") + kor_v("유지한다"),
                ),
                step(
                    "They call him Tyson.",
                    [
                        {"text": "They", "maps": 0, "role": "s"},
                        {"text": "call", "maps": 3, "role": "v"},
                        {"text": "him", "maps": 1, "role": "o"},
                        {"text": "Tyson", "maps": 2, "role": "c"},
                    ],
                    kor_s("그들", "은") + kor_o("그", "를") + kor_c_라고("타이슨이") + kor_v("부른다"),
                ),
                step(
                    "I found the test easy.",
                    [
                        {"text": "I", "maps": 0, "role": "s"},
                        {"text": "found", "maps": 3, "role": "v"},
                        {"text": "the test", "maps": 1, "role": "o"},
                        {"text": "easy", "maps": 2, "role": "c"},
                    ],
                    kor_s("나") + kor_o("그 시험", "을") + kor_c_다고("쉽") + kor_v("알았다"),
                ),
                step(
                    "Mom made me happy.",
                    [
                        {"text": "Mom", "maps": 0, "role": "s"},
                        {"text": "made", "maps": 3, "role": "v"},
                        {"text": "me", "maps": 1, "role": "o"},
                        {"text": "happy", "maps": 2, "role": "c"},
                    ],
                    kor_s("엄마") + kor_o("나", "를") + kor_c_게("행복하") + kor_v("만들었다"),
                ),
            ],
        },
    ],
    "steps": [],
    "next": {"id": "verb_s3", "title": "3인칭 단수 -s", "ready": True},
}

index = json.loads(INDEX.read_text(encoding="utf-8"))
ch01 = index["chapters"][0]
ch01["docent"] = [
    {
        "role": "독해",
        "text": "영어 문장은 먼저 네 가지 성분으로 읽습니다.\n\n지금부터 그 방법을 익혀 봅시다.",
    },
    {
        "role": "문장 성분",
        "text_parts": [
            {"text": "네 가지 성분입니다.\n\n"},
            {"text": "1. "},
            {"text": "주어", "mark": "s"},
            {"text": " — 누가 (은/는/이/가)\n2. "},
            {"text": "서술어", "mark": "v"},
            {"text": " — 무엇을 한다 (~다)\n3. "},
            {"text": "목적어", "mark": "o"},
            {"text": " — 무엇을 (을/를)\n4. "},
            {"text": "보어", "mark": "c"},
            {"text": " — 상태·정체 보충 (이/가, ~하게)"},
        ],
    },
    {
        "role": "세 가지 모양",
        "text_parts": [
            {"text": "문장 모양은 세 가지입니다.\n\n"},
            {
                "text": "1. 누가 · -하다 · 무엇을\n2. 누가 · (되다) · 무엇이\n3. 누가 · -하다 · 무엇을 · ~하게",
                "mark": "forms",
            },
        ],
    },
]
ch01["docent_bridge"] = "1번 모양부터 볼게요.\n누가 · -하다 · 무엇을"

for name, data in [("svo.json", svo), ("svc.json", svc), ("svoc.json", svoc)]:
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("written svo/svc/svoc + pattern_index")
