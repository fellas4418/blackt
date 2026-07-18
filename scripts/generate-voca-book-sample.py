"""중등 보카 종이책 샘플 PDF 생성기 (Day 1 하루치)."""

from __future__ import annotations

import json
import re
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE_TXT = ROOT / "voca_middle.txt"
APP_DATA = ROOT / "worddata.js"
LEGACY_DATA = ROOT / "worddata_middle.js"
OUTPUT = ROOT / "단어장 PDF" / "트리거보카_중등_Day01_샘플_최종.pdf"

# Day 1 발음 — (IPA, 한글) 수기 검수
PRONUNCIATIONS = {
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

FONT_REGULAR = "Malgun"
FONT_BOLD = "MalgunBold"
FONT_IPA = "ArialIPA"
NAVY = HexColor("#24344A")
SLATE = HexColor("#526273")
PALE = HexColor("#EEF1F4")
LIGHT = HexColor("#F7F8FA")
LINE = HexColor("#9AA4AE")
INK = HexColor("#20262D")


def register_fonts() -> None:
    font_dir = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(font_dir / "malgun.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(font_dir / "malgunbd.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_IPA, str(font_dir / "arial.ttf")))


def load_source_words() -> list[tuple[str, str]]:
    words: list[tuple[str, str]] = []
    for line_no, raw in enumerate(SOURCE_TXT.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        if "|" not in line:
            raise ValueError(f"원본 {line_no}행에 구분자(|)가 없습니다.")
        word, meaning = line.split("|", 1)
        word, meaning = word.strip(), meaning.strip()
        if not word or not meaning:
            raise ValueError(f"원본 {line_no}행의 단어 또는 뜻이 비어 있습니다.")
        if not re.fullmatch(r"[A-Za-z][A-Za-z .,'’()/-]*", word):
            raise ValueError(f"원본 {line_no}행의 영단어 형식을 확인하세요: {word}")
        words.append((word, meaning))
    return words


def load_app_days() -> list[list[tuple[str, str]]]:
    text = APP_DATA.read_text(encoding="utf-8")
    prefix = "const wordsData = "
    if not text.startswith(prefix):
        raise ValueError("worddata.js 형식을 읽을 수 없습니다.")
    payload = text[len(prefix) :].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    data = json.loads(payload)
    week1 = data["middle"]["week1"]
    result: list[list[tuple[str, str]]] = []
    for day in range(1, 4):
        rows = []
        for item in week1[str(day)]:
            rows.append((item["word"], ", ".join(item["meanings"])))
        result.append(rows)
    return result


def load_legacy_days() -> list[list[tuple[str, str]]]:
    text = LEGACY_DATA.read_text(encoding="utf-8")
    prefix = "const wordData = "
    if not text.startswith(prefix):
        raise ValueError("worddata_middle.js 형식을 읽을 수 없습니다.")
    payload = text[len(prefix) :].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    data = json.loads(payload)
    return [[(item["word"], item["mean"]) for item in day] for day in data[:3]]


def validate_days() -> list[list[tuple[str, str]]]:
    source = load_source_words()
    if len(source) != 1200:
        raise ValueError(f"중등 원본은 1,200개여야 합니다. 현재 {len(source)}개입니다.")

    expected = [source[i * 24 : (i + 1) * 24] for i in range(3)]
    app_days = load_app_days()
    if expected != app_days:
        for day_no, (source_day, app_day) in enumerate(zip(expected, app_days), 1):
            if source_day != app_day:
                raise ValueError(f"Day {day_no}의 txt 원본과 앱 데이터가 일치하지 않습니다.")
        raise ValueError("txt 원본과 앱 데이터가 일치하지 않습니다.")

    legacy_days = load_legacy_days()
    if expected != legacy_days:
        raise ValueError("txt 원본과 중등 전용 데이터의 Day 1~3이 일치하지 않습니다.")

    flattened = [row for day in expected for row in day]
    if len(flattened) != len(set(flattened)):
        raise ValueError("Day 1~3 안에 동일한 단어·뜻 행이 중복되어 있습니다.")
    return expected


def fit_font_size(text: str, font: str, max_size: float, max_width: float) -> float:
    size = max_size
    while size > 6.2 and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 0.2
    return size


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    *,
    font: str = FONT_REGULAR,
    size: float = 8.5,
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
    radius = min(2.15 * mm, row_h * 0.25)
    c.setStrokeColor(SLATE)
    c.setLineWidth(0.65)
    c.rect(centers[0] - radius, cy - radius, radius * 2, radius * 2, fill=0)
    c.line(centers[1], cy + radius, centers[1] - radius, cy - radius)
    c.line(centers[1] - radius, cy - radius, centers[1] + radius, cy - radius)
    c.line(centers[1] + radius, cy - radius, centers[1], cy + radius)
    c.circle(centers[2], cy, radius, fill=0)


def draw_page_footer(c: canvas.Canvas, page_no: int, label: str) -> None:
    width, _ = A4
    draw_text(c, "TRIGGER VOCA · MIDDLE", 12 * mm, 8 * mm, size=7, color=SLATE)
    draw_text(c, label, width / 2, 8 * mm, size=7, color=SLATE, align="center")
    draw_text(c, str(page_no), width - 12 * mm, 8 * mm, size=7, color=SLATE, align="right")


def draw_cover(c: canvas.Canvas) -> None:
    width, height = A4
    c.setFillColor(NAVY)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    c.setFillColor(white)
    c.roundRect(18 * mm, 38 * mm, width - 36 * mm, height - 76 * mm, 5 * mm, fill=0, stroke=1)
    draw_text(c, "TRIGGER", width / 2, height - 67 * mm, font=FONT_BOLD, size=16, color=white, align="center")
    draw_text(c, "VOCABULARY BOOK", width / 2, height - 84 * mm, font=FONT_BOLD, size=28, color=white, align="center")
    draw_text(c, "MIDDLE SCHOOL · SAMPLE", width / 2, height - 97 * mm, size=11, color=PALE, align="center")

    c.setFillColor(white)
    c.roundRect(33 * mm, height - 139 * mm, width - 66 * mm, 20 * mm, 3 * mm, fill=1, stroke=0)
    draw_text(c, "DAY 01", width / 2, height - 132 * mm, font=FONT_BOLD, size=14, color=NAVY, align="center")

    info_x = 38 * mm
    info_y = height - 168 * mm
    lines = [
        ("1", "정답 면을 세로 점선에서 뒤로 접습니다."),
        ("2", "단어를 보고 뜻을 직접 쓴 뒤 정답과 비교합니다."),
        ("3", "결과에 따라  □ 모름   △ 애매   ○ 완료를 표시합니다."),
        ("4", "오른쪽 연습 면에서 단어를 두 번 따라 쓰고 뜻을 직접 씁니다."),
    ]
    for number, sentence in lines:
        c.setFillColor(white)
        c.circle(info_x, info_y + 1.5 * mm, 4 * mm, fill=0, stroke=1)
        draw_text(c, number, info_x, info_y - 0.3 * mm, font=FONT_BOLD, size=8, color=white, align="center")
        draw_text(c, sentence, info_x + 9 * mm, info_y - 0.5 * mm, size=9.5, color=white)
        info_y -= 15 * mm

    draw_text(
        c,
        "양면 인쇄 · 실제 크기(100%) · 긴 쪽 넘김 권장",
        width / 2,
        54 * mm,
        font=FONT_BOLD,
        size=9,
        color=PALE,
        align="center",
    )
    draw_text(c, "TRIGGER BLACK", width / 2, 45 * mm, size=7.5, color=PALE, align="center")
    c.showPage()


def draw_test_page(c: canvas.Canvas, day_no: int, rows: list[tuple[str, str]], page_no: int) -> None:
    width, height = A4
    margin_x = 10 * mm
    table_left = margin_x
    table_right = width - margin_x
    fold_x = width / 2
    table_top = height - 31 * mm
    table_bottom = 15 * mm
    header_h = 9 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    draw_text(c, f"MIDDLE · DAY {day_no:02d}", margin_x, height - 16 * mm, font=FONT_BOLD, size=15, color=NAVY)
    draw_text(c, f"{len(rows)} WORDS", table_right, height - 16 * mm, font=FONT_BOLD, size=8, color=SLATE, align="right")
    draw_text(
        c,
        "바깥쪽 정답 면을 점선에서 뒤로 접으세요",
        width / 2,
        height - 24 * mm,
        size=8,
        color=SLATE,
        align="center",
    )

    # 왼쪽 바깥면: 정답 / 오른쪽 제본면: 테스트
    c.setFillColor(PALE)
    c.rect(table_left, table_top - header_h, fold_x - table_left, header_h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(fold_x, table_top - header_h, table_right - fold_x, header_h, fill=1, stroke=0)

    answer_w = fold_x - table_left
    test_w = table_right - fold_x
    answer_cols = [8 * mm, 34 * mm, answer_w - 42 * mm]
    test_cols = [27 * mm, 30 * mm, test_w - 57 * mm]

    y_header = table_top - header_h + 2.6 * mm
    draw_text(c, "정답", table_left + answer_cols[0] / 2, y_header, font=FONT_BOLD, size=7.5, color=SLATE, align="center")
    draw_text(
        c,
        "WORD",
        table_left + answer_cols[0] + answer_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=7.5,
        color=SLATE,
        align="center",
    )
    draw_text(
        c,
        "MEANING",
        table_left + answer_cols[0] + answer_cols[1] + answer_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=7.5,
        color=SLATE,
        align="center",
    )
    draw_text(c, "모름   애매   완료", fold_x + test_cols[0] / 2, y_header, font=FONT_BOLD, size=6.7, color=white, align="center")
    draw_text(
        c,
        "WORD",
        fold_x + test_cols[0] + test_cols[1] / 2,
        y_header,
        font=FONT_BOLD,
        size=7.5,
        color=white,
        align="center",
    )
    draw_text(
        c,
        "뜻을 써보세요",
        fold_x + test_cols[0] + test_cols[1] + test_cols[2] / 2,
        y_header,
        font=FONT_BOLD,
        size=7.5,
        color=white,
        align="center",
    )

    # 행 배경과 내용
    y = table_top - header_h
    for index, (word, meaning) in enumerate(rows, 1):
        next_y = y - row_h
        if index % 2 == 0:
            c.setFillColor(LIGHT)
            c.rect(table_left, next_y, table_right - table_left, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 2.5
        draw_text(c, str(index), table_left + answer_cols[0] / 2, baseline, size=7, color=SLATE, align="center")
        draw_text(
            c,
            word,
            table_left + answer_cols[0] + 2 * mm,
            baseline,
            font=FONT_BOLD,
            size=8.3,
            max_width=answer_cols[1] - 4 * mm,
        )
        draw_text(
            c,
            meaning,
            table_left + answer_cols[0] + answer_cols[1] + 2 * mm,
            baseline,
            size=7.8,
            max_width=answer_cols[2] - 4 * mm,
        )

        draw_status_marks(c, fold_x, next_y, test_cols[0], row_h)
        draw_text(
            c,
            word,
            fold_x + test_cols[0] + 2 * mm,
            baseline,
            font=FONT_BOLD,
            size=8.2,
            max_width=test_cols[1] - 4 * mm,
        )
        blank_left = fold_x + test_cols[0] + test_cols[1] + 2 * mm
        blank_right = table_right - 2 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.45)
        c.line(blank_left, next_y + 2.7 * mm, blank_right, next_y + 2.7 * mm)
        y = next_y

    # 표 선
    c.setStrokeColor(LINE)
    c.setLineWidth(0.45)
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

    # 중앙 접는 선을 다른 선보다 강하게 표시
    c.saveState()
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.0)
    c.setDash(3, 2)
    c.line(fold_x, table_bottom - 3 * mm, fold_x, table_top + 4 * mm)
    c.restoreState()

    draw_page_footer(c, page_no, "TEST · 왼쪽 면")
    c.showPage()


def draw_practice_page(c: canvas.Canvas, day_no: int, rows: list[tuple[str, str]], page_no: int) -> None:
    width, height = A4
    left = 14 * mm
    right = width - 10 * mm
    table_top = height - 38 * mm
    table_bottom = 21 * mm
    header_h = 10 * mm
    row_h = (table_top - table_bottom - header_h) / len(rows)

    draw_text(c, f"DAY {day_no:02d} · PRACTICE", left, height - 16 * mm, font=FONT_BOLD, size=15, color=NAVY)
    draw_text(c, "영단어를 두 번 따라 쓰고, 뜻을 직접 써보세요.", left, height - 25 * mm, size=8.5, color=SLATE)
    draw_text(c, "오른쪽 쓰기 면", right, height - 16 * mm, font=FONT_BOLD, size=8, color=SLATE, align="right")

    total_w = right - left
    # WORD | 발음(IPA+한글) | 뜻 쓰기 | 영단어 써보기 ×2 | 완료
    col_widths = [26 * mm, 48 * mm, 34 * mm, 29 * mm, 29 * mm, total_w - 166 * mm]
    headers = ["WORD", "발음", "뜻 쓰기", "영단어 써보기", "영단어 써보기", "완료"]

    c.setFillColor(NAVY)
    c.rect(left, table_top - header_h, total_w, header_h, fill=1, stroke=0)
    x = left
    for label, col_w in zip(headers, col_widths):
        header_size = 6.6 if label == "영단어 써보기" else 7.5
        draw_text(c, label, x + col_w / 2, table_top - header_h + 3 * mm, font=FONT_BOLD, size=header_size, color=white, align="center")
        x += col_w

    # 행 배경과 인쇄 내용
    y = table_top - header_h
    for index, (word, meaning) in enumerate(rows, 1):
        next_y = y - row_h
        if index % 2 == 0:
            c.setFillColor(LIGHT)
            c.rect(left, next_y, total_w, row_h, fill=1, stroke=0)

        baseline = next_y + row_h / 2 - 2.5
        ipa, korean = PRONUNCIATIONS[word]
        draw_text(c, word, left + 2 * mm, baseline, font=FONT_BOLD, size=8.3, max_width=col_widths[0] - 4 * mm)

        # 발음: 왼쪽 IPA · 오른쪽 한글 (단어와 같은 크기, 칸 초과 시 자동 축소)
        pron_left = left + col_widths[0]
        ipa_w = col_widths[1] * 0.56
        kor_w = col_widths[1] - ipa_w
        draw_text(
            c,
            ipa,
            pron_left + ipa_w / 2,
            baseline,
            font=FONT_IPA,
            size=8.3,
            color=INK,
            max_width=ipa_w - 2 * mm,
            align="center",
        )
        draw_text(
            c,
            f"[{korean}]",
            pron_left + ipa_w + kor_w / 2,
            baseline,
            size=8.3,
            color=SLATE,
            max_width=kor_w - 1.5 * mm,
            align="center",
        )

        # 뜻 쓰기 빈칸 밑줄
        meaning_left = left + col_widths[0] + col_widths[1] + 2 * mm
        meaning_right = left + col_widths[0] + col_widths[1] + col_widths[2] - 2 * mm
        c.setStrokeColor(LINE)
        c.setLineWidth(0.45)
        c.line(meaning_left, next_y + 2.7 * mm, meaning_right, next_y + 2.7 * mm)
        y = next_y

    c.setStrokeColor(LINE)
    c.setLineWidth(0.45)
    x = left
    x_positions = [left]
    for col_w in col_widths:
        x += col_w
        x_positions.append(x)
    for x in x_positions:
        c.line(x, table_bottom, x, table_top)
    for i in range(len(rows) + 1):
        y = table_top - header_h - i * row_h
        c.line(left, y, right, y)
    c.rect(left, table_bottom, total_w, table_top - table_bottom, fill=0, stroke=1)

    # 각 행의 최종 완료 표시용 원
    done_center_x = right - col_widths[-1] / 2
    for i in range(len(rows)):
        y = table_top - header_h - (i + 0.5) * row_h
        c.circle(done_center_x, y, min(2.1 * mm, row_h * 0.26), fill=0, stroke=1)

    draw_text(c, "MEMO", left, 15 * mm, font=FONT_BOLD, size=7, color=SLATE)
    c.setStrokeColor(LINE)
    c.line(left + 13 * mm, 15 * mm, right, 15 * mm)
    draw_page_footer(c, page_no, "PRACTICE · 오른쪽 면")
    c.showPage()


def resolve_output_path() -> Path:
    """열려 있어 잠긴 파일은 덮어쓸 수 없으므로 번호를 붙여 저장한다."""
    candidate = OUTPUT
    for n in range(2, 20):
        try:
            with open(candidate, "ab"):
                return candidate
        except FileNotFoundError:
            return candidate
        except PermissionError:
            candidate = OUTPUT.with_stem(f"{OUTPUT.stem}{n}")
    raise PermissionError("PDF 저장 경로가 모두 잠겨 있습니다. 열려 있는 PDF를 닫아 주세요.")


def build_pdf(days: list[list[tuple[str, str]]]) -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    out_path = resolve_output_path()
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1)
    c.setTitle("트리거 보카 중등 Day 01 샘플")
    c.setAuthor("TRIGGER BLACK")
    c.setSubject("접이식 테스트와 쓰기 연습용 중등 단어장")
    c.setCreator("TRIGGER VOCA Book Generator")

    draw_cover(c)
    page_no = 2
    for day_no, rows in enumerate(days, 1):
        draw_test_page(c, day_no, rows, page_no)
        page_no += 1
        draw_practice_page(c, day_no, rows, page_no)
        page_no += 1
    c.save()
    return out_path


def validate_pronunciations(day_rows: list[tuple[str, str]]) -> None:
    missing = [word for word, _ in day_rows if word not in PRONUNCIATIONS]
    if missing:
        raise ValueError(f"발음이 없는 단어: {missing}")
    extra = set(PRONUNCIATIONS) - {word for word, _ in day_rows}
    if extra:
        raise ValueError(f"Day 1에 없는 발음 항목: {sorted(extra)}")


def main() -> None:
    register_fonts()
    days = validate_days()[:1]
    validate_pronunciations(days[0])
    out_path = build_pdf(days)
    print(f"검증 완료: 원본 1,200개 / Day 1 24개 / 발음 24개 / 중복·누락 없음")
    print(f"PDF 생성 완료: {out_path}")


if __name__ == "__main__":
    main()
