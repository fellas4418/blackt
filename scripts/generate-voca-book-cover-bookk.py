"""부크크용 B5 표지 PDF (뒷표지 + 책등 + 앞표지, 도련 3mm).

책등 두께: 부크크 화면에서 100p = 7.1mm 였던 비율로
  267p → 7.1 × (267/100) = 18.957 ≈ 19.0mm
부크크에 다른 두께가 뜨면 --spine 으로 다시 생성하세요.
"""

from __future__ import annotations

import argparse
import importlib.util
import math
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR_MIDDLE = ROOT / "단어장 PDF" / "중등"
OUT_DIR_HIGH = ROOT / "단어장 PDF" / "고등"
OUT_DIR = OUT_DIR_MIDDLE
MARK_PATH = ROOT / "로고, 이미지" / "로고 최종.png"
QR_PATH = ROOT / "로고, 이미지" / "qr-blackt.png"
META_PATH = ROOT / "scripts" / "voca-book-meta.py"
LOGO_SHADOW = HexColor("#636262")
_MARK_CACHE: dict[bool, ImageReader] = {}
_MARK_TIGHT: ImageReader | None = None

FONT_BOLD = "PretendardBold"
FONT_REGULAR = "Pretendard"
FONT_BLACK = "PretendardBlack"
FONT_LOGO = "BlackHanSans"  # Trigger 워드마크와 맞춘 디스플레이 서체

NAVY = HexColor("#0A0A0A")
NEON_BLUE = HexColor("#00F3FF")
NEON_GREEN = HexColor("#39FF14")  # 토익 배지(앱 --neon-green)
ORANGE = HexColor("#FF9900")
PALE = HexColor("#EEF1F4")
LOGO_SHADOW = HexColor("#636262")


def load_level_meta(level: str):
    spec = importlib.util.spec_from_file_location("voca_book_meta", META_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"메타 로드 실패: {META_PATH}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["voca_book_meta"] = mod
    spec.loader.exec_module(mod)
    return mod.meta_for_level(level)


def level_accent(level: str):
    """레벨 배지·책등 레벨명 색. 중등=주황 / 고등=네온블루 / 토익=네온그린."""
    if level in ("고등", "HIGH", "high"):
        return NEON_BLUE
    if level in ("토익", "TOEIC", "toeic"):
        return NEON_GREEN
    return ORANGE


# B5 재단 사이즈 — 기본 부크크. --kyobo 시 188×254.
PAGE_W_BOOKK = 182 * mm
PAGE_H_BOOKK = 257 * mm
PAGE_W_KYOBO = 188 * mm
PAGE_H_KYOBO = 254 * mm
PAGE_W = PAGE_W_BOOKK
PAGE_H = PAGE_H_BOOKK
BLEED = 3 * mm


def mark_reader(*, for_dark: bool = True) -> ImageReader:
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


def draw_mark(c: canvas.Canvas, x: float, y: float, size: float) -> None:
    c.drawImage(
        mark_reader(for_dark=True),
        x,
        y,
        width=size,
        height=size,
        preserveAspectRatio=True,
        mask="auto",
    )


def mark_reader_tight() -> ImageReader:
    """여백을 잘라 T가 박스에 꽉 차게 — 책등에서 제목 높이와 맞출 때 사용."""
    global _MARK_TIGHT
    if _MARK_TIGHT is None:
        img = PILImage.open(MARK_PATH).convert("RGBA")
        pixels = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if r < 45 and g < 45 and b < 45:
                    pixels[x, y] = (0, 0, 0, 0)
        bbox = img.getbbox()
        if bbox:
            pad = 4
            left, top, right, bottom = bbox
            img = img.crop(
                (
                    max(0, left - pad),
                    max(0, top - pad),
                    min(w, right + pad),
                    min(h, bottom + pad),
                )
            )
        side = max(img.size)
        square = PILImage.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2), img)
        buf = BytesIO()
        square.save(buf, format="PNG")
        buf.seek(0)
        _MARK_TIGHT = ImageReader(buf)
    return _MARK_TIGHT


def draw_spine_mark(c: canvas.Canvas, x: float, y: float, size: float) -> None:
    c.drawImage(
        mark_reader_tight(),
        x,
        y,
        width=size,
        height=size,
        preserveAspectRatio=True,
        mask="auto",
    )


def register_fonts() -> None:
    brand_dir = ROOT / "fonts"
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(brand_dir / "Pretendard-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(brand_dir / "Pretendard-Bold.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BLACK, str(brand_dir / "Pretendard-Black.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_LOGO, str(brand_dir / "BlackHanSans-Regular.ttf")))


def bookk_spine_mm(pages: int) -> float:
    """부크크 실측 비율(100p → 7.1mm)로 책등 추정."""
    return round(7.1 * (pages / 100.0), 1)


def draw_tracked_centred(
    c: canvas.Canvas,
    text: str,
    ox: float,
    oy: float,
    *,
    font: str,
    size: float,
    tracking: float,
) -> None:
    """자간을 넣은 가운데 정렬 텍스트."""
    widths = [pdfmetrics.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + tracking * max(len(text) - 1, 0)
    cursor = ox - total / 2
    for ch, tw in zip(text, widths):
        c.drawString(cursor, oy, ch)
        cursor += tw + tracking


def draw_korean_title_two_lines(
    c: canvas.Canvas,
    cx: float,
    cy: float,
    *,
    lines: tuple[str, str] = ("트리거", "VOCA"),
    base_size: float = 120,
    max_w: float = 106 * mm,
    second_width_ratio: float = 1.01,
) -> float:
    """트리거(BlackHanSans) + VOCA(Pretendard Black, 가로 약 101%, 얕은 그림자)."""
    size1 = base_size
    while size1 > 28 and pdfmetrics.stringWidth(lines[0], FONT_LOGO, size1) > max_w:
        size1 *= 0.97
    w1 = pdfmetrics.stringWidth(lines[0], FONT_LOGO, size1)
    target_w = w1 * second_width_ratio
    w2_at_size1 = pdfmetrics.stringWidth(lines[1], FONT_BLACK, size1)
    size2 = size1 * target_w / w2_at_size1 if w2_at_size1 else size1 * 0.8

    fonts = (FONT_LOGO, FONT_BLACK)
    sizes = (size1, size2)
    fills = (white, white)
    shadow_scales = (1.0, 0.65)
    shadow_steps = (14, 11)

    line_gap = (size1 + size2) / 2 * 1.05
    half_h = line_gap / 2
    offsets = (half_h, -half_h)
    skew_tan = math.tan(math.radians(18))

    c.saveState()
    c.translate(cx, cy)
    c.skew(0, 18)
    for line, y_off, sz, font, fill, sh_scale, steps in zip(
        lines, offsets, sizes, fonts, fills, shadow_scales, shadow_steps
    ):
        x_comp = -skew_tan * y_off
        shadow_dx = sz * 0.081 * sh_scale
        shadow_dy = -sz * 0.063 * sh_scale
        c.setFont(font, sz)
        c.setFillColor(LOGO_SHADOW)
        for i in range(steps, 0, -1):
            t = i / steps
            c.drawCentredString(x_comp + shadow_dx * t, y_off + shadow_dy * t, line)
        c.setFillColor(fill)
        for dx, dy in ((0, 0), (0.5, 0), (0, 0.4), (0.5, 0.4)):
            c.drawCentredString(x_comp + dx, y_off + dy, line)
    c.restoreState()
    return cy - half_h - size2 * 0.36


def draw_front_panel(
    c: canvas.Canvas,
    x0: float,
    y0: float,
    w: float,
    h: float,
    *,
    level: str = "중등",
    day_label: str = "DAY 01–50 · 1200 WORDS",
    main_title: str = "트리거 보카",
    subtitle: str = "Trigger VOCA",
) -> None:
    """앞표지 — 트리거(한글) + VOCA(영문)."""
    c.saveState()
    c.translate(x0, y0)
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm, 4 * mm, fill=0, stroke=1)

    if level in ("고등", "HIGH", "high"):
        badge_w, badge_h = 38 * mm, 17 * mm
        badge_font, badge_dy, badge_stroke, badge_face = 27, 9.6, 1.8, FONT_BLACK
    else:
        badge_w, badge_h = 26 * mm, 12 * mm
        badge_font, badge_dy, badge_stroke, badge_face = 13.5, 4.8, 1.2, FONT_BOLD
    badge_x, badge_y = 18 * mm, h - 18 * mm - badge_h
    c.setStrokeColor(level_accent(level))
    c.setLineWidth(badge_stroke)
    c.roundRect(badge_x, badge_y, badge_w, badge_h, 2 * mm, fill=0, stroke=1)
    c.setFillColor(white)
    c.setFont(badge_face, badge_font)
    badge_cx = badge_x + badge_w / 2
    badge_cy = badge_y + badge_h / 2 - badge_dy
    if badge_face == FONT_BLACK:
        for dx, dy in ((0.45, 0), (0, 0.4), (0.45, 0.4), (-0.25, 0)):
            c.drawCentredString(badge_cx + dx, badge_cy + dy, level)
    c.drawCentredString(badge_cx, badge_cy, level)

    title_zone_top = badge_y - 10 * mm
    title_zone_bottom = h - 200 * mm
    # 구 영문(Trigger 로고 + VOCA)보다 블록이 내려가 보여 10mm 상향
    title_center_y = (title_zone_top + title_zone_bottom) / 2 + 10 * mm
    draw_korean_title_two_lines(
        c, w / 2, title_center_y, max_w=w - 56 * mm
    )

    c.setFillColor(NEON_BLUE)
    c.roundRect(28 * mm, h - 184 * mm, w - 56 * mm, 16 * mm, 2.5 * mm, fill=1, stroke=0)
    c.saveState()
    c.translate(w / 2, h - 178.5 * mm)
    c.skew(0, 10)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 17.5)
    for dx, dy in ((0, 0), (0.45, 0), (0, 0.35), (0.45, 0.35)):
        c.drawCentredString(dx, dy, day_label)
    c.restoreState()

    mark_size = 14 * mm
    draw_mark(c, w - 18 * mm - mark_size, 18 * mm, mark_size)
    c.setFillColor(PALE)
    c.setFont(FONT_REGULAR, 14)
    c.drawCentredString(w / 2, 18 * mm, "TRIGGER BLACK")
    c.restoreState()


def draw_isbn_barcode_block(
    c: canvas.Canvas,
    x: float,
    y: float,
    *,
    isbn_digits: str,
    isbn_hyphen: str,
    price_label: str,
) -> None:
    """뒤표지 좌하단 — 흰 바탕에 EAN-13 바코드 + ISBN·가격."""
    plate_w = 72 * mm
    plate_h = 32 * mm
    c.setFillColor(white)
    c.roundRect(x, y, plate_w, plate_h, 1.5 * mm, fill=1, stroke=0)

    barcode = createBarcodeDrawing(
        "EAN13",
        value=isbn_digits,
        barWidth=0.33 * mm,
        barHeight=14 * mm,
        humanReadable=False,
    )
    bw = float(barcode.width)
    bx = x + (plate_w - bw) / 2
    by = y + 12.5 * mm
    renderPDF.draw(barcode, c, bx, by)

    c.setFillColor(black)
    c.setFont(FONT_REGULAR, 7.5)
    c.drawCentredString(x + plate_w / 2, y + 7.2 * mm, f"ISBN {isbn_hyphen}")
    c.setFont(FONT_BOLD, 8)
    c.drawCentredString(x + plate_w / 2, y + 2.8 * mm, price_label)


def draw_back_panel(
    c: canvas.Canvas,
    x0: float,
    y0: float,
    w: float,
    h: float,
    *,
    isbn_digits: str,
    isbn_hyphen: str,
    price_label: str,
) -> None:
    """뒤표지 패널."""
    c.saveState()
    c.translate(x0, y0)
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm, 4 * mm, fill=0, stroke=1)

    slogan = "Just Follow"
    slogan_size = 40
    slogan_w = pdfmetrics.stringWidth(slogan, FONT_BOLD, slogan_size)

    qr_size = 34 * mm
    qr_pad = 4 * mm
    box_size = qr_size + qr_pad * 2
    box_x = (w - box_size) / 2
    box_y = h - 158 * mm
    caption_y = box_y + box_size + 7 * mm
    # Just Follow ↓ · 아래 문장과 간격 절반
    slogan_y = caption_y + 18.5 * mm

    c.saveState()
    c.translate(w / 2, slogan_y)
    c.skew(0, 12)
    c.setFillColor(white)
    c.setFont(FONT_BOLD, slogan_size)
    c.drawCentredString(0, 0, slogan)
    c.setFillColor(ORANGE)
    c.drawString(slogan_w / 2, 0, ".")
    c.restoreState()

    c.setFillColor(PALE)
    c.setFont(FONT_REGULAR, 14)
    c.drawCentredString(w / 2, caption_y, "앱에서 오늘의 단어를 테스트하세요")
    c.setFillColor(white)
    c.roundRect(box_x, box_y, box_size, box_size, 2.5 * mm, fill=1, stroke=0)
    if QR_PATH.exists():
        c.drawImage(str(QR_PATH), box_x + qr_pad, box_y + qr_pad, width=qr_size, height=qr_size)

    # 교보 POD: 뒤표지에 바코드·ISBN·가격 필수 (판권면만으로는 반려)
    draw_isbn_barcode_block(
        c,
        14 * mm,
        14 * mm,
        isbn_digits=isbn_digits,
        isbn_hyphen=isbn_hyphen,
        price_label=price_label,
    )

    # 우하단: T마크 아래, 그 위에 글자(겹침 방지)
    mark_size = 12 * mm
    mark_x = w - 18 * mm - mark_size
    mark_y = 14 * mm
    draw_mark(c, mark_x, mark_y, mark_size)
    text_right = w - 18 * mm
    brand_y = mark_y + mark_size + 3 * mm
    pub_y = brand_y + 5.5 * mm
    c.setFillColor(PALE)
    c.setFont(FONT_REGULAR, 11)
    c.drawRightString(text_right, pub_y, "펴낸곳  플레이온")
    c.drawRightString(text_right, brand_y, "TRIGGER BLACK")
    c.restoreState()


def draw_spine(
    c: canvas.Canvas,
    x0: float,
    y0: float,
    spine_w: float,
    h: float,
    *,
    level: str = "중등",
    spine_title: str = "트리거 VOCA",
) -> None:
    """책등 — 왼쪽 끝에 T 마크, 트리거 VOCA · 레벨."""
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(x0, y0, spine_w, h, fill=1, stroke=0)

    edge = 1.0 * mm
    band = max(spine_w - edge * 2, 4 * mm)

    c.translate(x0 + spine_w / 2, y0 + h / 2)
    c.rotate(90)

    title_prefix = f"{spine_title}  ·  "
    title_level = level
    title = title_prefix + title_level
    # 책등 두께에 비례해 글씨 크기 결정 (중등 16.7mm 대비 고등 27.5mm면 약 1.65배)
    title_size = (band / mm) * (72.0 / 25.4) / 0.72 * (1.0 / 2.0)
    end_margin = 10 * mm
    gap = 2.5 * mm

    # 로컬 +x = 책 위쪽. 읽기 기준 왼쪽 끝 = 책 아래쪽
    mark_x = -(h / 2) + end_margin
    avail_end = h / 2 - end_margin
    while True:
        # 대문자 높이 ≈ 0.72em — T 마크는 제목 글씨에 맞춤
        mark_size = title_size * 0.72 * (25.4 / 72.0) * mm
        avail = avail_end - (mark_x + mark_size + gap)
        if title_size <= 8 or pdfmetrics.stringWidth(title, FONT_BOLD, title_size) <= avail:
            break
        title_size *= 0.99

    draw_spine_mark(c, mark_x, -mark_size / 2, mark_size)

    title_left = mark_x + mark_size + gap
    title_center = title_left + avail / 2
    baseline = -title_size * 0.35
    prefix_w = pdfmetrics.stringWidth(title_prefix, FONT_BOLD, title_size)
    level_w = pdfmetrics.stringWidth(title_level, FONT_BOLD, title_size)
    total_w = prefix_w + level_w
    x = title_center - total_w / 2
    c.setFont(FONT_BOLD, title_size)
    c.setFillColor(white)
    c.drawString(x, baseline, title_prefix)
    c.setFillColor(level_accent(level))
    c.drawString(x + prefix_w, baseline, title_level)
    c.restoreState()


def resolve_output_path(base: Path) -> Path:
    candidate = base
    for n in range(2, 20):
        try:
            with open(candidate, "ab"):
                return candidate
        except FileNotFoundError:
            return candidate
        except PermissionError:
            candidate = base.with_stem(f"{base.stem}_{n}")
    raise PermissionError("표지 PDF 저장 경로가 모두 잠겨 있습니다. 열려 있는 PDF를 닫아 주세요.")


def build_cover_pdf(
    *,
    pages: int,
    spine_mm: float | None,
    name_suffix: str = "",
    logo_w: float = 106 * mm,
    voca_size: float = 60,
    logo_top: float | None = None,
    voca_y: float | None = None,
    write_note: bool = True,
    kyobo: bool = False,
    level: str = "중등",
) -> Path:
    global PAGE_W, PAGE_H, OUT_DIR
    if kyobo:
        PAGE_W, PAGE_H = PAGE_W_KYOBO, PAGE_H_KYOBO
    else:
        PAGE_W, PAGE_H = PAGE_W_BOOKK, PAGE_H_BOOKK

    OUT_DIR = OUT_DIR_HIGH if level == "고등" else OUT_DIR_MIDDLE
    book = load_level_meta(level)
    day_label = book["day_label_cover"]
    stem = "고등_표지" if level == "고등" else "중등_표지"

    register_fonts()
    spine = spine_mm if spine_mm is not None else bookk_spine_mm(pages)
    spine_w = spine * mm

    # 도련 포함 전체 크기: 뒤 + 등 + 앞
    total_w = BLEED + PAGE_W + spine_w + PAGE_W + BLEED
    total_h = BLEED + PAGE_H + BLEED

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    default_name = f"{stem}_교보" if kyobo else stem
    out = resolve_output_path(OUT_DIR / f"{default_name}{name_suffix}.pdf")
    channel = "교보" if kyobo else "부크크"
    trim_w = 188 if kyobo else 182
    trim_h = 254 if kyobo else 257
    c = canvas.Canvas(str(out), pagesize=(total_w, total_h))
    c.setTitle(f"{book['formal_title']} 표지 (책등 {spine}mm)")
    c.setAuthor("플레이온")
    c.setSubject(f"{channel} B5 표지 · {pages}p · spine {spine}mm · bleed 3mm")

    # 전체 검정 (도련까지)
    c.setFillColor(NAVY)
    c.rect(0, 0, total_w, total_h, fill=1, stroke=0)

    y0 = BLEED
    back_x = BLEED
    spine_x = BLEED + PAGE_W
    front_x = BLEED + PAGE_W + spine_w

    draw_back_panel(
        c,
        back_x,
        y0,
        PAGE_W,
        PAGE_H,
        isbn_digits=book["isbn_digits"],
        isbn_hyphen=book["isbn_hyphen"],
        price_label=book["price_label"],
    )
    draw_spine(
        c,
        spine_x,
        y0,
        spine_w,
        PAGE_H,
        level=level,
        spine_title=book["main_title"],
    )
    draw_front_panel(
        c,
        front_x,
        y0,
        PAGE_W,
        PAGE_H,
        level=level,
        day_label=day_label,
        main_title=book["main_title"],
        subtitle=book["subtitle"],
    )

    c.save()

    if write_note:
        note_name = f"{stem}_교보_안내.txt" if kyobo else f"{stem}_안내.txt"
        note = OUT_DIR / note_name
        kyobo_flag = " --kyobo" if kyobo else ""
        high_flag = " --high" if level == "고등" else ""
        note.write_text(
            "\n".join(
                [
                    f"{channel} 표지 등록 안내",
                    "",
                    f"파일: {out.name}",
                    f"내지 페이지: {pages}쪽 → 책등 {spine}mm",
                    "  (교보 계산기 값이면 --spine 으로 그 값 사용)",
                    "",
                    f"앞표지: 트리거 + VOCA · {level} 배지 · T마크 · DAY 바",
                    f"뒷표지: Just Follow(40pt) + QR · ISBN바코드({book['isbn_hyphen']}) · {book['price_label']} · T마크(우하)",
                    f"책등: T마크 + {book['main_title']} · {level}",
                    f"정식명: {book['formal_title']}",
                    f"발행일(판권): {book['pub_date']}",
                    "",
                    "표지 PDF 크기(도련 3mm 포함):",
                    f"  가로 {total_w / mm:.1f} mm = 3 + {trim_w} + {spine} + {trim_w} + 3",
                    f"  세로 {total_h / mm:.1f} mm = 3 + {trim_h} + 3",
                    "",
                    "레이아웃: [뒤표지] [책등] [앞표지]  ← 왼쪽→오른쪽",
                    "날개: 없음",
                    "",
                    "재생성 예:",
                    f"  python scripts/generate-voca-book-cover-bookk.py{kyobo_flag}{high_flag} --pages {pages} --spine {spine}",
                    "",
                ]
            ),
            encoding="utf-8",
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=267, help="내지 쪽수 (기본 267 · 1회독+랜덤)")
    parser.add_argument("--spine", type=float, default=None, help="책등 mm (미입력 시 부크크 비율 추정)")
    parser.add_argument(
        "--kyobo",
        action="store_true",
        help="교보 B5 188×254 표지 전개도",
    )
    parser.add_argument(
        "--high",
        action="store_true",
        help="고등 표지 (기본 중등)",
    )
    parser.add_argument(
        "--variant",
        choices=["logo-half-voca2x"],
        default=None,
        help="비교용 변형. logo-half-voca2x = 로고 1/2 · VOCA 2배 (별도 파일, 기존 유지)",
    )
    args = parser.parse_args()
    level = "고등" if args.high else "중등"
    spine = args.spine if args.spine is not None else bookk_spine_mm(args.pages)

    if args.variant == "logo-half-voca2x":
        # 기존 기본 표지는 건드리지 않고 별도 파일만 생성
        path = build_cover_pdf(
            pages=args.pages,
            spine_mm=spine,
            name_suffix="_로고반_VOCA배",
            logo_w=53 * mm,
            voca_size=120,
            logo_top=PAGE_H - 48 * mm,
            voca_y=PAGE_H - 148 * mm,
            write_note=False,
            kyobo=args.kyobo,
            level=level,
        )
    else:
        path = build_cover_pdf(
            pages=args.pages,
            spine_mm=args.spine,
            kyobo=args.kyobo,
            level=level,
        )

    print(f"표지: {path}")
    print(f"책등(추정): {spine} mm  ·  내지 {args.pages}쪽")
    if args.variant is None:
        stem = "고등_표지" if args.high else "중등_표지"
        note = f"{stem}_교보_안내.txt" if args.kyobo else f"{stem}_안내.txt"
        print(f"안내: {OUT_DIR / note}")


if __name__ == "__main__":
    main()
