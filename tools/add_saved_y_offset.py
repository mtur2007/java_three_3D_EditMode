#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import tempfile
import zipfile
from pathlib import Path


MSGPACK_SUFFIXES = (".msgpack", ".mpk")
PAYLOAD_SUFFIXES = (".json", ".msgpack", ".mpk")


def load_msgpack_module():
    try:
        import msgpack  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "msgpack package is required for ZIP/msgpack inputs. "
            "Install it with: python3 -m pip install msgpack"
        ) from exc
    return msgpack


def add_y_to_pos_list(pos: list[object] | None, dy: float) -> bool:
    if not isinstance(pos, list) or len(pos) < 3:
        return False
    pos[1] = float(pos[1] or 0) + dy
    return True


def add_y_to_point_obj(point: dict[str, object] | None, dy: float) -> bool:
    if not isinstance(point, dict) or "y" not in point:
        return False
    point["y"] = float(point.get("y", 0) or 0) + dy
    return True


def adjust_track_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    for points in (data.get("tracks") or {}).values():
        if not isinstance(points, list):
            continue
        for point in points:
            if add_y_to_point_obj(point, dy):
                changed += 1
    return changed


def adjust_group_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    steel_frame = data.get("steelFrame") or {}
    for point in (steel_frame.get("points") or []):
        if add_y_to_pos_list(point.get("position"), dy):
            changed += 1
    for decoration in (data.get("decorations") or []):
        if add_y_to_pos_list(decoration.get("position"), dy):
            changed += 1
    for pin in (data.get("pins") or []):
        if add_y_to_point_obj(pin, dy):
            changed += 1
    for run in (data.get("generationRuns") or []):
        for pin in (run.get("pins") or []):
            if add_y_to_point_obj(pin, dy):
                changed += 1
    for grid in (data.get("guideAddGrids") or []):
        if add_y_to_pos_list(grid.get("position"), dy):
            changed += 1
        frame = grid.get("guideMirrorCoordFrame") if isinstance(grid, dict) else None
        if isinstance(frame, dict) and add_y_to_pos_list(frame.get("anchor"), dy):
            changed += 1
    if isinstance(data.get("baseGuideGrid"), dict) and add_y_to_pos_list(data["baseGuideGrid"].get("position"), dy):
        changed += 1
    return changed


def adjust_manual_copy_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    for copied_group in (data.get("copiedStructureGroups") or []):
        if not isinstance(copied_group, dict):
            continue
        if add_y_to_pos_list(copied_group.get("anchorPosition"), dy):
            changed += 1
        elif add_y_to_pos_list(copied_group.get("center"), dy):
            changed += 1
    return changed


def adjust_source_groups_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    for group_payload in (data.get("sourceStructureGroups") or []):
        if isinstance(group_payload, dict):
            changed += adjust_group_payload(group_payload, dy)
    return changed


def adjust_group_entries_in_create_mode_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    steel_frame = data.get("steelFrame") or {}
    segments = steel_frame.get("segments") or []
    points = steel_frame.get("points") or []
    point_keys = set()

    for segment in segments:
        if not isinstance(segment, dict):
            continue
        group_id = str(segment.get("structureGroupId") or "").strip()
        if not group_id:
            continue
        for key in (segment.get("pointKeys") or []):
            normalized = str(key or "").strip()
            if normalized:
                point_keys.add(normalized)

    for point in points:
        if not isinstance(point, dict):
            continue
        key = str(point.get("key") or "").strip()
        if key and key in point_keys and add_y_to_pos_list(point.get("position"), dy):
            changed += 1

    for decoration in (data.get("decorations") or []):
        if not isinstance(decoration, dict):
            continue
        group_id = str(decoration.get("structureGroupId") or "").strip()
        if group_id and add_y_to_pos_list(decoration.get("position"), dy):
            changed += 1

    return changed


def adjust_saved_payload(data: dict[str, object], dy: float) -> int:
    changed = 0
    if isinstance(data.get("tracks"), dict):
        changed += adjust_track_payload(data, dy)
    if isinstance(data.get("sourceStructureGroups"), list):
        changed += adjust_source_groups_payload(data, dy)
    if isinstance(data.get("copiedStructureGroups"), list):
        changed += adjust_manual_copy_payload(data, dy)
    if isinstance(data.get("steelFrame"), dict) or isinstance(data.get("decorations"), list):
        changed += adjust_group_entries_in_create_mode_payload(data, dy)
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


def save_payload_file(path: Path, data: dict[str, object]) -> None:
    path.write_bytes(dump_payload_to_bytes(data, path.suffix))


def adjust_payload_file(path: Path, dy: float) -> int:
    data = load_payload_from_bytes(path.read_bytes(), path.suffix)
    changed = adjust_saved_payload(data, dy)
    save_payload_file(path, data)
    return changed


def adjust_zip_file(path: Path, dy: float) -> list[tuple[str, int]]:
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
                if suffix in PAYLOAD_SUFFIXES:
                    try:
                        payload = load_payload_from_bytes(raw, suffix)
                    except Exception:
                        payload = None
                    if isinstance(payload, dict):
                        changed = adjust_saved_payload(payload, dy)
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
                if suffix in PAYLOAD_SUFFIXES:
                    results.append((name, changed))
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Add a Y offset to saved runtime data. Supports ZIP saves and single "
            "JSON/msgpack files. Targets track control points, sourceStructureGroups, "
            "and copiedStructureGroups."
        )
    )
    parser.add_argument(
        "--path",
        required=True,
        help="Path to a saved ZIP file or a single JSON/msgpack payload file.",
    )
    parser.add_argument(
        "--dy",
        type=float,
        required=True,
        help="Amount to add to Y coordinates.",
    )
    args = parser.parse_args()

    target = Path(args.path).resolve()
    if not target.exists():
        raise SystemExit(f"path not found: {target}")

    if target.is_file() and target.suffix.lower() == ".zip":
        for name, changed in adjust_zip_file(target, args.dy):
            print(f"zip {name}: {changed} points")
        return 0

    if not target.is_file() or target.suffix.lower() not in PAYLOAD_SUFFIXES:
        raise SystemExit(f"unsupported input: {target}")

    print(f"file {target.name}: {adjust_payload_file(target, args.dy)} points")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
