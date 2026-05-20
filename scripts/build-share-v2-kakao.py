"""Build Kakao-safe 1:1 share-v2.png (VOCA 5-cycle)."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "로고, 이미지"
ASSETS = Path(r"C:\Users\noto0\.cursor\projects\c-Users-noto0-Desktop\assets")
SIDE = 1024
KAKAO_SAFE_RATIO = 0.16


def sample_bg(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    r, g, b, a = px[min(8, im.size[0] - 1), min(8, im.size[1] - 1)]
    return (r, g, b, 255)


def find_source() -> Path:
    for name in os.listdir(ASSETS):
        if "21571575" in name and name.endswith(".png"):
            return ASSETS / name
    for name in os.listdir(ASSETS):
        if name.endswith(".png") and "share-v2" in name and "4faa9fc9" not in name:
            p = ASSETS / name
            w, h = Image.open(p).size
            if w > h:
                return p
    local = IMG_DIR / "share-v2.png"
    if local.is_file():
        return local
    raise FileNotFoundError("share-v2 source not found")


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
    src = find_source()
    out = fit_square(Image.open(src))
    out_path = IMG_DIR / "share-v2.png"
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    out.save(out_path, format="PNG", optimize=True)
    print(f"saved {out_path} from {src.name} -> {out.size}")


if __name__ == "__main__":
    main()
