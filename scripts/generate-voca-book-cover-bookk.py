"""부크크용 B5 표지 PDF (뒷표지 + 책등 + 앞표지, 도련 3mm).

책등 두께: 부크크 화면에서 100p = 7.1mm 였던 비율로
  267p → 7.1 × (267/100) = 18.957 ≈ 19.0mm
부크크에 다른 두께가 뜨면 --spine 으로 다시 생성하세요.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "단어장 PDF" / "중등"
LOGO_PATH = ROOT / "로고, 이미지" / "trigger-logo-v2.png"
QR_PATH = ROOT / "로고, 이미지" / "qr-blackt.png"
LOGO_ASPECT = 342 / 820

FONT_BOLD = "PretendardBold"
FONT_REGULAR = "Pretendard"
FONT_DISPLAY = "PretendardBlack"

NAVY = HexColor("#0A0A0A")
NEON_BLUE = HexColor("#00F3FF")
ORANGE = HexColor("#FF9900")
PALE = HexColor("#EEF1F4")

# B5 재단 사이즈 (부크크)
PAGE_W = 182 * mm
PAGE_H = 257 * mm
BLEED = 3 * mm
COVER_TITLE_SIZE = 82 * 1.6  # 기존 VOCA(82pt) 대비 1.6배


def register_fonts() -> None:
    brand_dir = ROOT / "fonts"
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(brand_dir / "Pretendard-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(brand_dir / "Pretendard-Bold.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_DISPLAY, str(brand_dir / "Pretendard-Black.ttf")))


def draw_cover_title(c: canvas.Canvas, text: str, x: float, y: float, size: float = COVER_TITLE_SIZE) -> None:
    """표지 메인 타이포 — 강한 디스플레이 서체 + 기울임."""
    c.saveState()
    c.translate(x, y)
    c.skew(0, 14)
    c.setFillColor(white)
    c.setFont(FONT_DISPLAY, size)
    for dx, dy in ((0, 0), (0.7, 0), (0, 0.55), (0.7, 0.55)):
        c.drawCentredString(dx, dy, text)
    c.restoreState()


def fit_title_size(text: str, max_width: float, preferred: float) -> float:
    """좌우 여백이 맞도록 글씨 크기를 max_width 안으로 맞춤."""
    size = preferred
    while size > 36 and pdfmetrics.stringWidth(text, FONT_DISPLAY, size) > max_width:
        size -= 0.5
    return size


def bookk_spine_mm(pages: int) -> float:
    """부크크 실측 비율(100p → 7.1mm)로 책등 추정."""
    return round(7.1 * (pages / 100.0), 1)


def draw_front_panel(c: canvas.Canvas, x0: float, y0: float, w: float, h: float) -> None:
    """앞표지 패널 — A안 심플 히어로 (VOCA 중심)."""
    c.saveState()
    c.translate(x0, y0)
    c.setFillColor(NAVY)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    c.setStrokeColor(white)
    c.setLineWidth(1)
    c.roundRect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm, 4 * mm, fill=0, stroke=1)

    # 로고 — 오른쪽 위 작게
    logo_w = 28 * mm
    logo_h = logo_w * LOGO_ASPECT
    c.drawImage(
        str(LOGO_PATH),
        w - 18 * mm - logo_w,
        h - 18 * mm - logo_h,
        width=logo_w,
        height=logo_h,
        preserveAspectRatio=True,
        anchor="c",
    )

    # 히어로: VOCA 크게 · 위/아래는 트리거·중등 작게 · DAY는 하단
    side_pad = 26 * mm
    max_title_w = w - 2 * side_pad
    voca_size = fit_title_size("VOCA", max_title_w, COVER_TITLE_SIZE)
    trigger_size = fit_title_size("트리거", max_title_w, max(voca_size * 0.32, 28))
    title_x = w / 2 - 1.2 * mm
    voca_y = h * 0.58
    trigger_y = voca_y + voca_size * 0.85 + 14 * mm
    draw_cover_title(c, "트리거", title_x, trigger_y, size=trigger_size)
    draw_cover_title(c, "VOCA", title_x, voca_y, size=voca_size)

    badge_w, badge_h = 30 * mm, 13 * mm
    badge_x = (w - badge_w) / 2
    badge_y = voca_y - 28 * mm
    c.setStrokeColor(ORANGE)
    c.setLineWidth(1.3)
    c.roundRect(badge_x, badge_y, badge_w, badge_h, 2.2 * mm, fill=0, stroke=1)
    c.setFillColor(white)
    c.setFont(FONT_BOLD, 14)
    c.drawCentredString(badge_x + badge_w / 2, badge_y + badge_h / 2 - 4.8, "중등")

    # DAY 바 — 하단
    day_bar_y = 34 * mm
    c.setFillColor(NEON_BLUE)
    c.roundRect(28 * mm, day_bar_y, w - 56 * mm, 14 * mm, 2.5 * mm, fill=1, stroke=0)
    c.saveState()
    c.translate(w / 2, day_bar_y + 4.6 * mm)
    c.skew(0, 8)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 15)
    label = "DAY 01–50 · 1200 WORDS"
    for dx, dy in ((0, 0), (0.4, 0), (0, 0.3), (0.4, 0.3)):
        c.drawCentredString(dx, dy, label)
    c.restoreState()

    c.setFillColor(PALE)
    c.setFont(FONT_REGULAR, 12)
    c.drawCentredString(w / 2, 18 * mm, "TRIGGER BLACK")
    c.restoreState()


def draw_back_panel(c: canvas.Canvas, x0: float, y0: float, w: float, h: float) -> None:
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

    c.setFillColor(PALE)
    c.setFont(FONT_REGULAR, 11)
    c.drawCentredString(w / 2, 28 * mm, "펴낸곳  플레이온")
    c.setFont(FONT_REGULAR, 14)
    c.drawCentredString(w / 2, 18 * mm, "TRIGGER BLACK")
    c.restoreState()


def draw_spine(c: canvas.Canvas, x0: float, y0: float, spine_w: float, h: float) -> None:
    """책등 — 제목이 책등 폭·길이에 꽉 차게."""
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(x0, y0, spine_w, h, fill=1, stroke=0)

    title = "TRIGGER VOCA · 중등"
    margin_end = 8 * mm
    avail_len = h - margin_end * 2
    # 폭의 약 55% (기존 대비 약 30% 축소) · 길이는 가로 스케일로 맞춤
    size = spine_w * 0.273  # 이전 대비 절반
    text_w = pdfmetrics.stringWidth(title, FONT_DISPLAY, size)
    if text_w > avail_len:
        size *= avail_len / text_w
        text_w = pdfmetrics.stringWidth(title, FONT_DISPLAY, size)
        stretch = 1.0
    else:
        stretch = avail_len / text_w

    c.translate(x0 + spine_w / 2, y0 + h / 2)
    c.rotate(90)
    c.scale(stretch, 1)
    c.setFillColor(white)
    c.setFont(FONT_DISPLAY, size)
    for dx, dy in ((0, 0), (0.45, 0), (0, 0.35), (0.45, 0.35)):
        c.drawCentredString(dx, dy, title)
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


def build_cover_pdf(*, pages: int, spine_mm: float | None) -> Path:
    register_fonts()
    spine = spine_mm if spine_mm is not None else bookk_spine_mm(pages)
    spine_w = spine * mm

    # 도련 포함 전체 크기: 뒤 + 등 + 앞
    total_w = BLEED + PAGE_W + spine_w + PAGE_W + BLEED
    total_h = BLEED + PAGE_H + BLEED

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = resolve_output_path(OUT_DIR / f"트리거보카_중등_표지_부크크_B5_등{spine}mm.pdf")
    c = canvas.Canvas(str(out), pagesize=(total_w, total_h))
    c.setTitle(f"트리거 보카 중등 표지 (책등 {spine}mm)")
    c.setAuthor("플레이온")
    c.setSubject(f"부크크 B5 표지 · {pages}p · spine {spine}mm · bleed 3mm")

    # 전체 검정 (도련까지)
    c.setFillColor(NAVY)
    c.rect(0, 0, total_w, total_h, fill=1, stroke=0)

    y0 = BLEED
    back_x = BLEED
    spine_x = BLEED + PAGE_W
    front_x = BLEED + PAGE_W + spine_w

    draw_back_panel(c, back_x, y0, PAGE_W, PAGE_H)
    draw_spine(c, spine_x, y0, spine_w, PAGE_H)
    draw_front_panel(c, front_x, y0, PAGE_W, PAGE_H)

    # 재단·등 가이드 (인쇄용으로는 연하게 — 실제 인쇄 전 가이드 없는 버전도 가능)
    # 부크크 업로드용: 가이드 선 없이 순수 디자인만 (가이드는 콘솔/파일명으로 안내)
    c.save()

    note = OUT_DIR / "트리거보카_중등_표지_부크크_안내.txt"
    note.write_text(
        "\n".join(
            [
                "부크크 표지 등록 안내",
                "",
                f"파일: {out.name}",
                f"내지 페이지: {pages}쪽 → 추정 책등 {spine}mm",
                "  (1회독 + 랜덤 1회독 내지 기준. 부크크 100쪽=7.1mm 비율)",
                "  (화면에 다른 두께가 나오면 --spine 으로 재생성)",
                "",
                "앞표지: A안 심플 히어로 — VOCA 중심 · 트리거/중등 작게 · DAY 하단",
                "뒷표지: Just Follow(40pt) + QR · 로고 없음",
                "책등: TRIGGER VOCA · 중등 (책등 폭·길이에 맞춤)",
                "",
                f"표지 PDF 크기(도련 3mm 포함):",
                f"  가로 {total_w / mm:.1f} mm = 3 + 182 + {spine} + 182 + 3",
                f"  세로 {total_h / mm:.1f} mm = 3 + 257 + 3",
                "",
                "레이아웃: [뒤표지] [책등] [앞표지]  ← 왼쪽→오른쪽",
                "날개: 없음",
                "",
                "재생성 예:",
                f"  python scripts/generate-voca-book-cover-bookk.py --pages {pages} --spine {spine}",
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
    args = parser.parse_args()
    path = build_cover_pdf(pages=args.pages, spine_mm=args.spine)
    spine = args.spine if args.spine is not None else bookk_spine_mm(args.pages)
    print(f"표지: {path}")
    print(f"책등(추정): {spine} mm  ·  내지 {args.pages}쪽")
    print(f"안내: {OUT_DIR / '트리거보카_중등_표지_부크크_안내.txt'}")


if __name__ == "__main__":
    main()
