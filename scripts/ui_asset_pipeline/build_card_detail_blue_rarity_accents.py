"""构建蓝色稀有度详情页的无字、实际槽位尺寸装饰素材。"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


PALETTES = {
    "blue": ((67, 181, 255, 255), (166, 229, 255, 255), (7, 42, 91, 235), (39, 113, 191, 180), (24, 100, 180, 210)),
    "green": ((76, 215, 126, 255), (180, 255, 198, 255), (8, 69, 45, 235), (37, 132, 79, 180), (22, 112, 61, 210)),
}


def frame(palette: tuple[tuple[int, int, int, int], ...]) -> Image.Image:
    color, highlight, dark, _, _ = palette
    canvas = Image.new("RGBA", (448, 296), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    # 柔和外辉光只服务大轮廓，四角不增加任何独立装饰。
    for inset, alpha in ((0, 24), (2, 38), (4, 56)):
        draw.rounded_rectangle((inset, inset, 447 - inset, 295 - inset), radius=12, outline=(*color[:3], alpha), width=2)
    draw.rounded_rectangle((6, 6, 441, 289), radius=9, outline=dark, width=5)
    draw.rounded_rectangle((8, 8, 439, 287), radius=8, outline=color, width=3)
    draw.line((20, 10, 180, 10), fill=highlight, width=1)
    draw.line((268, 10, 428, 10), fill=highlight, width=1)
    # 上下中心为一处内凹连接，不额外引入角标或宝石。
    draw.line((180, 8, 188, 15, 260, 15, 268, 8), fill=color, width=3)
    draw.line((180, 287, 188, 280, 260, 280, 268, 287), fill=color, width=3)
    return canvas


def title_accent(palette: tuple[tuple[int, int, int, int], ...]) -> Image.Image:
    color, highlight, _, muted, shadow = palette
    canvas = Image.new("RGBA", (260, 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.line((0, 4, 28, 4), fill=muted, width=2)
    draw.line((28, 4, 38, 1, 222, 1, 232, 4), fill=color, width=2)
    draw.line((38, 6, 222, 6), fill=shadow, width=2)
    draw.line((232, 4, 260, 4), fill=muted, width=2)
    draw.line((98, 2, 162, 2), fill=highlight, width=1)
    return canvas


def xp_frame(palette: tuple[tuple[int, int, int, int], ...]) -> Image.Image:
    color, highlight, _, _, _ = palette
    canvas = Image.new("RGBA", (592, 21), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((0, 0, 591, 20), radius=9, outline=(*color[:3], 70), width=3)
    draw.rounded_rectangle((2, 2, 589, 18), radius=7, outline=color, width=2)
    draw.line((18, 3, 574, 3), fill=highlight, width=1)
    return canvas


def save(output_dir: Path, tone: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    palette = PALETTES[tone]
    outputs = {
        f"detail-{tone}-rarity-card-frame-448x296.png": frame(palette),
        f"detail-{tone}-rarity-title-accent-260x8.png": title_accent(palette),
        f"detail-{tone}-rarity-xp-frame-592x21.png": xp_frame(palette),
    }
    for name, image in outputs.items():
        target = output_dir / name
        if target.exists():
            raise FileExistsError(f"拒绝覆盖已有输出：{target}")
        image.save(target, "PNG")
        print(target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    parser.add_argument("--tone", choices=PALETTES, default="blue")
    args = parser.parse_args()
    save(Path(args.output_dir), args.tone)


if __name__ == "__main__":
    main()
