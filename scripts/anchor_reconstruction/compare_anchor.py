"""Compose stage-local preview and produce reference/preview/overlay/difference crops."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from anchor_common import load_manifest, output_path, resolve, resize_rgba


def font(size: int):
    for candidate in (Path("C:/Windows/Fonts/arialbd.ttf"), Path("C:/Windows/Fonts/msyhbd.ttc")):
        if candidate.exists(): return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("manifest"); args = parser.parse_args()
    manifest, base = load_manifest(args.manifest); out_dir = (base / manifest["output_dir"]).resolve()
    p = manifest["preview"]
    canvas = resize_rgba(out_dir / p["background"], tuple(manifest["canvas"]))
    resource = Image.open(out_dir / p["resource_skin"]).convert("RGBA") if p.get("resource_skin") else None
    title = Image.open(out_dir / p["title_skin"]).convert("RGBA")
    gem = Image.open(out_dir / p["title_gem"]).convert("RGBA")
    active_gem = Image.open(out_dir / p["active_gem"]).convert("RGBA") if p.get("active_gem") else None
    default = Image.open(out_dir / p["tab_default_skin"]).convert("RGBA")
    active = Image.open(out_dir / p["tab_active_skin"]).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    if p.get("resources"):
        for item in p["resources"]:
            skin = Image.open(out_dir / item["skin"]).convert("RGBA")
            x, y = item["rect"][:2]
            canvas.alpha_composite(skin, (x, y))
            tx, ty, tw, th = item["value_rect"]
            value_font = font(22)
            box = draw.textbbox((0, 0), item["value"], font=value_font, stroke_width=1)
            draw.text((tx + (tw - (box[2] - box[0])) / 2, ty + 4), item["value"], font=value_font, fill="#F4F8FC", stroke_width=1, stroke_fill="#08111F")
    elif resource:
        for index, x in enumerate(p["resource_x"]):
            canvas.alpha_composite(resource, (x, p["resource_y"]))
            draw.text((x + 50, p["resource_y"] + 12), p["resource_values"][index], font=font(18), fill="#F4F8FC", stroke_width=1, stroke_fill="#050A11")
            draw.text((x + 137, p["resource_y"] + 12), "+", font=font(18), fill="#D5A333", stroke_width=1, stroke_fill="#050A11")
    canvas.alpha_composite(title, tuple(p["title_xy"]))
    canvas.alpha_composite(gem, tuple(p["title_gem_xy"]))
    for i, label in enumerate(["I", "II", "III", "IV", "V"]):
        x, y = p["tab_xy"][0] + i * default.width, p["tab_xy"][1]
        canvas.alpha_composite(active if i == 0 else default, (x, y))
        label_font = font(24)
        box = draw.textbbox((0, 0), label, font=label_font, stroke_width=1)
        draw.text((x + (default.width - (box[2] - box[0])) / 2, y + round((default.height - 30) / 2)), label, font=label_font, fill="#FFF2B8", stroke_width=1, stroke_fill="#07111D")
    if active_gem:
        canvas.alpha_composite(active_gem, tuple(p["active_gem_xy"]))
    preview = output_path(base, p["preview_output"]); canvas.save(preview, "PNG")

    anchor = resize_rgba(resolve(p["anchor"]), tuple(manifest["canvas"]))
    x0, y0, x1, y1 = p["compare_region"]
    ref_crop = anchor.crop((x0, y0, x1, y1)); preview_crop = canvas.crop((x0, y0, x1, y1))
    ref_crop.save(output_path(base, "compare/reference.png"), "PNG")
    preview_crop.save(output_path(base, "compare/preview.png"), "PNG")
    Image.blend(ref_crop, preview_crop, 0.5).save(output_path(base, "compare/overlay.png"), "PNG")
    # Difference must be RGB/opaque: RGBA subtraction leaves alpha at zero and
    # visually turns a real mismatch into an apparently empty transparent image.
    difference = ImageChops.difference(ref_crop.convert("RGB"), preview_crop.convert("RGB"))
    difference.save(output_path(base, "compare/difference.png"), "PNG")


if __name__ == "__main__": main()
