"""Parameterised generator for metal UI chrome families.

The manifest controls dimensions, palette, line widths, corner/chamfer ratios and
state.  It is deliberately usable for deck tabs, resource bars, filters and nav.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from anchor_common import load_manifest, output_path, resolve, resize_rgba


def color(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    if len(value) == 6:
        return tuple(int(value[i:i + 2], 16) for i in range(0, 6, 2)) + (255,)
    return tuple(int(value[i:i + 2], 16) for i in range(0, 8, 2))


def inset_box(box, amount):
    return (box[0] + amount, box[1] + amount, box[2] - amount, box[3] - amount)


def chamfer_polygon(box, radius):
    x0, y0, x1, y1 = box
    return [(x0 + radius, y0), (x1 - radius, y0), (x1, y0 + radius), (x1, y1 - radius),
            (x1 - radius, y1), (x0 + radius, y1), (x0, y1 - radius), (x0, y0 + radius)]


def draw_shape(draw, box, kind, radius, fill, outline=None, width=1):
    if kind == "chamfer":
        draw.polygon(chamfer_polygon(box, radius), fill=fill)
        if outline:
            draw.line(chamfer_polygon(box, radius) + [chamfer_polygon(box, radius)[0]], fill=outline, width=width, joint="curve")
    else:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def build_item(item, palette, destination: Path):
    w, h = item["size"]
    state = item.get("state", "default")
    kind = item.get("shape", "chamfer")
    radius = max(2, round(min(w, h) * item.get("corner_ratio", 0.16)))
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if item.get("emblem") == "diamond":
        cx, cy = w // 2, h // 2
        gem = [(cx, 1), (w - 2, cy), (cx, h - 2), (1, cy)]
        draw.polygon(gem, fill="#1C9ED2", outline=palette["gold"])
        draw.line((cx, 4, cx, h - 5), fill="#A8F5FF", width=1)
        image.save(destination, "PNG")
        return
    outer = (0, 0, w - 1, h - 1)
    line = max(1, round(min(w, h) * item.get("line_ratio", 0.035)))
    fill = palette["active_fill"] if state == "active" else palette["default_fill"]
    gold = palette["active_gold"] if state == "active" else palette["gold"]
    # Shadow, structural dark outer edge, gold body edge, thin slate inner edge,
    # and a restricted upper glint reproduce the anchor's five-layer hierarchy.
    draw_shape(draw, (1, 2, w - 2, h - 1), kind, radius, palette["shadow"])
    draw_shape(draw, outer, kind, radius, palette["outline"], palette["outline"], line + 1)
    draw_shape(draw, inset_box(outer, line), kind, max(1, radius - line), fill, gold, line)
    inner = inset_box(outer, line * 2 + 1)
    draw_shape(draw, inner, kind, max(1, radius - line * 2), None, palette["inner_line"], 1)
    # Gold high-light exists only across the upper segment, not as an equal-width glow.
    x0, y0, x1, _ = inset_box(outer, line + 2)
    draw.line((x0 + radius, y0 + 1, x1 - radius, y0 + 1), fill=palette["glint"], width=1)
    if item.get("emblem") == "shield":
        cx, cy = w // 2, h // 2
        size = round(min(w, h) * 0.30)
        shield = [(cx, cy - size), (cx + size, cy - size // 2), (cx + size - 2, cy + size // 3),
                  (cx, cy + size), (cx - size + 2, cy + size // 3), (cx - size, cy - size // 2)]
        draw.polygon(shield, fill=palette["outline"], outline=gold)
        inner = [(cx, cy - size + 4), (cx + size - 4, cy - size // 2 + 2), (cx + size - 6, cy + size // 3 - 2),
                 (cx, cy + size - 4), (cx - size + 6, cy + size // 3 - 2), (cx - size + 4, cy - size // 2 + 2)]
        draw.line(inner + [inner[0]], fill=palette["inner_line"], width=1, joint="curve")
    image.save(destination, "PNG")


def reframe_chamfer(item, destination: Path):
    """Rebuild a damaged wide chrome frame at exact design pixels.

    The semantic content inside the measured inner polygon (icons and a navy
    material surface) is retained from ``source``.  Every exterior frame pixel
    is rebuilt as clean antialiased geometry, so a generated/cropped strip can
    never retain a jagged, pitted, or black-matted metal rim.
    """
    w, h = item["size"]
    scale = item.get("antialias", 4)
    source = resize_rgba(resolve(item["source"]), (w, h)).resize((w * scale, h * scale), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    margin = item.get("margin", 3) * scale
    cut = item.get("cut", 12) * scale
    colours = item.get("frame_colours", ["#31495A", "#755016", "#D4A844", "#FFE8A0", "#92641A", "#0B2435"])

    def polygon(inset: int):
        inset *= scale
        x0, y0, x1, y1 = margin + inset, margin + inset, w * scale - 1 - margin - inset, h * scale - 1 - margin - inset
        return chamfer_polygon((x0, y0, x1, y1), max(scale, cut - inset))

    # Nested solids make mathematically continuous rings.  This replaces an
    # image-model edge with a reusable, measured metal-frame construction.
    for inset, fill in enumerate(colours):
        draw.polygon(polygon(inset), fill=color(fill))

    content_inset = item.get("content_inset", len(colours))
    content_mask = Image.new("L", canvas.size, 0)
    if item.get("content_shape") == "rect":
        inset = content_inset * scale
        ImageDraw.Draw(content_mask).rectangle(
            (margin + inset, margin + inset, w * scale - 1 - margin - inset, h * scale - 1 - margin - inset),
            fill=255,
        )
    else:
        ImageDraw.Draw(content_mask).polygon(polygon(content_inset), fill=255)
    source_alpha = ImageChops.multiply(source.getchannel("A"), content_mask)
    source.putalpha(source_alpha)
    canvas.alpha_composite(source)

    # The bar owns only its continuous chrome and navy panel.  Any emblem or
    # stat icon that happened to exist in an old reference is removed here;
    # it must later be rebound as a separate true-alpha UIW node.
    pixels = canvas.load()
    for region in item.get("remove_source_rects", []):
        x, y, rw, rh = region["rect"]
        sx, sy, sw, sh = region["surface_sample_rect"]
        x0, y0 = x * scale, y * scale
        x1, y1 = (x + rw) * scale, (y + rh) * scale
        for yy in range(y0, y1):
            sample_y = min(canvas.height - 1, max(0, sy * scale + min(sh * scale - 1, yy - y0)))
            samples = [pixels[sample_x, sample_y] for sample_x in range(sx * scale, (sx + sw) * scale)]
            colour = tuple(sorted(pixel[channel] for pixel in samples)[len(samples) // 2] for channel in range(4))
            for xx in range(x0, x1):
                pixels[xx, yy] = colour

    # A restrained top glint and a darker lower return produce metal rather
    # than a flat yellow outline; both use continuous straight scanlines.
    left = margin + (cut - scale)
    right = w * scale - 1 - margin - (cut - scale)
    top = margin + 2 * scale
    bottom = h * scale - 1 - margin - 2 * scale
    draw.line((left, top, right, top), fill=color(item.get("top_glint", "#FFF0A9")), width=scale)
    draw.line((left, bottom, right, bottom), fill=color(item.get("bottom_return", "#8C611B")), width=scale)

    image = canvas.resize((w, h), Image.Resampling.LANCZOS)
    for rect in item.get("transparent_boundary_rects", []):
        x, y, rw, rh = rect
        # Downsampling an antialiased edge can leave subpixel colour in a
        # measured outer-only band.  Make that band genuine alpha first, then
        # assert it; otherwise a one-pixel presentation matte can survive.
        alpha = image.getchannel("A")
        ImageDraw.Draw(alpha).rectangle((x, y, x + rw - 1, y + rh - 1), fill=0)
        image.putalpha(alpha)
        alpha = image.getchannel("A").crop((x, y, x + rw, y + rh))
        if alpha.getbbox():
            raise ValueError(f"Reframed chrome has opaque pixels outside measured boundary {rect}: {item['file']}")
    image.save(destination, "PNG")


def build_flat_icon(item, destination: Path):
    """Build a crisp, true-alpha flat symbol for a reusable UI icon family."""
    w, h = item["size"]
    scale = item.get("antialias", 4)
    ink = color(item.get("color", "#F4F8FF"))
    image = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Icon paths are authored in a 22px design grid.  Scale that grid to the
    # requested output size before supersampling; otherwise a 66px icon keeps
    # the visual footprint of a 22px glyph inside a much larger transparent
    # canvas, which makes sibling assets look undersized and misaligned.
    grid_scale = scale * min(w, h) / 22

    def point(x, y):
        return (round(x * grid_scale), round(y * grid_scale))

    def box(x0, y0, x1, y1):
        return (round(x0 * grid_scale), round(y0 * grid_scale), round(x1 * grid_scale), round(y1 * grid_scale))

    width = max(scale, round(item.get("line_ratio", 0.11) * min(w, h) * scale))
    kind = item["flat_icon"]
    if kind == "sword":
        # An upright blade keeps a visible point, guard, grip and pommel even
        # after a 66px asset is presented in the narrow battle strip.
        draw.polygon([point(11, 1.5), point(15.2, 7), point(13, 15.5), point(11, 18), point(9, 15.5), point(6.8, 7)], fill=ink)
        guard_width = max(scale, width // 2)
        draw.line((point(5, 16), point(17, 16)), fill=ink, width=guard_width)
        draw.line((point(11, 16), point(11, 20)), fill=ink, width=guard_width + scale)
        draw.ellipse((8.5 * grid_scale, 18 * grid_scale, 13.5 * grid_scale, 22 * grid_scale), fill=ink)
    elif kind == "bow":
        # A deliberately planar bow: curved limb, taut string and horizontal
        # arrow.  Segment geometry is more reliable than a tiny arc at 22px.
        light_width = max(scale, width // 2)
        bow = [point(4, 2), point(10, 5), point(14, 11), point(10, 17), point(4, 20)]
        draw.line(bow, fill=ink, width=light_width, joint="curve")
        draw.line((point(4, 2), point(4, 20)), fill=ink, width=light_width)
        draw.line((point(5, 11), point(20, 11)), fill=ink, width=light_width)
        draw.polygon([point(20, 11), point(16, 8.2), point(16, 13.8)], fill=ink)
        draw.line((point(7.5, 8.8), point(5, 11)), fill=ink, width=light_width)
        draw.line((point(7.5, 13.2), point(5, 11)), fill=ink, width=light_width)
    elif kind == "cards":
        # Three simplified cards: offset rear silhouettes plus a foreground
        # card and a small centered diamond. No backing plate is introduced.
        light_width = max(scale, width // 2)
        draw.rounded_rectangle(box(3, 5, 15, 20), radius=2 * grid_scale, outline=ink, width=light_width)
        draw.rounded_rectangle(box(7, 2, 19, 17), radius=2 * grid_scale, outline=ink, width=light_width)
        draw.polygon([point(13, 7), point(16, 10), point(13, 13), point(10, 10)], fill=ink)
        draw.line((point(8.5, 15), point(17, 15)), fill=ink, width=max(scale, light_width // 2))
    elif kind == "relic":
        # A faceted gem communicates an artifact/relic at this scale.
        light_width = max(scale, width // 2)
        gem = [point(11, 1.5), point(19, 8), point(16, 19), point(11, 22), point(6, 19), point(3, 8)]
        draw.line(gem + [gem[0]], fill=ink, width=light_width, joint="curve")
        detail_width = max(scale, light_width // 2)
        draw.line((point(3.5, 8), point(18.5, 8)), fill=ink, width=detail_width)
        draw.line((point(11, 2), point(11, 21)), fill=ink, width=detail_width)
        draw.line((point(6, 19), point(11, 8)), fill=ink, width=detail_width)
        draw.line((point(16, 19), point(11, 8)), fill=ink, width=detail_width)
    elif kind == "chest":
        # A compact chest silhouette with distinct lid, body and central lock.
        light_width = max(scale, width // 2)
        draw.rounded_rectangle(box(3, 9, 19, 20), radius=2 * grid_scale, outline=ink, width=light_width)
        draw.arc(box(3, 3, 19, 15), start=180, end=360, fill=ink, width=light_width)
        draw.line((point(3, 12), point(19, 12)), fill=ink, width=light_width)
        draw.rounded_rectangle(box(9, 11, 13, 16), radius=grid_scale, fill=ink)
        draw.line((point(6, 12), point(6, 19)), fill=ink, width=max(scale, light_width // 2))
        draw.line((point(16, 12), point(16, 19)), fill=ink, width=max(scale, light_width // 2))
    elif kind == "emote":
        # An open smile with two eyes stays legible without any filled panel.
        light_width = max(scale, width // 2)
        draw.ellipse(box(3, 3, 19, 19), outline=ink, width=light_width)
        draw.ellipse(box(7, 8, 9, 10), fill=ink)
        draw.ellipse(box(13, 8, 15, 10), fill=ink)
        draw.arc(box(7, 9, 15, 16), start=0, end=180, fill=ink, width=light_width)
        draw.polygon([point(6, 16), point(8, 16.5), point(7, 20)], fill=ink)
    else:
        raise ValueError(f"Unknown flat icon: {kind}")
    image.resize((w, h), Image.Resampling.LANCZOS).save(destination, "PNG")


def anchor_extract(item, destination: Path):
    """Create a reusable, text-free sprite from an anchor component.

    This is intentionally parameterised by crop, silhouette and text-removal
    rules. It preserves the approved anchor's actual line positions instead of
    asking a generative model to redraw a tiny mobile UI control.
    """
    source = resize_rgba(resolve(item["source"]), tuple(item["canvas"]))
    x, y, w, h = item["rect"]
    sprite = source.crop((x, y, x + w, y + h))
    if item.get("size"):
        w, h = item["size"]
        sprite = sprite.resize((w, h), Image.Resampling.LANCZOS)
    alpha = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(alpha)
    for shape in item.get("silhouette", []):
        if shape["type"] == "chamfer":
            bx, by, bw, bh = shape["rect"]
            # `cut` describes a straight cut-corner amount; `radius` remains
            # supported for existing manifests that used the older name.
            cut = shape.get("cut", shape.get("radius"))
            if cut is None:
                raise ValueError("A chamfer silhouette needs 'cut' or 'radius'.")
            draw.polygon(chamfer_polygon((bx, by, bx + bw - 1, by + bh - 1), cut), fill=255)
        elif shape["type"] == "round":
            bx, by, bw, bh = shape["rect"]
            draw.rounded_rectangle((bx, by, bx + bw - 1, by + bh - 1), radius=shape["radius"], fill=255)
        elif shape["type"] == "diamond":
            cx, cy = shape["center"]
            rw, rh = shape["size"]
            draw.polygon([(cx, cy-rh//2), (cx+rw//2, cy), (cx, cy+rh//2), (cx-rw//2, cy)], fill=255)
        elif shape["type"] == "rect":
            bx, by, bw, bh = shape["rect"]
            draw.rectangle((bx, by, bx + bw - 1, by + bh - 1), fill=255)
    # The input anchors use white/near-white numerals. Remove only low-saturation
    # bright pixels inside declared runtime-text areas; gold outlines stay intact.
    pixels = sprite.load()
    for erase in item.get("erase_runtime_text", []):
        bx, by, bw, bh = erase["rect"]
        fill = color(erase.get("fill", "#091C2C"))
        for py in range(max(0, by), min(h, by + bh)):
            for px in range(max(0, bx), min(w, bx + bw)):
                r, g, b, a = pixels[px, py]
                if min(r, g, b) > 130 and max(r, g, b) - min(r, g, b) < 50:
                    pixels[px, py] = fill
    for erase in item.get("erase_runtime_polygons", []):
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).polygon(erase["points"], fill=255)
        flat = Image.new("RGBA", (w, h), color(erase.get("fill", "#102033")))
        sprite = Image.composite(flat, sprite, mask)
    for clear in item.get("clear_rects", []):
        bx, by, bw, bh = clear
        ImageDraw.Draw(alpha).rectangle((bx, by, bx + bw - 1, by + bh - 1), fill=0)
    for fill in item.get("fill_rects", []):
        bx, by, bw, bh = fill["rect"]
        ImageDraw.Draw(sprite).rounded_rectangle(
            (bx, by, bx + bw - 1, by + bh - 1), radius=fill.get("radius", 0), fill=color(fill["color"])
        )
    # Anchor crops can contain a near-black canvas halo outside the actual
    # metal outline.  Remove only declared edge regions and only dark pixels;
    # this keeps the coloured/gold contour while making the surrounding page
    # background genuinely transparent.
    alpha_pixels = alpha.load()
    for trim in item.get("trim_edge_dark_regions", []):
        bx, by, bw, bh = trim["rect"]
        threshold = trim.get("max_channel", 120)
        for py in range(max(0, by), min(h, by + bh)):
            for px in range(max(0, bx), min(w, bx + bw)):
                r, g, b, _ = pixels[px, py]
                if alpha_pixels[px, py] and max(r, g, b) <= threshold:
                    alpha_pixels[px, py] = 0
    # Some wide metal bars need a deliberately symmetric lower rim.  Mirror
    # the already-trimmed upper rim (including alpha) rather than stretching
    # or clipping the original pixels.  This is opt-in per manifest.
    for mirror in item.get("mirror_edges", []):
        sx, sy, sw, sh = mirror["source_rect"]
        tx, ty = mirror["target_xy"]
        source_box = (sx, sy, sx + sw, sy + sh)
        sprite_edge = sprite.crop(source_box).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        alpha_edge = alpha.crop(source_box).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        sprite.paste(sprite_edge, (tx, ty))
        alpha.paste(alpha_edge, (tx, ty))
    sprite.putalpha(alpha)
    sprite.save(destination, "PNG")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    args = parser.parse_args()
    manifest, base = load_manifest(args.manifest)
    out_dir = (base / manifest["output_dir"]).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    palette = {name: color(value) for name, value in manifest["palette"].items()}
    # Reference crops are reusable inputs for an ImageGen precision-edit pass.
    # They deliberately preserve the target scale and surrounding spacing so the
    # generated skin can be checked against its visual source before binding.
    for crop in manifest.get("reference_crops", []):
        source = resize_rgba(resolve(crop["source"]), tuple(crop["canvas"]))
        x, y, w, h = crop["rect"]
        source.crop((x, y, x + w, y + h)).save(output_path(out_dir, crop["file"]), "PNG")
    for item in manifest.get("anchor_extracts", []):
        anchor_extract(item, output_path(out_dir, item["file"]))
    for item in manifest.get("chrome", []):
        destination = output_path(out_dir, item["file"])
        if item.get("reframe_chamfer"):
            reframe_chamfer(item, destination)
        elif item.get("flat_icon"):
            build_flat_icon(item, destination)
        else:
            build_item(item, palette, destination)


if __name__ == "__main__":
    main()
