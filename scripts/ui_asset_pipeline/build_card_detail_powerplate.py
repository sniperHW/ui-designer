"""Crop a generated blue-metal power plate into the exact runtime slot."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("output")
    args = parser.parse_args()
    source, output = Path(args.source), Path(args.output)
    if output.exists():
        raise FileExistsError(f"拒绝覆盖已有输出：{output}")

    image = Image.open(source).convert("RGBA")
    # 只取物理板材本体，排除生成图中的透明留白与顶部杂散高光。
    plate = image.crop((42, 250, 2055, 460)).resize((588, 36), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (668, 40), (0, 0, 0, 0))
    # 与已确认的当前宽度一致：左右各保留 40px 安全缩进。
    result.alpha_composite(plate, (40, 2))
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output, "PNG")
    print(f"Built power plate: {output}")


if __name__ == "__main__":
    main()
