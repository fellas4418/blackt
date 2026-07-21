# -*- coding: utf-8 -*-
"""김노이 토익 오답노트 — week1 day 1~4 임시 교체 (원본은 backup JSON에 보관)."""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOEIC_JS = os.path.join(ROOT, "worddata_toeic.js")
BACKUP_JSON = os.path.join(ROOT, "data", "toeic_week1_days1-4_official_backup.json")

NOTE_DAYS = {
    "1": [
        ("preparing", "준비하다"),
        ("hint", "기미, 약간"),
        ("addition", "추가, 보탬"),
        ("get in touch with", "~에게 연락하다"),
        ("Supplier", "공급업체"),
        ("regular", "정기적인"),
        ("inquire", "문의하다"),
        ("Consult", "상의하다, 참고하다"),
        ("Spend", "쓰다"),
        ("Subscription", "구독"),
        ("expert", "전문가, 전문가의"),
        ("Summary", "요약(본)"),
        ("useful", "유용한"),
        ("clinical practice Work", "임상실무"),
        ("accounting", "회계"),
        ("development", "발달"),
        ("Convenient", "편리한"),
        ("ancient", "고대의"),
        ("Civilization", "문명"),
        ("accurate", "정확한"),
        ("registered", "등록하다"),
        ("Convention", "관습, 대회"),
        ("fund-raising", "모금"),
        ("merger", "합병"),
        ("launch", "출시, 공개"),
        ("Promote", "승진시키다, 홍보하다"),
        ("Opportunity", "기회"),
        ("advertising", "광고"),
        ("article", "기사"),
        ("Come up with", "~을 만들어내다, ~을 제안하다"),
        ("Suggestion", "의견, 제안"),
        ("Immediately", "즉시"),
        ("finalize", "확정하다, 마무리하다"),
        ("trail", "산책로, 코스"),
        ("Run out of", "~이 다 떨어지다, ~을 다 쓰다"),
        ("Concerned", "걱정하는"),
        ("reserve", "예약하다"),
        ("Possible", "가능성"),
        ("Motivate", "동기를 부여하다"),
        ("Announcement", "안내, 공지"),
    ],
    "2": [
        ("Specific", "특정한, 구체적인"),
        ("as opposed to", "~와 달리, ~와 대비하여"),
        ("lab", "실험실"),
        ("Practical", "실무의"),
        ("analyze", "분석하다"),
        ("Instead", "대신에"),
        ("Vendor", "노점상, 판매업체"),
        ("According to", "~에 따르면"),
    ],
    "3": [
        ("Shift", "교대근무"),
        ("Close down", "중단하다, 폐쇄하다"),
        ("management", "경영진"),
        ("assembly", "조립"),
        ("automatically", "자동으로"),
        ("operation", "작동, 가동"),
        ("respond to", "~에 답변하다"),
        ("distribute", "배부하다, 나눠주다"),
        ("authorize", "승인하다, 권한을 부여하다"),
        ("Conduct", "실시하다"),
        ("upcoming", "다가오는, 곧 있을"),
        ("Choreograph", "안무를 짜다"),
        ("piece", "작품"),
        ("re Cover", "회복하다"),
        ("in charge of", "~을 담당하는"),
        ("last-minute", "최후의, 막바지의"),
        ("alteration", "수정, 변경"),
        ("Compliment ~ on", "~에 대해 ~을 칭찬하다"),
        ("margin", "여유, 여지"),
        ("adjustment", "조정"),
        ("high-profile", "세간의 이목을 끄는"),
        ("broad cast", "방송하다"),
        ("be bound to", "틀림없이 ~하게 될 것이다"),
        ("in demand", "수요가 많은"),
        ("renovation", "개조, 보수"),
        ("approve", "승인하다"),
        ("extend", "(환영, 감사 등을) 전하다"),
        ("onboarding", "신규 입사자 교육"),
        ("present", "현재의"),
        ("certainly", "분명히"),
        ("achievement", "업적, 성취, 달성"),
        ("excuse", "핑계, 변명"),
        ("renowned", "명성 있는, 유명한"),
        ("get Situated", "준비하다, 자리를 잡다"),
        ("inconvenience", "불편함"),
        ("Significance", "의의, 중요성"),
        ("Conductor", "(버스, 기차의) 승무원"),
        ("refrain from -ing", "~하는 것을 삼가하다"),
        ("resource", "자원, 자산"),
        ("Conservation", "보존, 보호"),
    ],
    "4": [
        ("priority", "우선순위"),
        ("Currently", "현재의"),
        ("urban", "도시의"),
        ("Join forces", "제휴하다, 협력하다"),
        ("Suburban", "교외의"),
        ("accommodate", "수용하다, 공간을 제공하다"),
        ("environmentally friendly", "친환경적인"),
        ("renovate", "개조하다, 보수하다"),
        ("Certification", "자격증"),
        ("Publish", "발표하다, 출판하다"),
        ("attract", "끌어들이다"),
        ("promotion", "판촉(행사), 홍보"),
        ("propose", "제안하다"),
        ("merger", "합병, 통합"),
        ("Committee", "위원회"),
        ("award Winner", "수상자"),
        ("organization", "단체, 기관"),
        ("advertise", "광고하다"),
    ],
}


def to_entries(pairs):
    return [{"word": w, "meanings": [m]} for w, m in pairs]


def format_day_js(entries, indent="    "):
    lines = [f'{indent}"{{day_key}}": ['.replace("{day_key}", "")]  # noqa - will fix
    # simpler approach below
    pass


def format_day_block(day_key: str, entries: list[dict], indent: str = "    ") -> str:
    inner = indent + "  "
    parts = [f'{indent}"{day_key}": [']
    for i, e in enumerate(entries):
        word = json.dumps(e["word"], ensure_ascii=False)
        meaning = json.dumps(e["meanings"][0], ensure_ascii=False)
        comma = "," if i < len(entries) - 1 else ""
        parts.append(f"{inner}{{")
        parts.append(f'{inner}  "word": {word},')
        parts.append(f'{inner}  "meanings": [')
        parts.append(f"{inner}    {meaning}")
        parts.append(f"{inner}  ]")
        parts.append(f"{inner}}}{comma}")
    parts.append(f"{indent}],")
    return "\n".join(parts)


def load_toeic_data(js_text: str) -> dict:
    m = re.search(r"var toeicData = (\{.*\});\s*\n\s*if \(typeof wordsData", js_text, re.DOTALL)
    if not m:
        raise RuntimeError("toeicData block not found")
    return json.loads(m.group(1))


def main():
    with open(TOEIC_JS, encoding="utf-8") as f:
        js_text = f.read()

    data = load_toeic_data(js_text)
    week1 = data.get("week1") or {}

    backup = {k: week1.get(k) for k in ("1", "2", "3", "4")}
    os.makedirs(os.path.dirname(BACKUP_JSON), exist_ok=True)
    with open(BACKUP_JSON, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, indent=2)
    print("backup saved:", BACKUP_JSON)

    for day_key, pairs in NOTE_DAYS.items():
        week1[day_key] = to_entries(pairs)
    data["week1"] = week1

    new_days_block = "\n".join(format_day_block(k, week1[k]) for k in ("1", "2", "3", "4"))

    pattern = re.compile(
        r'(\s*"week1": \{\n)\s*"1": \[[\s\S]*?\],\s*"2": \[[\s\S]*?\],\s*"3": \[[\s\S]*?\],\s*"4": \[[\s\S]*?\],',
        re.MULTILINE,
    )
    if not pattern.search(js_text):
        raise RuntimeError("week1 days 1-4 block not found for replace")

    replacement = r"\1" + new_days_block.rstrip(",") + ","
    new_js = pattern.sub(replacement, js_text, count=1)

    with open(TOEIC_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_js)

    total = sum(len(v) for v in NOTE_DAYS.values())
    print("patched", TOEIC_JS)
    print("note words:", total, "days:", {k: len(v) for k, v in NOTE_DAYS.items()})


if __name__ == "__main__":
    main()
