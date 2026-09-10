"""Generic background resize/crop processor for anchor-driven UI pages."""
from __future__ import annotations
import argparse
from collections import deque
import colorsys
from PIL import Image, ImageChops, ImageColor, ImageDraw
from anchor_common import load_manifest, output_path, resolve, resize_rgba


def neutral_background_to_alpha(image: Image.Image, spec: dict) -> Image.Image:
    """Turn a flat/chequered neutral presentation background into real alpha.

    Image editing models sometimes render a chequerboard preview as opaque
    near-white pixels.  Flooding only qualifying pixels from the canvas edge
    preserves bright interior metal highlights while removing the external
    presentation surface.
    """
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    min_value = spec.get("min_value", 220)
    max_spread = spec.get("max_spread", 24)

    def is_background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= min_value and max(r, g, b) - min(r, g, b) <= max_spread

    queue = deque()
    visited = bytearray(width * height)
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(1, height - 1):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if visited[index] or not is_background(x, y):
            continue
        visited[index] = 1
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))
    return rgba


def recolor_neutral_regions(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Replace opaque chequerboard/preview white left inside known UI regions.

    Unlike edge flood-fill, this only acts in explicitly measured structural
    zones. It preserves bright highlights on the outer chrome while removing
    non-art neutral pixels that an image model left inside a frame.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    for region in regions:
        x0, y0, width, height = region["rect"]
        x1, y1 = min(image.width, x0 + width), min(image.height, y0 + height)
        x0, y0 = max(0, x0), max(0, y0)
        replacement = ImageColor.getrgb(region["color"])
        min_value = region.get("min_value", 220)
        max_spread = region.get("max_spread", 24)
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = pixels[x, y]
                if a and min(r, g, b) >= min_value and max(r, g, b) - min(r, g, b) <= max_spread:
                    pixels[x, y] = (*replacement, a)
    return image


def clear_neutral_regions(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Turn measured, non-structural neutral residue into real alpha."""
    image = image.convert("RGBA")
    pixels = image.load()
    for region in regions:
        x0, y0, width, height = region["rect"]
        x1, y1 = min(image.width, x0 + width), min(image.height, y0 + height)
        x0, y0 = max(0, x0), max(0, y0)
        min_value = region.get("min_value", 220)
        max_spread = region.get("max_spread", 24)
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = pixels[x, y]
                if a and min(r, g, b) >= min_value and max(r, g, b) - min(r, g, b) <= max_spread:
                    pixels[x, y] = (r, g, b, 0)
    return image


def clear_edge_dark_matte(image: Image.Image, spec: dict) -> Image.Image:
    """Remove a dark presentation matte connected to the outside canvas.

    A generated/chopped chrome asset can contain near-black pixels that were
    composited behind its silhouette.  They are not a shadow: on a different
    page background they read as a hard black border.  The search is limited
    to pixels reachable from the canvas edge through transparent or
    near-black pixels, so dark blue interior fills remain protected by their
    gold/chrome edge.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    max_value = spec.get("max_value", 42)
    max_opaque_depth = spec.get("max_opaque_depth")
    queue = deque()
    visited = set()
    for x in range(width):
        queue.extend(((x, 0, 0), (x, height - 1, 0)))
    for y in range(1, height - 1):
        queue.extend(((0, y, 0), (width - 1, y, 0)))

    while queue:
        x, y, opaque_depth = queue.popleft()
        state = (x, y) if max_opaque_depth is None else (x, y, opaque_depth)
        if state in visited:
            continue
        visited.add(state)
        r, g, b, a = pixels[x, y]
        traversable = not a or max(r, g, b) <= max_value
        if not traversable:
            continue
        next_depth = opaque_depth if not a else opaque_depth + 1
        if max_opaque_depth is not None and next_depth > max_opaque_depth:
            continue
        if a:
            pixels[x, y] = (r, g, b, 0)
        if x > 0: queue.append((x - 1, y, next_depth))
        if x + 1 < width: queue.append((x + 1, y, next_depth))
        if y > 0: queue.append((x, y - 1, next_depth))
        if y + 1 < height: queue.append((x, y + 1, next_depth))
    return image


def edge_dark_matte_pixel_count(image: Image.Image, max_value: int, max_opaque_depth: int | None = None) -> int:
    """Count visible near-black pixels reachable from the external canvas.

    ``max_opaque_depth`` protects a measured, intentionally dark chrome rim
    that directly meets a true-alpha silhouette.  It still detects a real
    presentation matte (the first opaque pixels beyond that rim), while not
    mistaking a legitimate deep-blue metal edge for an external black canvas.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    queue = deque()
    # A pixel can be reached through alpha or through a bounded run of dark
    # opaque pixels, so include the run length in the visited state.
    visited = set()
    for x in range(width):
        queue.extend(((x, 0, 0), (x, height - 1, 0)))
    for y in range(1, height - 1):
        queue.extend(((0, y, 0), (width - 1, y, 0)))
    count = 0
    while queue:
        x, y, opaque_depth = queue.popleft()
        state = (x, y) if max_opaque_depth is None else (x, y, opaque_depth)
        if state in visited:
            continue
        visited.add(state)
        r, g, b, a = pixels[x, y]
        traversable = not a or max(r, g, b) <= max_value
        if not traversable:
            continue
        next_depth = opaque_depth if not a else opaque_depth + 1
        if max_opaque_depth is not None and next_depth > max_opaque_depth:
            continue
        if a:
            count += 1
        if x > 0: queue.append((x - 1, y, next_depth))
        if x + 1 < width: queue.append((x + 1, y, next_depth))
        if y > 0: queue.append((x, y - 1, next_depth))
        if y + 1 < height: queue.append((x, y + 1, next_depth))
    return count


def assert_quality_gate(image: Image.Image, spec: dict, label: str) -> None:
    """Fail a build when a declared presentation-matte quality gate fails."""
    matte = spec.get("edge_dark_matte")
    if matte:
        count = edge_dark_matte_pixel_count(
            image,
            matte.get("max_value", 42),
            matte.get("max_opaque_depth"),
        )
        permitted = matte.get("max_pixels", 0)
        if count > permitted:
            raise ValueError(
                f"Quality gate failed for {label}: {count} external dark-matte pixels remain "
                f"(maximum {permitted})."
            )
        # A bounded dark chrome rim needs an explicit alpha proof outside its
        # measured outline.  This prevents a relaxed rim-depth budget from
        # ever being used to retain an opaque black presentation canvas.
        pixels = image.convert("RGBA").load()
        for rect in matte.get("transparent_boundary_rects", []):
            x, y, width, height = rect
            x0, y0 = max(0, x), max(0, y)
            x1, y1 = min(image.width, x + width), min(image.height, y + height)
            opaque = sum(1 for yy in range(y0, y1) for xx in range(x0, x1) if pixels[xx, yy][3])
            if opaque:
                raise ValueError(
                    f"Quality gate failed for {label}: {opaque} opaque pixels remain "
                    f"outside the declared material boundary {rect}."
                )
    # Runtime labels and values must never inherit a baked chrome socket from
    # an earlier anchor crop.  A warm-metal scan inside a declared dynamic
    # area catches the tell-tale gold outline of such a socket while allowing
    # the same material test to be reused by any horizontal/vertical panel.
    for region in spec.get("forbid_warm_metal_regions", []):
        x, y, width, height = region["rect"]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(image.width, x + width), min(image.height, y + height)
        min_red = region.get("min_red", 72)
        min_green = region.get("min_green", 48)
        max_blue = region.get("max_blue", 80)
        permitted = region.get("max_pixels", 0)
        pixels = image.convert("RGBA").load()
        count = sum(
            1 for yy in range(y0, y1) for xx in range(x0, x1)
            if pixels[xx, yy][3]
            and pixels[xx, yy][0] >= min_red
            and pixels[xx, yy][1] >= min_green
            and pixels[xx, yy][2] <= max_blue
        )
        if count > permitted:
            raise ValueError(
                f"Quality gate failed for {label}: {count} baked warm-metal placeholder "
                f"pixels remain in runtime region {region['rect']} (maximum {permitted})."
            )


def paint_rounded_rects(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Replace a removed baked element with an opaque, deliberate UI underlay."""
    image = image.convert("RGBA")
    draw = ImageDraw.Draw(image)
    for region in regions:
        x, y, width, height = region["rect"]
        draw.rounded_rectangle(
            (x, y, x + width, y + height),
            radius=region.get("radius", 0),
            fill=ImageColor.getcolor(region["color"], "RGBA"),
        )
    return image


def paint_rects(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Paint a measured flat structural zone without inventing a badge shape."""
    image = image.convert("RGBA")
    draw = ImageDraw.Draw(image)
    for region in regions:
        x, y, width, height = region["rect"]
        draw.rectangle(
            (x, y, x + width - 1, y + height - 1),
            fill=ImageColor.getcolor(region["color"], "RGBA"),
        )
    return image


def apply_chamfer_silhouette(image: Image.Image, spec: dict) -> Image.Image:
    """Apply an anti-aliased transparent outer silhouette to a chrome asset.

    Image generation commonly leaves its dark presentation canvas in the four
    corners of a chamfered frame. The silhouette is measured in final design
    pixels, so it removes that canvas without cutting into the gold edge.
    """
    image = image.convert("RGBA")
    scale = spec.get("antialias", 4)
    cut = spec["cut"] * scale
    width, height = image.size
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([
        (cut, 0), (width * scale - cut, 0),
        (width * scale, cut), (width * scale, height * scale - cut),
        (width * scale - cut, height * scale), (cut, height * scale),
        (0, height * scale - cut), (0, cut),
    ], fill=255)
    mask = mask.resize((width, height), Image.Resampling.LANCZOS)
    alpha = ImageChops.multiply(image.getchannel("A"), mask)
    image.putalpha(alpha)
    return image


def copy_regions(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Rebuild a repeated chrome area from a clean sibling region.

    A generated frame can invent a second decorative socket where a runtime
    badge already owns the space. Copying the corresponding clean corner
    preserves the frame's material and removes that duplicate structure.
    """
    image = image.convert("RGBA")
    for region in regions:
        sx, sy, width, height = region["source_rect"]
        tx, ty = region["target_xy"]
        fragment = image.crop((sx, sy, sx + width, sy + height))
        if region.get("flip_horizontal"):
            fragment = fragment.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if region.get("flip_vertical"):
            fragment = fragment.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        image.paste(fragment, (tx, ty))
    return image


def inpaint_surface_rects(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Remove a baked runtime socket while preserving its surrounding surface.

    The repair samples the complete panel material immediately to the left and
    right of a measured rectangle for every scanline, then interpolates across
    the removed area.  This retains a navy/metal surface's local vertical
    gradient and alpha rather than covering the defect with a flat colour.
    It is deliberately generic: the same rule can repair any decorative frame
    that accidentally contains text, number, progress, or empty-slot chrome.
    """
    image = image.convert("RGBA")
    source = image.copy()
    source_pixels = source.load()
    target_pixels = image.load()
    for region in regions:
        x, y, width, height = region["rect"]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(image.width, x + width), min(image.height, y + height)
        if x1 <= x0 or y1 <= y0:
            continue
        sample_rect = region.get("surface_sample_rect")
        if sample_rect:
            sx, sy, sw, sh = sample_rect
            sx0, sx1 = max(0, sx), min(image.width, sx + sw)
            if sx1 <= sx0 or sh <= 0:
                raise ValueError(f"Invalid surface sample rectangle: {sample_rect}")
            for yy in range(y0, y1):
                sample_y = min(image.height - 1, max(0, sy + min(sh - 1, yy - y0)))
                samples = [source_pixels[sample_x, sample_y] for sample_x in range(sx0, sx1)]
                # The sampled strip is a clean segment of the same physical
                # panel.  Averaging its scanline retains the vertical material
                # gradient while removing a baked outline's local shadow.
                colour = tuple(
                    sorted(pixel[channel] for pixel in samples)[len(samples) // 2]
                    for channel in range(4)
                )
                for xx in range(x0, x1):
                    target_pixels[xx, yy] = colour
            continue
        inset = max(1, region.get("sample_inset", 3))
        left_x = max(0, x0 - inset)
        right_x = min(image.width - 1, x1 - 1 + inset)
        span = max(1, x1 - x0 + 1)
        for yy in range(y0, y1):
            left = source_pixels[left_x, yy]
            right = source_pixels[right_x, yy]
            for xx in range(x0, x1):
                mix = (xx - x0 + 1) / span
                target_pixels[xx, yy] = tuple(
                    round(left[channel] * (1 - mix) + right[channel] * mix)
                    for channel in range(4)
                )
    return image


def remap_hue(image: Image.Image, spec: dict) -> Image.Image:
    """Create an exact-geometry rarity skin by recolouring a passed master.

    Only the measured green material hue range moves. Champagne metal, alpha,
    highlights and all structural pixels remain untouched, avoiding geometry
    drift that would be caused by regenerating three otherwise identical cards.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    min_hue, max_hue = spec["source_hue_range"]
    target_hue = spec["target_hue"]
    saturation_multiplier = spec.get("saturation_multiplier", 1.0)
    value_multiplier = spec.get("value_multiplier", 1.0)
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if not a:
                continue
            hue, saturation, value = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if min_hue <= hue <= max_hue and saturation >= spec.get("min_saturation", 0.18):
                rr, gg, bb = colorsys.hsv_to_rgb(
                    target_hue,
                    min(1.0, saturation * saturation_multiplier),
                    min(1.0, value * value_multiplier),
                )
                pixels[x, y] = (round(rr * 255), round(gg * 255), round(bb * 255), a)
    return image


def tint_regions(image: Image.Image, regions: list[dict]) -> Image.Image:
    """Apply a controlled material tint while retaining existing texture.

    This is used for semantic state skins (for example a selected Tab): it
    blends the established material rather than painting a flat state patch.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    for region in regions:
        x0, y0, width, height = region["rect"]
        x1, y1 = min(image.width, x0 + width), min(image.height, y0 + height)
        x0, y0 = max(0, x0), max(0, y0)
        tr, tg, tb = ImageColor.getrgb(region["color"])
        opacity = region.get("opacity", 0.0)
        brightness = region.get("brightness", 1.0)
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = pixels[x, y]
                if not a:
                    continue
                r = min(255, round((r * (1 - opacity) + tr * opacity) * brightness))
                g = min(255, round((g * (1 - opacity) + tg * opacity) * brightness))
                b = min(255, round((b * (1 - opacity) + tb * opacity) * brightness))
                pixels[x, y] = (r, g, b, a)
    return image


def retain_hue_range(image: Image.Image, spec: dict) -> Image.Image:
    """Convert an icon's old coloured socket into alpha while retaining its ink."""
    image = image.convert("RGBA")
    pixels = image.load()
    minimum, maximum = spec["hue_range"]
    min_saturation = spec.get("min_saturation", 0.2)
    min_value = spec.get("min_value", 0.2)
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if not a:
                continue
            hue, saturation, value = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if not (minimum <= hue <= maximum and saturation >= min_saturation and value >= min_value):
                pixels[x, y] = (r, g, b, 0)
    return image


def dark_panel_to_alpha(image: Image.Image, spec: dict) -> Image.Image:
    """Extract a true-alpha icon from a dark-navy UI panel crop.

    It removes only the dark blue/near-black presentation surface.  Gold,
    white and coloured icon ink remains a separate semantic asset, so it can
    be composed over any complete container without carrying a square socket.
    """
    image = image.convert("RGBA")
    pixels = image.load()
    max_value = spec.get("max_value", 110)
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a and max(r, g, b) <= max_value and b >= r:
                pixels[x, y] = (r, g, b, 0)
    return image


def nine_slice_resize(image: Image.Image, target_size: tuple[int, int], spec: dict) -> Image.Image:
    """Resize reusable UI chrome while preserving corners and border weight."""
    image = image.convert("RGBA")
    target_w, target_h = target_size
    left, top, right, bottom = spec.get("insets", [12, 12, 12, 12])
    source_w, source_h = image.size
    if left + right > source_w or top + bottom > source_h:
        raise ValueError(f"Nine-slice insets exceed source size: {image.size} / {spec}")
    if left + right > target_w or top + bottom > target_h:
        raise ValueError(f"Nine-slice insets exceed target size: {target_size} / {spec}")
    result = Image.new("RGBA", target_size, (0, 0, 0, 0))
    xs, ys = [0, left, source_w - right, source_w], [0, top, source_h - bottom, source_h]
    tx, ty = [0, left, target_w - right, target_w], [0, top, target_h - bottom, target_h]
    for row in range(3):
        for col in range(3):
            part = image.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            dest = (tx[col], ty[row], tx[col + 1], ty[row + 1])
            size = (dest[2] - dest[0], dest[3] - dest[1])
            if part.size != size:
                part = part.resize(size, Image.Resampling.LANCZOS)
            result.alpha_composite(part, dest[:2])
    return result


def recolor_visible_to_color(image: Image.Image, spec: dict) -> Image.Image:
    """Recolour an independent true-alpha icon without changing its alpha.

    This is deliberately colour-only: the shared race glyph remains the same
    source silhouette used by the filter, while a context such as the battle
    strip can request its flat white presentation without baking a new panel
    behind it.
    """
    image = image.convert("RGBA")
    target = ImageColor.getrgb(spec["color"])
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            _, _, _, a = pixels[x, y]
            if a:
                pixels[x, y] = (*target, a)
    return image


def process(item: dict) -> Image.Image:
    image = Image.open(resolve(item["source"])).convert("RGBA")
    if item.get("source_rect"):
        x, y, width, height = item["source_rect"]
        image = image.crop((x, y, x + width, y + height))
    if item.get("neutral_background_to_alpha"):
        image = neutral_background_to_alpha(image, item["neutral_background_to_alpha"])
    if item.get("crop_alpha"):
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            raise ValueError(f"No opaque pixels after background extraction: {item['source']}")
        image = image.crop(bounds)
    target_size = tuple(item["size"])
    if item.get("nine_slice"):
        image = nine_slice_resize(image, target_size, item["nine_slice"])
    elif item.get("fit") == "contain":
        # Independent icons keep their designed aspect ratio while their
        # transparent canvas matches the exact runtime slot.  Stretching a
        # chest, shield, or tower to a fixed rectangle changes its silhouette
        # and creates apparent visual inconsistency between sibling icons.
        scale = min(target_size[0] / image.width, target_size[1] / image.height)
        contained_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(contained_size, Image.Resampling.LANCZOS)
        contained = Image.new("RGBA", target_size, (0, 0, 0, 0))
        contained.alpha_composite(image, ((target_size[0] - contained_size[0]) // 2, (target_size[1] - contained_size[1]) // 2))
        image = contained
    else:
        image = image.resize(target_size, Image.Resampling.LANCZOS)
    if item.get("copy_regions"):
        image = copy_regions(image, item["copy_regions"])
    if item.get("surface_inpaint_rects"):
        image = inpaint_surface_rects(image, item["surface_inpaint_rects"])
    if item.get("clear_alpha_rects"):
        alpha = image.getchannel("A")
        for x, y, w, h in item["clear_alpha_rects"]:
            Image.Image.paste(alpha, 0, (x, y, x + w, y + h))
        image.putalpha(alpha)
    if item.get("neutral_clear_rects"):
        image = clear_neutral_regions(image, item["neutral_clear_rects"])
    if item.get("neutral_recolor_rects"):
        image = recolor_neutral_regions(image, item["neutral_recolor_rects"])
    if item.get("edge_dark_matte_clear"):
        image = clear_edge_dark_matte(image, item["edge_dark_matte_clear"])
    # Structural infills are deliberately painted after matte removal.  Their
    # dark blue is valid UI content, not outside-canvas contamination.
    if item.get("paint_rounded_rects"):
        image = paint_rounded_rects(image, item["paint_rounded_rects"])
    if item.get("paint_rects"):
        image = paint_rects(image, item["paint_rects"])
    if item.get("hue_remap"):
        image = remap_hue(image, item["hue_remap"])
    if item.get("tint_regions"):
        image = tint_regions(image, item["tint_regions"])
    if item.get("retain_hue_range"):
        image = retain_hue_range(image, item["retain_hue_range"])
    if item.get("dark_panel_to_alpha"):
        image = dark_panel_to_alpha(image, item["dark_panel_to_alpha"])
    if item.get("recolor_visible_to_color"):
        image = recolor_visible_to_color(image, item["recolor_visible_to_color"])
    if item.get("post_edge_dark_matte_clear"):
        image = clear_edge_dark_matte(image, item["post_edge_dark_matte_clear"])
    if item.get("post_crop_alpha"):
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            raise ValueError(f"No icon ink remains after panel extraction: {item['file']}")
        image = image.crop(bounds)
        if item.get("post_fit") == "contain":
            scale = min(target_size[0] / image.width, target_size[1] / image.height)
            fitted_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
            image = image.resize(fitted_size, Image.Resampling.LANCZOS)
            fitted = Image.new("RGBA", target_size, (0, 0, 0, 0))
            fitted.alpha_composite(image, ((target_size[0] - fitted_size[0]) // 2, (target_size[1] - fitted_size[1]) // 2))
            image = fitted
    if item.get("silhouette_chamfer"):
        image = apply_chamfer_silhouette(image, item["silhouette_chamfer"])
    # The edit model can leave the outermost anti-alias pixels pre-composited
    # against its presentation background.  For a closed, symmetric chrome
    # frame, copy a clean edge with both colour and alpha rather than retaining
    # that contaminated fringe.
    for mirror in item.get("mirror_edges", []):
        sx, sy, sw, sh = mirror["source_rect"]
        tx, ty = mirror["target_xy"]
        edge = image.crop((sx, sy, sx + sw, sy + sh)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        image.paste(edge, (tx, ty))
    if item.get("quality_gate"):
        assert_quality_gate(image, item["quality_gate"], item["file"])
    return image


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("manifest"); args = parser.parse_args()
    manifest, base = load_manifest(args.manifest)
    out_dir = (base / manifest["output_dir"]).resolve()
    for item in manifest.get("backgrounds", []):
        image = process(item)
        image.save(output_path(out_dir, item["file"]), "PNG")


if __name__ == "__main__": main()
