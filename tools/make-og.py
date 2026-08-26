#!/usr/bin/env python3
"""Render the Open Graph card (og.png) that link previews show.

Kept as a script rather than a runtime endpoint on purpose: the card is the
same for everyone, so baking it once means no serverless dependency, no cold
start, and no way for a preview to fail in front of an audience.

    python tools/make-og.py

Writes og.png (1200x630) at the repo root.
"""

from __future__ import annotations

import math
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630

BG = (6, 7, 10)
INK = (238, 241, 247)
INK_2 = (154, 165, 186)
INK_3 = (126, 138, 161)
BRAND_HI = (169, 157, 255)
BRAND_LO = (108, 92, 240)
PASS = (52, 211, 153)
LINE = (33, 39, 52)

FONT_DIRS = [
    r"C:\Windows\Fonts",
    "/usr/share/fonts/truetype/dejavu",
    "/System/Library/Fonts",
]
CANDIDATES = {
    "bold": ["segoeuib.ttf", "seguisb.ttf", "DejaVuSans-Bold.ttf", "Helvetica.ttc"],
    "regular": ["segoeui.ttf", "DejaVuSans.ttf", "Helvetica.ttc"],
    "mono": ["consola.ttf", "DejaVuSansMono.ttf", "Menlo.ttc"],
}


def find_font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    for name in CANDIDATES[kind]:
        for d in FONT_DIRS:
            path = os.path.join(d, name)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except OSError:
                    continue
    return ImageFont.load_default()


def radial_glow(size, center, radius, color, strength=1.0):
    """A soft circular light, drawn big and blurred down."""
    layer = Image.new("RGB", size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    steps = 48
    for i in range(steps, 0, -1):
        t = i / steps
        r = radius * t
        falloff = (1 - t) ** 2 * strength
        c = tuple(int(v * falloff) for v in color)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    return layer.filter(ImageFilter.GaussianBlur(radius / 6))


def fit(draw, text, kind, max_w, start_size, min_size=28):
    """Largest size at which `text` still fits inside max_w."""
    size = start_size
    while size > min_size:
        f = find_font(kind, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return find_font(kind, min_size)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)

    # One light source, upper-left, the same move the site makes.
    glow = radial_glow((W, H), (260, -80), 720, BRAND_LO, 0.5)
    img = ImageChops.add(img, glow)

    d = ImageDraw.Draw(img)

    pad = 78
    col_w = 660          # the text column; the ring lives to the right of it
    ring_cx, ring_cy, ring_r = W - 208, 316, 112

    f_brand = find_font("bold", 34)
    f_sub = find_font("regular", 28)
    f_mono = find_font("mono", 22)

    # -- brand row ------------------------------------------------------------
    mark, my = 46, pad
    d.rounded_rectangle([pad, my, pad + mark, my + mark], radius=13, fill=BRAND_LO)
    d.line(
        [(pad + 12, my + 24), (pad + 20, my + 32), (pad + 34, my + 14)],
        fill=(10, 7, 19), width=6, joint="curve",
    )
    d.text((pad + mark + 18, my + 4), "VibeCheck", font=f_brand, fill=INK)

    # -- headline -------------------------------------------------------------
    lines = ["You built it in a weekend.", "Is it safe to ship on Monday?"]
    f_title = min(
        (fit(d, line, "bold", col_w, 62) for line in lines),
        key=lambda f: f.size,
    )
    y = 212
    for line in lines:
        d.text((pad, y), line, font=f_title, fill=INK)
        y += int(f_title.size * 1.22)

    # -- subhead --------------------------------------------------------------
    y += 26
    for line in [
        "Paste your link. Get a Launch Readiness score",
        "in plain English, with the fixes written out.",
    ]:
        d.text((pad, y), line, font=f_sub, fill=INK_2)
        y += 40

    # -- footer chips ---------------------------------------------------------
    chips = ["Free", "No signup", "Runs in your browser", "Open source"]
    cx, cy = pad, H - pad - 42
    for chip in chips:
        w = int(d.textlength(chip, font=f_mono)) + 34
        d.rounded_rectangle([cx, cy, cx + w, cy + 42], radius=21, outline=LINE, width=2)
        d.text((cx + 17, cy + 9), chip, font=f_mono, fill=INK_3)
        cx += w + 13

    # -- the score ring, in its own column ------------------------------------
    box = [ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r]
    d.ellipse(box, outline=LINE, width=17)
    d.arc(box, start=-90, end=-90 + 360 * 0.87, fill=PASS, width=17)

    f_score = find_font("bold", 76)
    f_den = find_font("mono", 20)
    score, den = "87", "/ 100"
    sw = d.textlength(score, font=f_score)
    d.text((ring_cx - sw / 2, ring_cy - 58), score, font=f_score, fill=PASS)
    dw = d.textlength(den, font=f_den)
    d.text((ring_cx - dw / 2, ring_cy + 22), den, font=f_den, fill=INK_3)

    cap = "launch readiness"
    cw = d.textlength(cap, font=f_mono)
    d.text((ring_cx - cw / 2, ring_cy + ring_r + 26), cap, font=f_mono, fill=INK_3)

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "og.png")
    img.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
