# -*- coding: utf-8 -*-
"""세련된 앱용 T 모노그램 (shear 이탤릭, 여유 패딩, 얇은 실버 엣지)."""
from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "로고, 이미지")
OUT = 1024
SS = 4
S = OUT * SS
BG = (0, 0, 0, 255)
NEON = (0, 243, 255)


def shear(pts, cy, k):
    return [(x + (cy - y) * k, y) for x, y in pts]


def rr(x0, y0, x1, y1, r, n=12):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    pts = []
    for a0, a1, ox, oy in (
        (math.pi, 1.5 * math.pi, x0 + r, y0 + r),
        (1.5 * math.pi, 2 * math.pi, x1 - r, y0 + r),
        (0, 0.5 * math.pi, x1 - r, y1 - r),
        (0.5 * math.pi, math.pi, x0 + r, y1 - r),
    ):
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def build():
    canvas = Image.new("RGBA", (S, S), BG)
    cx = cy = S / 2
    k = 0.18  # 은은한 이탤릭

    # 우아한 비율 + 여유 마진 (T가 프레임의 ~55%)
    top_w, top_h = 920, 200
    stem_w, stem_h = 200, 1080
    top_y0 = cy - stem_h * 0.45
    top_y1 = top_y0 + top_h
    sx0, sx1 = cx - stem_w / 2, cx + stem_w / 2
    sy1 = top_y0 + stem_h
    rad = 22

    top = rr(cx - top_w / 2, top_y0, cx + top_w / 2, top_y1, rad)
    stem = rr(sx0, top_y0, sx1, sy1, rad)

    def layer(fill, dx=0, dy=0):
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        t = [(x + dx, y + dy) for x, y in shear(top, cy, k)]
        s = [(x + dx, y + dy) for x, y in shear(stem, cy, k)]
        d.polygon(t, fill=fill)
        d.polygon(s, fill=fill)
        return im

    # 1) 실버 하드 섀도 (얇게)
    canvas = Image.alpha_composite(canvas, layer((168, 176, 186, 255), dx=11 * SS, dy=8 * SS))
    # 2) 화이트 본체
    canvas = Image.alpha_composite(canvas, layer((255, 255, 255, 255)))

    # 3) 줄기 오른쪽 얇은 실버 하이라이트 (본체 바깥)
    rib = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rib)
    y0, y1 = top_y1 + 4 * SS, sy1 - 8 * SS
    # unsheared ribbon then shear
    band = [
        (sx1 + 1 * SS, y0),
        (sx1 + 28 * SS, y0),
        (sx1 + 28 * SS, y1),
        (sx1 + 1 * SS, y1),
    ]
    rd.polygon(shear(band, cy, k), fill=(175, 183, 193, 220))
    hi = [
        (sx1 + 4 * SS, y0),
        (sx1 + 9 * SS, y0),
        (sx1 + 9 * SS, y1),
        (sx1 + 4 * SS, y1),
    ]
    rd.polygon(shear(hi, cy, k), fill=(235, 240, 245, 190))
    canvas = Image.alpha_composite(canvas, rib)

    # 4) 네온 블루 점 — 작고 또렷하게, T와 조화
    glow_s = 90 * SS // 2
    glow = Image.new("RGBA", (glow_s, glow_s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    c = glow_s // 2
    core = 12 * SS
    for r, a in ((int(core * 2.8), 18), (int(core * 2.0), 40), (int(core * 1.4), 90)):
        gd.ellipse((c - r, c - r, c + r, c + r), fill=(*NEON, a))
    gd.ellipse((c - core, c - core, c + core, c + core), fill=(*NEON, 255))
    n = max(2, core // 3)
    gd.ellipse((c - n, c - n, c + n, c + n), fill=(230, 255, 255, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=SS * 0.6))

    # 위치: 줄기 하단 오른쪽 바깥
    # sheared stem bottom-right approx
    br_x = sx1 + (cy - sy1) * k
    gx = int(br_x + 70 * SS) - glow_s // 2
    gy = int(sy1 - 40 * SS) - glow_s // 2
    canvas.alpha_composite(glow, (gx, gy))

    final = canvas.resize((OUT, OUT), Image.Resampling.LANCZOS)
    path = os.path.join(OUT_DIR, "trigger-t-app-icon.png")
    final.convert("RGB").save(path, "PNG", optimize=True)
    final.convert("RGB").save(os.path.join(OUT_DIR, "trigger-t-app-icon-refined.png"), "PNG", optimize=True)
    print("saved", path)

    # 폰트 버전 (Arial Black 느낌)
    for fp, name in (
        (r"C:\Windows\Fonts\ariblk.ttf", "trigger-t-app-icon-black.png"),
        (r"C:\Windows\Fonts\arialbd.ttf", "trigger-t-app-icon-font.png"),
    ):
        if not os.path.exists(fp):
            continue
        c2 = Image.new("RGBA", (S, S), BG)
        tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(tmp)
        font = ImageFont.truetype(fp, int(S * 0.62))
        bb = d.textbbox((0, 0), "T", font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        x = (S - tw) / 2 - bb[0]
        y = (S - th) / 2 - bb[1] - S * 0.02
        d.text((x, y), "T", font=font, fill=(255, 255, 255, 255))
        sheared = tmp.transform(
            (S, S),
            Image.Transform.AFFINE,
            (1, -0.17, 0.17 * (S / 2), 0, 1, 0),
            resample=Image.Resampling.BICUBIC,
        )
        # silver
        sil = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        sp, tp = sil.load(), sheared.load()
        for yy in range(S):
            for xx in range(S):
                r, g, b, a = tp[xx, yy]
                if a > 40:
                    sp[xx, yy] = (176, 184, 194, a)
        c2.alpha_composite(sil, (int(12 * SS), int(8 * SS)))
        c2.alpha_composite(sheared)
        # neon
        g2 = glow.resize((glow_s, glow_s), Image.Resampling.LANCZOS)
        c2.alpha_composite(g2, (int(S * 0.68) - glow_s // 2, int(S * 0.74) - glow_s // 2))
        out = c2.resize((OUT, OUT), Image.Resampling.LANCZOS)
        out.convert("RGB").save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
        print("saved", name)


if __name__ == "__main__":
    build()
