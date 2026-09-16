"""Crop a generated close button into its exact runtime slot."""
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
    button = image.crop((92, 88, 1174, 1153)).resize((56, 56), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    button.save(output, "PNG")
    print(f"Built close button: {output}")


if __name__ == "__main__":
    main()
