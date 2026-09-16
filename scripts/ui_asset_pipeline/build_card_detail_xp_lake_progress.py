"""构建绿色卡牌详情经验条的黑底与湖蓝填充素材（均为实际显示尺寸）。"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


WIDTH, HEIGHT = 592, 21


def track() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, WIDTH - 1, HEIGHT - 1), radius=10, fill=(5, 11, 17, 255), outline=(24, 69, 86, 255), width=2)
    draw.rounded_rectangle((3, 3, WIDTH - 4, HEIGHT - 4), radius=7, fill=(1, 5, 9, 255), outline=(10, 28, 37, 255), width=1)
    draw.line((14, 3, WIDTH - 15, 3), fill=(50, 103, 116, 170), width=1)
    return image


def fill() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # 从亮湖蓝过渡到深湖蓝；实际进度由渲染器裁切这张全长素材。
    for y in range(3, HEIGHT - 3):
        t = (y - 3) / max(1, HEIGHT - 7)
        r = int(46 * (1 - t) + 4 * t)
        g = int(222 * (1 - t) + 132 * t)
        b = int(244 * (1 - t) + 188 * t)
        draw.line((4, y, WIDTH - 5, y), fill=(r, g, b, 255), width=1)
    draw.rounded_rectangle((3, 3, WIDTH - 4, HEIGHT - 4), radius=7, outline=(104, 246, 255, 230), width=1)
    draw.line((13, 4, WIDTH - 14, 4), fill=(174, 255, 255, 220), width=1)
    return image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir")
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "detail-green-xp-track-black-592x21.png": track(),
        "detail-green-xp-fill-lake-blue-592x21.png": fill(),
    }
    for name, image in outputs.items():
        target = output_dir / name
        if target.exists():
            raise FileExistsError(f"拒绝覆盖已有输出：{target}")
        image.save(target, "PNG")
        print(target)


if __name__ == "__main__":
    main()
