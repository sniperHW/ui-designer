"""Build the final-size power bar with deliberate transparent safety margins."""
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
    # The generated source has a wide, nearly transparent glow above/below
    # the physical bar.  Crop its measured visual band instead of its broad
    # alpha bounds, otherwise the actual material is compressed into a line.
    body = image.crop((128, 250, 2105, 450)).resize((588, 34), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (668, 40), (0, 0, 0, 0))
    result.alpha_composite(body, (40, 3))
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output, "PNG")
    print(f"Built safe-area power bar: {output}")


if __name__ == "__main__":
    main()
