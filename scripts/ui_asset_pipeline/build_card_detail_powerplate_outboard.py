"""Build a full-shell-width power plate whose end clamps overlap outer rails."""
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
    # 让原中央板保持内缩；两侧完整卡扣延伸至外壳边界并覆盖立柱。
    plate = image.crop((60, 280, 2070, 425)).resize((688, 38), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (688, 40), (0, 0, 0, 0))
    result.alpha_composite(plate, (0, 1))
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output, "PNG")
    print(f"Built outboard-clamp power plate: {output}")


if __name__ == "__main__":
    main()
