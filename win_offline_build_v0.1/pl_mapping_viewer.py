#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import pickle
import re
import sys
import tempfile
import urllib.parse
import uuid
from dataclasses import dataclass
from functools import lru_cache
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "pl_mapping_static"
DATA_DIR = ROOT / "PL_mapping_opener"
BROWSE_ROOT = Path.home().resolve()
UPLOAD_DIR = (Path(tempfile.gettempdir()) / "pl-mapping-viewer-uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_PREFIX_RE = re.compile(r"^[0-9a-f]{32}_")


def is_allowed_path(path: Path) -> bool:
    resolved = path.resolve()
    return (
        resolved == BROWSE_ROOT
        or BROWSE_ROOT in resolved.parents
        or resolved == UPLOAD_DIR
        or UPLOAD_DIR in resolved.parents
    )


def ensure_pandas_available() -> None:
    try:
        import pandas  # noqa: F401
    except ModuleNotFoundError as exc:
        interpreter = sys.executable
        raise SystemExit(
            "This viewer needs pandas to open the PL mapping pickle files.\n"
            f"Current interpreter: {interpreter}\n"
            "Use a Python with pandas installed, for example:\n"
            "  /opt/anaconda3/bin/python3 /Users/hwijewoo/Desktop/Project-MVI_opener/pl_mapping_viewer.py\n"
            "or install pandas into the current interpreter."
        ) from exc


@dataclass
class GridPreview:
    width: int
    height: int
    min_value: float
    max_value: float
    values: list[float]
    source_points: int


def infer_dimensions(point_count: int) -> tuple[int, int]:
    side = int(round(math.sqrt(point_count)))
    return side, side


def parse_dimensions(raw_width: str | None, raw_height: str | None, point_count: int) -> tuple[int, int]:
    square_width, square_height = infer_dimensions(point_count)
    if square_width * square_height == point_count:
        return square_width, square_height
    if raw_width is None or raw_height is None:
        raise ValueError(
            f"Pixel count {point_count} is not a square map. Enter X pixels and Y pixels manually."
        )
    width = int(raw_width)
    height = int(raw_height)
    if width <= 0 or height <= 0:
        raise ValueError("X pixels and Y pixels must be positive integers.")
    if width * height != point_count:
        raise ValueError(f"X pixels * Y pixels must equal {point_count}.")
    return width, height


def downsample_grid(values: list[float], source_width: int, source_height: int, max_edge: int = 256) -> GridPreview:
    if source_width <= max_edge and source_height <= max_edge:
        return GridPreview(source_width, source_height, min(values), max(values), values, len(values))

    scale = max(source_width / max_edge, source_height / max_edge)
    target_width = max(1, int(round(source_width / scale)))
    target_height = max(1, int(round(source_height / scale)))
    sampled: list[float] = []
    for ty in range(target_height):
        sy = min(source_height - 1, int(ty * source_height / target_height))
        base = sy * source_width
        for tx in range(target_width):
            sx = min(source_width - 1, int(tx * source_width / target_width))
            sampled.append(values[base + sx])
    return GridPreview(target_width, target_height, min(values), max(values), sampled, len(values))


def mime_type(path: Path) -> str:
    if path.suffix == ".html":
        return "text/html; charset=utf-8"
    if path.suffix == ".js":
        return "application/javascript; charset=utf-8"
    if path.suffix == ".css":
        return "text/css; charset=utf-8"
    return "application/octet-stream"


def resolve_pickle_path(query: str | None) -> Path:
    if not query:
        raise FileNotFoundError("Missing path")
    raw = Path(query)
    path = raw.resolve() if raw.is_absolute() else (BROWSE_ROOT / raw).resolve()
    if not is_allowed_path(path):
        raise FileNotFoundError("Path is outside the allowed browse root")
    if not path.exists() or not path.is_file() or path.suffix != ".pickle":
        raise FileNotFoundError(f"File not found: {raw}")
    return path


def resolve_browse_dir(query: str | None) -> Path:
    if not query:
        desktop = (BROWSE_ROOT / "Desktop").resolve()
        return desktop if desktop.exists() else BROWSE_ROOT
    raw = Path(query)
    path = raw.resolve() if raw.is_absolute() else (BROWSE_ROOT / raw).resolve()
    if not is_allowed_path(path):
        raise FileNotFoundError("Directory is outside the allowed browse root")
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Directory not found: {raw}")
    return path


@lru_cache(maxsize=24)
def load_pickle_payload(path: str, raw_width: str | None = None, raw_height: str | None = None) -> dict:
    source = Path(path)
    with source.open("rb") as handle:
        frame = pickle.load(handle)

    matrix = frame.to_numpy(dtype=float, copy=False)
    wavelengths = [float(value) for value in frame.index.tolist()]
    pixel_count = int(matrix.shape[1])
    inferred_width, inferred_height = infer_dimensions(pixel_count)
    requires_manual_dimensions = inferred_width * inferred_height != pixel_count
    width, height = parse_dimensions(raw_width, raw_height, pixel_count)

    mean_trace = [float(value) for value in matrix.mean(axis=1).tolist()]
    return {
        "name": source.name,
        "width": width,
        "height": height,
        "inferred_width": inferred_width,
        "inferred_height": inferred_height,
        "requires_manual_dimensions": requires_manual_dimensions,
        "slice_count": int(matrix.shape[0]),
        "pixel_count": pixel_count,
        "wavelengths": wavelengths,
        "matrix": matrix,
        "mean_trace": mean_trace,
        "min_wavelength": min(wavelengths) if wavelengths else None,
        "max_wavelength": max(wavelengths) if wavelengths else None,
        "size_bytes": source.stat().st_size,
    }


def build_file_summary() -> dict:
    files = []
    for path in sorted(ROOT.rglob("*.pickle")):
        payload = load_pickle_payload(str(path))
        relative = path.relative_to(ROOT)
        files.append(
            {
                "name": relative.name,
                "path": str(relative),
                "folder": str(relative.parent),
                "width": payload["width"],
                "height": payload["height"],
                "inferred_width": payload["inferred_width"],
                "inferred_height": payload["inferred_height"],
                "requires_manual_dimensions": payload["requires_manual_dimensions"],
                "slice_count": payload["slice_count"],
                "pixel_count": payload["pixel_count"],
                "min_wavelength": payload["min_wavelength"],
                "max_wavelength": payload["max_wavelength"],
                "size_bytes": payload["size_bytes"],
            }
        )
    return {"dataset_dir": str(ROOT), "file_count": len(files), "files": files}


def build_browse_summary(current_dir: Path) -> dict:
    directories: list[dict[str, str]] = []
    files: list[dict[str, str]] = []
    for entry in sorted(current_dir.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            directories.append({"name": entry.name, "path": str(entry.resolve())})
        elif entry.is_file() and entry.suffix == ".pickle":
            files.append({"name": entry.name, "path": str(entry.resolve())})
    parent_dir = str(current_dir.parent.resolve()) if current_dir != BROWSE_ROOT else None
    return {
        "root": str(BROWSE_ROOT),
        "current_dir": str(current_dir.resolve()),
        "parent_dir": parent_dir,
        "directories": directories,
        "files": files,
    }


def build_file_info(path: Path) -> dict:
    payload = load_pickle_payload(str(path))
    display_name = UPLOAD_PREFIX_RE.sub("", payload["name"])
    return {
        "name": display_name,
        "path": str(path.resolve()),
        "folder": str(path.parent.resolve()),
        "width": payload["width"],
        "height": payload["height"],
        "inferred_width": payload["inferred_width"],
        "inferred_height": payload["inferred_height"],
        "requires_manual_dimensions": payload["requires_manual_dimensions"],
        "slice_count": payload["slice_count"],
        "pixel_count": payload["pixel_count"],
        "min_wavelength": payload["min_wavelength"],
        "max_wavelength": payload["max_wavelength"],
        "size_bytes": payload["size_bytes"],
    }


def nearest_wavelength_index(wavelengths: list[float], target: float) -> int:
    if not wavelengths:
        return 0
    return min(range(len(wavelengths)), key=lambda idx: abs(wavelengths[idx] - target))


def clamp_range_indices(slice_count: int, start_index: int, end_index: int) -> tuple[int, int]:
    safe_start = max(0, min(slice_count - 1, start_index))
    safe_end = max(0, min(slice_count - 1, end_index))
    if safe_start > safe_end:
        safe_start, safe_end = safe_end, safe_start
    return safe_start, safe_end


def parse_pl_image(
    path: Path,
    mode: str,
    selection: str,
    target_wavelength: float,
    start_wavelength: float,
    end_wavelength: float,
    raw_width: str | None,
    raw_height: str | None,
) -> dict:
    payload = load_pickle_payload(str(path), raw_width, raw_height)
    slice_count = payload["slice_count"]
    wavelengths = payload["wavelengths"]
    target_index = nearest_wavelength_index(wavelengths, target_wavelength)
    start_index = nearest_wavelength_index(wavelengths, start_wavelength)
    end_index = nearest_wavelength_index(wavelengths, end_wavelength)
    safe_start, safe_end = clamp_range_indices(slice_count, start_index, end_index)

    if selection == "range":
        if mode == "mean":
            row = payload["matrix"][safe_start : safe_end + 1, :].mean(axis=0)
            label = f"Range Mean {wavelengths[safe_start]:.2f}-{wavelengths[safe_end]:.2f} nm"
        else:
            mode = "sum"
            row = payload["matrix"][safe_start : safe_end + 1, :].sum(axis=0)
            label = f"Range Sum {wavelengths[safe_start]:.2f}-{wavelengths[safe_end]:.2f} nm"
        wavelength = None
    else:
        selection = "point"
        row = payload["matrix"][target_index, :]
        label = f"{wavelengths[target_index]:.2f} nm"
        wavelength = wavelengths[target_index]

    values = [float(value) for value in row.tolist()]
    preview = downsample_grid(values, payload["width"], payload["height"])
    return {
        "width": preview.width,
        "height": preview.height,
        "source_width": payload["width"],
        "source_height": payload["height"],
        "values": preview.values,
        "min": preview.min_value,
        "max": preview.max_value,
        "source_points": preview.source_points,
        "slice_count": slice_count,
        "range_start_index": safe_start,
        "range_end_index": safe_end,
        "target_index": target_index,
        "range_start_wavelength": wavelengths[safe_start] if wavelengths else None,
        "range_end_wavelength": wavelengths[safe_end] if wavelengths else None,
        "target_wavelength": wavelength,
        "wavelengths": wavelengths,
        "wavelength_label": wavelength,
        "wavelength_unit": "nm",
        "wavelength_axis_label": "Wavelength",
        "signal_unit": "Intensity (a.u.)",
        "caption": path.stem,
        "mode": mode,
        "selection": selection,
        "mode_label": label,
    }


def parse_pl_trace(path: Path, x_index: int, y_index: int, raw_width: str | None, raw_height: str | None) -> dict:
    payload = load_pickle_payload(str(path), raw_width, raw_height)
    x = max(0, min(payload["width"] - 1, x_index))
    y = max(0, min(payload["height"] - 1, y_index))
    pixel_index = y * payload["width"] + x
    trace = [float(value) for value in payload["matrix"][:, pixel_index].tolist()]
    return {
        "x": payload["wavelengths"],
        "trace": trace,
        "mean_trace": payload["mean_trace"],
        "x_unit": "nm",
        "x_label": "Wavelength",
        "y_unit": "Intensity (a.u.)",
        "pixel_x": x,
        "pixel_y": y,
        "width": payload["width"],
        "height": payload["height"],
        "caption": path.stem,
    }


class PLMappingHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/upload-pickle":
            self.serve_upload_pickle()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if route == "/":
            self.serve_static(STATIC_DIR / "index.html")
            return
        if route == "/app.js":
            self.serve_static(STATIC_DIR / "app.js")
            return
        if route == "/styles.css":
            self.serve_static(STATIC_DIR / "styles.css")
            return
        if route == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        if route == "/api/files":
            self.serve_json(build_file_summary())
            return
        if route == "/api/file-info":
            self.serve_file_info(
                params.get("path", [None])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
            )
            return
        if route == "/api/pl-image":
            self.serve_pl_image(
                params.get("path", [None])[0],
                params.get("mode", ["sum"])[0],
                params.get("selection", ["point"])[0],
                params.get("target_wavelength", ["0"])[0],
                params.get("start_wavelength", ["0"])[0],
                params.get("end_wavelength", ["0"])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
            )
            return
        if route == "/api/pl-trace":
            self.serve_pl_trace(
                params.get("path", [None])[0],
                params.get("x", ["0"])[0],
                params.get("y", ["0"])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
            )
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def log_message(self, fmt: str, *args) -> None:
        return

    def serve_static(self, path: Path) -> None:
        if not path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "Missing static file")
            return
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type(path))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def serve_json(self, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def serve_pl_image(
        self,
        file_name: str | None,
        raw_mode: str,
        raw_selection: str,
        raw_target_wavelength: str,
        raw_start_wavelength: str,
        raw_end_wavelength: str,
        raw_width: str | None,
        raw_height: str | None,
    ) -> None:
        try:
            source = resolve_pickle_path(file_name)
            mode = raw_mode if raw_mode in {"sum", "mean"} else "sum"
            selection = raw_selection if raw_selection in {"point", "range"} else "point"
            target_wavelength = float(raw_target_wavelength)
            start_wavelength = float(raw_start_wavelength)
            end_wavelength = float(raw_end_wavelength)
            self.serve_json(
                parse_pl_image(
                    source,
                    mode,
                    selection,
                    target_wavelength,
                    start_wavelength,
                    end_wavelength,
                    raw_width,
                    raw_height,
                )
            )
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_pl_trace(
        self,
        file_name: str | None,
        raw_x: str,
        raw_y: str,
        raw_width: str | None,
        raw_height: str | None,
    ) -> None:
        try:
            source = resolve_pickle_path(file_name)
            x_index = max(0, int(raw_x))
            y_index = max(0, int(raw_y))
            self.serve_json(parse_pl_trace(source, x_index, y_index, raw_width, raw_height))
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_file_info(self, raw_path: str | None, raw_width: str | None, raw_height: str | None) -> None:
        try:
            path = resolve_pickle_path(raw_path)
            payload = load_pickle_payload(str(path), raw_width, raw_height)
            info = build_file_info(path)
            info["width"] = payload["width"]
            info["height"] = payload["height"]
            self.serve_json(info)
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_upload_pickle(self) -> None:
        try:
            raw_length = self.headers.get("Content-Length")
            if not raw_length:
                raise ValueError("Missing content length")
            length = int(raw_length)
            payload = self.rfile.read(length)
            filename = self.headers.get("X-Filename", "uploaded.pickle")
            safe_name = Path(urllib.parse.unquote(filename)).name
            if not safe_name.endswith(".pickle"):
                raise ValueError("Only .pickle files are supported")
            target = UPLOAD_DIR / f"{uuid.uuid4().hex}_{safe_name}"
            target.write_bytes(payload)
            self.serve_json(build_file_info(target))
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))


def main() -> None:
    parser = argparse.ArgumentParser(description="Standalone PL mapping viewer")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8234)
    args = parser.parse_args()

    ensure_pandas_available()

    server = ThreadingHTTPServer((args.host, args.port), PLMappingHandler)
    print(f"Serving PL mapping viewer on http://{args.host}:{args.port}")
    if DATA_DIR.exists():
        print(f"Dataset: {DATA_DIR}")
    else:
        print("Dataset: no bundled PL_mapping_opener directory found; use file upload/browser selection.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
