"""Build exact-size transparent V16-style property icons for the card detail page."""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SCALE = 4
SIZE = 46
CANVAS = SIZE * SCALE
GOLD = "#E7B94A"
GOLD_HI = "#FFF0A3"
CYAN = "#29D7EF"
INK = "#071724"


def pt(x: float, y: float) -> tuple[int, int]:
    return round(x * SCALE), round(y * SCALE)


def line(draw: ImageDraw.ImageDraw, points, fill=GOLD_HI, width=2, joint="curve"):
    draw.line([pt(x, y) for x, y in points], fill=fill, width=width * SCALE, joint=joint)


def ellipse(draw: ImageDraw.ImageDraw, box, outline=GOLD_HI, width=2, fill=None):
    draw.ellipse(tuple(v * SCALE for v in box), outline=outline, width=width * SCALE, fill=fill)


def polygon(draw: ImageDraw.ImageDraw, points, outline=GOLD_HI, width=2, fill=None):
    q = [pt(x, y) for x, y in points]
    if fill:
        draw.polygon(q, fill=fill)
    draw.line(q + [q[0]], fill=outline, width=width * SCALE, joint="curve")


def base() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def building() -> Image.Image:
    image, draw = base()
    polygon(draw, [(13, 38), (13, 20), (18, 16), (18, 10), (28, 10), (28, 16), (33, 20), (33, 38)], fill=INK)
    line(draw, [(17, 38), (17, 22), (23, 18), (29, 22), (29, 38)], CYAN, 1)
    polygon(draw, [(19, 38), (19, 28), (27, 28), (27, 38)], outline=GOLD_HI, width=2)
    line(draw, [(12, 38), (34, 38)], GOLD, 2)
    return image


def clock() -> Image.Image:
    image, draw = base()
    ellipse(draw, (8, 8, 38, 38), fill=INK)
    ellipse(draw, (12, 12, 34, 34), outline=CYAN, width=1)
    line(draw, [(23, 14), (23, 23), (30, 27)], GOLD_HI, 2)
    for x, y in [(23, 9), (37, 23), (23, 37), (9, 23)]:
        ellipse(draw, (x - 1, y - 1, x + 1, y + 1), outline=GOLD, width=1, fill=GOLD)
    return image


def sword() -> Image.Image:
    image, draw = base()
    line(draw, [(12, 35), (33, 14)], GOLD_HI, 3)
    line(draw, [(27, 12), (35, 13), (34, 21)], CYAN, 2)
    line(draw, [(10, 37), (16, 39)], GOLD, 3)
    line(draw, [(16, 30), (24, 38)], GOLD, 2)
    line(draw, [(12, 35), (7, 31)], GOLD, 2)
    return image


def heart() -> Image.Image:
    image, draw = base()
    points = []
    for i in range(101):
        t = math.pi * 2 * i / 100
        x = 23 + 1.0 * (16 * math.sin(t) ** 3)
        y = 20 - (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) * 0.82
        points.append((x, y))
    polygon(draw, points, outline=GOLD_HI, width=2, fill=INK)
    line(draw, [(16, 19), (20, 16), (23, 20)], CYAN, 1)
    return image


def speed() -> Image.Image:
    image, draw = base()
    for offset, length, y in [(0, 28, 15), (4, 24, 22), (8, 19, 29)]:
        line(draw, [(7 + offset, y), (7 + offset + length, y)], GOLD_HI if offset == 0 else GOLD, 2)
        line(draw, [(7 + offset + length - 5, y - 4), (7 + offset + length, y), (7 + offset + length - 5, y + 4)], CYAN, 1)
    return image


def target() -> Image.Image:
    image, draw = base()
    ellipse(draw, (8, 8, 38, 38), outline=GOLD, width=2)
    ellipse(draw, (14, 14, 32, 32), outline=CYAN, width=1)
    ellipse(draw, (20, 20, 26, 26), outline=GOLD_HI, width=2, fill=INK)
    line(draw, [(23, 5), (23, 12)], GOLD_HI, 2)
    line(draw, [(23, 34), (23, 41)], GOLD_HI, 2)
    line(draw, [(5, 23), (12, 23)], GOLD_HI, 2)
    line(draw, [(34, 23), (41, 23)], GOLD_HI, 2)
    return image


def main():
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("assets/ui-pipeline/candidates/card-detail-green/r14/derived")
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f"Refuse to overwrite non-empty output: {output}")
    output.mkdir(parents=True, exist_ok=True)
    makers = {
        "property-building-health-46.png": building,
        "property-production-time-46.png": clock,
        "property-attack-46.png": sword,
        "property-unit-health-46.png": heart,
        "property-speed-46.png": speed,
        "property-range-46.png": target,
    }
    for name, maker in makers.items():
        maker().resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(output / name, "PNG")
    print(f"built {len(makers)} transparent property icons in {output}")


if __name__ == "__main__":
    main()
