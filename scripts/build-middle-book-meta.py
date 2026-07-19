"""중등 1,200단어 IPA·한글발음·품사 메타 자동 생성.

수기 검수된 Day 1~3(72개)는 그대로 유지하고, 나머지는 자동 생성.
- IPA: eng-to-ipa
- 한글 발음: CMUdict ARPAbet → 단어장식 한글
- 품사: 뜻 어미 규칙

결과: data/middle_book_meta.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import eng_to_ipa as eng_ipa
import pronouncing

ROOT = Path(__file__).resolve().parents[1]
VOCA_PATH = ROOT / "voca_middle.txt"
OUT_PATH = ROOT / "data" / "middle_book_meta.json"
SAMPLE_SCRIPT = ROOT / "scripts" / "generate-voca-book-b5-sample.py"

# 한글 자모
_CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
_JUNG = list("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
_JONG = [""] + list("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")


def compose(cho: str, jung: str, jong: str = "") -> str:
    return chr(0xAC00 + _CHO.index(cho) * 588 + _JUNG.index(jung) * 28 + _JONG.index(jong))


def load_words(path: Path) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        if "|" not in line:
            raise ValueError(f"{path.name} {line_no}행: '|' 없음")
        word, meaning = line.split("|", 1)
        word, meaning = word.strip(), meaning.strip()
        if not word or not meaning:
            raise ValueError(f"{path.name} {line_no}행: 빈 칸")
        rows.append((word, meaning))
    return rows


def extract_manual_overrides(script_path: Path) -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    src = script_path.read_text(encoding="utf-8")
    ns: dict = {}
    for name in ("MIDDLE_PRON", "POS_MEANINGS"):
        m = re.search(rf"^{name} = (\{{.*?\n\}})", src, re.M | re.S)
        if not m:
            raise ValueError(f"{name} 블록을 찾지 못했습니다.")
        exec(f"{name} = {m.group(1)}", ns)
    return ns["MIDDLE_PRON"], ns["POS_MEANINGS"]


def classify_pos(part: str) -> str:
    p = part.strip()
    if re.search(r"(하다|되다|시키다)$", p):
        return "동"
    if p.endswith("다") and len(p) >= 2:
        return "동"
    if p.endswith("게") or p.endswith("히"):
        return "부"
    if re.search(r"(한|은|운|인|의|적인|있는|없는|로운|스러운|다운)$", p):
        return "형"
    return "명"


def format_pos_meaning(meaning: str) -> str:
    parts = [p.strip() for p in meaning.split(",") if p.strip()]
    if not parts:
        return meaning
    tagged = [(p, classify_pos(p)) for p in parts]
    groups: list[tuple[list[str], str]] = []
    cur_parts = [tagged[0][0]]
    cur_pos = tagged[0][1]
    for text, pos in tagged[1:]:
        if pos == cur_pos:
            cur_parts.append(text)
        else:
            groups.append((cur_parts, cur_pos))
            cur_parts = [text]
            cur_pos = pos
    groups.append((cur_parts, cur_pos))
    return ", ".join(f"{', '.join(ps)} ({pos})" for ps, pos in groups)


# ARPAbet → (초성 후보, 모음 음절들, 종성 후보)
# 모음은 완성 음절 문자열 리스트로 (이중모음은 2음절)
_VOWEL: dict[str, list[str]] = {
    "AA": ["아"],
    "AE": ["애"],
    "AH": ["어"],
    "AO": ["오"],
    "AW": ["아", "우"],
    "AY": ["아", "이"],
    "EH": ["에"],
    "ER": ["어"],
    "EY": ["에", "이"],
    "IH": ["이"],
    "IY": ["이"],
    "OW": ["오"],
    "OY": ["오", "이"],
    "UH": ["우"],
    "UW": ["우"],
}

_ONSET: dict[str, str] = {
    "B": "ㅂ",
    "CH": "ㅊ",
    "D": "ㄷ",
    "DH": "ㄷ",
    "F": "ㅍ",
    "G": "ㄱ",
    "HH": "ㅎ",
    "JH": "ㅈ",
    "K": "ㅋ",
    "L": "ㄹ",
    "M": "ㅁ",
    "N": "ㄴ",
    "P": "ㅍ",
    "R": "ㄹ",
    "S": "ㅅ",
    "SH": "ㅅ",  # + ㅣ 계열에서 시
    "T": "ㅌ",
    "TH": "ㅅ",
    "V": "ㅂ",
    "W": "ㅇ",  # 워/와 처리
    "Y": "ㅇ",  # 여/야 처리
    "Z": "ㅈ",
    "ZH": "ㅈ",
}

_CODA: dict[str, str] = {
    "B": "ㅂ",
    "D": "ㄷ",
    "G": "ㄱ",
    "K": "ㄱ",
    "L": "ㄹ",
    "M": "ㅁ",
    "N": "ㄴ",
    "NG": "ㅇ",
    "P": "ㅂ",
    "T": "ㅅ",  # 영어 어말 t → ㅅ에 가까운 표기(칫/싯)보다 단어장은 보통 열어씀 → 아래에서 처리
    "S": "ㅅ",
    "Z": "ㅅ",
    "F": "ㅍ",
    "V": "ㅂ",
    "CH": "ㅊ",
    "JH": "ㅈ",
}


def _strip_stress(phone: str) -> str:
    return re.sub(r"\d", "", phone)


def arpa_to_korean(phones: list[str]) -> str:
    """CMU ARPAbet → 단어장식 한글 표기."""
    tokens = [_strip_stress(p) for p in phones if _strip_stress(p)]
    out: list[str] = []
    i = 0
    while i < len(tokens):
        # 자음군 수집
        onset: list[str] = []
        while i < len(tokens) and tokens[i] not in _VOWEL:
            onset.append(tokens[i])
            i += 1
        if i >= len(tokens):
            # 자음만 남음 → 으 받침/개음
            for c in onset:
                if c == "NG":
                    out.append(compose("ㅇ", "ㅡ", "ㅇ"))
                else:
                    cho = _ONSET.get(c, "ㅇ")
                    out.append(compose(cho if cho != "ㅇ" else "ㅇ", "ㅡ"))
            break

        vowel = tokens[i]
        if vowel not in _VOWEL:
            # 방어: 예상치 못한 토큰
            i += 1
            continue
        i += 1
        vowel_parts = list(_VOWEL[vowel])

        # 종성 하나 (다음이 자음이고 그 다음이 자음/끝이거나, 단일 coda)
        coda = ""
        if i < len(tokens) and tokens[i] not in _VOWEL:
            # 다음 다음이 모음이면 onset으로 넘김
            if i + 1 >= len(tokens) or tokens[i + 1] in _VOWEL:
                # 어말 또는 다음 음절 onset — 영어 단어장에선 어말 폐쇄음을 여는 경우가 많음
                if i + 1 >= len(tokens) and tokens[i] in {"P", "T", "K", "B", "D", "G", "CH", "JH", "F", "V", "S", "Z", "TH", "DH", "SH", "ZH"}:
                    pass  # coda 없이 다음 루프에서 자음+으
                elif tokens[i] in _CODA and tokens[i] in {"M", "N", "NG", "L"}:
                    coda = _CODA[tokens[i]]
                    i += 1

        # onset 처리: 앞 자음은 '으' 음절, 마지막만 초성
        if not onset:
            cho = "ㅇ"
        else:
            for c in onset[:-1]:
                if c == "S" and onset[-1] in {"P", "T", "K"}:
                    out.append(compose("ㅅ", "ㅡ"))
                elif c in _ONSET:
                    ch = _ONSET[c]
                    out.append(compose(ch if ch != "ㅇ" else "ㅇ", "ㅡ"))
                else:
                    out.append("으")
            last = onset[-1]
            if last == "W":
                # W + vowel → 워/와/위 …
                cho = "ㅇ"
                vowel_parts = _glide_w(vowel)
            elif last == "Y":
                cho = "ㅇ"
                vowel_parts = _glide_y(vowel)
            elif last == "SH":
                cho = "ㅅ"
                # 시 계열
                if vowel_parts == ["이"]:
                    vowel_parts = ["이"]
                elif vowel_parts[0] == "어":
                    vowel_parts = ["여"] + vowel_parts[1:]
            else:
                cho = _ONSET.get(last, "ㅇ")

        # 첫 모음 음절에 초성·종성
        first = vowel_parts[0]
        jung = _hangul_to_jung(first)
        if jung is None:
            out.append(first)
        else:
            # SH+이 = 시
            if onset and onset[-1] == "SH" and jung == "ㅣ":
                out.append(compose("ㅅ", "ㅣ", coda))
            else:
                out.append(compose(cho, jung, coda))
        for extra in vowel_parts[1:]:
            j = _hangul_to_jung(extra)
            out.append(compose("ㅇ", j) if j else extra)

    text = "".join(out)
    # 정리
    for a, b in (
        ("으이", "이"),
        ("으어", "어"),
        ("르어", "러"),
        ("퍼어", "퍼"),
    ):
        text = text.replace(a, b)
    return text


def _hangul_to_jung(syllable: str) -> str | None:
    """'아' 같은 1글자 한글 → 중성."""
    if len(syllable) != 1 or not ("가" <= syllable <= "힣"):
        return None
    code = ord(syllable) - 0xAC00
    return _JUNG[(code % 588) // 28]


def _glide_w(vowel: str) -> list[str]:
    mapping = {
        "AH": ["워"],
        "AA": ["와"],
        "AO": ["워"],
        "UH": ["우"],
        "UW": ["우"],
        "IH": ["위"],
        "IY": ["위"],
        "EH": ["웨"],
        "EY": ["웨", "이"],
        "AY": ["와", "이"],
        "OW": ["워"],
        "ER": ["워"],
    }
    return mapping.get(vowel, ["우"] + _VOWEL.get(vowel, ["어"]))


def _glide_y(vowel: str) -> list[str]:
    mapping = {
        "AH": ["여"],
        "AA": ["야"],
        "AO": ["요"],
        "UH": ["유"],
        "UW": ["유"],
        "IH": ["이"],
        "IY": ["이"],
        "EH": ["예"],
        "EY": ["예", "이"],
        "OW": ["요"],
        "ER": ["여"],
    }
    return mapping.get(vowel, ["이"] + _VOWEL.get(vowel, ["어"]))


def fetch_ipa(word: str) -> str | None:
    parts = re.findall(r"[A-Za-z]+", word.lower())
    if not parts:
        return None
    ipas: list[str] = []
    for part in parts:
        raw = eng_ipa.convert(part)
        if not raw or raw == part or "*" in raw:
            return None
        ipas.append(raw)
    return "/" + " ".join(ipas) + "/"


def fetch_korean(word: str) -> str | None:
    parts = re.findall(r"[A-Za-z]+", word.lower())
    if not parts:
        return None
    kos: list[str] = []
    for part in parts:
        phones_list = pronouncing.phones_for_word(part)
        if not phones_list:
            return None
        kos.append(arpa_to_korean(phones_list[0].split()))
    return " ".join(kos)


def build_meta() -> dict[str, dict[str, str]]:
    words = load_words(VOCA_PATH)
    manual_pron, manual_pos = extract_manual_overrides(SAMPLE_SCRIPT)
    meta: dict[str, dict[str, str]] = {}
    missing: list[str] = []

    for word, meaning in words:
        if word in manual_pron:
            ipa, ko = manual_pron[word]
            source = "manual"
        else:
            ipa = fetch_ipa(word)
            ko = fetch_korean(word)
            if ipa is None or ko is None:
                missing.append(word)
                ipa = ipa or f"/{word}/"
                ko = ko or word
            source = "auto"

        if word in manual_pos:
            meaning_pos = manual_pos[word]
        else:
            meaning_pos = format_pos_meaning(meaning)

        meta[word] = {
            "ipa": ipa,
            "ko": ko,
            "meaning_pos": meaning_pos,
            "source": source,
        }

    if missing:
        print(f"경고: 발음 미검색 {len(missing)}개 (철자 폴백)", file=sys.stderr)
        print(", ".join(missing[:40]), file=sys.stderr)
    return meta


def main() -> None:
    meta = build_meta()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    auto_n = sum(1 for v in meta.values() if v["source"] == "auto")
    print(f"저장: {OUT_PATH} (전체 {len(meta)}, 수기 {len(meta) - auto_n}, 자동 {auto_n})")

    # 수기 72개와 자동 변환 품질 비교(참고용)
    manual_pron, _ = extract_manual_overrides(SAMPLE_SCRIPT)
    same = 0
    samples = []
    for w, (_, manual_ko) in list(manual_pron.items())[:15]:
        auto_ko = fetch_korean(w) or "?"
        ok = auto_ko == manual_ko
        same += int(ok)
        samples.append(f"{w}: 수기={manual_ko} / 자동={auto_ko}")
    Path(ROOT / "data" / "_pron_quality_sample.txt").write_text(
        "\n".join(samples) + f"\n\n앞 15개 일치: {same}/15 (수기는 메타에 그대로 유지)\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
