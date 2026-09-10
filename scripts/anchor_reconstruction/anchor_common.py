"""Shared utilities for anchor-driven UI material builds."""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]


def resolve(value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def load_manifest(path: str | Path) -> tuple[dict[str, Any], Path]:
    file = resolve(path)
    return json.loads(file.read_text(encoding="utf-8")), file.parent


def output_path(base: Path, name: str) -> Path:
    result = base / name
    result.parent.mkdir(parents=True, exist_ok=True)
    return result


def png_data_uri(file: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(file.read_bytes()).decode("ascii")


def resize_rgba(source: Path, size: tuple[int, int]) -> Image.Image:
    with Image.open(source) as image:
        return image.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
