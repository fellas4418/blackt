"""Build Kakao-safe 1:1 share-v2.png (VOCA 5-cycle) — full-bleed square."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "로고, 이미지"
SIDE = 1024
KAKAO_SAFE_RATIO = 0.05


def find_source() -> Path:
    for candidate in (
        ROOT / "share-v2.png",
        IMG_DIR / "share-v2.png",
    ):
        if candidate.is_file():
            im = Image.open(candidate)
            if im.size[0] >= im.size[1]:
                return candidate
    raise FileNotFoundError("share-v2 landscape source not found")


def fit_square(im: Image.Image, side: int = SIDE, margin_ratio: float = KAKAO_SAFE_RATIO) -> Image.Image:
    """Blur-cover background + sharp foreground (all content visible, square filled)."""
    im = im.convert("RGBA")
    w, h = im.size

    cover_scale = max(side / w, side / h)
    bg = im.resize((max(1, int(w * cover_scale)), max(1, int(h * cover_scale))), Image.Resampling.LANCZOS)
    bw, bh = bg.size
    bg = bg.crop(((bw - side) // 2, (bh - side) // 2, (bw + side) // 2, (bh + side) // 2))
    bg = bg.filter(ImageFilter.GaussianBlur(radius=14))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    canvas = bg.copy()

    margin = int(side * margin_ratio)
    max_w = side - margin * 2
    max_h = side - margin * 2
    scale = min(max_w / w, max_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    fg = im.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (side - nw) // 2
    oy = (side - nh) // 2
    canvas.paste(fg, (ox, oy), fg)
    return canvas


def main() -> None:
    src = find_source()
    out = fit_square(Image.open(src))
    out_path = IMG_DIR / "share-v2.png"
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    out.save(out_path, format="PNG", optimize=True)
    print(f"saved {out_path} from {src.name} -> {out.size}")


if __name__ == "__main__":
    main()
