"""Pad share images to 1:1 square for KakaoTalk."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "로고, 이미지"
FILES = [IMG_DIR / "share-exam-report.png", IMG_DIR / "share-exam-report-alt.png"]


def to_square(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if w == h:
        print(f"{path.name}: already {w}x{h}")
        return
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im.save(path, format="PNG", optimize=True)
    print(f"{path.name}: cropped to {side}x{side}")


def main() -> None:
    for p in FILES:
        if p.is_file():
            to_square(p)


if __name__ == "__main__":
    main()
