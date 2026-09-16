"""Crop a generated reset button into its exact runtime slot."""
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
    button = image.crop((100, 92, 1180, 1172)).resize((58, 58), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    button.save(output, "PNG")
    print(f"Built reset button: {output}")


if __name__ == "__main__":
    main()
