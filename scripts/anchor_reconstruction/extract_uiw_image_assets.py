"""Extract embedded PNG skins from a named UIW node for a quality-remaster stage."""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.get("children", []))
        for page in node.get("pages", []):
            yield from walk(page)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("uiw")
    parser.add_argument("--node", required=True)
    parser.add_argument("--property", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--prefix", required=True)
    args = parser.parse_args()
    doc = json.loads(Path(args.uiw).read_text(encoding="utf-8"))
    roots = list(doc.get("commonLayer", {}).get("nodes", []))
    for page in doc.get("pages", []):
        roots.extend(page.get("nodes", []))
    target = next((node for node in walk(roots) if node.get("name") == args.node), None)
    if target is None:
        raise ValueError(f"Node not found: {args.node}")
    values = target.get("props", {}).get(args.property)
    if not isinstance(values, list):
        values = [values]
    destination = Path(args.output_dir); destination.mkdir(parents=True, exist_ok=True)
    for index, value in enumerate(values):
        if not isinstance(value, str) or not value.startswith("data:image/png;base64,"):
            raise ValueError(f"{args.node}.{args.property}[{index}] is not an embedded PNG")
        (destination / f"{args.prefix}_{index + 1}.png").write_bytes(base64.b64decode(value.split(",", 1)[1]))


if __name__ == "__main__":
    main()
