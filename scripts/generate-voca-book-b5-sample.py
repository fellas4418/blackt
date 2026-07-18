"""중등·고등 보카 종이책 B5 샘플 PDF (각 Day 1 하루치).

중등: 24개 → TEST 1장 + PRACTICE 1장
고등: 40개 → 20개씩 TEST+PRACTICE × 2세트
"""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import B5
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "단어장 PDF"

FONT_REGULAR = "Malgun"
FONT_BOLD = "MalgunBold"
FONT_IPA = "ArialIPA"
NAVY = HexColor("#24344A")
SLATE = HexColor("#526273")
PALE = HexColor("#EEF1F4")
LIGHT = HexColor("#F7F8FA")
LINE = HexColor("#9AA4AE")
INK = HexColor("#20262D")

# 중등 Day 1 발음 — (IPA, 한글) 수기 검수
MIDDLE_PRON = {
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


def register_fonts() -> None:
    font_dir = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(font_dir / "malgun.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(font_dir / "malgunbd.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_IPA, str(font_dir / "arial.ttf")))


def load_words(path: Path, count: int) -> list[tuple[str, str]]:
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
        if len(words) >= count:
            break
    if len(words) < count:
        raise ValueError(f"{path.name}에서 Day 1용 {count}개를 읽지 못했습니다. ({len(words)}개)")
    return words


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
    centers = [x + width * 0.20, x + width * 0.50, x + width * 0.80]
    cy = y + row_h / 2
    radius = min(1.9 * mm, row_h * 0.24)
    c.setStrokeColor(SLATE)
    c.setLineWidth(0.55)
    c.rect(centers[0] - radius, cy - radius, radius * 2, radius * 2, fill=0)
    c.line(centers[1], cy + radius, centers[1] - radius, cy - radius)
    c.line(centers[1] - radius, cy - radius, centers[1] + radius, cy - radius)
    c.line(centers[1] + radius, cy - radius, centers[1], cy + radius)
    c.circle(centers[2], cy, radius, fill=0)


def draw_page_footer(c: canvas.Canvas, page_no: int, label: str, level_tag: str) -> None:
    width, _ = B5
    draw_text(c, f"TRIGGER VOCA · {level_tag} · B5", 10 * mm, 7 * mm, size=6.5, color=SLATE)
    draw_text(c, label, width / 2, 7 * mm, size=6.5, color=SLATE, align="center")
    draw_text(c, str(page_no), width - 10 * mm, 7 * mm, size=6.5, color=SLATE, align="right")


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

    c.setFillColor(white)
    c.roundRect(14 * mm, 32 * mm, width - 28 * mm, height - 64 * mm, 4 * mm, fill=0, stroke=1)
    draw_text(c, "TRIGGER", width / 2, height - 58 * mm, font=FONT_BOLD, size=14, color=white, align="center")
    draw_text(c, "VOCABULARY BOOK", width / 2, height - 72 * mm, font=FONT_BOLD, size=22, color=white, align="center")
    draw_text(c, f"{level_en} · B5 SAMPLE", width / 2, height - 84 * mm, size=10, color=PALE, align="center")

    c.setFillColor(white)
    c.roundRect(28 * mm, height - 118 * mm, width - 56 * mm, 16 * mm, 2.5 * mm, fill=1, stroke=0)
    draw_text(c, day_label, width / 2, height - 112 * mm, font=FONT_BOLD, size=12, color=NAVY, align="center")

    info_x = 30 * mm
    info_y = height - 142 * mm
    lines = [
        ("1", "정답 면을 세로 점선에서 뒤로 접습니다."),
        ("2", "단어를 보고 뜻을 직접 쓴 뒤 정답과 비교합니다."),
        ("3", "결과에 따라  □ 모름   △ 애매   ○ 완료를 표시합니다."),
        ("4", "연습 면에서 단어를 두 번 따라 쓰고 뜻을 직접 씁니다."),
        ("5", words_note),
    ]
    for number, sentence in lines:
        c.setFillColor(white)
        c.circle(info_x, info_y + 1.2 * mm, 3.4 * mm, fill=0, stroke=1)
        draw_text(c, number, info_x, info_y - 0.4 * mm, font=FONT_BOLD, size=7.5, color=white, align="center")
        draw_text(c, sentence, info_x + 8 * mm, info_y - 0.6 * mm, size=8.2, color=white, max_width=width - 52 * mm)
        info_y -= 13 * mm

    draw_text(
        c,
        f"{level_ko} · 양면 인쇄 · 실제 크기(100%) · 긴 쪽 넘김 권장",
        width / 2,
        46 * mm,
        font=FONT_BOLD,
        size=8,
        color=PALE,
        align="center",
    )
    draw_text(c, "TRIGGER BLACK", width / 2, 38 * mm, size=7, color=PALE, align="center")
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
    margin_x = 8 * mm
    table_left = margin_x
    table_right = width - margin_x
    fold_x = width / 2
    table_top = height - 26 * mm
    table_bottom = 13 * mm
    header_h = 8 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    title = f"{level_tag} · DAY {day_no:02d}"
    if part_label:
        title += f" · {part_label}"
    draw_text(c, title, margin_x, height - 13 * mm, font=FONT_BOLD, size=12, color=NAVY)
    draw_text(
        c,
        f"{len(rows)} WORDS",
        table_right,
        height - 13 * mm,
        font=FONT_BOLD,
        size=7.5,
        color=SLATE,
        align="right",
    )
    draw_text(
        c,
        "바깥쪽 정답 면을 점선에서 뒤로 접으세요",
        width / 2,
        height - 20 * mm,
        size=7.2,
        color=SLATE,
        align="center",
    )

    c.setFillColor(PALE)
    c.rect(table_left, table_top - header_h, fold_x - table_left, header_h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(fold_x, table_top - header_h, table_right - fold_x, header_h, fill=1, stroke=0)

    answer_w = fold_x - table_left
    test_w = table_right - fold_x
    answer_cols = [7 * mm, 28 * mm, answer_w - 35 * mm]
    test_cols = [24 * mm, 26 * mm, test_w - 50 * mm]

    y_header = table_top - header_h + 2.2 * mm
    draw_text(c, "정답", table_left + answer_cols[0] / 2, y_header, font=FONT_BOLD, size=6.8, color=SLATE, align="center")
    draw_text(
        c,
        "WORD",
        table_left + answer_cols[0] + answer_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=6.8,
        color=SLATE,
        align="center",
    )
    draw_text(
        c,
        "MEANING",
        table_left + answer_cols[0] + answer_cols[1] + answer_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=6.8,
        color=SLATE,
        align="center",
    )
    draw_text(
        c,
        "모름  애매  완료",
        fold_x + test_cols[0] / 2,
        y_header,
        font=FONT_BOLD,
        size=6.0,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "WORD",
        fold_x + test_cols[0] + test_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=6.8,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻을 써보세요",
        fold_x + test_cols[0] + test_cols[1] + test_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=6.8,
        color=white,
        align="center",
    )

    y = table_top - header_h
    for offset, (word, meaning) in enumerate(rows):
        index = start_index + offset
        next_y = y - row_h
        if offset % 2 == 1:
            c.setFillColor(LIGHT)
            c.rect(table_left, next_y, table_right - table_left, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 2.2
        draw_text(c, str(index), table_left + answer_cols[0] / 2, baseline, size=6.5, color=SLATE, align="center")
        draw_text(
            c,
            word,
            table_left + answer_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=7.6,
            max_width=answer_cols[1] - 3 * mm,
        )
        draw_text(
            c,
            meaning,
            table_left + answer_cols[0] + answer_cols[1] + 1.5 * mm,
            baseline,
            size=7.2,
            max_width=answer_cols[2] - 3 * mm,
        )

        draw_status_marks(c, fold_x, next_y, test_cols[0], row_h)
        draw_text(
            c,
            word,
            fold_x + test_cols[0] + 1.5 * mm,
            baseline,
            font=FONT_BOLD,
            size=7.5,
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
        if abs(x - fold_x) > 0.1:
            c.line(x, table_bottom, x, table_top)
    for i in range(len(rows) + 1):
        line_y = table_top - header_h - i * row_h
        c.line(table_left, line_y, table_right, line_y)
    c.rect(table_left, table_bottom, table_right - table_left, table_top - table_bottom, fill=0, stroke=1)

    c.saveState()
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.9)
    c.setDash(2.5, 1.8)
    c.line(fold_x, table_bottom - 2.5 * mm, fold_x, table_top + 3 * mm)
    c.restoreState()

    draw_page_footer(c, page_no, "TEST · 왼쪽 면", level_tag)
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
    left = 10 * mm
    right = width - 8 * mm
    table_top = height - 32 * mm
    table_bottom = 18 * mm
    header_h = 8.5 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    title = f"DAY {day_no:02d} · PRACTICE"
    if part_label:
        title += f" · {part_label}"
    draw_text(c, title, left, height - 13 * mm, font=FONT_BOLD, size=12, color=NAVY)
    draw_text(c, "영단어를 두 번 따라 쓰고, 뜻을 직접 써보세요.", left, height - 21 * mm, size=7.5, color=SLATE)

    total_w = right - left
    col_widths = [22 * mm, 40 * mm, 28 * mm, 25 * mm, 25 * mm, total_w - 140 * mm]
    headers = ["WORD", "발음", "뜻 쓰기", "영단어 써보기", "영단어 써보기", "완료"]

    c.setFillColor(NAVY)
    c.rect(left, table_top - header_h, total_w, header_h, fill=1, stroke=0)
    x = left
    for label, col_w in zip(headers, col_widths):
        header_size = 5.8 if label == "영단어 써보기" else 6.8
        draw_text(
            c,
            label,
            x + col_w / 2,
            table_top - header_h + 2.5 * mm,
            font=FONT_BOLD,
            size=header_size,
            color=white,
            align="center",
        )
        x += col_w

    y = table_top - header_h
    for offset, (word, _meaning) in enumerate(rows):
        next_y = y - row_h
        if offset % 2 == 1:
            c.setFillColor(LIGHT)
            c.rect(left, next_y, total_w, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 2.2
        ipa, korean = pronunciations[word]
        draw_text(c, word, left + 1.5 * mm, baseline, font=FONT_BOLD, size=7.5, max_width=col_widths[0] - 3 * mm)

        pron_left = left + col_widths[0]
        ipa_w = col_widths[1] * 0.56
        kor_w = col_widths[1] - ipa_w
        draw_text(
            c,
            ipa,
            pron_left + ipa_w / 2,
            baseline,
            font=FONT_IPA,
            size=7.4,
            color=INK,
            max_width=ipa_w - 1.5 * mm,
            align="center",
        )
        draw_text(
            c,
            f"[{korean}]",
            pron_left + ipa_w + kor_w / 2,
            baseline,
            size=7.4,
            color=SLATE,
            max_width=kor_w - 1.2 * mm,
            align="center",
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
    for i in range(len(rows) + 1):
        line_y = table_top - header_h - i * row_h
        c.line(left, line_y, right, line_y)
    c.rect(left, table_bottom, total_w, table_top - table_bottom, fill=0, stroke=1)

    done_center_x = right - col_widths[-1] / 2
    for i in range(len(rows)):
        cy = table_top - header_h - (i + 0.5) * row_h
        c.circle(done_center_x, cy, min(1.8 * mm, row_h * 0.24), fill=0, stroke=1)

    draw_page_footer(c, page_no, "PRACTICE · 오른쪽 면", level_tag)
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
    needed = {word for word, _ in rows}
    extra = set(pronunciations) - needed
    if extra:
        raise ValueError(f"Day 1에 없는 발음 항목: {sorted(extra)}")


def build_middle_pdf(rows: list[tuple[str, str]]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = resolve_output_path(OUT_DIR / "트리거보카_중등_Day01_B5샘플.pdf")
    c = canvas.Canvas(str(out_path), pagesize=B5, pageCompression=1)
    c.setTitle("트리거 보카 중등 Day 01 B5 샘플")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject("B5 중등 단어장 하루치 샘플")
    c.setCreator("TRIGGER VOCA Book Generator")

    draw_cover(
        c,
        level_en="MIDDLE SCHOOL",
        level_ko="중등",
        day_label="DAY 01 · 24 WORDS",
        words_note="중등 하루치 24개를 한 세트(TEST+연습)로 구성합니다.",
    )
    draw_test_page(
        c,
        level_tag="MIDDLE",
        day_no=1,
        part_label="",
        rows=rows,
        start_index=1,
        page_no=2,
    )
    draw_practice_page(
        c,
        level_tag="MIDDLE",
        day_no=1,
        part_label="",
        rows=rows,
        pronunciations=MIDDLE_PRON,
        page_no=3,
    )
    c.save()
    return out_path


def build_high_pdf(rows: list[tuple[str, str]]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = resolve_output_path(OUT_DIR / "트리거보카_고등_Day01_B5샘플.pdf")
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

    parts = [
        ("1–20", rows[:20], 1),
        ("21–40", rows[20:], 21),
    ]
    page_no = 2
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
    c.save()
    return out_path


def main() -> None:
    register_fonts()

    middle_rows = load_words(ROOT / "voca_middle.txt", 24)
    validate_pronunciations(middle_rows, MIDDLE_PRON)
    middle_path = build_middle_pdf(middle_rows)

    high_rows = load_words(ROOT / "voca_high.txt", 40)
    validate_pronunciations(high_rows, HIGH_PRON)
    high_path = build_high_pdf(high_rows)

    print(f"중등 B5 샘플: {middle_path} (표지+TEST+연습 = 3쪽, 24단어)")
    print(f"고등 B5 샘플: {high_path} (표지+20×2세트 = 5쪽, 40단어)")


if __name__ == "__main__":
    main()
