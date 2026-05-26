#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import tempfile
import zipfile
from pathlib import Path


MSGPACK_SUFFIXES = (".msgpack", ".mpk")
PAYLOAD_SUFFIXES = (".json", ".msgpack", ".mpk")
POSITION_ARRAY_KEYS = frozenset({
    "position",
    "center",
    "anchorPosition",
    "anchor",
})
POSITION_OBJECT_KEYS = frozenset({
    "position",
})
DIRECT_POINT_PARENT_KEYS = frozenset({
    "pins",
})
DIRECT_POINT_ANCESTOR_KEYS = frozenset({
    "tracks",
})


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


def add_y_to_point_obj(
    point: dict[str, object] | None,
    dy: float,
    *,
    require_xyz: bool = False,
) -> bool:
    if not isinstance(point, dict) or "y" not in point:
        return False
    if require_xyz and ("x" not in point or "z" not in point):
        return False
    point["y"] = float(point.get("y", 0) or 0) + dy
    return True


def should_adjust_direct_point_obj(
    point: dict[str, object] | None,
    ancestry: tuple[str, ...],
) -> bool:
    if not isinstance(point, dict):
        return False
    if not all(axis in point for axis in ("x", "y", "z")):
        return False
    if not ancestry:
        return False
    if ancestry[-1] in DIRECT_POINT_PARENT_KEYS:
        return True
    return any(key in DIRECT_POINT_ANCESTOR_KEYS for key in ancestry)


def adjust_saved_positions(node: object, dy: float, ancestry: tuple[str, ...] = ()) -> int:
    changed = 0
    if isinstance(node, dict):
        if should_adjust_direct_point_obj(node, ancestry) and add_y_to_point_obj(node, dy, require_xyz=True):
            changed += 1
        for raw_key, value in node.items():
            key = str(raw_key)
            if key in POSITION_ARRAY_KEYS and add_y_to_pos_list(value, dy):
                changed += 1
            elif key in POSITION_OBJECT_KEYS and add_y_to_point_obj(value, dy, require_xyz=True):
                changed += 1
            if isinstance(value, (dict, list)):
                changed += adjust_saved_positions(value, dy, ancestry + (key,))
        return changed
    if isinstance(node, list):
        for item in node:
            if isinstance(item, (dict, list)):
                changed += adjust_saved_positions(item, dy, ancestry)
    return changed


def adjust_saved_payload(data: dict[str, object], dy: float) -> int:
    return adjust_saved_positions(data, dy)


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
            "JSON/msgpack files. Recursively updates saved position-like fields such "
            "as position, center, anchorPosition, anchor, tracks, and pins."
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
