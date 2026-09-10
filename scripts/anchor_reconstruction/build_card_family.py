"""Generic card-art/component processor; no card is baked into a page screenshot."""
from __future__ import annotations
import argparse
from PIL import Image, ImageColor, ImageDraw
from anchor_common import load_manifest, output_path, resolve, resize_rgba


def cover_rgba(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale an illustration to fully cover a card window, then center-crop.

    Card portraits are visual content, not floating cut-outs. This operation
    deliberately uses ``cover`` semantics so the fixed card window can never
    reveal the page or the transparent card frame below it.
    """
    target_w, target_h = size
    source = source.convert("RGBA")
    source_w, source_h = source.size
    scale = max(target_w / source_w, target_h / source_h)
    resized = source.resize(
        (round(source_w * scale), round(source_h * scale)), Image.Resampling.LANCZOS
    )
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def assert_opaque(image: Image.Image, filename: str) -> None:
    """Fail early if a portrait would expose transparency through its window."""
    alpha_min, _ = image.getchannel("A").getextrema()
    if alpha_min != 255:
        raise ValueError(
            f"Card portrait {filename} is not fully opaque after normalization; "
            "supply a full-bleed illustration or add a deliberate opaque backdrop."
        )


def flatten_on_backdrop(image: Image.Image, color: str) -> Image.Image:
    """Composite semi-transparent legacy art onto an intentional card backdrop.

    This is not an export workaround: the backdrop is the structural bottom
    layer of a card portrait. It prevents alpha fringes in legacy art from
    exposing the card frame or page beneath the fixed portrait window.
    """
    backdrop = Image.new("RGBA", image.size, ImageColor.getcolor(color, "RGBA"))
    return Image.alpha_composite(backdrop, image)


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("manifest"); args = parser.parse_args()
    manifest, base = load_manifest(args.manifest); out_dir = (base / manifest["output_dir"]).resolve()
    for item in manifest.get("card_art", []):
        size = tuple(item["size"])
        source = Image.open(resolve(item["source"])).convert("RGBA")
        image = cover_rgba(source, size) if item.get("fit", "stretch") == "cover" else resize_rgba(resolve(item["source"]), size)
        if item.get("backdrop_color"):
            image = flatten_on_backdrop(image, item["backdrop_color"])
        if item.get("require_opaque", False):
            assert_opaque(image, item["file"])
        image.save(output_path(out_dir, item["file"]), "PNG")
    for item in manifest.get("card_components", []):
        w, h = item["size"]; image = Image.new("RGBA", (w, h), (0, 0, 0, 0)); draw = ImageDraw.Draw(image)
        if item["kind"] == "progress_track":
            draw.rounded_rectangle((1, 3, w - 2, h - 4), radius=max(3, h // 3), fill="#071423", outline="#C7982C", width=1)
        elif item["kind"] == "progress_fill":
            draw.rounded_rectangle((1, 3, w - 2, h - 4), radius=max(3, h // 3), fill="#18BED7", outline="#A8F4FF", width=1)
        image.save(output_path(out_dir, item["file"]), "PNG")


if __name__ == "__main__": main()
