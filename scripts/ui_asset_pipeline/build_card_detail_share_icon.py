"""Crop a generated share medallion into its exact runtime slot."""
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
    icon = image.crop((96, 92, 1186, 1178)).resize((38, 38), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    icon.save(output, "PNG")
    print(f"Built share icon: {output}")


if __name__ == "__main__":
    main()
