#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable


ROOT_STRUCTURE_FILES = (
    "structure.json",
    "structure_now.json",
    "structure＿.json",
    "structure_____.json",
)


def rotate_xz(x: float, z: float, radians: float) -> tuple[float, float]:
    cos_a = math.cos(radians)
    sin_a = math.sin(radians)
    return x * cos_a - z * sin_a, x * sin_a + z * cos_a


def rotate_pos_list(pos: list[object] | None, radians: float) -> bool:
    if not isinstance(pos, list) or len(pos) < 3:
        return False
    x = float(pos[0] or 0)
    z = float(pos[2] or 0)
    nx, nz = rotate_xz(x, z, radians)
    pos[0] = nx
    pos[2] = nz
    return True


def rotate_point_obj(point: dict[str, object] | None, radians: float) -> bool:
    if not isinstance(point, dict) or "x" not in point or "z" not in point:
        return False
    x = float(point.get("x", 0) or 0)
    z = float(point.get("z", 0) or 0)
    nx, nz = rotate_xz(x, z, radians)
    point["x"] = nx
    point["z"] = nz
    return True


def save_json(path: Path, data: dict[str, object]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def iter_track_files(base_dir: Path) -> Iterable[Path]:
    yield from sorted(base_dir.glob("track_points*.json"))


def iter_root_structure_files(base_dir: Path) -> Iterable[Path]:
    for file_name in ROOT_STRUCTURE_FILES:
        path = base_dir / file_name
        if path.exists():
            yield path


def iter_group_files(base_dir: Path) -> Iterable[Path]:
    group_dir = base_dir / "structure_group"
    if not group_dir.exists():
        return []
    return sorted(group_dir.glob("*.json"))


def rotate_track_file(path: Path, radians: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for points in (data.get("tracks") or {}).values():
        if not isinstance(points, list):
            continue
        for point in points:
            if rotate_point_obj(point, radians):
                changed += 1
    save_json(path, data)
    return changed


def rotate_root_structure_file(path: Path, radians: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for pin in (data.get("pins") or []):
        if rotate_point_obj(pin, radians):
            changed += 1
    for run in (data.get("generationRuns") or []):
        for pin in (run.get("pins") or []):
            if rotate_point_obj(pin, radians):
                changed += 1
    save_json(path, data)
    return changed


def rotate_group_file(path: Path, radians: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    steel_frame = data.get("steelFrame") or {}
    for point in (steel_frame.get("points") or []):
        if rotate_pos_list(point.get("position"), radians):
            changed += 1
    for decoration in (data.get("decorations") or []):
        if rotate_pos_list(decoration.get("position"), radians):
            changed += 1
    for pin in (data.get("pins") or []):
        if rotate_point_obj(pin, radians):
            changed += 1
    for run in (data.get("generationRuns") or []):
        for pin in (run.get("pins") or []):
            if rotate_point_obj(pin, radians):
                changed += 1
    for grid in (data.get("guideAddGrids") or []):
        if rotate_pos_list(grid.get("position"), radians):
            changed += 1
        frame = grid.get("guideMirrorCoordFrame") if isinstance(grid, dict) else None
        if isinstance(frame, dict) and rotate_pos_list(frame.get("anchor"), radians):
            changed += 1
    if isinstance(data.get("baseGuideGrid"), dict) and rotate_pos_list(data["baseGuideGrid"].get("position"), radians):
        changed += 1
    for copied_group in (data.get("copiedStructureGroups") or []):
        if rotate_pos_list(copied_group.get("center"), radians):
            changed += 1
    save_json(path, data)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rotate route and structure JSON data around world origin in the XZ plane."
    )
    parser.add_argument(
        "--base-dir",
        default="Train_EditMode_demo/docs/map_data",
        help="Base directory containing track_points*.json, structure*.json, and structure_group/*.json",
    )
    parser.add_argument(
        "--degrees",
        type=float,
        required=True,
        help="Rotation angle in degrees. Example: -100 or 100",
    )
    args = parser.parse_args()

    base_dir = Path(args.base_dir).resolve()
    radians = math.radians(args.degrees)

    if not base_dir.exists():
        raise SystemExit(f"base dir not found: {base_dir}")

    for path in iter_track_files(base_dir):
        print(f"track {path.name}: {rotate_track_file(path, radians)} points")

    for path in iter_root_structure_files(base_dir):
        print(f"structure {path.name}: {rotate_root_structure_file(path, radians)} points")

    for path in iter_group_files(base_dir):
        print(f"group {path.name}: {rotate_group_file(path, radians)} points")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
