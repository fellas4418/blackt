"""중등·고등 보카 종이책 B5 샘플 PDF.

중등: 하루 24개 → 1회독(간지·STUDY LOG·TEST·PRACTICE) + 랜덤 1회독(TEST만)
고등: 하루 40개 → 20개씩 TEST+PRACTICE × 2세트
"""

from __future__ import annotations

import importlib.util
import random
import re
import sys
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_MIDDLE = ROOT / "단어장 PDF" / "중등"
OUT_HIGH = ROOT / "단어장 PDF" / "고등"
META_PATH = ROOT / "scripts" / "voca-book-meta.py"
MARK_PATH = ROOT / "로고, 이미지" / "로고 최종.png"
_MARK_CACHE: dict[bool, ImageReader] = {}


def mark_reader(*, for_dark: bool) -> ImageReader:
    """T 마크. 어두운 배경용은 검정 픽셀을 투명 처리."""
    if for_dark not in _MARK_CACHE:
        img = PILImage.open(MARK_PATH).convert("RGBA")
        if for_dark:
            pixels = img.load()
            w, h = img.size
            for y in range(h):
                for x in range(w):
                    r, g, b, a = pixels[x, y]
                    if r < 45 and g < 45 and b < 45:
                        pixels[x, y] = (r, g, b, 0)
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        _MARK_CACHE[for_dark] = ImageReader(buf)
    return _MARK_CACHE[for_dark]


def draw_mark(
    c: canvas.Canvas,
    x: float,
    y: float,
    size: float,
    *,
    for_dark: bool,
) -> None:
    c.drawImage(
        mark_reader(for_dark=for_dark),
        x,
        y,
        width=size,
        height=size,
        preserveAspectRatio=True,
        mask="auto",
    )

# 기본: 부크크 JIS B5 (182×257). --kyobo 시 교보 46배판 (188×254).
B5_BOOKK = (182 * mm, 257 * mm)
B5_KYOBO = (188 * mm, 254 * mm)
B5 = B5_BOOKK
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
    """(left, right). PDF 홀수=오른쪽 면(바깥 오른쪽), 짝수=왼쪽 면(바깥 왼쪽)."""
    if page_no % 2 == 1:
        return MARGIN_INNER, MARGIN_OUTER
    return MARGIN_OUTER, MARGIN_INNER


def draw_page_footer(
    c: canvas.Canvas,
    page_no: int,
    level_tag: str,
    *,
    dark_bg: bool = False,
) -> None:
    width, _ = B5
    margin_left, margin_right = page_margins_x(page_no)
    label = f"TRIGGER VOCA · {level_tag}"
    ink = white if dark_bg else SLATE
    if page_no % 2 == 1:
        draw_text(c, label, margin_left, MARGIN_BOTTOM, size=6.5, color=ink)
        draw_text(c, str(page_no), width - margin_right, MARGIN_BOTTOM, size=10.4, color=ink, align="right")
    else:
        draw_text(c, str(page_no), margin_left, MARGIN_BOTTOM, size=10.4, color=ink)
        draw_text(c, label, width - margin_right, MARGIN_BOTTOM, size=6.5, color=ink, align="right")


def draw_divider_mark(c: canvas.Canvas, width: float, height: float) -> None:
    """검정 간지 상단 왼쪽 T 마크 (타이틀과 같은 높이대)."""
    size = 16 * mm
    draw_mark(c, 18 * mm, height - 18 * mm - size, size, for_dark=True)

FONT_REGULAR = "Pretendard"
FONT_BOLD = "PretendardBold"
FONT_BLACK = "PretendardBlack"
FONT_IPA = "Pretendard"  # IPA도 Pretendard (중등 메타 IPA 글리프 전부 포함)
FONT_IPA_BOLD = "PretendardBold"
FONT_LOGO = "BlackHanSans"  # Trigger 워드마크와 맞춘 디스플레이 서체
# 브랜드 색 — 트리거 블랙: 검정 배경 + 흰 글씨, 흑백 인쇄에서도 구분되는 무채색
NAVY = HexColor("#0A0A0A")  # 브랜드 블랙 (헤더 바·배너·표지)
NEON_BLUE = HexColor("#00F3FF")  # 앱 네온블루 — 고등 배지·혼동 간지 포인트
NEON_GREEN = HexColor("#39FF14")  # 토익 레벨 배지
ORANGE = HexColor("#FF9900")  # 중등 레벨 배지 테두리·슬로건 마침표
SLATE = HexColor("#5C5C5C")
PALE = HexColor("#EEF1F4")
LIGHT = HexColor("#F7F7F7")  # 줄무늬 배경
PAIR_EVEN = HexColor("#DEDEDE")  # 혼동 어휘 짝수 페어 배경
DIFF_RED = HexColor("#C62828")  # 혼동 어휘 — 다른 철자 강조
LINE = HexColor("#9AA4AE")
INK = HexColor("#20262D")
LOGO_SHADOW = HexColor("#636262")  # trigger-logo-v2 그림자 샘플
# Day/REVIEW/INDEX 간지 바 — 교보 부분컬러용 무채(혼동 구간만 NEON·빨강)
DIVIDER_ACCENT = PALE


def load_level_meta(level: str):
    spec = importlib.util.spec_from_file_location("voca_book_meta", META_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"메타 로드 실패: {META_PATH}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["voca_book_meta"] = mod
    spec.loader.exec_module(mod)
    return mod.meta_for_level(level)


# 교보 부분컬러(≤10쪽)용 — 혼동 표 밀도 상향
CONFUSABLE_COMPACT = False

# 혼동 어휘(철자) — (word_a, tag_a|None, word_b, tag_b|None). tag는 단어 오른쪽 (타동사)/(자동사) 등.
CONFUSABLE_SPELLING: list[tuple[str, str | None, str, str | None]] = [
    ("affect", None, "effect", None),
    ("raise", "타동사", "rise", "자동사"),
    ("adapt", None, "adopt", None),
    ("principal", None, "principle", None),
    ("purse", None, "pursue", None),
    ("garage", None, "garbage", None),
    ("patent", None, "patient", None),
    ("rely", None, "reply", None),
    ("compete", None, "complete", None),
    ("past", None, "paste", None),
    ("pain", None, "plain", None),
    ("found", None, "fund", None),
    ("exist", None, "exit", None),
    ("distinct", None, "district", None),
    ("thorough", None, "though", None),
    ("effective", None, "efficient", None),
    ("content", None, "continent", None),
    ("contract", None, "contrast", None),
    ("factor", None, "factory", None),
    ("produce", None, "product", None),
    ("rid", None, "ride", None),
    ("sting", None, "string", None),
]

# 혼동 어휘(품사) — 품사 한글자(수기). 메타 오표기 보정 포함.
CONFUSABLE_DERIVATION: list[tuple[str, str, str, str]] = [
    ("threat", "명", "threaten", "동"),
    ("absent", "형", "absence", "명"),
    ("gradual", "형", "gradually", "부"),
    ("immediate", "형", "immediately", "부"),
    ("definite", "형", "definitely", "부"),
    ("exhaust", "동", "exhausted", "형"),
    ("concern", "명", "concerned", "형"),
    ("explain", "동", "explanation", "명"),
    ("construct", "동", "construction", "명"),
    ("instruct", "동", "instruction", "명"),
    ("organize", "동", "organization", "명"),
    ("solve", "동", "solution", "명"),
    ("prove", "동", "proof", "명"),
    ("appear", "동", "appearance", "명"),
    ("attend", "동", "attention", "명"),
    ("attract", "동", "attraction", "명"),
    ("press", "동", "pressure", "명"),
    ("nature", "명", "natural", "형"),
    ("announce", "동", "announcer", "명"),
    ("complain", "동", "complaint", "명"),
    ("counsel", "동", "counselor", "명"),
    ("contain", "동", "container", "명"),
    ("classic", "형", "classical", "형"),
]

# 혼동 어휘 — 실제 짧게 나는 한글 발음 (표기용)
CONFUSABLE_KO_PRON: dict[str, str] = {
    "affect": "어펙트",
    "effect": "이펙트",
    "raise": "레이즈",
    "rise": "라이즈",
    "adapt": "어댑트",
    "adopt": "어답트",
    "principal": "프린시펄",
    "principle": "프린시플",
    "purse": "퍼스",
    "pursue": "퍼슈",
    "garage": "개라지",
    "garbage": "가비지",
    "patent": "패튼트",
    "patient": "페이션트",
    "rely": "릴라이",
    "reply": "리플라이",
    "compete": "컴피트",
    "complete": "컴플리트",
    "past": "패스트",
    "paste": "페이스트",
    "pain": "페인",
    "plain": "플레인",
    "found": "파운드",
    "fund": "펀드",
    "exist": "이그지스트",
    "exit": "엑시트",
    "distinct": "디스팅트",
    "district": "디스트릭트",
    "thorough": "써로",
    "though": "도우",
    "effective": "이펙티브",
    "efficient": "이피션트",
    "content": "컨텐츠",
    "continent": "콘티넌트",
    "contract": "컨트랙트",
    "contrast": "컨트라스트",
    "factor": "팩터",
    "factory": "팩토리",
    "rid": "리드",
    "ride": "라이드",
    "sting": "스팅",
    "string": "스트링",
    "threat": "스렛",
    "threaten": "스레튼",
    "absent": "앱선트",
    "absence": "앱선스",
    "gradual": "그래주얼",
    "gradually": "그래주얼리",
    "immediate": "이미디엇",
    "immediately": "이미디엇리",
    "definite": "데피닛",
    "definitely": "데피닛리",
    "exhaust": "이그조스트",
    "exhausted": "이그조스티드",
    "concern": "컨선",
    "concerned": "컨선드",
    "explain": "익스플레인",
    "explanation": "익스플러네이션",
    "construct": "컨스트럭트",
    "construction": "컨스트럭션",
    "instruct": "인스트럭트",
    "instruction": "인스트럭션",
    "organize": "오거나이즈",
    "organization": "오거나이제이션",
    "solve": "솔브",
    "solution": "솔루션",
    "prove": "프루브",
    "proof": "프루프",
    "appear": "어피어",
    "appearance": "어피어런스",
    "attend": "어텐드",
    "attention": "어텐션",
    "attract": "어트랙트",
    "attraction": "어트랙션",
    "press": "프레스",
    "pressure": "프레셔",
    "produce": "프로듀스",
    "product": "프로덕트",
    "nature": "네이처",
    "natural": "내추럴",
    "announce": "어나운스",
    "announcer": "어나운서",
    "complain": "컴플레인",
    "complaint": "컴플레인트",
    "counsel": "카운슬",
    "counselor": "카운슬러",
    "contain": "컨테인",
    "container": "컨테이너",
    "classic": "클래식",
    "classical": "클래시컬",
}

# 혼동 어휘 — 뜻 표기 고정(메타와 다를 때)
CONFUSABLE_MEANING_OVERRIDE: dict[str, str] = {}

# 혼동 어휘 — 품사 한글자 (전부 수기, 빠짐 없이)
CONFUSABLE_POS: dict[str, str] = {
    "affect": "동",
    "effect": "명",
    "raise": "동",
    "rise": "동",
    "adapt": "동",
    "adopt": "동",
    "principal": "명",
    "principle": "명",
    "purse": "명",
    "pursue": "동",
    "garage": "명",
    "garbage": "명",
    "patent": "명",
    "patient": "명",
    "rely": "동",
    "reply": "동",
    "compete": "동",
    "complete": "동",
    "past": "명",
    "paste": "동",
    "pain": "명",
    "plain": "형",
    "found": "동",
    "fund": "명",
    "exist": "동",
    "exit": "명",
    "distinct": "형",
    "district": "명",
    "thorough": "형",
    "though": "접",
    "effective": "형",
    "efficient": "형",
    "content": "명",
    "continent": "명",
    "contract": "명",
    "contrast": "동",
    "factor": "명",
    "factory": "명",
    "rid": "동",
    "ride": "동",
    "sting": "동",
    "string": "명",
    "threat": "명",
    "threaten": "동",
    "absent": "형",
    "absence": "명",
    "gradual": "형",
    "gradually": "부",
    "immediate": "형",
    "immediately": "부",
    "definite": "형",
    "definitely": "부",
    "exhaust": "동",
    "exhausted": "형",
    "concern": "명",
    "concerned": "형",
    "explain": "동",
    "explanation": "명",
    "construct": "동",
    "construction": "명",
    "instruct": "동",
    "instruction": "명",
    "organize": "동",
    "organization": "명",
    "solve": "동",
    "solution": "명",
    "prove": "동",
    "proof": "명",
    "appear": "동",
    "appearance": "명",
    "attend": "동",
    "attention": "명",
    "attract": "동",
    "attraction": "명",
    "press": "동",
    "pressure": "명",
    "produce": "동",
    "product": "명",
    "nature": "명",
    "natural": "형",
    "announce": "동",
    "announcer": "명",
    "complain": "동",
    "complaint": "명",
    "counsel": "동",
    "counselor": "명",
    "contain": "동",
    "container": "명",
    "classic": "형",
    "classical": "형",
}

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
    brand_dir = ROOT / "fonts"  # 앱과 동일한 Pretendard (브랜드 통일)
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(brand_dir / "Pretendard-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(brand_dir / "Pretendard-Bold.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BLACK, str(brand_dir / "Pretendard-Black.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_LOGO, str(brand_dir / "BlackHanSans-Regular.ttf")))


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


def middle_first_day_page(*, include_covers: bool, kyobo: bool = False) -> int:
    """1회독 Day 01 간지가 시작하는 페이지 번호."""
    # 표지 제외: 목차·사용법·발음 = 3쪽 → Day 4
    # 교보 판권은 INDEX 뒤(맨 끝) — Day 시작은 동일
    _ = kyobo
    if include_covers:
        return 5
    return 4


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
    kyobo: bool = False,
) -> list[tuple[str, int, int, int]]:
    first = middle_first_day_page(include_covers=include_covers, kyobo=kyobo)
    return [
        (
            f"DAY {day_no:02d}",
            len(rows),
            first + (day_no - 1) * MIDDLE_PAGES_PER_DAY_ROUND1,
            first + (day_no - 1) * MIDDLE_PAGES_PER_DAY_ROUND1 + MIDDLE_PAGES_PER_DAY_ROUND1 - 1,
        )
        for day_no, rows in enumerate(days, 1)
    ]


def _confusable_pairs_fit(content_top: float) -> int:
    if CONFUSABLE_COMPACT:
        # 페이지당 5줄(페어) = 10칸 (기존 4줄/8칸 → 5줄/10칸)
        pair_h = 32.0 * mm
        pair_gap = 2.2 * mm
    else:
        pair_h = 33.0 * mm  # word_block_h 22 + mean_h 11
        pair_gap = 6.0 * mm
    count = 0
    y = content_top
    while y - pair_h >= TABLE_BOTTOM:
        count += 1
        y -= pair_h + pair_gap
    return count


def confusable_pair_page_count(n_rows: int) -> int:
    """혼동 어휘 페어 표 페이지 수 (draw_confusable_pairs_pages와 동일 간격)."""
    if n_rows <= 0:
        return 0
    height = B5[1]
    first_n = _confusable_pairs_fit(height - 52 * mm)
    cont_n = max(1, _confusable_pairs_fit(height - TABLE_TOP_LOOSE))
    if n_rows <= first_n:
        return 1
    return 1 + (n_rows - first_n + cont_n - 1) // cont_n


def index_page_count(n_words: int) -> int:
    """INDEX 페이지 수 (draw_index_pages와 동일 밀도)."""
    if n_words <= 0:
        return 0
    height = B5[1]
    cols = 3
    row_h = 5.2 * mm
    top = height - TABLE_TOP_LOOSE + 4 * mm
    rows_per_col = int((top - TABLE_BOTTOM) / row_h)
    per_page = max(1, rows_per_col * cols)
    # 알파벳 헤더 약 26칸 + 단어
    items = n_words + 26
    return (items + per_page - 1) // per_page


def build_middle_back_matter_note(
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool,
    kyobo: bool = False,
) -> str:
    """목차 하단 — REVIEW · 혼동 어휘 · INDEX 페이지 안내."""
    day_count = len(days)
    word_count = sum(len(rows) for rows in days)
    first = middle_first_day_page(include_covers=include_covers, kyobo=kyobo)
    round1_end = first + day_count * MIDDLE_PAGES_PER_DAY_ROUND1 - 1
    review_div = round1_end + 1
    review_start = review_div + 1
    review_end = review_start + day_count - 1
    conf_div = review_end + 1
    spelling_pages = confusable_pair_page_count(len(CONFUSABLE_SPELLING))
    derivation_pages = confusable_pair_page_count(len(CONFUSABLE_DERIVATION))
    conf_start = conf_div + 1
    conf_end = conf_div + spelling_pages + derivation_pages
    index_div = conf_end + 1
    index_start = index_div + 1
    index_end = index_div + index_page_count(word_count)
    return (
        f"REVIEW {review_div}–{review_end}  ·  "
        f"혼동 어휘 {conf_div}–{conf_end}  ·  "
        f"INDEX {index_div}–{index_end}"
    )


def fit_font_size(text: str, font: str, max_size: float, max_width: float) -> float:
    size = max_size
    while size > 5.8 and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 0.2
    return size


def draw_colophon_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
    title: str | None = None,
    words_line: str | None = None,
    isbn: str | None = "979-11-993384-0-1",
    price: str = "16,000원",
    pub_date: str = "2026년 7월 31일",
) -> None:
    """교보 POD 필수 판권 페이지."""
    width, height = B5
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    max_w = right - left
    cx = width / 2

    book_title = title or f"트리거 보카 {level_tag}"
    book_words = words_line or "Trigger VOCA · DAY 01–50 · 1,200 WORDS"

    y = height - 48 * mm
    draw_text(c, book_title, cx, y, font=FONT_BOLD, size=22, color=INK, align="center")
    y -= 10 * mm
    draw_text(
        c,
        book_words,
        cx,
        y,
        font=FONT_REGULAR,
        size=12,
        color=SLATE,
        align="center",
    )

    y -= 22 * mm
    rows = [
        ("발행일", pub_date),
        ("지은이", "Looke"),
        ("발행처", "플레이온"),
    ]
    if isbn:
        rows.append(("ISBN", isbn))
    rows += [
        ("이메일", "ohryee@gmail.com"),
        ("값", price),
    ]
    label_w = 28 * mm
    for label, value in rows:
        draw_text(c, f"{label}", left, y, font=FONT_BOLD, size=12, color=INK)
        draw_text(c, value, left + label_w, y, font=FONT_REGULAR, size=12, color=INK, max_width=max_w - label_w)
        y -= 9.5 * mm

    y -= 14 * mm
    draw_text(c, "ⓒ Looke 2026", left, y, font=FONT_BOLD, size=12, color=INK)
    y -= 12 * mm
    legal = (
        "* 이 책 내용의 전부 또는 일부를 재사용하려면 "
        "반드시 저작권자의 동의를 받으셔야 합니다."
    )
    # wrap legal
    words = legal.split(" ")
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip() if cur else w
        if pdfmetrics.stringWidth(trial, FONT_REGULAR, 10.5) <= max_w:
            cur = trial
        else:
            draw_text(c, cur, left, y, font=FONT_REGULAR, size=10.5, color=SLATE)
            y -= 6.5 * mm
            cur = w
    if cur:
        draw_text(c, cur, left, y, font=FONT_REGULAR, size=10.5, color=SLATE)
        y -= 10 * mm

    ai_note = (
        "단어 선별·검수·학습 설계는 직접 진행했으며, "
        "편집·제작 일부에 AI를 활용했습니다."
    )
    cur = ""
    for w in ai_note.split(" "):
        trial = f"{cur} {w}".strip() if cur else w
        if pdfmetrics.stringWidth(trial, FONT_REGULAR, 10) <= max_w:
            cur = trial
        else:
            draw_text(c, cur, left, y, font=FONT_REGULAR, size=10, color=SLATE)
            y -= 6.2 * mm
            cur = w
    if cur:
        draw_text(c, cur, left, y, font=FONT_REGULAR, size=10, color=SLATE)

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


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
    main_title: str = "트리거 보카",
    subtitle: str = "Trigger VOCA",
) -> None:
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    badge_w, badge_h = 26 * mm, 12 * mm
    badge_x, badge_y = 18 * mm, height - 18 * mm - badge_h
    badge_stroke = ORANGE if level_ko == "중등" else (
        NEON_GREEN if level_ko in ("토익", "TOEIC") else NEON_BLUE
    )
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
    mark_size = 14 * mm
    draw_mark(
        c,
        width - 18 * mm - mark_size,
        18 * mm,
        mark_size,
        for_dark=True,
    )

    title_size = 52
    title_y = height - 108 * mm
    accent_w = 72 * mm
    c.setStrokeColor(NEON_BLUE)
    c.setLineWidth(2.2)
    c.line((width - accent_w) / 2, title_y + title_size * 0.55, (width + accent_w) / 2, title_y + title_size * 0.55)
    c.line((width - accent_w) / 2, title_y + title_size * 0.55 + 3.5, (width + accent_w) / 2, title_y + title_size * 0.55 + 3.5)

    shadow_dx = title_size * 0.05
    shadow_dy = -title_size * 0.04
    c.saveState()
    c.translate(width / 2, title_y)
    c.skew(0, 12)
    c.setFont(FONT_LOGO, title_size)
    c.setFillColor(LOGO_SHADOW)
    for i in range(10, 0, -1):
        t = i / 10
        c.drawCentredString(shadow_dx * t, shadow_dy * t, main_title)
    c.setFillColor(white)
    c.drawCentredString(0, 0, main_title)
    c.restoreState()

    draw_text(
        c,
        subtitle,
        width / 2,
        title_y - 22 * mm,
        font=FONT_BOLD,
        size=18,
        color=PALE,
        align="center",
    )

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
    """뒤표지 — 슬로건 + 앱 QR."""
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
    subtitle_extra = 0.0
    if footer_note:
        draw_text(
            c,
            footer_note,
            width / 2,
            height - SUBTITLE_Y - 6.5 * mm,
            size=8.2,
            color=SLATE,
            align="center",
        )
        subtitle_extra = 8.0 * mm

    margin_left, margin_right = page_margins_x(page_no)
    gap = 8 * mm
    column_count = 2 if len(entries) > 25 else 1
    table_w = width - margin_left - margin_right
    column_w = (table_w - gap * (column_count - 1)) / column_count
    rows_per_column = (len(entries) + column_count - 1) // column_count
    table_top = height - TABLE_TOP_LOOSE - subtitle_extra
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
    meta_size = 7.5
    meta_max_w = pdfmetrics.stringWidth("D00 · 000", FONT_REGULAR, meta_size)
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
                    # D 열 고정(왼쪽 정렬) — 페이지 자리수 차이로 D가 흔들리지 않게
                    meta_x = left + col_w - 1.2 * mm - meta_max_w
                    word_max = meta_x - left - 2.5 * mm
                    draw_text(c, word, left + 1.2 * mm, baseline, font=FONT_BOLD, size=8.0, max_width=word_max)
                    draw_text(c, meta, meta_x, baseline, size=meta_size, color=SLATE)
                y = next_y

        draw_page_footer(c, page_no, level_tag)
        c.showPage()
        page_no += 1

    return page_no


def draw_howto_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
    words_per_day: int = 24,
) -> None:
    """TEST부터 복습까지 하루 학습 순서를 안내."""
    width, height = B5
    draw_day_banner(c, "HOW TO STUDY", height - BANNER_Y)
    lead = (
        f"하루 {words_per_day}단어를 네 단계로 반복하세요."
        if words_per_day <= 24
        else f"하루 {words_per_day}단어를 20개씩 두 세트로 나눠 네 단계로 반복하세요."
    )
    draw_text(
        c,
        lead,
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
    draw_text(
        c,
        "1회독 뒤에는 랜덤 REVIEW · 혼동 어휘 · INDEX가 이어집니다.",
        width / 2,
        height - SUBTITLE_Y - 13.5 * mm,
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
    top = height - SUBTITLE_Y - 24 * mm
    box_h = 32 * mm
    gap = 6 * mm
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
        draw_text(c, description, left + 24 * mm, y + box_h / 2 - 4.3 * mm, size=13.0, color=SLATE, max_width=right - left - 30 * mm)

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

    draw_divider_mark(c, width, height)
    center_y = height * 0.58
    draw_text(c, "DAY", width / 2, center_y + 30 * mm, font=FONT_BOLD, size=20, color=PALE, align="center")
    draw_text(c, f"{day_no:02d}", width / 2, center_y - 10 * mm, font=FONT_BOLD, size=96, color=white, align="center")
    bar_w = 26 * mm
    c.setFillColor(DIVIDER_ACCENT)
    c.rect((width - bar_w) / 2, center_y - 20 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)
    draw_text(c, f"{len(rows)} WORDS", width / 2, center_y - 30 * mm, font=FONT_BOLD, size=12, color=white, align="center")
    draw_text(c, f"{rows[0][0]} – {rows[-1][0]}", width / 2, center_y - 38 * mm, size=11, color=PALE, align="center")

    draw_page_footer(c, page_no, level_tag, dark_bg=True)
    c.showPage()


def draw_random_review_divider(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_count: int,
    word_count: int,
    page_no: int,
    subtitle: str = "단어 순서 재배치 테스트",
    note_lines: list[str] | None = None,
) -> None:
    """1회독과 랜덤 복습 구간을 구분하는 표지 + 짧은 안내."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    draw_divider_mark(c, width, height)
    center_y = height * 0.62
    draw_text(c, "REVIEW", width / 2, center_y + 6 * mm, font=FONT_BOLD, size=56, color=white, align="center")
    subtitle_size = 16
    draw_text(
        c,
        subtitle,
        width / 2,
        center_y - 22 * mm,
        font=FONT_BOLD,
        size=subtitle_size,
        color=white,
        align="center",
    )

    bar_w = pdfmetrics.stringWidth(subtitle, FONT_BOLD, subtitle_size)
    c.setFillColor(DIVIDER_ACCENT)
    c.rect((width - bar_w) / 2, center_y - 30 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)
    draw_text(
        c,
        f"{word_count} WORDS · {day_count} DAYS",
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
    lines = note_lines or [
        "전체 단어 순서가 무작위로 섞여",
        "단어 뜻만으로 복습할 수 있습니다.",
    ]
    note_top = center_y - 58 * mm
    for index, line in enumerate(lines):
        draw_text(
            c,
            line,
            width / 2,
            note_top - index * 11 * mm,
            size=21,
            color=PALE,
            align="center",
            max_width=right - left,
        )

    draw_page_footer(c, page_no, level_tag, dark_bg=True)
    c.showPage()


def draw_index_divider(
    c: canvas.Canvas,
    *,
    level_tag: str,
    word_count: int,
    page_no: int,
) -> None:
    """색인 구간 앞에 두는 표지 간지."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    draw_divider_mark(c, width, height)
    center_y = height * 0.62
    draw_text(c, "INDEX", width / 2, center_y + 6 * mm, font=FONT_BOLD, size=56, color=white, align="center")
    subtitle = "단어 찾기 색인"
    subtitle_size = 16
    draw_text(
        c,
        subtitle,
        width / 2,
        center_y - 22 * mm,
        font=FONT_BOLD,
        size=subtitle_size,
        color=white,
        align="center",
    )

    bar_w = pdfmetrics.stringWidth(subtitle, FONT_BOLD, subtitle_size)
    c.setFillColor(DIVIDER_ACCENT)
    c.rect((width - bar_w) / 2, center_y - 30 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)
    draw_text(
        c,
        f"{word_count} WORDS · A–Z",
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
    note_lines = [
        "영단어를 알파벳 순으로 찾아",
        "Day·TEST 페이지를 확인할 수 있습니다.",
    ]
    note_top = center_y - 58 * mm
    for index, line in enumerate(note_lines):
        draw_text(
            c,
            line,
            width / 2,
            note_top - index * 9 * mm,
            size=16,
            color=PALE,
            align="center",
            max_width=right - left,
        )

    # 표기 안내 — 한 상자 안 2줄, abandon 시작 위치 맞춤
    guide_w = min(right - left, 118 * mm)
    guide_x = (width - guide_w) / 2
    pad_x = 3.5 * mm
    line_h = 6.2 * mm
    box_pad_y = 3.2 * mm
    box_h = box_pad_y * 2 + line_h * 2
    guide_top = note_top - 2 * 9 * mm - 10 * mm
    box_y = guide_top - box_h

    c.setStrokeColor(HexColor("#3A3A3A"))
    c.setLineWidth(0.6)
    c.roundRect(guide_x, box_y, guide_w, box_h, 1.5 * mm, fill=0, stroke=1)

    text_x = guide_x + pad_x
    font_size = 11
    prefix = "예) "
    line1_rest = "abandon D25 · 102"
    line2_rest = "abandon → Day 25 · 102페이지에서 찾을 수 있습니다."
    prefix_w = pdfmetrics.stringWidth(prefix, FONT_REGULAR, font_size)
    baselines = [
        box_y + box_h - box_pad_y - line_h * 0.72,
        box_y + box_h - box_pad_y - line_h * 1.72,
    ]
    draw_text(c, prefix + line1_rest, text_x, baselines[0], size=font_size, color=PALE)
    draw_text(c, line2_rest, text_x + prefix_w, baselines[1], size=font_size, color=PALE)

    draw_page_footer(c, page_no, level_tag, dark_bg=True)
    c.showPage()


def confusable_meaning_label(word: str, meanings: dict[str, str]) -> str:
    """혼동 어휘 뜻 — 고정 오버라이드 → 메타 meaning_pos 우선."""
    if word in CONFUSABLE_MEANING_OVERRIDE:
        return CONFUSABLE_MEANING_OVERRIDE[word]
    return (POS_MEANINGS.get(word) or meanings.get(word, "")).strip()


def confusable_pos_letter(word: str) -> str:
    """품사 한글자 — 혼동 어휘는 CONFUSABLE_POS 고정."""
    if word in CONFUSABLE_POS:
        return CONFUSABLE_POS[word]
    raw = POS_MEANINGS.get(word, "")
    m = re.search(r"\(([명동형부접전관])\)", raw)
    return m.group(1) if m else ""


def confusable_pron(
    word: str,
    pronunciations: dict[str, tuple[str, str]],
) -> tuple[str, str]:
    """IPA + 짧은 실발음 한글."""
    ipa, ko = pronunciations.get(word, ("", ""))
    ko = CONFUSABLE_KO_PRON.get(word, ko)
    return ipa, ko


def _attach_pos_if_needed(mean: str, pos: str) -> str:
    """뜻에 이미 (동)/(명) 등이 있으면 그대로, 없으면 단일 품사 부착."""
    if not mean:
        return mean
    if re.search(r"\([명동형부접전관]\)", mean):
        return mean
    return f"{mean} ({pos})" if pos else mean


def format_confusable_pair_cells(
    word_a: str,
    mean_a: str,
    pos_a: str,
    word_b: str,
    mean_b: str,
    pos_b: str,
    *,
    tag_a: str | None = None,
    tag_b: str | None = None,
) -> tuple[str, str, str, str]:
    """단어·뜻 칸. 품사는 뜻에 표기. (타)/(자)만 단어 옆."""
    la = f"{word_a} ({tag_a})" if tag_a else word_a
    lb = f"{word_b} ({tag_b})" if tag_b else word_b
    ma = _attach_pos_if_needed(mean_a, pos_a)
    mb = _attach_pos_if_needed(mean_b, pos_b)
    return la, ma, lb, mb


def draw_confusables_howto_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
) -> None:
    """혼동 어휘 읽기 안내 (흑백). 간지 바로 앞 — 빈 쪽 대신 배치."""
    width, height = B5
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    draw_day_banner(c, "HOW TO", height - BANNER_Y)

    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    max_w = right - left

    # 가운데 희미한 T 로고 (상하 중앙 · 기존 대비 크기·농도 약 30% 축소)
    mark_size = min(max_w * 0.72, 105 * mm) * 0.70
    mark_x = (width - mark_size) / 2
    mark_y = (height - mark_size) / 2
    try:
        mark_src = ROOT / "로고, 이미지" / "trigger-t-watermark.png"
        if not mark_src.exists():
            mark_src = MARK_PATH
        img = PILImage.open(mark_src).convert("RGBA")
        pixels = img.load()
        w_px, h_px = img.size
        opacity = 0.10 * 0.70  # 약 30% 더 희미
        for py in range(h_px):
            for px in range(w_px):
                r, g, b, a = pixels[px, py]
                if a < 8 or (r < 45 and g < 45 and b < 45):
                    pixels[px, py] = (0, 0, 0, 0)
                    continue
                # 시안 점 유지(희미), 흰 T → 진한 회색 희미
                if b > 180 and g > 150 and r < 120:
                    pixels[px, py] = (0, 220, 235, int(255 * opacity * 1.15))
                else:
                    pixels[px, py] = (32, 38, 45, int(255 * opacity))
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        c.drawImage(
            ImageReader(buf),
            mark_x,
            mark_y,
            width=mark_size,
            height=mark_size,
            mask="auto",
            preserveAspectRatio=True,
        )
    except Exception:
        pass

    title = "혼동 어휘 보는 법"
    title_size = 20
    title_y = height - 46 * mm
    tw = pdfmetrics.stringWidth(title, FONT_BOLD, title_size)
    draw_text(c, title, width / 2, title_y, font=FONT_BOLD, size=title_size, color=INK, align="center")
    c.setStrokeColor(INK)
    c.setLineWidth(1.35)
    c.line(width / 2 - tw / 2, title_y - 2.2 * mm, width / 2 + tw / 2, title_y - 2.2 * mm)

    def wrap_lines(text: str, font: str, size: float) -> list[str]:
        words = text.split(" ")
        out: list[str] = []
        cur = ""
        for w in words:
            trial = f"{cur} {w}".strip() if cur else w
            if pdfmetrics.stringWidth(trial, font, size) <= max_w:
                cur = trial
            else:
                if cur:
                    out.append(cur)
                cur = w
        if cur:
            out.append(cur)
        return out

    # 리드 문단 — 두 줄 사이 간격은 이전의 절반
    para1 = "테스트·연습에서 헷갈렸던 단어를 여기서 다시 정리하세요."
    para2 = "철자가 다른 글자만 빨강으로 표시됩니다."
    y = height - 58 * mm
    y -= 4 * mm  # 제목 아래 여유
    draw_text(c, para1, left, y, font=FONT_REGULAR, size=13.5, color=INK, max_width=max_w)
    y -= 7.1 * mm  # 기존 ~14.2mm의 절반
    draw_text(c, para2, left, y, font=FONT_REGULAR, size=13.5, color=INK, max_width=max_w)
    y -= 9.2 * mm
    y -= 8 * mm  # 리드 아래 여유

    draw_text(c, "[예시]", left, y, font=FONT_BOLD, size=15, color=INK)
    y -= 10 * mm

    examples = [
        "compete / complete  →  가운데 l 유무가 다릅니다.",
        "past / paste  →  끝의 e 유무가 다릅니다.",
    ]
    box_pad_x = 3.2 * mm
    box_pad_y = 2.8 * mm
    ex_size = 13.0
    for ex in examples:
        text_w = min(max_w, pdfmetrics.stringWidth(ex, FONT_REGULAR, ex_size) + box_pad_x * 2)
        box_h = 9.5 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.9)
        c.setFillColor(LIGHT)
        c.roundRect(left, y - box_pad_y, text_w, box_h, 1.6 * mm, fill=1, stroke=1)
        draw_text(
            c,
            ex,
            left + box_pad_x,
            y + 1.2 * mm,
            font=FONT_REGULAR,
            size=ex_size,
            color=INK,
            max_width=text_w - box_pad_x * 2,
        )
        y -= box_h + 4.5 * mm

    y -= 6 * mm
    check = "✓  "
    split_line = "혼동 어휘는 아래 두 종류로 나뉩니다."
    draw_text(
        c,
        check + split_line,
        left,
        y,
        font=FONT_BOLD,
        size=14.5,
        color=INK,
        max_width=max_w,
    )
    y -= 12 * mm

    blocks = [
        (
            "① 철자가 비슷한 단어",
            "비슷한 철자인데 뜻이 다른 쌍입니다.",
            "예: compete(경쟁하다) / complete(완성하다)",
        ),
        (
            "② 품사만 다른 단어",
            "같은 어근인데 품사(명·동·형·부)만 다른 쌍입니다.",
            "예: threat(명) / threaten(동)",
        ),
    ]
    for title, desc, ex in blocks:
        draw_text(c, title, left, y, font=FONT_BLACK, size=14.5, color=INK, max_width=max_w)
        y -= 8.5 * mm
        draw_text(c, desc, left + 2 * mm, y, font=FONT_REGULAR, size=12.5, color=INK, max_width=max_w - 2 * mm)
        y -= 7.5 * mm
        draw_text(c, ex, left + 2 * mm, y, font=FONT_REGULAR, size=12.5, color=SLATE, max_width=max_w - 2 * mm)
        y -= 12 * mm

    draw_page_footer(c, page_no, level_tag)
    c.showPage()


def draw_confusables_divider(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
) -> None:
    """혼동 어휘 구간 앞 간지."""
    width, height = B5
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 4 * mm, fill=0, stroke=1)

    draw_divider_mark(c, width, height)
    center_y = height * 0.62
    title = "혼동 어휘"
    title_size = 48
    draw_text(c, title, width / 2, center_y + 6 * mm, font=FONT_BOLD, size=title_size, color=white, align="center")

    bar_w = pdfmetrics.stringWidth(title, FONT_BOLD, title_size)
    bar_left = (width - bar_w) / 2
    c.setFillColor(DIVIDER_ACCENT)
    c.rect(bar_left, center_y - 14 * mm, bar_w, 1.4 * mm, fill=1, stroke=0)

    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    note_lines = [
        "철자가 비슷한 단어와",
        "품사만 다른 동일 단어들을 모아 두었습니다.",
    ]
    note_size = 16.0
    note_top = center_y - 26 * mm
    for index, line in enumerate(note_lines):
        draw_text(
            c,
            line,
            width / 2,
            note_top - index * 9 * mm,
            size=note_size,
            color=PALE,
            align="center",
            max_width=right - left,
        )

    draw_page_footer(c, page_no, level_tag, dark_bg=True)
    c.showPage()


def spelling_diff_segments(word_a: str, word_b: str) -> tuple[list[tuple[str, bool]], list[tuple[str, bool]]]:
    """글자 단위 비교 — 다른 구간만 True (SequenceMatcher)."""
    segs_a: list[tuple[str, bool]] = []
    segs_b: list[tuple[str, bool]] = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, word_a.lower(), word_b.lower()).get_opcodes():
        is_diff = tag != "equal"
        if i1 != i2:
            segs_a.append((word_a[i1:i2], is_diff))
        if j1 != j2:
            segs_b.append((word_b[j1:j2], is_diff))
    return segs_a or [(word_a, False)], segs_b or [(word_b, False)]


def draw_centered_word_with_diff(
    c: canvas.Canvas,
    cx: float,
    y: float,
    *,
    word: str,
    other: str,
    suffix: str,
    size: float,
    max_width: float,
) -> None:
    """다른 철자는 진한 빨강+볼드, 같으면 검정 볼드. suffix(품사·타동사/자동사)는 슬레이트."""
    segs = spelling_diff_segments(word, other)[0]

    def total_w(sz: float) -> float:
        w = 0.0
        for text, _is_diff in segs:
            w += pdfmetrics.stringWidth(text, FONT_BOLD, sz)
        if suffix:
            w += pdfmetrics.stringWidth(suffix, FONT_REGULAR, sz * 0.85)
        return w

    sz = size
    while sz > 8.0 and total_w(sz) > max_width:
        sz -= 0.2

    tw = total_w(sz)
    x = cx - tw / 2
    for text, is_diff in segs:
        c.setFont(FONT_BOLD, sz)
        c.setFillColor(DIFF_RED if is_diff else INK)
        c.drawString(x, y, text)
        x += pdfmetrics.stringWidth(text, FONT_BOLD, sz)
    if suffix:
        suf_sz = sz * 0.85
        c.setFont(FONT_REGULAR, suf_sz)
        c.setFillColor(SLATE)
        c.drawString(x, y, suffix)


def draw_boxed_ko_pron_with_diff(
    c: canvas.Canvas,
    cx: float,
    baseline_y: float,
    *,
    ko: str,
    other: str,
    size: float,
    max_width: float,
) -> float:
    """한글 발음 — 다른 글자만 빨강, 테두리 박스. 사용한 박스 너비 반환."""
    if not ko:
        return 0.0
    segs = spelling_diff_segments(ko, other or ko)[0]
    pad_x = 1.8 * mm
    pad_y = 1.0 * mm

    def text_w(sz: float) -> float:
        return sum(pdfmetrics.stringWidth(t, FONT_BOLD, sz) for t, _ in segs)

    sz = size
    while sz > 7.0 and text_w(sz) + 2 * pad_x > max_width:
        sz -= 0.2

    tw = text_w(sz)
    box_w = tw + 2 * pad_x
    box_bottom = baseline_y - pad_y - sz * 0.18
    box_top = baseline_y + sz * 0.82 + pad_y
    box_h = box_top - box_bottom
    box_x = cx - box_w / 2

    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.75)
    c.roundRect(box_x, box_bottom, box_w, box_h, 1.1 * mm, fill=1, stroke=1)

    x = cx - tw / 2
    for text, is_diff in segs:
        c.setFont(FONT_BOLD, sz)
        c.setFillColor(DIFF_RED if is_diff else INK)
        c.drawString(x, baseline_y, text)
        x += pdfmetrics.stringWidth(text, FONT_BOLD, sz)
    return box_w


def draw_confusable_pairs_pages(
    c: canvas.Canvas,
    *,
    level_tag: str,
    start_page_no: int,
    banner: str,
    subtitle: str,
    rows: list[tuple[str, str, str, str, str, str, str, str, str, str]],
    subtitle_note: str | None = None,
) -> int:
    """페어 표: 번호 + (단어·발음 한 칸) + 뜻. 다른 철자 빨강 강조."""
    width, height = B5
    if CONFUSABLE_COMPACT:
        # 5줄×2칸=10칸/쪽 (기존 4줄×2칸=8칸). 글자 크기는 거의 유지.
        word_size = 17.0
        mean_size = 14.5
        pron_size = 11.0
        no_size = 15.0
        pair_gap = 2.2 * mm
        word_block_h = 20.5 * mm
        mean_h = 11.5 * mm
        no_w = 12 * mm
    else:
        word_size = 20.0
        mean_size = 18.0
        pron_size = 12.5
        no_size = 18.0
        pair_gap = 6.0 * mm
        word_block_h = 22.0 * mm
        mean_h = 11.0 * mm
        no_w = 14 * mm
    pair_h = word_block_h + mean_h

    page_no = start_page_no
    idx = 0
    first_of_section = True

    while idx < len(rows):
        banner_cy = height - BANNER_Y
        banner_h = 8.5 * mm
        banner_bottom = banner_cy - banner_h / 2
        draw_day_banner(c, banner, banner_cy)

        margin_left, margin_right = page_margins_x(page_no)
        left = margin_left
        right = width - margin_right
        table_w = right - left
        half_w = (table_w - no_w) / 2

        if first_of_section:
            # compact: 부제 영역 조금만 줄여 첫 쪽도 5줄 가깝게
            content_top = height - (48 * mm if CONFUSABLE_COMPACT else 52 * mm)
            mid_y = (banner_bottom + content_top) / 2
            if subtitle_note:
                title_size = 14.0 if CONFUSABLE_COMPACT else 16.0
                note_size = 12.0 if CONFUSABLE_COMPACT else 14.0
                line_gap = 6.2 * mm if CONFUSABLE_COMPACT else 7.2 * mm
                draw_text(
                    c,
                    subtitle,
                    width / 2,
                    mid_y + line_gap / 2 - title_size * 0.15,
                    font=FONT_BOLD,
                    size=title_size,
                    color=INK,
                    align="center",
                )
                draw_text(
                    c,
                    subtitle_note,
                    width / 2,
                    mid_y - line_gap / 2 - note_size * 0.55,
                    font=FONT_REGULAR,
                    size=note_size,
                    color=SLATE,
                    align="center",
                )
            else:
                subtitle_size = 14.0 if CONFUSABLE_COMPACT else 16.0
                draw_text(
                    c,
                    subtitle,
                    width / 2,
                    mid_y - subtitle_size * 0.35,
                    font=FONT_BOLD,
                    size=subtitle_size,
                    color=INK,
                    align="center",
                )
            first_of_section = False
        else:
            content_top = height - TABLE_TOP_LOOSE

        y = content_top
        while idx < len(rows):
            if y - pair_h < TABLE_BOTTOM:
                break
            word_a, suf_a, mean_a, ipa_a, ko_a, word_b, suf_b, mean_b, ipa_b, ko_b = rows[idx]
            pair_no = idx + 1
            bottom = y - pair_h

            c.setFillColor(PAIR_EVEN if pair_no % 2 == 0 else white)
            c.rect(left, bottom, table_w, pair_h, fill=1, stroke=0)

            c.setStrokeColor(LINE)
            c.setLineWidth(0.55)
            c.rect(left, bottom, table_w, pair_h, fill=0, stroke=1)
            c.line(left + no_w, bottom, left + no_w, y)
            # 발음 전용 가로선 없음 — 뜻 칸만 구분
            c.line(left + no_w, y - word_block_h, right, y - word_block_h)
            c.line(left + no_w + half_w, bottom, left + no_w + half_w, y)

            draw_text(
                c,
                str(pair_no),
                left + no_w / 2,
                bottom + pair_h / 2 - no_size * 0.35,
                font=FONT_BOLD,
                size=no_size,
                align="center",
            )

            cell_max = half_w - (2.5 * mm if CONFUSABLE_COMPACT else 4 * mm)
            left_cx = left + no_w + half_w / 2
            right_cx = left + no_w + half_w + half_w / 2

            if CONFUSABLE_COMPACT:
                word_base = y - 5.0 * mm - word_size * 0.32
                pron_base = y - word_block_h + 3.6 * mm
            else:
                word_base = y - 5.8 * mm - word_size * 0.32
                pron_base = y - word_block_h + 4.2 * mm
            draw_centered_word_with_diff(
                c,
                left_cx,
                word_base,
                word=word_a,
                other=word_b,
                suffix=suf_a,
                size=word_size,
                max_width=cell_max,
            )
            draw_centered_word_with_diff(
                c,
                right_cx,
                word_base,
                word=word_b,
                other=word_a,
                suffix=suf_b,
                size=word_size,
                max_width=cell_max,
            )

            def draw_pron(cx: float, ko: str, other_ko: str) -> None:
                if not ko:
                    return
                draw_boxed_ko_pron_with_diff(
                    c,
                    cx,
                    pron_base,
                    ko=ko,
                    other=other_ko,
                    size=pron_size,
                    max_width=cell_max,
                )

            draw_pron(left_cx, ko_a, ko_b)
            draw_pron(right_cx, ko_b, ko_a)

            m_size = min(mean_size, fit_font_size(mean_a, FONT_REGULAR, mean_size, cell_max))
            m_size = min(m_size, fit_font_size(mean_b, FONT_REGULAR, mean_size, cell_max))
            mean_base = bottom + mean_h / 2 - m_size * 0.32
            draw_text(c, mean_a, left_cx, mean_base, size=m_size, color=SLATE, align="center", max_width=cell_max)
            draw_text(c, mean_b, right_cx, mean_base, size=m_size, color=SLATE, align="center", max_width=cell_max)

            y = bottom - pair_gap
            idx += 1

        draw_page_footer(c, page_no, level_tag)
        c.showPage()
        page_no += 1

    return page_no


def split_confusable_label(label: str) -> tuple[str, str]:
    """'rise (자동사)' → ('rise', ' (자동사)')."""
    m = re.match(r"^([A-Za-z]+)(.*)$", label.strip())
    if not m:
        return label, ""
    return m.group(1), m.group(2)


def draw_confusables_spelling_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
    meanings: dict[str, str],
    pronunciations: dict[str, tuple[str, str]],
) -> int:
    """① 철자가 비슷한 단어."""
    rows: list[tuple[str, str, str, str, str, str, str, str, str, str]] = []
    for a, tag_a, b, tag_b in CONFUSABLE_SPELLING:
        pos_a = confusable_pos_letter(a)
        pos_b = confusable_pos_letter(b)
        la, ma, lb, mb = format_confusable_pair_cells(
            a,
            confusable_meaning_label(a, meanings),
            pos_a,
            b,
            confusable_meaning_label(b, meanings),
            pos_b,
            tag_a=tag_a,
            tag_b=tag_b,
        )
        wa, sa = split_confusable_label(la)
        wb, sb = split_confusable_label(lb)
        ipa_a, ko_a = confusable_pron(a, pronunciations)
        ipa_b, ko_b = confusable_pron(b, pronunciations)
        rows.append((wa, sa, ma, ipa_a, ko_a, wb, sb, mb, ipa_b, ko_b))
    return draw_confusable_pairs_pages(
        c,
        level_tag=level_tag,
        start_page_no=page_no,
        banner="혼동 어휘 ①",
        subtitle="철자가 비슷한 단어",
        subtitle_note="[발음]으로 구분하면 쉬워요.",
        rows=rows,
    )


def draw_confusables_derivation_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    page_no: int,
    meanings: dict[str, str],
    pronunciations: dict[str, tuple[str, str]],
) -> int:
    """② 품사만 다른 동일 단어."""
    rows: list[tuple[str, str, str, str, str, str, str, str, str, str]] = []
    for a, pos_a, b, pos_b in CONFUSABLE_DERIVATION:
        # 표기용 품사는 CONFUSABLE_POS 우선 (수기 고정)
        pos_a = confusable_pos_letter(a) or pos_a
        pos_b = confusable_pos_letter(b) or pos_b
        la, ma, lb, mb = format_confusable_pair_cells(
            a,
            confusable_meaning_label(a, meanings),
            pos_a,
            b,
            confusable_meaning_label(b, meanings),
            pos_b,
        )
        wa, sa = split_confusable_label(la)
        wb, sb = split_confusable_label(lb)
        ipa_a, ko_a = confusable_pron(a, pronunciations)
        ipa_b, ko_b = confusable_pron(b, pronunciations)
        rows.append((wa, sa, ma, ipa_a, ko_a, wb, sb, mb, ipa_b, ko_b))
    return draw_confusable_pairs_pages(
        c,
        level_tag=level_tag,
        start_page_no=page_no,
        banner="혼동 어휘 ②",
        subtitle="품사만 다른 동일 단어",
        rows=rows,  # type: ignore[arg-type]
    )


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

    # 랜덤 40칸 등 고밀도: 안내 간격·헤더·하단을 줄여 행 높이 확보 (쪽수 증가 없음)
    dense = len(rows) >= 32
    if dense:
        subtitle_y = 28.5 * mm
        rule_y = 31.5 * mm
        table_top = height - 33 * mm
        table_bottom = 20 * mm
        header_h = 6.2 * mm
        guide_size = 8.5
        header_size = 8.5
        check_size = 7.5
        word_size = 8.8
        index_size = 6.0
        y_header_pad = 1.6 * mm
        blank_line_pad = 1.6 * mm
    else:
        subtitle_y = SUBTITLE_Y
        rule_y = RULE_Y
        table_top = height - TABLE_TOP_TIGHT
        table_bottom = TABLE_BOTTOM
        header_h = 8 * mm
        guide_size = 9.5
        header_size = 10.2
        check_size = 9.0
        word_size = 10.5
        index_size = 7.0
        y_header_pad = 2.2 * mm
        blank_line_pad = 2.3 * mm

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
        height - subtitle_y,
        size=guide_size,
        color=SLATE,
        align="center",
    )
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.0)
    c.line(table_left, height - rule_y, table_right, height - rule_y)

    c.setFillColor(NAVY)
    c.rect(table_left, table_top - header_h, fold_x - table_left, header_h, fill=1, stroke=0)
    c.rect(fold_x, table_top - header_h, table_right - fold_x, header_h, fill=1, stroke=0)

    answer_w = fold_x - table_left
    test_w = table_right - fold_x
    answer_cols = [7 * mm, 33 * mm, answer_w - 40 * mm]
    test_cols = [24 * mm, 30 * mm, test_w - 54 * mm]

    y_header = table_top - header_h + y_header_pad
    draw_text(
        c,
        "단어",
        table_left + answer_cols[0] + answer_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=header_size,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻",
        table_left + answer_cols[0] + answer_cols[1] + answer_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=header_size,
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
            size=check_size,
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
        size=header_size,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻 써보기",
        fold_x + test_cols[0] + test_cols[1] + test_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=header_size,
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

        baseline = next_y + row_h / 2 - (word_size * 0.35)
        draw_text(
            c,
            str(index),
            table_left + answer_cols[0] / 2,
            baseline,
            size=index_size,
            color=SLATE,
            align="center",
        )
        draw_text(
            c,
            word,
            table_left + answer_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=word_size,
            max_width=answer_cols[1] - 3 * mm,
        )
        draw_text(
            c,
            POS_MEANINGS.get(word, meaning),
            table_left + answer_cols[0] + answer_cols[1] + 1.5 * mm,
            baseline,
            size=word_size,
            max_width=answer_cols[2] - 3 * mm,
        )

        draw_status_marks(c, fold_x, next_y, test_cols[0], row_h)
        draw_text(
            c,
            word,
            fold_x + test_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=word_size,
            max_width=test_cols[1] - 3 * mm,
        )
        blank_left = fold_x + test_cols[0] + test_cols[1] + 1.5 * mm
        blank_right = table_right - 1.5 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(blank_left, next_y + blank_line_pad, blank_right, next_y + blank_line_pad)
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


def draw_random_lookup_page(
    c: canvas.Canvas,
    *,
    level_tag: str,
    day_no: int,
    rows: list[tuple[str, str]],
    page_no: int,
) -> None:
    """고등 랜덤 복습 — 접기 TEST 없이 단어·뜻 양단 표 (20+20)."""
    width, height = B5
    margin_left, margin_right = page_margins_x(page_no)
    left = margin_left
    right = width - margin_right
    gap = 5 * mm
    col_w = (right - left - gap) / 2

    # 배너 박스 하단 기준으로 안내 위·아래 여백을 같게 (겹침 방지)
    banner_box_h = 8.5 * mm
    clear = 5.0 * mm
    subtitle_size = 10.0
    subtitle_from_top = BANNER_Y + banner_box_h / 2 + clear + subtitle_size * 0.55
    table_from_top = subtitle_from_top + clear + subtitle_size * 0.25

    draw_day_banner(c, f"{level_tag} · DAY {day_no:02d} · RANDOM", height - BANNER_Y)
    draw_text(
        c,
        f"순서만 바꿔 복습 · {len(rows)} WORDS",
        width / 2,
        height - subtitle_from_top,
        size=subtitle_size,
        color=SLATE,
        align="center",
    )

    table_top = height - table_from_top
    table_bottom = 20 * mm
    header_h = 7.2 * mm
    half = (len(rows) + 1) // 2
    left_rows = rows[:half]
    right_rows = rows[half:]
    n_rows = max(len(left_rows), len(right_rows), 1)
    row_h = (table_top - table_bottom - header_h) / n_rows

    num_w = 8 * mm
    word_w = 36 * mm
    word_size = 11.2
    mean_size = 10.2
    index_size = 8.0
    header_size = 10.0

    def draw_column(x0: float, col_rows: list[tuple[str, str]], start_index: int) -> None:
        x1 = x0 + col_w
        c.setFillColor(NAVY)
        c.rect(x0, table_top - header_h, col_w, header_h, fill=1, stroke=0)
        y_h = table_top - header_h + 1.9 * mm
        draw_text(c, "#", x0 + num_w / 2, y_h, font=FONT_BOLD, size=header_size - 0.5, color=white, align="center")
        draw_text(
            c,
            "단어",
            x0 + num_w + word_w / 2,
            y_h,
            font=FONT_BOLD,
            size=header_size,
            color=white,
            align="center",
        )
        draw_text(
            c,
            "뜻",
            x0 + num_w + word_w + (col_w - num_w - word_w) / 2,
            y_h,
            font=FONT_BOLD,
            size=header_size,
            color=white,
            align="center",
        )

        y = table_top - header_h
        for offset, (word, meaning) in enumerate(col_rows):
            next_y = y - row_h
            if offset % 2 == 1:
                c.setFillColor(LIGHT)
                c.rect(x0, next_y, col_w, row_h, fill=1, stroke=0)
            baseline = next_y + row_h / 2 - word_size * 0.32
            idx = start_index + offset
            mean = POS_MEANINGS.get(word, meaning)
            draw_text(
                c,
                str(idx),
                x0 + num_w / 2,
                baseline,
                size=index_size,
                color=SLATE,
                align="center",
            )
            draw_text(
                c,
                word,
                x0 + num_w + 1.2 * mm,
                baseline,
                font=FONT_BOLD,
                size=word_size,
                max_width=word_w - 2.2 * mm,
            )
            draw_text(
                c,
                mean,
                x0 + num_w + word_w + 1.2 * mm,
                baseline,
                size=mean_size,
                max_width=col_w - num_w - word_w - 2.4 * mm,
            )
            y = next_y

        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        for x in (x0, x0 + num_w, x0 + num_w + word_w, x1):
            c.line(x, table_bottom, x, table_top)
        c.setStrokeColor(white)
        for x in (x0 + num_w, x0 + num_w + word_w):
            c.line(x, table_top - header_h, x, table_top)
        c.setStrokeColor(LINE)
        for i in range(n_rows + 1):
            line_y = table_top - header_h - i * row_h
            c.line(x0, line_y, x1, line_y)
        c.rect(x0, table_bottom, col_w, table_top - table_bottom, fill=0, stroke=1)

    draw_column(left, left_rows, 1)
    draw_column(left + col_w + gap, right_rows, 1 + len(left_rows))

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


def build_middle_days_pdf(
    days: list[list[tuple[str, str]]],
    *,
    include_covers: bool = True,
    kyobo: bool = False,
) -> Path:
    """앞부분 + 1회독(Day×4) + 랜덤 표지 + 랜덤 1회독(TEST) + 혼동 어휘 + 색인."""
    global B5, POS_MEANINGS, CONFUSABLE_COMPACT
    if kyobo:
        B5 = B5_KYOBO
        CONFUSABLE_COMPACT = True  # 페이지당 ~10쌍 · 표만 부분컬러(≤10쪽)
    else:
        B5 = B5_BOOKK
        CONFUSABLE_COMPACT = False
    pron, pos = load_middle_meta()
    POS_MEANINGS = pos

    OUT_MIDDLE.mkdir(parents=True, exist_ok=True)
    day_count = len(days)
    word_count = sum(len(rows) for rows in days)
    random_days = shuffle_days_for_random_review(days)
    first_day_page = middle_first_day_page(include_covers=include_covers, kyobo=kyobo)

    if kyobo and not include_covers:
        out_name = "중등_내지_교보.pdf"
    elif kyobo:
        out_name = "중등_교보.pdf"
    else:
        out_name = "중등.pdf" if include_covers else "중등_내지.pdf"
    out_path = resolve_output_path(OUT_MIDDLE / out_name)
    book = load_level_meta("중등")
    c = canvas.Canvas(str(out_path), pagesize=B5, pageCompression=1)
    size_note = "교보 B5 188×254" if kyobo else "부크크 B5 182×257"
    c.setTitle(f"{book['formal_title']} Day 01-{day_count:02d} {size_note}")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject(
        f"{size_note} 중등 단어장 (1회독 + 랜덤 1회독)"
        if include_covers
        else f"{size_note} 중등 단어장 내지 (표지 제외 · 부분컬러=혼동)"
    )
    c.setCreator("TRIGGER VOCA Book Generator")

    conf_color_start = conf_color_end = 0
    if include_covers:
        draw_cover(
            c,
            level_en="MIDDLE SCHOOL",
            level_ko="중등",
            day_label=book["day_label_cover"],
            words_note="1회독 + 랜덤 1회독 · Day 구분은 페이지 헤더만 사용합니다.",
            main_title=book["main_title"],
            subtitle=book["subtitle"],
        )
    contents_page_no = 2 if include_covers else 1
    contents = build_middle_round1_contents_entries(
        days, include_covers=include_covers, kyobo=kyobo
    )
    draw_contents_page(
        c,
        level_tag="중등",
        entries=contents,
        page_no=contents_page_no,
        footer_note=build_middle_back_matter_note(
            days, include_covers=include_covers, kyobo=kyobo
        ),
    )
    draw_howto_page(c, level_tag="중등", page_no=contents_page_no + 1)
    draw_pronunciation_guide(c, level_tag="중등", page_no=contents_page_no + 2)
    page_no = first_day_page
    for day_no, rows in enumerate(days, 1):
        draw_day_divider(
            c,
            level_tag="중등",
            day_no=day_no,
            rows=rows,
            page_no=page_no,
        )
        page_no += 1
        draw_day_log_page(
            c,
            level_tag="중등",
            day_no=day_no,
            word_count=len(rows),
            page_no=page_no,
        )
        page_no += 1
        draw_test_page(
            c,
            level_tag="중등",
            day_no=day_no,
            part_label="",
            rows=rows,
            start_index=1,
            page_no=page_no,
        )
        page_no += 1
        draw_practice_page(
            c,
            level_tag="중등",
            day_no=day_no,
            part_label="",
            rows=rows,
            pronunciations=pron,
            page_no=page_no,
        )
        page_no += 1

    draw_random_review_divider(
        c,
        level_tag="중등",
        day_count=day_count,
        word_count=word_count,
        page_no=page_no,
    )
    page_no += 1
    for day_no, rows in enumerate(random_days, 1):
        draw_test_page(
            c,
            level_tag="중등",
            day_no=day_no,
            part_label="RANDOM",
            rows=rows,
            start_index=1,
            page_no=page_no,
        )
        page_no += 1

    meanings = {word: meaning for day_rows in days for word, meaning in day_rows}
    # 흑백: 안내(홀수) → 간지(짝수) → 표 컬러는 다음 홀수부터
    if page_no % 2 == 0:
        width, height = B5
        c.setFillColor(white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        draw_page_footer(c, page_no, "중등")
        c.showPage()
        page_no += 1
    draw_confusables_howto_page(c, level_tag="중등", page_no=page_no)
    page_no += 1
    draw_confusables_divider(c, level_tag="중등", page_no=page_no)
    page_no += 1
    conf_color_start = page_no
    page_no = draw_confusables_spelling_page(
        c, level_tag="중등", page_no=page_no, meanings=meanings, pronunciations=pron
    )
    page_no = draw_confusables_derivation_page(
        c, level_tag="중등", page_no=page_no, meanings=meanings, pronunciations=pron
    )
    while (page_no - 1) % 2 == 1:
        width, height = B5
        c.setFillColor(white)
        c.rect(0, 0, width, height, fill=1, stroke=0)
        draw_page_footer(c, page_no, "중등")
        c.showPage()
        page_no += 1
    conf_color_end = page_no - 1
    color_pages = conf_color_end - conf_color_start + 1
    if color_pages > 10:
        print(
            f"[경고] 혼동 표 컬러 구간 {color_pages}쪽 (p.{conf_color_start}~{conf_color_end}). "
            "교보 부분컬러 한도 10쪽 초과."
        )
    elif conf_color_start % 2 == 0 or conf_color_end % 2 == 1:
        print(
            f"[경고] 부분컬러 홀수시작/짝수끝 조건 확인: "
            f"p.{conf_color_start}~{conf_color_end}"
        )

    index_entries = build_word_index_entries(
        days,
        first_day_page=first_day_page,
        pages_per_day=MIDDLE_PAGES_PER_DAY_ROUND1,
    )
    draw_index_divider(
        c,
        level_tag="중등",
        word_count=word_count,
        page_no=page_no,
    )
    page_no += 1
    page_no = draw_index_pages(
        c,
        level_tag="중등",
        entries=index_entries,
        start_page_no=page_no,
    )
    if kyobo:
        # 교보: 판권은 INDEX 다음 맨 뒤
        draw_colophon_page(
            c,
            level_tag="중등",
            page_no=page_no,
            title=book["formal_title"],
            words_line=book["words_line_colophon"],
            isbn=book["isbn_hyphen"],
            price=book["price_colophon"],
            pub_date=book["pub_date"],
        )
        page_no += 1
    if include_covers:
        draw_back_cover(c)
    c.save()

    if kyobo and not include_covers:
        note = OUT_MIDDLE / "중등_교보_부분컬러_안내.txt"
        color_pages = conf_color_end - conf_color_start + 1
        lines = [
            "교보 바로출판 POD — 부분 컬러 요청 안내",
            "",
            f"내지 파일: {out_path.name}",
            f"판형: 188×254 mm (교보 B5/46배판)",
            f"총 페이지: {page_no - 1}쪽",
            "",
            f"혼동 구간: p.{conf_color_start}~p.{conf_color_end} ({color_pages}쪽)",
        ]
        if color_pages > 10:
            lines += [
                "",
                "[주의] 교보 부분컬러 한도 10쪽 초과.",
                "  - 혼동 표 밀도/쪽수를 더 줄여야 함",
            ]
        else:
            lines += [
                "",
                "혼동 안내·간지 = 흑백 (부분컬러에 포함하지 않음)",
                "배치: 안내(홀수) → 간지(짝수) → 표(홀수~짝수 컬러)",
                "Step2: 내지인쇄 = 흑백",
                "Step5 요청 사항 예시:",
                f"p.{conf_color_start}(홀수페이지)~p.{conf_color_end}(짝수페이지) 부분 컬러 적용 요청",
            ]
        lines += [
            "",
            "※ PDF 파일 페이지 순서 기준 (인쇄 쪽번호 아님)",
            f"※ 판권 ISBN: {book['isbn_hyphen']} · 발행일 {book['pub_date']}",
            f"※ 정식명: {book['formal_title']}",
            f"※ 표지 뒤표지에 바코드·ISBN·{book['price_label']} 포함 필수",
            "※ 표지는 전개도 파일(중등_표지_교보.pdf)을 따로 업로드",
        ]
        note.write_text("\n".join(lines), encoding="utf-8")
        print(f"부분컬러 안내: {note}")
        print(
            f"혼동 구간: p.{conf_color_start}~p.{conf_color_end} ({color_pages}쪽)"
        )

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
        help="내지 PDF만 생성 (앞·뒤표지 제외)",
    )
    parser.add_argument(
        "--kyobo",
        action="store_true",
        help="교보 46배판 188×254 · 간지 무채 · 혼동만 컬러(부분컬러용)",
    )
    args = parser.parse_args()
    register_fonts()

    # 중등 전체 50일(1,200단어): 목차·사용법·발음 + Day×(간지 앞·뒤+TEST+PRACTICE) [+ 표지]
    middle_words = load_words(ROOT / "voca_middle.txt")
    middle_days = chunk_days(middle_words, 24)
    pron, _ = load_middle_meta()
    for day_rows in middle_days:
        validate_pronunciations(day_rows, pron)
    if args.interior_only or args.kyobo:
        interior_path = build_middle_days_pdf(
            middle_days, include_covers=False, kyobo=args.kyobo
        )
        print(f"중등 B5 내지: {interior_path}")
        if args.kyobo:
            return

    if args.interior_only:
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
