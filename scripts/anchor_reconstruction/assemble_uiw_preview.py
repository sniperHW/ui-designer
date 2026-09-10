"""Bind a stage manifest's independent PNGs into a real, interactive UIW preview."""
from __future__ import annotations

import argparse
import json

from anchor_common import load_manifest, output_path, png_data_uri, resolve


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("manifest"); args = parser.parse_args()
    manifest, base = load_manifest(args.manifest)
    assembly = manifest["assembly"]
    geometry = assembly.get("geometry", {})
    doc = json.loads(resolve(assembly["uiw_source"]).read_text(encoding="utf-8"))
    asset_dir = (base / manifest["output_dir"]).resolve()
    # A later gate may reuse all frozen assets without copying them into every
    # stage directory.  The manifest controls the lookup order, so this remains
    # reusable for any component family.
    asset_dirs = [asset_dir, *(resolve(path) for path in manifest.get("asset_source_dirs", []))]

    def asset(name):
        for directory in asset_dirs:
            candidate = directory / name
            if candidate.is_file():
                return png_data_uri(candidate)
        raise FileNotFoundError(f"Asset not found in stage asset directories: {name}")

    # Card skins are bound at the reusable custom-widget definition level so
    # every existing card instance keeps its art overrides and interactions.
    for custom in doc.get("customWidgets", []):
        skin = assembly.get("card_frames", {}).get(custom.get("id"))
        portrait = assembly.get("card_portraits", {}).get(custom.get("id"))
        # Race marks are a shared, true-alpha icon family.  Keep their asset
        # binding separate from the card chrome so a later card-to-race
        # assignment only changes the manifest, never the PNG or widget tree.
        faction_icon = assembly.get("card_faction_icons", {}).get(custom.get("id"))
        progress = assembly.get("card_progress_by_id", {}).get(custom.get("id"), assembly.get("card_progress"))
        layout = assembly.get("card_layouts", {}).get(custom.get("id"), {})
        is_game_card = any(node.get("name") == "卡面图片" for node in custom.get("tree", []))
        if not skin and not portrait and not progress and not is_game_card:
            continue
        for node in custom.get("tree", []):
            if skin and node.get("name") == "卡框":
                node["props"]["assetSrc"] = asset(skin)
            # A portrait is normalized by build_card_family.py to the exact
            # card-window size before it reaches UIW. Keeping the component
            # rect explicit makes the no-transparent-gap contract testable.
            if portrait and node.get("name") == "卡面图片":
                node["props"]["assetSrc"] = asset(portrait)
                rect = layout.get("portrait", assembly.get("card_window"))
                if rect:
                    node["x"], node["y"], node["w"], node["h"] = rect
            if faction_icon and node.get("name") == "配型图标":
                # The source icon is already alpha-clean.  A placeholder is
                # used here because it is the UIW image-bearing primitive used
                # by the existing card component; removing text styling avoids
                # a browser/font fallback being composited behind the glyph.
                node["type"] = "placeholder"
                node["props"] = {"assetSrc": asset(faction_icon)}
            if progress and node.get("name") == "碎片进度条":
                node["props"]["assetSrc"] = asset(progress["track"])
                node["props"]["assetFillSrc"] = asset(progress["fill"])
            rect_key = {
                "等级文字": "level",
                "碎片进度条": "progress",
                "碎片文字": "progress_text",
                "配型底": "faction_base",
                "配型图标": "faction_icon",
            }.get(node.get("name"))
            if rect_key and layout.get(rect_key):
                node["x"], node["y"], node["w"], node["h"] = layout[rect_key]
            if node.get("name") in layout.get("node_props", {}):
                node["props"].update(layout["node_props"][node["name"]])
            if node.get("name") in layout.get("hidden_nodes", []):
                node["visible"] = False

        # A portrait window slightly intersects the lower edge of the faction
        # badge.  Rendering the portrait after the badge clips that edge in
        # the real canvas.  Keep a single, explicit card compositing contract
        # for every rarity: portrait -> frame -> faction chrome -> runtime UI.
        if is_game_card:
            layer_order = {
                "卡面图片": 10,
                "卡框": 20,
                "配型底": 30,
                "配型图标": 40,
                "等级文字": 50,
                "碎片进度条": 60,
                "碎片文字": 70,
                "可升级标识": 80,
            }
            indexed_tree = list(enumerate(custom.get("tree", [])))
            custom["tree"] = [
                node for _, node in sorted(
                    indexed_tree, key=lambda item: (layer_order.get(item[1].get("name"), 50), item[0])
                )
            ]

    resource_specs = assembly.get("resources", [])
    resource_icon_specs = assembly.get("resource_icons", [])
    for node in doc["commonLayer"]["nodes"]:
        if node["name"] == "页面背景素材" and assembly.get("background"):
            node["props"]["src"] = asset(assembly["background"])
        if node["name"].startswith("资源图标"):
            icon_spec = next((s for s in resource_icon_specs if node["name"] == s["node"]), None)
            if icon_spec:
                node["visible"] = True
                node["x"], node["y"], node["w"], node["h"] = icon_spec["rect"]
                node["props"]["src"] = asset(icon_spec["skin"])
            elif resource_specs:
                node["visible"] = False
        if node["name"].startswith("资源条"):
            spec = next((s for s in resource_specs if s["tag"] in node["name"]), None)
            if spec:
                node["props"]["assetSrc"] = asset(spec["skin"])
                node["x"], node["y"], node["w"], node["h"] = spec["rect"]
            elif assembly.get("resource_skin"):
                node["props"]["assetSrc"] = asset(assembly["resource_skin"])
        for spec in resource_specs:
            if node["name"] == f"资源值{spec['tag']}":
                x, y, w, h = spec["value_rect"]
                node["x"], node["y"], node["w"], node["h"] = x, y, w, h
                node["props"].update({"text": spec["value"], "fontSize": 22, "fontWeight": 800,
                                      "textColor": "#F4F8FF", "textStroke": "#08111F", "textStrokeWidth": 1.2})
            if node["name"] in (f"资源加号{spec['tag']}", f"资源加号字{spec['tag']}"):
                node["visible"] = False

    main_tab = next(node for node in doc["pages"][0]["nodes"] if node["type"] == "tab")
    main_tab["activeTab"] = assembly.get("main_page", 1)
    main_navigation = assembly.get("main_navigation")
    if main_navigation:
        # Bottom navigation uses whole, stateful chrome skins plus independent
        # true-alpha icons.  Tab labels stay in the document as interaction
        # semantics, but are deliberately not drawn over the icon art.
        main_tab["props"].update({
            "tabs": main_navigation.get("tabs", main_tab["props"].get("tabs", [])),
            "barPosition": "bottom",
            "barHeight": main_navigation["bar_height"],
            "tabWidths": main_navigation.get("tab_widths"),
            "tabGap": main_navigation.get("tab_gap", 0),
            "transparentSurface": True,
            "assetDefaultSrc": asset(main_navigation["default_skin"]),
            "assetActiveSrc": asset(main_navigation["active_skin"]),
            "assetIconSrcs": [asset(name) for name in main_navigation["icons"]],
            "assetIconWidth": main_navigation["icon_size"][0],
            "assetIconHeight": main_navigation["icon_size"][1],
            "hideTabLabels": True,
        })
    page = main_tab["pages"][assembly.get("main_page", 1)]
    filter_spec = assembly.get("filter")
    if filter_spec:
        filter_node = next((node for node in page if node["name"] == filter_spec["node"]), None)
        if filter_node is None:
            raise ValueError(f"Filter node not found: {filter_spec['node']}")
        filter_node["visible"] = True
        filter_node["x"], filter_node["y"], filter_node["w"], filter_node["h"] = filter_spec["rect"]
        filter_node["props"].update({
            "options": filter_spec["options"], "selected": filter_spec.get("selected", 0),
            "filterWidths": filter_spec["widths"],
            "assetDefaultSrcs": [asset(name) for name in filter_spec["default_skins"]],
            "assetActiveSrcs": [asset(name) for name in filter_spec["active_skins"]],
            "assetIconSrcs": [asset(name) if name else "" for name in filter_spec["icons"]],
            "assetIconWidth": filter_spec["icon_size"][0],
            "assetIconHeight": filter_spec["icon_size"][1],
            "fontSize": filter_spec.get("font_size", 20), "fontWeight": filter_spec.get("font_weight", 800),
            "textColor": filter_spec.get("text_color", "#FFF2B8"),
            "textStroke": filter_spec.get("text_stroke", "#07111D"),
            "textStrokeWidth": filter_spec.get("text_stroke_width", 1.0),
        })
    # The card library is a real nested Tab -> Scroll composition.  Its cards,
    # category pages, race pages and scrolling remain document nodes; this
    # generic binder only replaces the visual frame behind every library
    # scroll viewport with the measured, alpha-clean material skin.
    library = assembly.get("library")
    if library:
        if filter_spec is None:
            raise ValueError("Library binding requires a declared filter node")
        category_name = library.get("category_node")
        scrolls = []
        for race_page in filter_node.get("pages", []):
            category = next((node for node in race_page if node.get("name") == category_name), None)
            if category is None:
                raise ValueError(f"Library category node not found: {category_name}")
            category_page_index = library.get("category_page", 0)
            category_pages = category.get("pages", [])
            if not 0 <= category_page_index < len(category_pages):
                raise ValueError(f"Library category page {category_page_index} is out of range")
            category_spec = library.get("category")
            if category_spec:
                # The category pager remains a genuine nested Tab.  Its four
                # closed state skins are only chrome; the page labels are
                # runtime text and each tab continues to select its own page.
                category["visible"] = True
                if category_spec.get("rect"):
                    category["x"], category["y"], category["w"], category["h"] = category_spec["rect"]
                category["activeTab"] = category_spec.get("selected", category_page_index)
                category["props"].update({
                    "tabs": category_spec.get("tabs", category["props"].get("tabs", [])),
                    "barPosition": category_spec.get("bar_position", "bottom"),
                    "barHeight": category_spec.get("bar_height", 64),
                    "tabWidths": category_spec.get("tab_widths"),
                    "tabGap": category_spec.get("tab_gap", 0),
                    "transparentSurface": True,
                    "assetDefaultSrc": asset(category_spec["default_skin"]),
                    "assetActiveSrc": asset(category_spec["active_skin"]),
                    "fontSize": category_spec.get("font_size", 22),
                    "fontWeight": category_spec.get("font_weight", 800),
                    "textColor": category_spec.get("text_color", "#FFF2B8"),
                    "textStroke": category_spec.get("text_stroke", "#07111D"),
                    "textStrokeWidth": category_spec.get("text_stroke_width", 1.0),
                })
                category["props"].pop("hideTabLabels", None)
            selected_page = category_pages[category_page_index]
            selected_scrolls = [node for node in selected_page if node.get("type") == "scroll"]
            if library.get("flatten_category", False):
                # Card-library category chrome was an obsolete nested Tab.
                # Flattening keeps the selected category's real Scroll and
                # card children, but removes the middle container that the
                # design canvas failed to present as a nested layer.
                race_page[:] = selected_scrolls
            scrolls.extend(selected_scrolls)
        if not scrolls:
            raise ValueError("Library binding found no scroll viewports")
        for scroll in scrolls:
            scroll["visible"] = True
            # A library viewport may deliberately be frame-free: the cards
            # scroll directly over the page background, while scroll behavior
            # and the runtime thumb remain intact.  Remove a skin inherited
            # from an earlier stage rather than leaving a fixed lower rim.
            scroll["props"].update({
                "transparentSurface": True,
                "scrollThumbColor": library.get("scroll_thumb_color", "#C59A45"),
            })
            if library.get("frame_skin"):
                scroll["props"]["assetSrc"] = asset(library["frame_skin"])
            else:
                scroll["props"].pop("assetSrc", None)
            if library.get("scroll_rect"):
                scroll["x"], scroll["y"], scroll["w"], scroll["h"] = library["scroll_rect"]
        pager_spec = library.get("pager")
        if pager_spec:
            # The renderer supports the root navigation plus one nested Tab,
            # but fails to present a second nested Tab around a Scroll. Keep
            # category paging as a sibling real Tab: it has true page/active
            # state and click handling without enclosing the race filter and
            # risking the blank-library regression.
            pager_rect = pager_spec["rect"]
            tabs = pager_spec["tabs"]
            filter_node["h"] = pager_rect[1] - filter_node["y"]
            pager_node = {
                "id": "library-category-pager", "type": "tab", "name": pager_spec.get("node", "卡库切页栏"),
                "x": pager_rect[0], "y": pager_rect[1], "w": pager_rect[2], "h": pager_rect[3],
                "visible": True, "locked": False, "activeTab": pager_spec.get("selected", 0),
                "props": {
                    "tabs": tabs, "barPosition": "bottom", "barHeight": pager_spec.get("bar_height", 64),
                    "tabWidths": pager_spec.get("tab_widths"), "tabGap": pager_spec.get("tab_gap", 0),
                    "transparentSurface": True,
                    "assetDefaultSrc": asset(pager_spec["default_skin"]),
                    "assetActiveSrc": asset(pager_spec["active_skin"]),
                    "assetIconSrcs": [asset(name) for name in pager_spec["icons"]],
                    "assetIconWidth": pager_spec.get("icon_size", [48, 48])[0],
                    "assetIconHeight": pager_spec.get("icon_size", [48, 48])[1],
                    "hideTabLabels": True,
                    "fontSize": pager_spec.get("font_size", 22), "fontWeight": pager_spec.get("font_weight", 800),
                    "textColor": pager_spec.get("text_color", "#FFF2B8"),
                    "textStroke": pager_spec.get("text_stroke", "#07111D"),
                    "textStrokeWidth": pager_spec.get("text_stroke_width", 1.0),
                },
                "pages": [[] for _ in tabs],
            }
            page.insert(page.index(filter_node) + 1, pager_node)
    keep = {"牌组标题底板", "牌组标题文字", "牌组编号切换"}
    keep.update(assembly.get("visible_node_names", []))
    show_custom_cards = assembly.get("show_custom_cards", False)
    for node in page:
        if not assembly.get("preserve_page_visibility", False):
            node["visible"] = node["name"] in keep or (show_custom_cards and node["type"] == "custom")
        if node["name"] == "牌组标题底板":
            if assembly.get("title_skin"):
                node["props"]["assetSrc"] = asset(assembly["title_skin"])
            if "title" in geometry: node["x"], node["y"], node["w"], node["h"] = geometry["title"]
        elif node["name"] == "牌组标题文字" and not assembly.get("preserve_page_visibility", False): node["visible"] = False
        elif node["name"] == "牌组编号切换":
            if "tabs" in geometry: node["x"], node["y"], node["w"], node["h"] = geometry["tabs"]
            if assembly.get("tab_default_skin") and assembly.get("tab_active_skin"):
                node["props"].update({
                    "options": ["I", "II", "III", "IV", "V"], "selected": 0,
                    "assetDefaultSrc": asset(assembly["tab_default_skin"]),
                    "assetActiveSrc": asset(assembly["tab_active_skin"]),
                    "fontSize": 24, "fontWeight": 800,
                    "textColor": "#FFF2B8", "textStroke": "#07111D", "textStrokeWidth": 1.0,
                })
            tab_icon = assembly.get("tab_icon")
            if tab_icon:
                node["props"].update({
                    "assetIconSrc": asset(tab_icon["skin"]),
                    "assetIconWidth": tab_icon["size"][0],
                    "assetIconHeight": tab_icon["size"][1],
                })
            overlay = assembly.get("filter_active_overlay")
            if overlay:
                node["props"].update({
                    "assetActiveOverlaySrc": asset(overlay["skin"]),
                    "activeOverlayWidth": overlay["size"][0],
                    "activeOverlayHeight": overlay["size"][1],
                    "activeOverlayOffsetX": overlay.get("offset", [0, 0])[0],
                    "activeOverlayOffsetY": overlay.get("offset", [0, 0])[1],
                })
            if assembly.get("clear_filter_active_overlay", False):
                for key in (
                    "assetActiveOverlaySrc", "activeOverlayWidth", "activeOverlayHeight",
                    "activeOverlayOffsetX", "activeOverlayOffsetY",
                ):
                    node["props"].pop(key, None)

    # Generic status/battle strip binding.  All labels and counts remain
    # runtime text nodes; the source skin contains only the chrome and icons.
    battle = assembly.get("battle")
    if battle:
        bar = next((node for node in page if node["name"] == battle["bar_node"]), None)
        if bar is None:
            raise ValueError(f"Battle bar node not found: {battle['bar_node']}")
        bar["visible"] = True
        bar["props"]["assetSrc"] = asset(battle["skin"])
        bar["x"], bar["y"], bar["w"], bar["h"] = battle["rect"]

        for text_spec in [battle.get("value"), *battle.get("stats", [])]:
            if not text_spec:
                continue
            text_node = next((node for node in page if node["name"] == text_spec["node"]), None)
            if text_node is None:
                raise ValueError(f"Battle text node not found: {text_spec['node']}")
            text_node["visible"] = True
            text_node["x"], text_node["y"], text_node["w"], text_node["h"] = text_spec["rect"]
            text_node["props"].update(text_spec.get("props", {}))

        for node_name in battle.get("hide_node_names", []):
            node = next((item for item in page if item["name"] == node_name), None)
            if node:
                node["visible"] = False
        for icon in battle.get("icons", []):
            node = next((item for item in page if item["name"] == icon["node"]), None)
            if node is None:
                node = {
                    "id": f"battle-icon-{len(page)}", "type": "image", "name": icon["node"],
                    "x": 0, "y": 0, "w": 1, "h": 1, "visible": True, "locked": False, "props": {},
                }
                page.append(node)
            node["type"] = "image"
            node["visible"] = True
            node["props"] = {"src": asset(icon["skin"])}
            node["x"], node["y"], node["w"], node["h"] = icon["rect"]
    for gem_name, skin_key, geometry_key in (
        ("牌组标题菱形装饰", "title_gem", "title_gem"),
        ("牌组首项菱形装饰", "active_gem", "active_gem"),
    ):
        skin = assembly.get(skin_key)
        gem = next((node for node in page if node["name"] == gem_name), None)
        if not skin:
            if gem and not assembly.get("preserve_page_visibility", False): gem["visible"] = False
            continue
        if gem is None:
            gem = {"id": f"anchor-stage01-{geometry_key}", "type": "image", "name": gem_name,
                   "x": 0, "y": 0, "w": 1, "h": 1, "visible": True, "locked": False, "props": {}}
            page.append(gem)
        gem["props"]["src"] = asset(skin)
        if geometry_key in geometry: gem["x"], gem["y"], gem["w"], gem["h"] = geometry[geometry_key]
        gem["visible"] = True
    for node_name in assembly.get("hidden_page_nodes", []):
        node = next((item for item in page if item["name"] == node_name), None)
        if node:
            node["visible"] = False
    for node_name, spec in assembly.get("page_node_overrides", {}).items():
        node = next((item for item in page if item["name"] == node_name), None)
        if node is None:
            raise ValueError(f"Page node not found: {node_name}")
        if "visible" in spec:
            node["visible"] = spec["visible"]
        if "rect" in spec:
            node["x"], node["y"], node["w"], node["h"] = spec["rect"]
        if "props" in spec:
            node["props"].update(spec["props"])
    doc["meta"]["name"] = assembly["name"]
    output_path(base, assembly["uiw_output"]).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__": main()
