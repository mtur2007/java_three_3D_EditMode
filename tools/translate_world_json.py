#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable


ROOT_STRUCTURE_FILES = (
    "structure.json",
    "structure_now.json",
    "structure＿.json",
    "structure_____.json",
)

MSGPACK_SUFFIXES = (".msgpack", ".mpk")
TRANSLATABLE_ARCHIVE_SUFFIXES = (".json", ".msgpack", ".mpk")


def load_msgpack_module():
    try:
        import msgpack  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "msgpack package is required for ZIP/msgpack inputs. "
            "Install it with: python3 -m pip install msgpack"
        ) from exc
    return msgpack


def translate_pos_list(pos: list[object] | None, dx: float, dz: float) -> bool:
    if not isinstance(pos, list) or len(pos) < 3:
        return False
    pos[0] = float(pos[0] or 0) + dx
    pos[2] = float(pos[2] or 0) + dz
    return True


def translate_point_obj(point: dict[str, object] | None, dx: float, dz: float) -> bool:
    if not isinstance(point, dict) or "x" not in point or "z" not in point:
        return False
    point["x"] = float(point.get("x", 0) or 0) + dx
    point["z"] = float(point.get("z", 0) or 0) + dz
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


def translate_track_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    for points in (data.get("tracks") or {}).values():
        if not isinstance(points, list):
            continue
        for point in points:
            if translate_point_obj(point, dx, dz):
                changed += 1
    return changed


def translate_structure_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    for pin in (data.get("pins") or []):
        if translate_point_obj(pin, dx, dz):
            changed += 1
    for run in (data.get("generationRuns") or []):
        for pin in (run.get("pins") or []):
            if translate_point_obj(pin, dx, dz):
                changed += 1
    return changed


def translate_group_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    steel_frame = data.get("steelFrame") or {}
    for point in (steel_frame.get("points") or []):
        if translate_pos_list(point.get("position"), dx, dz):
            changed += 1
    for decoration in (data.get("decorations") or []):
        if translate_pos_list(decoration.get("position"), dx, dz):
            changed += 1
    for pin in (data.get("pins") or []):
        if translate_point_obj(pin, dx, dz):
            changed += 1
    for run in (data.get("generationRuns") or []):
        for pin in (run.get("pins") or []):
            if translate_point_obj(pin, dx, dz):
                changed += 1
    for grid in (data.get("guideAddGrids") or []):
        if translate_pos_list(grid.get("position"), dx, dz):
            changed += 1
        frame = grid.get("guideMirrorCoordFrame") if isinstance(grid, dict) else None
        if isinstance(frame, dict) and translate_pos_list(frame.get("anchor"), dx, dz):
            changed += 1
    if isinstance(data.get("baseGuideGrid"), dict) and translate_pos_list(data["baseGuideGrid"].get("position"), dx, dz):
        changed += 1
    for copied_group in (data.get("copiedStructureGroups") or []):
        if translate_pos_list(copied_group.get("center"), dx, dz):
            changed += 1
    return changed


def translate_difference_space_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    for space in (data.get("differenceSpaces") or []):
        if isinstance(space, dict) and translate_pos_list(space.get("position"), dx, dz):
            changed += 1
    return changed


def translate_world_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    for group_payload in (data.get("sourceStructureGroups") or []):
        if isinstance(group_payload, dict):
            changed += translate_group_payload(group_payload, dx, dz)
    return changed


def translate_payload(data: dict[str, object], dx: float, dz: float) -> int:
    changed = 0
    if isinstance(data.get("tracks"), dict):
        changed += translate_track_payload(data, dx, dz)
    if "pins" in data or "generationRuns" in data:
        changed += translate_structure_payload(data, dx, dz)
    if any(key in data for key in ("steelFrame", "decorations", "guideAddGrids", "baseGuideGrid", "copiedStructureGroups")):
        changed += translate_group_payload(data, dx, dz)
    if isinstance(data.get("differenceSpaces"), list):
        changed += translate_difference_space_payload(data, dx, dz)
    if isinstance(data.get("sourceStructureGroups"), list):
        changed += translate_world_payload(data, dx, dz)
    return changed


def load_payload_from_bytes(raw: bytes, suffix: str) -> dict[str, object]:
    if suffix.lower() in MSGPACK_SUFFIXES:
        msgpack = load_msgpack_module()
        return msgpack.unpackb(raw, raw=False, strict_map_key=False)
    return json.loads(raw.decode("utf-8"))


def dump_payload_to_bytes(data: dict[str, object], suffix: str) -> bytes:
    if suffix.lower() in MSGPACK_SUFFIXES:
        msgpack = load_msgpack_module()
        return msgpack.packb(data, use_bin_type=True)
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def translate_track_file(path: Path, dx: float, dz: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = translate_track_payload(data, dx, dz)
    save_json(path, data)
    return changed


def translate_root_structure_file(path: Path, dx: float, dz: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = translate_structure_payload(data, dx, dz)
    save_json(path, data)
    return changed


def translate_group_file(path: Path, dx: float, dz: float) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = translate_group_payload(data, dx, dz)
    save_json(path, data)
    return changed


def is_zip_path(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".zip"


def translate_zip_file(path: Path, dx: float, dz: float) -> list[tuple[str, int]]:
    results: list[tuple[str, int]] = []
    with zipfile.ZipFile(path, "r") as src_zip:
        entries = [(info, src_zip.read(info.filename)) for info in src_zip.infolist()]

    fd, tmp_name = tempfile.mkstemp(prefix=f"{path.stem}_", suffix=".zip", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with open(fd, "wb"):
            pass
        with zipfile.ZipFile(tmp_path, "w") as dst_zip:
            for info, raw in entries:
                name = info.filename
                suffix = Path(name).suffix.lower()
                out_raw = raw
                changed = 0
                if suffix in TRANSLATABLE_ARCHIVE_SUFFIXES:
                    try:
                        payload = load_payload_from_bytes(raw, suffix)
                    except Exception:
                        payload = None
                    if isinstance(payload, dict):
                        changed = translate_payload(payload, dx, dz)
                        if changed > 0:
                            out_raw = dump_payload_to_bytes(payload, suffix)
                new_info = zipfile.ZipInfo(filename=name, date_time=info.date_time)
                new_info.compress_type = info.compress_type
                new_info.comment = info.comment
                new_info.extra = info.extra
                new_info.create_system = info.create_system
                new_info.external_attr = info.external_attr
                new_info.internal_attr = info.internal_attr
                new_info.flag_bits = info.flag_bits
                dst_zip.writestr(new_info, out_raw)
                if suffix in TRANSLATABLE_ARCHIVE_SUFFIXES:
                    results.append((name, changed))
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Translate route/structure payloads in the XZ plane. Supports JSON directories and world_data.zip msgpack archives."
    )
    parser.add_argument(
        "--base-dir",
        default="Train_EditMode_demo/docs/map_data",
        help="Directory containing JSON files, or a ZIP file such as world_data.zip",
    )
    parser.add_argument(
        "--dx",
        type=float,
        required=True,
        help="Amount to add to X coordinates.",
    )
    parser.add_argument(
        "--dz",
        type=float,
        required=True,
        help="Amount to add to Z coordinates.",
    )
    args = parser.parse_args()

    target = Path(args.base_dir).resolve()
    if not target.exists():
        raise SystemExit(f"path not found: {target}")

    if is_zip_path(target):
        for name, changed in translate_zip_file(target, args.dx, args.dz):
            print(f"zip {name}: {changed} points")
        return 0

    if not target.is_dir():
        raise SystemExit(f"unsupported input: {target}")

    for path in iter_track_files(target):
        print(f"track {path.name}: {translate_track_file(path, args.dx, args.dz)} points")

    for path in iter_root_structure_files(target):
        print(f"structure {path.name}: {translate_root_structure_file(path, args.dx, args.dz)} points")

    for path in iter_group_files(target):
        print(f"group {path.name}: {translate_group_file(path, args.dx, args.dz)} points")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
