"""Remove bottom-right logo area from share-exam-report.png."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "로고, 이미지"
ASSETS = Path(r"C:\Users\noto0\.cursor\projects\c-Users-noto0-Desktop\assets")
OUT = IMG_DIR / "share-exam-report.png"


def find_asset(substr: str) -> Path | None:
    if not ASSETS.is_dir():
        return None
    for name in os.listdir(ASSETS):
        if substr in name and name.lower().endswith(".png"):
            return ASSETS / name
    return None


def erase_bottom_right_logo(img: Image.Image) -> Image.Image:
    banner = img.convert("RGBA")
    bw, bh = banner.size
    pad = int(min(bw, bh) * 0.02)
    box_w = int(bw * 0.18)
    box_h = int(bh * 0.18)
    x0 = bw - box_w - pad
    y0 = bh - box_h - pad

    # sample clean background just above the logo zone
    sample = banner.crop((x0, max(0, y0 - box_h - pad), x0 + box_w, max(1, y0)))
    if sample.size[1] < 4:
        sample = banner.crop((max(0, x0 - box_w), y0, x0, y0 + box_h))
    bg_patch = sample.resize((box_w, box_h), Image.Resampling.LANCZOS)
    banner.paste(bg_patch, (x0, y0))
    return banner


def main() -> None:
    src = find_asset("share-exam-report") or OUT
    banner = Image.open(src)
    banner = erase_bottom_right_logo(banner)
    banner.save(OUT, format="PNG", optimize=True)
    print(f"saved {OUT} ({banner.size[0]}x{banner.size[1]})")


if __name__ == "__main__":
    main()
