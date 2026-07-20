"""중등·고등 보카 종이책 B5 샘플 PDF.

중등: 하루 24개 → 1회독(간지·STUDY LOG·TEST·PRACTICE) + 랜덤 1회독(TEST만)
고등: 하루 40개 → 20개씩 TEST+PRACTICE × 2세트
"""

from __future__ import annotations

import random
import re
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_MIDDLE = ROOT / "단어장 PDF" / "중등"
OUT_HIGH = ROOT / "단어장 PDF" / "고등"

# 부크크 JIS B5 (182×257mm) — 권장 여백 안전 구역
B5 = (182 * mm, 257 * mm)
MARGIN_OUTER = 14 * mm  # 권장여백 안쪽 끝 (바깥으로 밀 때)
MARGIN_INNER = 20 * mm  # 반대쪽 (콘텐츠를 한쪽 끝으로 밀 때)
MARGIN_BOTTOM = 14 * mm
TABLE_BOTTOM = 24 * mm
BANNER_Y = 22 * mm
SUBTITLE_Y = 34 * mm
RULE_Y = 38 * mm
TABLE_TOP_TIGHT = 40 * mm
TABLE_TOP_LOOSE = 46 * mm


def page_margins_x(page_no: int) -> tuple[float, float]:
    """(left, right). 홀수=왼쪽 끝까지, 짝수=오른쪽 끝까지."""
    if page_no % 2 == 1:
        return MARGIN_OUTER, MARGIN_INNER
    return MARGIN_INNER, MARGIN_OUTER


def draw_page_footer(c: canvas.Canvas, page_no: int, level_tag: str) -> None:
    width, _ = B5
    margin_left, margin_right = page_margins_x(page_no)
    label = f"TRIGGER VOCA · {level_tag}"
    if page_no % 2 == 1:
        draw_text(c, str(page_no), margin_left, MARGIN_BOTTOM, size=10.4, color=SLATE)
        draw_text(c, label, width - margin_right, MARGIN_BOTTOM, size=6.5, color=SLATE, align="right")
    else:
        draw_text(c, label, margin_left, MARGIN_BOTTOM, size=6.5, color=SLATE)
        draw_text(c, str(page_no), width - margin_right, MARGIN_BOTTOM, size=10.4, color=SLATE, align="right")

FONT_REGULAR = "Pretendard"
FONT_BOLD = "PretendardBold"
FONT_IPA = "ArialIPA"
FONT_IPA_BOLD = "ArialIPABold"
FONT_LOGO = "BlackHanSans"  # Trigger 워드마크와 맞춘 디스플레이 서체
# 브랜드 색 — 트리거 블랙: 검정 배경 + 흰 글씨, 흑백 인쇄에서도 구분되는 무채색
NAVY = HexColor("#0A0A0A")  # 브랜드 블랙 (헤더 바·배너·표지)
NEON_BLUE = HexColor("#00F3FF")  # 앱 네온블루 — 표지·간지 포인트 전용
ORANGE = HexColor("#FF9900")  # 부가 포인트 — 레벨 배지 테두리·슬로건 마침표
SLATE = HexColor("#5C5C5C")
PALE = HexColor("#EEF1F4")
LIGHT = HexColor("#F7F7F7")  # 줄무늬 배경
LINE = HexColor("#9AA4AE")
INK = HexColor("#20262D")
LOGO_SHADOW = HexColor("#636262")  # trigger-logo-v2 그림자 샘플

# 중등 Day 1~3 발음 — (IPA, 한글) 수기 검수. 전체 1,200개는 data/middle_book_meta.json 이 우선.
MIDDLE_PRON = {
    # Day 1
    "religion": ("/rɪˈlɪdʒən/", "릴리전"),
    "border": ("/ˈbɔːrdər/", "보더"),
    "spread": ("/spred/", "스프레드"),
    "escape": ("/ɪˈskeɪp/", "이스케입"),
    "common": ("/ˈkɑːmən/", "커먼"),
    "remain": ("/rɪˈmeɪn/", "리메인"),
    "punish": ("/ˈpʌnɪʃ/", "퍼니시"),
    "fee": ("/fiː/", "피"),
    "familiar": ("/fəˈmɪliər/", "퍼밀리어"),
    "volunteer": ("/ˌvɑːlənˈtɪr/", "발런티어"),
    "square": ("/skwer/", "스퀘어"),
    "steal": ("/stiːl/", "스틸"),
    "attack": ("/əˈtæk/", "어택"),
    "represent": ("/ˌreprɪˈzent/", "레프리젠트"),
    "arrow": ("/ˈæroʊ/", "애로우"),
    "shoot": ("/ʃuːt/", "슛"),
    "matter": ("/ˈmætər/", "매터"),
    "shake": ("/ʃeɪk/", "셰이크"),
    "ruin": ("/ˈruːɪn/", "루인"),
    "result": ("/rɪˈzʌlt/", "리절트"),
    "bless": ("/bles/", "블레스"),
    "exist": ("/ɪɡˈzɪst/", "이그지스트"),
    "medicine": ("/ˈmedɪsn/", "메디슨"),
    "pack": ("/pæk/", "팩"),
    # Day 2
    "repeat": ("/rɪˈpiːt/", "리핏"),
    "perform": ("/pərˈfɔːrm/", "퍼폼"),
    "popular": ("/ˈpɑːpjələr/", "파퓰러"),
    "regular": ("/ˈreɡjələr/", "레귤러"),
    "seldom": ("/ˈseldəm/", "셀덤"),
    "president": ("/ˈprezɪdənt/", "프레지던트"),
    "international": ("/ˌɪntərˈnæʃənl/", "인터내셔널"),
    "overcome": ("/ˌoʊvərˈkʌm/", "오버컴"),
    "destroy": ("/dɪˈstrɔɪ/", "디스트로이"),
    "reply": ("/rɪˈplaɪ/", "리플라이"),
    "treasure": ("/ˈtreʒər/", "트레저"),
    "favor": ("/ˈfeɪvər/", "페이버"),
    "grade": ("/ɡreɪd/", "그레이드"),
    "trust": ("/trʌst/", "트러스트"),
    "term": ("/tɜːrm/", "텀"),
    "spell": ("/spel/", "스펠"),
    "regret": ("/rɪˈɡret/", "리그렛"),
    "suggest": ("/səˈdʒest/", "석제스트"),
    "recognize": ("/ˈrekəɡnaɪz/", "레커그나이즈"),
    "balance": ("/ˈbæləns/", "밸런스"),
    "notice": ("/ˈnoʊtɪs/", "노티스"),
    "realize": ("/ˈriːəlaɪz/", "리얼라이즈"),
    "admire": ("/ədˈmaɪər/", "어드마이어"),
    "needle": ("/ˈniːdl/", "니들"),
    # Day 3
    "tray": ("/treɪ/", "트레이"),
    "role": ("/roʊl/", "롤"),
    "pride": ("/praɪd/", "프라이드"),
    "tie": ("/taɪ/", "타이"),
    "repair": ("/rɪˈper/", "리페어"),
    "soap": ("/soʊp/", "소프"),
    "normal": ("/ˈnɔːrml/", "노멀"),
    "smooth": ("/smuːð/", "스무스"),
    "trade": ("/treɪd/", "트레이드"),
    "benefit": ("/ˈbenɪfɪt/", "베니핏"),
    "crop": ("/krɑːp/", "크롭"),
    "gather": ("/ˈɡæðər/", "개더"),
    "stadium": ("/ˈsteɪdiəm/", "스테이디엄"),
    "incredible": ("/ɪnˈkredəbl/", "인크레더블"),
    "coach": ("/koʊtʃ/", "코치"),
    "strike": ("/straɪk/", "스트라이크"),
    "desire": ("/dɪˈzaɪər/", "디자이어"),
    "effective": ("/ɪˈfektɪv/", "이펙티브"),
    "able": ("/ˈeɪbl/", "에이블"),
    "pain": ("/peɪn/", "페인"),
    "spend": ("/spend/", "스펜드"),
    "belong": ("/bɪˈlɔːŋ/", "빌롱"),
    "usual": ("/ˈjuːʒuəl/", "유주얼"),
    "neighbor": ("/ˈneɪbər/", "네이버"),
}

# 고등 Day 1 발음 — (IPA, 한글) 수기 검수
HIGH_PRON = {
    "ability": ("/əˈbɪləti/", "어빌리티"),
    "allow": ("/əˈlaʊ/", "얼라우"),
    "amaze": ("/əˈmeɪz/", "어메이즈"),
    "ancient": ("/ˈeɪnʃənt/", "에이션트"),
    "angle": ("/ˈæŋɡl/", "앵글"),
    "audience": ("/ˈɔːdiəns/", "오디언스"),
    "award": ("/əˈwɔːrd/", "어워드"),
    "awful": ("/ˈɔːfl/", "오플"),
    "background": ("/ˈbækɡraʊnd/", "백그라운드"),
    "basis": ("/ˈbeɪsɪs/", "베이시스"),
    "alignment": ("/əˈlaɪnmənt/", "얼라인먼트"),
    "bet": ("/bet/", "벳"),
    "bury": ("/ˈberi/", "베리"),
    "cause": ("/kɔːz/", "코즈"),
    "certain": ("/ˈsɜːrtn/", "서튼"),
    "challenge": ("/ˈtʃælɪndʒ/", "챌린지"),
    "cheat": ("/tʃiːt/", "치트"),
    "cheerful": ("/ˈtʃɪrfl/", "치어플"),
    "communicate": ("/kəˈmjuːnɪkeɪt/", "커뮤니케이트"),
    "congratulate": ("/kənˈɡrætʃuleɪt/", "컨그래출레이트"),
    "connect": ("/kəˈnekt/", "커넥트"),
    "consider": ("/kənˈsɪdər/", "컨시더"),
    "contact": ("/ˈkɑːntækt/", "콘택트"),
    "court": ("/kɔːrt/", "코트"),
    "curiosity": ("/ˌkjʊriˈɑːsəti/", "큐리어시티"),
    "customer": ("/ˈkʌstəmər/", "커스터머"),
    "damage": ("/ˈdæmɪdʒ/", "대미지"),
    "deadline": ("/ˈdedlaɪn/", "데드라인"),
    "drag": ("/dræɡ/", "드래그"),
    "duty": ("/ˈduːti/", "듀티"),
    "embarrassed": ("/ɪmˈbærəst/", "엠배러스트"),
    "environment": ("/ɪnˈvaɪrənmənt/", "인바이어런먼트"),
    "eventually": ("/ɪˈventʃuəli/", "이벤추얼리"),
    "exactly": ("/ɪɡˈzæktli/", "이그잭틀리"),
    "failure": ("/ˈfeɪljər/", "페일러"),
    "female": ("/ˈfiːmeɪl/", "피메일"),
    "flavor": ("/ˈfleɪvər/", "플레이버"),
    "flow": ("/floʊ/", "플로우"),
    "fold": ("/foʊld/", "폴드"),
    "forgive": ("/fərˈɡɪv/", "포기브"),
}

# 중등 Day 1~3 품사 표기 — 각 뜻 뒤에 한 칸 띄우고 (명)(동)(형)(부), 같은 품사는 한 번만
POS_MEANINGS = {
    # Day 1
    "religion": "종교 (명)",
    "border": "국경 (명)",
    "spread": "퍼지다 (동)",
    "escape": "탈출하다 (동)",
    "common": "흔한, 공통의 (형)",
    "remain": "남다 (동)",
    "punish": "처벌하다 (동)",
    "fee": "요금 (명)",
    "familiar": "익숙한 (형)",
    "volunteer": "자원봉사자 (명)",
    "square": "정사각형, 광장 (명)",
    "steal": "훔치다 (동)",
    "attack": "공격하다 (동)",
    "represent": "대표하다 (동)",
    "arrow": "화살 (명)",
    "shoot": "쏘다 (동)",
    "matter": "문제 (명), 중요하다 (동)",
    "shake": "흔들다 (동)",
    "ruin": "망치다 (동)",
    "result": "결과 (명)",
    "bless": "축복하다 (동)",
    "exist": "존재하다 (동)",
    "medicine": "약 (명)",
    "pack": "싸다, 포장하다 (동)",
    # Day 2
    "repeat": "반복하다 (동)",
    "perform": "수행하다, 공연하다 (동)",
    "popular": "인기 있는 (형)",
    "regular": "규칙적인 (형)",
    "seldom": "드물게 (부)",
    "president": "대통령, 회장 (명)",
    "international": "국제적인 (형)",
    "overcome": "극복하다 (동)",
    "destroy": "파괴하다 (동)",
    "reply": "대답하다 (동)",
    "treasure": "보물 (명)",
    "favor": "호의 (명)",
    "grade": "성적, 학년 (명)",
    "trust": "신뢰하다 (동)",
    "term": "용어, 기간 (명)",
    "spell": "철자를 쓰다 (동)",
    "regret": "후회하다 (동)",
    "suggest": "제안하다 (동)",
    "recognize": "알아차리다 (동)",
    "balance": "균형 (명)",
    "notice": "알아차리다 (동)",
    "realize": "깨닫다 (동)",
    "admire": "존경하다 (동)",
    "needle": "바늘 (명)",
    # Day 3
    "tray": "쟁반 (명)",
    "role": "역할 (명)",
    "pride": "자부심 (명)",
    "tie": "묶다 (동)",
    "repair": "수리하다 (동)",
    "soap": "비누 (명)",
    "normal": "정상적인 (형)",
    "smooth": "부드러운 (형)",
    "trade": "무역 (명)",
    "benefit": "이익 (명)",
    "crop": "농작물 (명)",
    "gather": "모으다 (동)",
    "stadium": "경기장 (명)",
    "incredible": "믿을 수 없는 (형)",
    "coach": "코치 (명)",
    "strike": "치다, 파업하다 (동)",
    "desire": "욕망 (명)",
    "effective": "효과적인 (형)",
    "able": "할 수 있는 (형)",
    "pain": "고통 (명)",
    "spend": "소비하다 (동)",
    "belong": "속하다 (동)",
    "usual": "평소의 (형)",
    "neighbor": "이웃 (명)",
}


def register_fonts() -> None:
    font_dir = Path("C:/Windows/Fonts")
    brand_dir = ROOT / "fonts"  # 앱과 동일한 Pretendard (브랜드 통일)
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(brand_dir / "Pretendard-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(brand_dir / "Pretendard-Bold.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_LOGO, str(brand_dir / "BlackHanSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_IPA, str(font_dir / "arial.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_IPA_BOLD, str(font_dir / "arialbd.ttf")))


def load_middle_meta() -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    """data/middle_book_meta.json → (발음 dict, 품사뜻 dict). 수기 폴백 포함."""
    meta_path = ROOT / "data" / "middle_book_meta.json"
    pron: dict[str, tuple[str, str]] = dict(MIDDLE_PRON)
    pos: dict[str, str] = dict(POS_MEANINGS)
    if not meta_path.exists():
        return pron, pos
    import json

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    for word, row in meta.items():
        pron[word] = (row["ipa"], row["ko"])
        pos[word] = row["meaning_pos"]
    return pron, pos


def load_words(path: Path, count: int | None = None) -> list[tuple[str, str]]:
    words: list[tuple[str, str]] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        if "|" not in line:
            raise ValueError(f"{path.name} {line_no}행에 구분자(|)가 없습니다.")
        word, meaning = line.split("|", 1)
        word, meaning = word.strip(), meaning.strip()
        if not word or not meaning:
            raise ValueError(f"{path.name} {line_no}행의 단어 또는 뜻이 비어 있습니다.")
        if not re.fullmatch(r"[A-Za-z][A-Za-z .,'’()/-]*", word):
            raise ValueError(f"{path.name} {line_no}행의 영단어 형식을 확인하세요: {word}")
        words.append((word, meaning))
        if count is not None and len(words) >= count:
            break
    if count is not None and len(words) < count:
        raise ValueError(f"{path.name}에서 {count}개를 읽지 못했습니다. ({len(words)}개)")
    return words


def chunk_days(words: list[tuple[str, str]], per_day: int) -> list[list[tuple[str, str]]]:
    if len(words) % per_day != 0:
        raise ValueError(f"단어 수({len(words)})가 하루치({per_day})로 나누어떨어지지 않습니다.")
    return [words[i : i + per_day] for i in range(0, len(words), per_day)]


MIDDLE_WORDS_PER_DAY = 24
MIDDLE_PAGES_PER_DAY_ROUND1 = 4  # 간지 · STUDY LOG · TEST · PRACTICE
MIDDLE_RANDOM_SEED = 20260720


def middle_first_day_page(*, include_covers: bool) -> int:
    """1회독 Day 01 간지가 시작하는 페이지 번호."""
    return 5 if include_covers else 4


def shuffle_days_for_random_review(
    days: list[list[tuple[str, str]]],
    *,
    seed: int = MIDDLE_RANDOM_SEED,
) -> list[list[tuple[str, str]]]:
    """1회독 Day 구성과 다른 순서로 Day를 재구성 (고정 시드)."""
    per_day = len(days[0])
    flat = [row for day in days for row in day]
    shuffled = flat[:]
    random.Random(seed).shuffle(shuffled)
    if {word for word, _ in shuffled} != {word for word, _ in flat}:
        raise ValueError("랜덤 1회독 셔플 후 단어 누락·중복이 있습니다.")
    return chunk_days(shuffled, per_day)


def build_middle_round1_contents_entries(
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool,
) -> list[tuple[str, int, int, int]]:
    first = middle_first_day_page(include_covers=include_covers)
    return [
        (
            f"DAY {day_no:02d}",
            len(rows),
            first + (day_no - 1) * MIDDLE_PAGES_PER_DAY_ROUND1,
            first + (day_no - 1) * MIDDLE_PAGES_PER_DAY_ROUND1 + MIDDLE_PAGES_PER_DAY_ROUND1 - 1,
        )
        for day_no, rows in enumerate(days, 1)
    ]


def fit_font_size(text: str, font: str, max_size: float, max_width: float) -> float:
    size = max_size
    while size > 5.8 and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 0.2
    return size


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    *,
    font: str = FONT_REGULAR,
    size: float = 8.0,
    color: Color = INK,
    max_width: float | None = None,
    align: str = "left",
) -> None:
    if max_width is not None:
        size = fit_font_size(text, font, size, max_width)
    c.setFillColor(color)
    c.setFont(font, size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def draw_status_marks(c: canvas.Canvas, x: float, y: float, width: float, row_h: float) -> None:
    centers = [x + width * 1 / 6, x + width * 3 / 6, x + width * 5 / 6]
    cy = y + row_h / 2
    radius = min(1.9 * mm, row_h * 0.24)
    c.setStrokeColor(SLATE)
    c.setLineWidth(0.55)
    for cx in centers:
        c.rect(cx - radius, cy - radius, radius * 2, radius * 2, fill=0)


def draw_day_banner(c: canvas.Canvas, title: str, center_y: float) -> None:
    """페이지 상단 중앙의 Day 배너 — 검은 배경 박스에 흰 글씨."""
    width, _ = B5
    size = 15.0
    text_w = pdfmetrics.stringWidth(title, FONT_BOLD, size)
    pad_x = 5 * mm
    box_w = text_w + pad_x * 2
    box_h = 8.5 * mm
    box_x = (width - box_w) / 2
    box_y = center_y - box_h / 2
    c.setFillColor(NAVY)
    c.roundRect(box_x, box_y, box_w, box_h, 1.8 * mm, fill=1, stroke=0)
    draw_text(c, title, width / 2, center_y - size * 0.36, font=FONT_BOLD, size=size, color=white, align="center")


LOGO_PATH = ROOT / "로고, 이미지" / "trigger-logo-v2.png"
LOGO_ASPECT = 342 / 820  # 세로/가로


def draw_cover(
    c: canvas.Canvas,
    *,
    level_en: str,
    level_ko: str,
    day_label: str,
    words_note: str,
) -> None:
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    badge_w, badge_h = 26 * mm, 12 * mm
    badge_x, badge_y = 18 * mm, height - 18 * mm - badge_h
    badge_stroke = ORANGE if level_ko == "중등" else NEON_BLUE
    c.setStrokeColor(badge_stroke)
    c.setLineWidth(1.2)
    c.roundRect(badge_x, badge_y, badge_w, badge_h, 2 * mm, fill=0, stroke=1)
    draw_text(
        c,
        level_ko,
        badge_x + badge_w / 2,
        badge_y + badge_h / 2 - 4.8,
        font=FONT_BOLD,
        size=13.5,
        color=white,
        align="center",
    )

    logo_w = 114.8 * mm
    logo_h = logo_w * LOGO_ASPECT
    c.drawImage(
        str(LOGO_PATH),
        (width - logo_w) / 2,
        height - 60 * mm - logo_h,
        width=logo_w,
        height=logo_h,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )

    voca_size = 54
    voca_y = height - 128 * mm
    shadow_dx = voca_size * 0.081
    shadow_dy = -voca_size * 0.063
    c.saveState()
    c.translate(width / 2, voca_y)
    c.skew(0, 18)
    c.setFont(FONT_LOGO, voca_size)
    c.setFillColor(LOGO_SHADOW)
    steps = 14
    for i in range(steps, 0, -1):
        t = i / steps
        c.drawCentredString(shadow_dx * t, shadow_dy * t, "VOCA")
    c.setFillColor(white)
    for dx, dy in ((0, 0), (0.5, 0), (0, 0.4), (0.5, 0.4)):
        c.drawCentredString(dx, dy, "VOCA")
    c.restoreState()

    c.setFillColor(NEON_BLUE)
    c.roundRect(28 * mm, height - 184 * mm, width - 56 * mm, 16 * mm, 2.5 * mm, fill=1, stroke=0)
    c.saveState()
    c.translate(width / 2, height - 178.5 * mm)
    c.skew(0, 10)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 17.5)
    for dx, dy in ((0, 0), (0.45, 0), (0, 0.35), (0.45, 0.35)):
        c.drawCentredString(dx, dy, day_label)
    c.restoreState()

    draw_text(c, "TRIGGER BLACK", width / 2, 18 * mm, size=14, color=PALE, align="center")
    c.showPage()


QR_PATH = ROOT / "로고, 이미지" / "qr-blackt.png"


def draw_back_cover(c: canvas.Canvas) -> None:
    """뒤표지 — 슬로건 + 앱 QR (로고 없음)."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    # 슬로건 — 아래로 · 아래 문장과 간격 절반
    slogan = "Just Follow"
    slogan_size = 40
    slogan_w = pdfmetrics.stringWidth(slogan, FONT_BOLD, slogan_size)

    qr_size = 34 * mm
    qr_pad = 4 * mm
    box_size = qr_size + qr_pad * 2
    box_x = (width - box_size) / 2
    box_y = height - 158 * mm
    caption_y = box_y + box_size + 7 * mm
    slogan_y = caption_y + 18.5 * mm

    c.saveState()
    c.translate(width / 2, slogan_y)
    c.skew(0, 12)
    c.setFillColor(white)
    c.setFont(FONT_BOLD, slogan_size)
    c.drawCentredString(0, 0, slogan)
    c.setFillColor(ORANGE)
    c.drawString(slogan_w / 2, 0, ".")
    c.restoreState()

    draw_text(c, "앱에서 오늘의 단어를 테스트하세요", width / 2, caption_y, size=16, color=PALE, align="center")
    c.setFillColor(white)
    c.roundRect(box_x, box_y, box_size, box_size, 2.5 * mm, fill=1, stroke=0)
    c.drawImage(str(QR_PATH), box_x + qr_pad, box_y + qr_pad, width=qr_size, height=qr_size)

    draw_text(c, "TRIGGER BLACK", width / 2, 18 * mm, size=14, color=PALE, align="center")
    c.showPage()


def draw_contents_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    entries: list[tuple[str, int, int, int]],
    page_no: int,
    footer_note: str | None = None,
) -> None:
    """Day별 단어 수와 시작·끝 페이지를 보여 주는 목차."""
    width, height = B5
    draw_day_banner(c, "CONTENTS", height - BANNER_Y)
    draw_text(
        c,
        f"{level_tag} · {len(entries)} DAYS · {sum(words for _, words, _, _ in entries)} WORDS",
        width / 2,
        height - SUBTITLE_Y,
        font=FONT_BOLD,
        size=9.5,
        color=SLATE,
        align="center",
    )

    margin_left, margin_right = page_margins_x(page_no)
    gap = 8 * mm
    column_count = 2 if len(entries) > 25 else 1
    table_w = width - margin_left - margin_right
    column_w = (table_w - gap * (column_count - 1)) / column_count
    rows_per_column = (len(entries) + column_count - 1) // column_count
    table_top = height - TABLE_TOP_LOOSE
    header_h = 9 * mm
    row_h = min(8 * mm, (table_top - TABLE_BOTTOM - header_h) / max(rows_per_column, 1))
    day_w = 25 * mm
    words_w = 22 * mm

    for column in range(column_count):
        start = column * rows_per_column
        column_entries = entries[start : start + rows_per_column]
        if not column_entries:
            continue
        left = margin_left + column * (column_w + gap)
        right = left + column_w
        words_x = left + day_w
        page_x = words_x + words_w
        bottom = table_top - header_h - len(column_entries) * row_h

        c.setFillColor(NAVY)
        c.rect(left, table_top - header_h, column_w, header_h, fill=1, stroke=0)
        for label, center_x in (
            ("DAY", left + day_w / 2),
            ("WORDS", words_x + words_w / 2),
            ("PAGE", page_x + (right - page_x) / 2),
        ):
            draw_text(
                c,
                label,
                center_x,
                table_top - header_h + 2.6 * mm,
                font=FONT_BOLD,
                size=9.5,
                color=white,
                align="center",
            )

        y = table_top - header_h
        for index, (day_label, words, start_page, end_page) in enumerate(column_entries):
            next_y = y - row_h
            if index % 2 == 1:
                c.setFillColor(LIGHT)
                c.rect(left, next_y, column_w, row_h, fill=1, stroke=0)
            baseline = next_y + row_h / 2 - 3.2
            draw_text(c, day_label, left + day_w / 2, baseline, font=FONT_BOLD, size=10.5, align="center")
            draw_text(c, str(words), words_x + words_w / 2, baseline, size=9.5, color=SLATE, align="center")
            page_text = str(start_page) if start_page == end_page else f"{start_page}–{end_page}"
            draw_text(c, page_text, page_x + (right - page_x) / 2, baseline, font=FONT_BOLD, size=10.0, align="center")
            y = next_y

        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        for x in (left, words_x, page_x, right):
            c.line(x, bottom, x, table_top)
        c.setStrokeColor(white)
        for x in (words_x, page_x):
            c.line(x, table_top - header_h, x, table_top)
        c.setStrokeColor(LINE)
        for index in range(len(column_entries) + 1):
            line_y = table_top - header_h - index * row_h
            c.line(left, line_y, right, line_y)
        c.rect(left, bottom, column_w, table_top - bottom, fill=0, stroke=1)

    if footer_note:
        draw_text(
            c,
            footer_note,
            width / 2,
            TABLE_BOTTOM + 6 * mm,
            font=FONT_BOLD,
            size=10.0,
            color=SLATE,
            align="center",
        )

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def build_word_index_entries(
    days: list[list[tuple[str, str]]],
    *,
    first_day_page: int = 5,
    pages_per_day: int = 4,
) -> list[tuple[str, str, int, int]]:
    """(word, meaning, day_no, test_page) 알파벳 순."""
    entries: list[tuple[str, str, int, int]] = []
    for day_no, rows in enumerate(days, 1):
        # Day: 간지·로그·TEST·PRACTICE → TEST는 +2
        test_page = first_day_page + (day_no - 1) * pages_per_day + 2
        for word, meaning in rows:
            entries.append((word, meaning, day_no, test_page))
    entries.sort(key=lambda row: row[0].lower())
    return entries


def draw_index_pages(
    c: canvas.Canvas,
    *,
    level_tag: str,
    entries: list[tuple[str, str, int, int]],
    start_page_no: int,
) -> int:
    """알파벳 색인 — 단어 · Day · TEST 페이지. 여러 쪽."""
    width, height = B5
    page_no = start_page_no
    cols = 3
    gap = 4 * mm
    top = height - TABLE_TOP_LOOSE + 4 * mm
    bottom = TABLE_BOTTOM
    row_h = 5.2 * mm
    content_w = width - MARGIN_OUTER - MARGIN_INNER
    col_w = (content_w - gap * (cols - 1)) / cols
    rows_per_col = int((top - bottom) / row_h)

    # 레터 헤더는 한 칸 사용
    items: list[tuple[str, object]] = []
    prev_letter = ""
    for idx, (word, _meaning, day_no, test_page) in enumerate(entries):
        letter = word[0].upper() if word else "#"
        if not letter.isalpha():
            letter = "#"
        if letter != prev_letter:
            items.append(("letter", letter))
            prev_letter = letter
        items.append(("word", idx))

    per_page = rows_per_col * cols
    offset = 0
    first_index_page = True
    while offset < len(items):
        chunk = items[offset : offset + per_page]
        offset += len(chunk)

        if first_index_page:
            draw_day_banner(c, "INDEX", height - BANNER_Y)
            draw_text(
                c,
                f"{level_tag} · A–Z · {len(entries)} WORDS",
                width / 2,
                height - SUBTITLE_Y,
                font=FONT_BOLD,
                size=9.5,
                color=SLATE,
                align="center",
            )
            first_index_page = False
        else:
            draw_day_banner(c, "INDEX", height - BANNER_Y)
            draw_text(
                c,
                f"{level_tag} · A–Z",
                width / 2,
                height - SUBTITLE_Y,
                size=9.0,
                color=SLATE,
                align="center",
            )

        margin_left, _margin_right = page_margins_x(page_no)
        for col in range(cols):
            col_items = chunk[col * rows_per_col : (col + 1) * rows_per_col]
            if not col_items:
                continue
            left = margin_left + col * (col_w + gap)
            y = top
            for kind, payload in col_items:
                next_y = y - row_h
                if kind == "letter":
                    c.setFillColor(NAVY)
                    c.rect(left, next_y + 0.4 * mm, col_w, row_h - 0.8 * mm, fill=1, stroke=0)
                    draw_text(
                        c,
                        str(payload),
                        left + 2 * mm,
                        next_y + row_h / 2 - 2.8,
                        font=FONT_BOLD,
                        size=9.5,
                        color=white,
                    )
                else:
                    word, _meaning, day_no, test_page = entries[int(payload)]  # type: ignore[arg-type]
                    baseline = next_y + row_h / 2 - 2.6
                    day_label = f"D{day_no:02d}"
                    page_label = str(test_page)
                    meta = f"{day_label} · {page_label}"
                    meta_w = pdfmetrics.stringWidth(meta, FONT_REGULAR, 7.5)
                    word_max = col_w - meta_w - 3 * mm
                    draw_text(c, word, left + 1.2 * mm, baseline, font=FONT_BOLD, size=8.0, max_width=word_max)
                    draw_text(
                        c,
                        meta,
                        left + col_w - 1.2 * mm,
                        baseline,
                        size=7.5,
                        color=SLATE,
                        align="right",
                    )
                y = next_y

        draw_page_footer(c, page_no, level_tag)
        c.showPage()
        page_no += 1

    return page_no


def draw_howto_page(c: canvas.Canvas, *, level_tag: str, page_no: int) -> None:
    """TEST부터 복습까지 하루 학습 순서를 안내."""
    width, height = B5
    draw_day_banner(c, "HOW TO STUDY", height - BANNER_Y)
    draw_text(
        c,
        "하루 24단어를 네 단계로 반복하세요.",
        width / 2,
        height - SUBTITLE_Y,
        font=FONT_BOLD,
        size=11.5,
        color=SLATE,
        align="center",
    )
    draw_text(
        c,
        "단어 구성은 트리거보카 앱의 Day 구성과 동일합니다.",
        width / 2,
        height - SUBTITLE_Y - 7 * mm,
        size=10.0,
        color=SLATE,
        align="center",
    )

    steps = [
        ("01", "FOLD", "정답 면을 가운데 세로선에서 뒤로 접습니다."),
        ("02", "TEST", "영단어를 보고 뜻을 직접 씁니다. 모르는 단어도 끝까지 풀어봅니다."),
        ("03", "CHECK", "접었던 정답 면과 비교하고 1차·2차·3차 결과를 체크합니다."),
        ("04", "PRACTICE", "발음을 확인하며 영단어를 따라 쓰고, 뜻을 다시 써봅니다."),
    ]
    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    top = height - SUBTITLE_Y - 18 * mm
    box_h = 35 * mm
    gap = 8 * mm
    for index, (number, title, description) in enumerate(steps):
        y = top - index * (box_h + gap) - box_h
        c.setFillColor(LIGHT if index % 2 == 0 else white)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.roundRect(left, y, right - left, box_h, 2.5 * mm, fill=1, stroke=1)
        c.setFillColor(NAVY)
        c.circle(left + 11 * mm, y + box_h / 2, 6 * mm, fill=1, stroke=0)
        draw_text(c, number, left + 11 * mm, y + box_h / 2 - 3.0, font=FONT_BOLD, size=9.5, color=white, align="center")
        draw_text(c, title, left + 24 * mm, y + box_h / 2 + 2.2 * mm, font=FONT_BOLD, size=13.0)
        draw_text(c, description, left + 24 * mm, y + box_h / 2 - 4.3 * mm, size=13.3, color=SLATE, max_width=right - left - 30 * mm)

    draw_text(
        c,
        "1회독을 모두 마친 뒤, 뒤쪽 「랜덤 1회독」 구간(TEST만)으로 이어집니다.",
        width / 2,
        top - 4 * (box_h + gap) - 14 * mm,
        font=FONT_BOLD,
        size=10.5,
        color=SLATE,
        align="center",
        max_width=right - left,
    )

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_pronunciation_guide(c: canvas.Canvas, *, level_tag: str, page_no: int) -> None:
    """단어 목록 전에 보는 영어 발음기호 읽기 안내."""
    width, height = B5
    # (기호, 한글소리, 예시단어, 예시발음)
    vowels = [
        ("iː", "이", "see", "siː"),
        ("ɪ", "이", "sit", "sɪt"),
        ("e", "에", "bed", "bed"),
        ("æ", "애", "cat", "kæt"),
        ("ɑː", "아", "father", "ˈfɑːðər"),
        ("ɒ", "아", "hot", "hɒt"),
        ("ɔː", "오", "saw", "sɔː"),
        ("ʊ", "우", "book", "bʊk"),
        ("uː", "우", "food", "fuːd"),
        ("ʌ", "어", "cup", "kʌp"),
        ("ɜː", "얼", "bird", "bɜːrd"),
        ("ə", "어", "about", "əˈbaʊt"),
        ("eɪ", "에이", "day", "deɪ"),
        ("aɪ", "아이", "my", "maɪ"),
        ("ɔɪ", "오이", "boy", "bɔɪ"),
        ("aʊ", "아우", "now", "naʊ"),
        ("oʊ", "오우", "go", "ɡoʊ"),
        ("ɪr", "이어", "near", "nɪr"),
        ("er", "에어", "care", "ker"),
        ("ʊr", "우어", "tour", "tʊr"),
    ]
    consonants = [
        ("p", "프", "pen", "pen"),
        ("b", "브", "book", "bʊk"),
        ("t", "트", "ten", "ten"),
        ("d", "드", "day", "deɪ"),
        ("k", "크", "cat", "kæt"),
        ("ɡ", "그", "go", "ɡoʊ"),
        ("f", "프", "fine", "faɪn"),
        ("v", "브", "very", "ˈveri"),
        ("θ", "쓰", "think", "θɪŋk"),
        ("ð", "드", "this", "ðɪs"),
        ("s", "스", "see", "siː"),
        ("z", "즈", "zoo", "zuː"),
        ("ʃ", "쉬", "she", "ʃiː"),
        ("ʒ", "쥐", "vision", "ˈvɪʒn"),
        ("h", "흐", "hat", "hæt"),
        ("tʃ", "취", "chair", "tʃer"),
        ("dʒ", "쥐", "job", "dʒɑːb"),
        ("m", "므", "man", "mæn"),
        ("n", "느", "no", "noʊ"),
        ("ŋ", "응", "sing", "sɪŋ"),
        ("l", "르", "love", "lʌv"),
        ("r", "르", "red", "red"),
        ("j", "이", "yes", "jes"),
        ("w", "우", "we", "wiː"),
    ]
    example_korean = {
        "see": "씨",
        "sit": "싯",
        "bed": "베드",
        "cat": "캣",
        "father": "파더",
        "hot": "핫",
        "saw": "소",
        "book": "북",
        "food": "푸드",
        "cup": "컵",
        "bird": "버드",
        "about": "어바웃",
        "day": "데이",
        "my": "마이",
        "boy": "보이",
        "now": "나우",
        "go": "고우",
        "near": "니어",
        "care": "케어",
        "tour": "투어",
        "pen": "펜",
        "ten": "텐",
        "fine": "파인",
        "very": "베리",
        "think": "씽크",
        "this": "디스",
        "zoo": "주",
        "she": "쉬",
        "vision": "비전",
        "hat": "햇",
        "chair": "체어",
        "job": "잡",
        "man": "맨",
        "no": "노우",
        "sing": "싱",
        "love": "러브",
        "red": "레드",
        "yes": "예스",
        "we": "위",
    }

    draw_day_banner(c, "발음기호 읽는 법", height - BANNER_Y)
    draw_text(
        c,
        "한글 표기는 가장 가까운 소리입니다. 예시 단어와 함께 소리 내어 읽어 보세요.",
        width / 2,
        height - SUBTITLE_Y,
        size=11.0,
        color=SLATE,
        align="center",
    )

    margin_left, margin_right = page_margins_x(page_no)
    table_top = height - TABLE_TOP_LOOSE
    table_bottom = TABLE_BOTTOM
    gap = 5 * mm
    group_w = (width - margin_left - margin_right - gap) / 2
    title_h = 7 * mm
    header_h = 8 * mm

    def draw_example_ipa(text: str, target: str, x: float, y: float) -> float:
        """예시 IPA에서 현재 행의 발음기호만 굵게 그리고 끝 x좌표를 반환."""
        size = 9.2
        target_index = text.find(target)
        if target_index < 0:
            segments = [(f"[{text}]", FONT_IPA)]
        else:
            segments = [
                (f"[{text[:target_index]}", FONT_IPA),
                (target, FONT_IPA_BOLD),
                (f"{text[target_index + len(target):]}]", FONT_IPA),
            ]
        current_x = x
        for segment, font in segments:
            if not segment:
                continue
            draw_text(c, segment, current_x, y, font=font, size=size, color=SLATE)
            current_x += pdfmetrics.stringWidth(segment, font, size)
        return current_x

    def draw_group(title: str, rows: list[tuple[str, str, str, str]], left: float) -> None:
        row_h = (table_top - table_bottom - header_h) / len(rows)
        symbol_w = 12 * mm
        sound_w = 14 * mm
        example_w = group_w - symbol_w - sound_w
        col_xs = [left, left + symbol_w, left + symbol_w + sound_w, left + group_w]
        headers = ("기호", "소리", "예시")
        col_centers = [
            left + symbol_w / 2,
            left + symbol_w + sound_w / 2,
            left + symbol_w + sound_w + example_w / 2,
        ]

        c.setFillColor(white)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.rect(left, table_top, group_w, title_h, fill=1, stroke=1)
        c.setStrokeColor(NAVY)
        c.setLineWidth(1.2)
        c.line(left, table_top + title_h, left + group_w, table_top + title_h)
        c.setLineWidth(0.4)
        draw_text(
            c,
            title,
            left + group_w / 2,
            table_top + 2.0 * mm,
            font=FONT_BOLD,
            size=10.5,
            color=INK,
            align="center",
        )
        c.setFillColor(NAVY)
        c.rect(left, table_top - header_h, group_w, header_h, fill=1, stroke=0)
        for label, cx in zip(headers, col_centers):
            draw_text(
                c,
                label,
                cx,
                table_top - header_h + 2.3 * mm,
                font=FONT_BOLD,
                size=10.5,
                color=white,
                align="center",
            )

        y = table_top - header_h
        for index, (symbol, sound, example, example_ipa) in enumerate(rows):
            next_y = y - row_h
            if index % 2 == 1:
                c.setFillColor(LIGHT)
                c.rect(left, next_y, group_w, row_h, fill=1, stroke=0)
            baseline = next_y + row_h / 2 - 3.0
            draw_text(c, symbol, left + symbol_w / 2, baseline, font=FONT_IPA, size=11.8, align="center")
            draw_text(c, sound, left + symbol_w + sound_w / 2, baseline, size=10.8, align="center")
            ex_x = col_xs[2] + 1.2 * mm
            draw_text(c, example, ex_x, baseline, font=FONT_BOLD, size=10.0)
            word_w = pdfmetrics.stringWidth(example, FONT_BOLD, 10.0)
            ipa_x = ex_x + word_w + 1.2 * mm
            korean_x = draw_example_ipa(example_ipa, symbol, ipa_x, baseline) + 1.2 * mm
            draw_text(
                c,
                example_korean[example],
                korean_x,
                baseline,
                size=9.2,
                color=SLATE,
                max_width=left + group_w - korean_x - 1.2 * mm,
            )
            y = next_y

        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        for x in col_xs:
            c.line(x, table_bottom, x, table_top)
        c.setStrokeColor(white)
        for x in col_xs[1:-1]:
            c.line(x, table_top - header_h, x, table_top)
        c.setStrokeColor(LINE)
        for index in range(len(rows) + 1):
            line_y = table_top - header_h - index * row_h
            c.line(left, line_y, left + group_w, line_y)
        c.rect(left, table_bottom, group_w, table_top - table_bottom, fill=0, stroke=1)

    draw_group("모음", vowels, margin_left)
    draw_group("자음", consonants, margin_left + group_w + gap)
    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_day_divider(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_no: int,
    rows: list[tuple[str, str]],
    page_no: int,
) -> None:
    """Day 간지 앞면 — 검정 바탕에 Day 번호를 크게. 펼쳤을 때 위치 구분용."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    center_y = height * 0.58
    draw_text(c, "DAY", width / 2, center_y + 30 * mm, font=FONT_BOLD, size=20, color=PALE, align="center")
    draw_text(c, f"{day_no:02d}", width / 2, center_y - 10 * mm, font=FONT_BOLD, size=96, color=white, align="center")
    bar_w = 26 * mm
    c.setFillColor(NEON_BLUE)
    c.rect((width - bar_w) / 2, center_y - 20 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)
    draw_text(c, f"{len(rows)} WORDS", width / 2, center_y - 30 * mm, font=FONT_BOLD, size=12, color=white, align="center")
    draw_text(c, f"{rows[0][0]} – {rows[-1][0]}", width / 2, center_y - 38 * mm, size=11, color=PALE, align="center")

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_random_review_divider(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_count: int,
    word_count: int,
    random_first_test_page: int,
    page_no: int,
) -> None:
    """1회독과 랜덤 1회독 구간을 구분하는 표지 + 짧은 안내."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    center_y = height * 0.62
    draw_text(c, "RANDOM", width / 2, center_y + 34 * mm, font=FONT_BOLD, size=22, color=PALE, align="center")
    draw_text(c, "REVIEW", width / 2, center_y + 6 * mm, font=FONT_BOLD, size=56, color=white, align="center")
    draw_text(c, "랜덤 1회독", width / 2, center_y - 22 * mm, font=FONT_BOLD, size=16, color=white, align="center")

    bar_w = 36 * mm
    c.setFillColor(NEON_BLUE)
    c.rect((width - bar_w) / 2, center_y - 30 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)
    draw_text(
        c,
        f"{word_count} WORDS · SHUFFLED · {day_count} DAYS",
        width / 2,
        center_y - 40 * mm,
        font=FONT_BOLD,
        size=11,
        color=white,
        align="center",
    )

    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    notes = [
        "1회독을 모두 마친 뒤, 이 구간부터 시작하세요.",
        "전체 단어 순서가 무작위로 섞여 Day 01~{:02d}으로 다시 구성되어 있습니다.".format(day_count),
        "TEST만 있습니다. 연습(PRACTICE) 페이지는 없습니다.",
        "Day 번호는 1부터이지만, 단어 구성은 1회독과 다릅니다.",
        "순서를 외우지 않았는지 확인하는 복습입니다.",
    ]
    note_top = center_y - 58 * mm
    for index, line in enumerate(notes):
        draw_text(
            c,
            line,
            width / 2,
            note_top - index * 7.5 * mm,
            size=10.5,
            color=PALE,
            align="center",
            max_width=right - left,
        )

    draw_text(
        c,
        f"다음 페이지(p.{random_first_test_page})부터 Day 01 TEST",
        width / 2,
        28 * mm,
        font=FONT_BOLD,
        size=10.0,
        color=PALE,
        align="center",
    )

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_day_log_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_no: int,
    word_count: int,
    page_no: int,
) -> None:
    """Day 간지 뒷면 — 회차별 학습 기록 + 헷갈린 단어 메모 (빈 페이지 대신)."""
    width, height = B5
    draw_day_banner(c, f"DAY {day_no:02d} · STUDY LOG", height - BANNER_Y)
    draw_text(
        c,
        "회차별 테스트 날짜와 점수를 기록하고, 헷갈린 단어는 아래에 적어 두세요.",
        width / 2,
        height - SUBTITLE_Y,
        size=10.5,
        color=SLATE,
        align="center",
    )

    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    total_w = right - left
    table_top = height - TABLE_TOP_LOOSE
    header_h = 9 * mm
    row_h = 12 * mm
    round_w = 24 * mm
    score_w = 34 * mm
    check_w = 22 * mm
    date_w = total_w - round_w - score_w - check_w
    col_xs = [left, left + round_w, left + round_w + date_w, left + round_w + date_w + score_w, right]
    headers = ["회차", "날짜", "점수", "확인"]

    c.setFillColor(NAVY)
    c.rect(left, table_top - header_h, total_w, header_h, fill=1, stroke=0)
    for label, x0, x1 in zip(headers, col_xs, col_xs[1:]):
        draw_text(
            c,
            label,
            (x0 + x1) / 2,
            table_top - header_h + 2.6 * mm,
            font=FONT_BOLD,
            size=10.5,
            color=white,
            align="center",
        )

    rounds = ["1차", "2차", "3차"]
    y = table_top - header_h
    for index, round_label in enumerate(rounds):
        next_y = y - row_h
        if index % 2 == 1:
            c.setFillColor(LIGHT)
            c.rect(left, next_y, total_w, row_h, fill=1, stroke=0)
        baseline = next_y + row_h / 2 - 3.2
        draw_text(c, round_label, (col_xs[0] + col_xs[1]) / 2, baseline, font=FONT_BOLD, size=11.0, align="center")
        draw_text(c, "월          일", (col_xs[1] + col_xs[2]) / 2, baseline, size=10.0, color=SLATE, align="center")
        draw_text(c, f"/ {word_count}", col_xs[3] - 4 * mm, baseline, size=10.5, color=SLATE, align="right")
        cy = next_y + row_h / 2
        c.setStrokeColor(SLATE)
        c.setLineWidth(0.55)
        c.circle((col_xs[3] + col_xs[4]) / 2, cy, 1.9 * mm, fill=0, stroke=1)
        y = next_y

    table_bottom = table_top - header_h - len(rounds) * row_h
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    for x in col_xs:
        c.line(x, table_bottom, x, table_top)
    c.setStrokeColor(white)
    for x in col_xs[1:-1]:
        c.line(x, table_top - header_h, x, table_top)
    c.setStrokeColor(LINE)
    for index in range(len(rounds) + 1):
        line_y = table_top - header_h - index * row_h
        c.line(left, line_y, right, line_y)
    c.rect(left, table_bottom, total_w, table_top - table_bottom, fill=0, stroke=1)

    # 헷갈린 단어 메모 — 두 칸 줄노트
    section_title_y = table_bottom - 12 * mm
    draw_text(c, "헷갈린 단어", left, section_title_y, font=FONT_BOLD, size=12.0)
    draw_text(c, "테스트에서 틀렸거나 다시 볼 단어", right, section_title_y, size=9.0, color=SLATE, align="right")
    line_gap = 11 * mm
    column_gap = 10 * mm
    column_w = (total_w - column_gap) / 2
    line_top = section_title_y - 8 * mm
    line_bottom = TABLE_BOTTOM
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    for column in range(2):
        x0 = left + column * (column_w + column_gap)
        line_y = line_top
        while line_y >= line_bottom:
            c.line(x0, line_y, x0 + column_w, line_y)
            line_y -= line_gap

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_test_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_no: int,
    part_label: str,
    rows: list[tuple[str, str]],
    start_index: int,
    page_no: int,
) -> None:
    width, height = B5
    margin_left, margin_right = page_margins_x(page_no)
    table_left = margin_left
    table_right = width - margin_right
    fold_x = (table_left + table_right) / 2
    table_top = height - TABLE_TOP_TIGHT
    table_bottom = TABLE_BOTTOM
    header_h = 8 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    title = f"{level_tag} · DAY {day_no:02d}"
    if part_label:
        title += f" · {part_label}"
    draw_day_banner(c, title, height - BANNER_Y)
    draw_text(
        c,
        f"{len(rows)} WORDS",
        table_right,
        height - BANNER_Y,
        font=FONT_BOLD,
        size=7.5,
        color=SLATE,
        align="right",
    )
    draw_text(
        c,
        "바깥쪽 정답 면을 가운데 세로선에서 뒤로 접으세요",
        width / 2,
        height - SUBTITLE_Y,
        size=9.5,
        color=SLATE,
        align="center",
    )
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.0)
    c.line(table_left, height - RULE_Y, table_right, height - RULE_Y)

    c.setFillColor(NAVY)
    c.rect(table_left, table_top - header_h, fold_x - table_left, header_h, fill=1, stroke=0)
    c.rect(fold_x, table_top - header_h, table_right - fold_x, header_h, fill=1, stroke=0)

    answer_w = fold_x - table_left
    test_w = table_right - fold_x
    answer_cols = [7 * mm, 33 * mm, answer_w - 40 * mm]
    test_cols = [24 * mm, 30 * mm, test_w - 54 * mm]

    y_header = table_top - header_h + 2.2 * mm
    draw_text(
        c,
        "단어",
        table_left + answer_cols[0] + answer_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=10.2,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻",
        table_left + answer_cols[0] + answer_cols[1] + answer_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=10.2,
        color=white,
        align="center",
    )
    for label, ratio in (("1차", 1 / 6), ("2차", 3 / 6), ("3차", 5 / 6)):
        draw_text(
            c,
            label,
            fold_x + test_cols[0] * ratio,
            y_header,
            font=FONT_BOLD,
            size=9.0,
            color=white,
            align="center",
            max_width=test_cols[0] / 3 - 1 * mm,
        )
    draw_text(
        c,
        "단어",
        fold_x + test_cols[0] + test_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=10.2,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻 써보기",
        fold_x + test_cols[0] + test_cols[1] + test_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=10.2,
        color=white,
        align="center",
        max_width=test_cols[2] - 2 * mm,
    )

    y = table_top - header_h
    for offset, (word, meaning) in enumerate(rows):
        index = start_index + offset
        next_y = y - row_h
        if offset % 2 == 1:
            c.setFillColor(LIGHT)
            c.rect(table_left, next_y, table_right - table_left, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 3.0
        draw_text(c, str(index), table_left + answer_cols[0] / 2, baseline, size=7.0, color=SLATE, align="center")
        draw_text(
            c,
            word,
            table_left + answer_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=10.5,
            max_width=answer_cols[1] - 3 * mm,
        )
        draw_text(
            c,
            POS_MEANINGS.get(word, meaning),
            table_left + answer_cols[0] + answer_cols[1] + 1.5 * mm,
            baseline,
            size=10.5,
            max_width=answer_cols[2] - 3 * mm,
        )

        draw_status_marks(c, fold_x, next_y, test_cols[0], row_h)
        draw_text(
            c,
            word,
            fold_x + test_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=10.5,
            max_width=test_cols[1] - 3 * mm,
        )
        blank_left = fold_x + test_cols[0] + test_cols[1] + 1.5 * mm
        blank_right = table_right - 1.5 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(blank_left, next_y + 2.3 * mm, blank_right, next_y + 2.3 * mm)
        y = next_y

    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    x_positions = [
        table_left,
        table_left + answer_cols[0],
        table_left + answer_cols[0] + answer_cols[1],
        fold_x,
        fold_x + test_cols[0],
        fold_x + test_cols[0] + test_cols[1],
        table_right,
    ]
    for x in x_positions:
        c.line(x, table_bottom, x, table_top)
    # 1차/2차/3차 칸 구분 세로줄 (본문)
    for ratio in (1 / 3, 2 / 3):
        div_x = fold_x + test_cols[0] * ratio
        c.line(div_x, table_bottom, div_x, table_top - header_h)
    # 헤더(검은 배경) 구간은 내부 세로줄을 전부 같은 굵기의 흰색으로 통일
    c.setStrokeColor(white)
    header_div_xs = x_positions[1:-1] + [
        fold_x + test_cols[0] * 1 / 3,
        fold_x + test_cols[0] * 2 / 3,
    ]
    for div_x in header_div_xs:
        c.line(div_x, table_top - header_h, div_x, table_top)
    c.setStrokeColor(LINE)
    for i in range(len(rows) + 1):
        line_y = table_top - header_h - i * row_h
        c.line(table_left, line_y, table_right, line_y)
    c.rect(table_left, table_bottom, table_right - table_left, table_top - table_bottom, fill=0, stroke=1)

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_practice_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_no: int,
    part_label: str,
    rows: list[tuple[str, str]],
    pronunciations: dict[str, tuple[str, str]],
    page_no: int,
) -> None:
    width, height = B5
    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    table_top = height - TABLE_TOP_TIGHT - 2 * mm
    table_bottom = TABLE_BOTTOM
    header_h = 8.5 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    title = f"DAY {day_no:02d} · PRACTICE"
    if part_label:
        title += f" · {part_label}"
    draw_day_banner(c, title, height - BANNER_Y)
    draw_text(
        c,
        "영단어를 따라 쓰고, 뜻을 직접 써보세요.",
        width / 2,
        height - SUBTITLE_Y,
        size=9.5,
        color=SLATE,
        align="center",
    )
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.0)
    c.line(left, height - RULE_Y, right, height - RULE_Y)

    total_w = right - left
    col_widths = [30 * mm, 46 * mm, 32 * mm, 32 * mm, total_w - 140 * mm]
    headers = ["단어", "발음", "뜻 쓰기", "영단어 써보기", "완료"]

    c.setFillColor(NAVY)
    c.rect(left, table_top - header_h, total_w, header_h, fill=1, stroke=0)
    x = left
    for label, col_w in zip(headers, col_widths):
        header_size = 10.2
        draw_text(
            c,
            label,
            x + col_w / 2,
            table_top - header_h + 2.5 * mm,
            font=FONT_BOLD,
            size=header_size,
            color=white,
            align="center",
            max_width=col_w - 1.5 * mm,
        )
        x += col_w

    y = table_top - header_h
    for offset, (word, _meaning) in enumerate(rows):
        next_y = y - row_h
        if offset % 2 == 1:
            c.setFillColor(LIGHT)
            c.rect(left, next_y, total_w, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 3.0
        ipa, korean = pronunciations[word]
        draw_text(c, word, left + 1.5 * mm, baseline, font=FONT_BOLD, size=10.5, max_width=col_widths[0] - 3 * mm)

        pron_left = left + col_widths[0]
        ipa_w = col_widths[1] * 0.56
        kor_w = col_widths[1] - ipa_w
        draw_text(
            c,
            ipa.strip("/"),
            pron_left + 1.5 * mm,
            baseline,
            font=FONT_IPA,
            size=10.5,
            color=INK,
            max_width=ipa_w - 1.5 * mm,
        )
        draw_text(
            c,
            f"[{korean}]",
            pron_left + ipa_w,
            baseline,
            size=10.5,
            color=SLATE,
            max_width=kor_w - 1.2 * mm,
        )

        meaning_left = left + col_widths[0] + col_widths[1] + 1.5 * mm
        meaning_right = left + col_widths[0] + col_widths[1] + col_widths[2] - 1.5 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(meaning_left, next_y + 2.3 * mm, meaning_right, next_y + 2.3 * mm)
        y = next_y

    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    x = left
    x_positions = [left]
    for col_w in col_widths:
        x += col_w
        x_positions.append(x)
    for x in x_positions:
        c.line(x, table_bottom, x, table_top)
    # 헤더(검은 배경) 구간은 내부 세로줄을 테스트 면과 동일하게 흰색으로
    c.setStrokeColor(white)
    for x in x_positions[1:-1]:
        c.line(x, table_top - header_h, x, table_top)
    c.setStrokeColor(LINE)
    for i in range(len(rows) + 1):
        line_y = table_top - header_h - i * row_h
        c.line(left, line_y, right, line_y)
    c.rect(left, table_bottom, total_w, table_top - table_bottom, fill=0, stroke=1)

    done_center_x = right - col_widths[-1] / 2
    for i in range(len(rows)):
        cy = table_top - header_h - (i + 0.5) * row_h
        c.circle(done_center_x, cy, min(1.8 * mm, row_h * 0.24), fill=0, stroke=1)

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def resolve_output_path(base: Path) -> Path:
    candidate = base
    for n in range(2, 20):
        try:
            with open(candidate, "ab"):
                return candidate
        except FileNotFoundError:
            return candidate
        except PermissionError:
            candidate = base.with_stem(f"{base.stem}{n}")
    raise PermissionError("PDF 저장 경로가 모두 잠겨 있습니다. 열려 있는 PDF를 닫아 주세요.")


def validate_pronunciations(rows: list[tuple[str, str]], pronunciations: dict[str, tuple[str, str]]) -> None:
    missing = [word for word, _ in rows if word not in pronunciations]
    if missing:
        raise ValueError(f"발음이 없는 단어: {missing}")


def build_middle_days_pdf(days: list[list[tuple[str, str]]], *, include_covers: bool = True) -> Path:
    """앞부분 + 1회독(Day×4) + 랜덤 표지 + 랜덤 1회독(TEST) + 색인."""
    global POS_MEANINGS
    pron, pos = load_middle_meta()
    POS_MEANINGS = pos

    OUT_MIDDLE.mkdir(parents=True, exist_ok=True)
    day_count = len(days)
    word_count = sum(len(rows) for rows in days)
    random_days = shuffle_days_for_random_review(days)
    first_day_page = middle_first_day_page(include_covers=include_covers)
    random_divider_page = first_day_page + day_count * MIDDLE_PAGES_PER_DAY_ROUND1
    random_first_test_page = random_divider_page + 1
    random_last_test_page = random_first_test_page + day_count - 1

    name_suffix = "" if include_covers else "_내지"
    out_path = resolve_output_path(OUT_MIDDLE / f"트리거보카_중등_Day01-{day_count:02d}_B5{name_suffix}.pdf")
    c = canvas.Canvas(str(out_path), pagesize=B5, pageCompression=1)
    c.setTitle(f"트리거 보카 중등 Day 01-{day_count:02d} B5")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject(
        "B5 중등 단어장 (1회독 + 랜덤 1회독)"
        if include_covers
        else "B5 중등 단어장 내지 (1회독 + 랜덤 1회독 · 표지 제외)"
    )
    c.setCreator("TRIGGER VOCA Book Generator")

    contents_page_no = 2 if include_covers else 1
    if include_covers:
        draw_cover(
            c,
            level_en="MIDDLE SCHOOL",
            level_ko="중등",
            day_label=f"DAY 01–{day_count:02d} · {word_count} WORDS",
            words_note="1회독 + 랜덤 1회독 · Day 구분은 페이지 헤더만 사용합니다.",
        )
    contents = build_middle_round1_contents_entries(days, include_covers=include_covers)
    draw_contents_page(
        c,
        level_tag="MIDDLE",
        entries=contents,
        page_no=contents_page_no,
        footer_note=(
            f"랜덤 1회독 · p.{random_divider_page}(안내) · "
            f"p.{random_first_test_page}–{random_last_test_page}(TEST)"
        ),
    )
    draw_howto_page(c, level_tag="MIDDLE", page_no=contents_page_no + 1)
    draw_pronunciation_guide(c, level_tag="MIDDLE", page_no=contents_page_no + 2)
    page_no = first_day_page
    for day_no, rows in enumerate(days, 1):
        draw_day_divider(
            c,
            level_tag="MIDDLE",
            day_no=day_no,
            rows=rows,
            page_no=page_no,
        )
        page_no += 1
        draw_day_log_page(
            c,
            level_tag="MIDDLE",
            day_no=day_no,
            word_count=len(rows),
            page_no=page_no,
        )
        page_no += 1
        draw_test_page(
            c,
            level_tag="MIDDLE",
            day_no=day_no,
            part_label="",
            rows=rows,
            start_index=1,
            page_no=page_no,
        )
        page_no += 1
        draw_practice_page(
            c,
            level_tag="MIDDLE",
            day_no=day_no,
            part_label="",
            rows=rows,
            pronunciations=pron,
            page_no=page_no,
        )
        page_no += 1

    draw_random_review_divider(
        c,
        level_tag="MIDDLE",
        day_count=day_count,
        word_count=word_count,
        random_first_test_page=random_first_test_page,
        page_no=page_no,
    )
    page_no += 1
    for day_no, rows in enumerate(random_days, 1):
        draw_test_page(
            c,
            level_tag="MIDDLE",
            day_no=day_no,
            part_label="RANDOM",
            rows=rows,
            start_index=1,
            page_no=page_no,
        )
        page_no += 1

    index_entries = build_word_index_entries(
        days,
        first_day_page=first_day_page,
        pages_per_day=MIDDLE_PAGES_PER_DAY_ROUND1,
    )
    page_no = draw_index_pages(
        c,
        level_tag="MIDDLE",
        entries=index_entries,
        start_page_no=page_no,
    )
    if include_covers:
        draw_back_cover(c)
    c.save()
    return out_path


def build_middle_pdf(rows: list[tuple[str, str]]) -> Path:
    return build_middle_days_pdf([rows])


def build_high_pdf(rows: list[tuple[str, str]]) -> Path:
    OUT_HIGH.mkdir(parents=True, exist_ok=True)
    out_path = resolve_output_path(OUT_HIGH / "트리거보카_고등_Day01_B5샘플.pdf")
    c = canvas.Canvas(str(out_path), pagesize=B5, pageCompression=1)
    c.setTitle("트리거 보카 고등 Day 01 B5 샘플")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject("B5 고등 단어장 하루치 샘플 (20+20)")
    c.setCreator("TRIGGER VOCA Book Generator")

    draw_cover(
        c,
        level_en="HIGH SCHOOL",
        level_ko="고등",
        day_label="DAY 01 · 40 WORDS",
        words_note="고등 하루치 40개를 20개씩 두 세트(TEST+연습)로 나눕니다.",
    )
    draw_contents_page(c, level_tag="HIGH", entries=[("DAY 01", len(rows), 4, 7)], page_no=2)
    draw_pronunciation_guide(c, level_tag="HIGH", page_no=3)

    parts = [
        ("1–20", rows[:20], 1),
        ("21–40", rows[20:], 21),
    ]
    page_no = 4
    for part_label, part_rows, start_index in parts:
        draw_test_page(
            c,
            level_tag="HIGH",
            day_no=1,
            part_label=part_label,
            rows=part_rows,
            start_index=start_index,
            page_no=page_no,
        )
        page_no += 1
        draw_practice_page(
            c,
            level_tag="HIGH",
            day_no=1,
            part_label=part_label,
            rows=part_rows,
            pronunciations=HIGH_PRON,
            page_no=page_no,
        )
        page_no += 1
    draw_back_cover(c)
    c.save()
    return out_path


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--interior-only",
        action="store_true",
        help="부크크용 내지 PDF만 생성 (앞·뒤표지 제외)",
    )
    args = parser.parse_args()
    register_fonts()

    # 중등 전체 50일(1,200단어): 목차·사용법·발음 + Day×(간지 앞·뒤+TEST+PRACTICE) [+ 표지]
    middle_words = load_words(ROOT / "voca_middle.txt")
    middle_days = chunk_days(middle_words, 24)
    pron, _ = load_middle_meta()
    for day_rows in middle_days:
        validate_pronunciations(day_rows, pron)
    if args.interior_only:
        interior_path = build_middle_days_pdf(middle_days, include_covers=False)
        print(f"중등 B5 내지: {interior_path}")
        return

    middle_path = build_middle_days_pdf(middle_days)
    print(f"중등 B5 전체: {middle_path}")
    interior_path = build_middle_days_pdf(middle_days, include_covers=False)
    print(f"중등 B5 내지: {interior_path}")

    # 고등 Day01 샘플 (40단어) — 전체 고등은 발음 메타 준비 후
    high_rows = load_words(ROOT / "voca_high.txt", count=40)
    validate_pronunciations(high_rows, HIGH_PRON)
    high_path = build_high_pdf(high_rows)
    print(f"고등 B5 Day01 샘플: {high_path}")


if __name__ == "__main__":
    main()
