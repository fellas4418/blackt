"""Build Kakao-safe 1:1 share-exam-report from two-line title source."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "로고, 이미지"
ASSETS = Path(r"C:\Users\noto0\.cursor\projects\c-Users-noto0-Desktop\assets")
SIDE = 1024
KAKAO_SAFE_RATIO = 0.24


def sample_bg(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    r, g, b, a = px[min(8, im.size[0] - 1), min(8, im.size[1] - 1)]
    return (r, g, b, 255)


def find_two_line_source() -> Path:
    for name in os.listdir(ASSETS):
        if "share-exam-report-v3" in name and name.endswith(".png"):
            return ASSETS / name
    raise FileNotFoundError("share-exam-report-v3.png not found in assets")


def fit_square(im: Image.Image, side: int = SIDE, margin_ratio: float = KAKAO_SAFE_RATIO) -> Image.Image:
    im = im.convert("RGBA")
    margin = int(side * margin_ratio)
    max_w = side - margin * 2
    max_h = side - margin * 2
    w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    bg = sample_bg(im)
    canvas = Image.new("RGBA", (side, side), bg)
    ox = (side - nw) // 2
    oy = (side - nh) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas


def main() -> None:
    src = find_two_line_source()
    out = fit_square(Image.open(src))
    out_path = IMG_DIR / "share-exam-report.png"
    out.save(out_path, format="PNG", optimize=True)
    print(f"saved {out_path} from {src.name} -> {out.size}")


if __name__ == "__main__":
    main()
