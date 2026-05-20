"""Fit share images into 1:1 square without cropping text (scale + pad)."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(r"C:\Users\noto0\.cursor\projects\c-Users-noto0-Desktop\assets")
SIDE = 1024
# Kakao feed preview often center-crops/zooms ~15–20%; keep content in inner ~58%
KAKAO_SAFE_RATIO = 0.21  # margin each side (~42% total inset)


def sample_bg(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    r, g, b, a = px[4, 4]
    return (r, g, b, 255)


def erase_bottom_right_logo(im: Image.Image) -> Image.Image:
    banner = im.convert("RGBA")
    bw, bh = banner.size
    pad = int(min(bw, bh) * 0.02)
    box_w = int(bw * 0.18)
    box_h = int(bh * 0.18)
    x0 = bw - box_w - pad
    y0 = bh - box_h - pad
    sample = banner.crop((x0, max(0, y0 - box_h - pad), x0 + box_w, max(1, y0)))
    if sample.size[1] < 4:
        sample = banner.crop((max(0, x0 - box_w), y0, x0, y0 + box_h))
    bg_patch = sample.resize((box_w, box_h), Image.Resampling.LANCZOS)
    banner.paste(bg_patch, (x0, y0))
    return banner


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


def find_landscape_source() -> Path:
    for name in os.listdir(ASSETS):
        if "8e7b4af0" in name and name.endswith(".png"):
            return ASSETS / name
    for name in os.listdir(ASSETS):
        if "share-exam-report" in name and name.endswith(".png"):
            p = ASSETS / name
            im = Image.open(p)
            if im.size[0] > im.size[1]:
                return p
    return ROOT / "share-exam-report.png"


def main() -> None:
    src = find_landscape_source()
    im = Image.open(src)
    im = erase_bottom_right_logo(im)
    out = fit_square(im)
    out_path = ROOT / "share-exam-report.png"
    out.save(out_path, format="PNG", optimize=True)
    print(f"saved {out_path} from {src.name} -> {out.size}")

    alt_src = ASSETS / "share-exam-report-alt.png"
    if alt_src.is_file():
        alt = fit_square(Image.open(alt_src))
        alt_path = ROOT / "share-exam-report-alt.png"
        alt.save(alt_path, format="PNG", optimize=True)
        print(f"saved {alt_path} -> {alt.size}")


if __name__ == "__main__":
    main()
