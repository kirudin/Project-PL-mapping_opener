#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import pickle
import re
import sys
import tempfile
import threading
import urllib.parse
import uuid
import webbrowser
from dataclasses import dataclass
from functools import lru_cache, wraps
import csv
import io
import zipfile
import os
from pl_core import finite_mean, GridPreview, build_line_band_points, clamp_line_thickness, downsample_grid, finite_min_max, get_line_pixels, nan_safe_list
from update_checker import check_updates
from runtime_paths import APP_VERSION, DATA_HOME, UPLOAD_DIR, LEGACY_UPLOAD_DIR, load_session, save_session
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "pl_mapping_static"
DATA_DIR = ROOT / "PL_mapping_opener"
BROWSE_ROOT = Path.home().resolve()

UPLOAD_PREFIX_RE = re.compile(r"^[0-9a-f]{32}_")
NUMBER_TOKEN_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")


def is_allowed_path(path: Path) -> bool:
    resolved = path.resolve()
    return (
        resolved == BROWSE_ROOT
        or BROWSE_ROOT in resolved.parents
        or resolved == UPLOAD_DIR
        or UPLOAD_DIR in resolved.parents
        or LEGACY_UPLOAD_DIR in resolved.parents
    )


def ensure_pandas_available() -> None:
    try:
        import numpy  # noqa: F401
    except ModuleNotFoundError as exc:
        interpreter = sys.executable
        raise SystemExit(
            "This viewer needs numpy to open the PL mapping data files.\n"
            f"Current interpreter: {interpreter}\n"
            "Use a Python with numpy installed, for example:\n"
            "  /opt/anaconda3/bin/python3 /Users/hwijewoo/Desktop/Project-MVI_opener/pl_mapping_viewer.py\n"
            "or install numpy into the current interpreter."
        ) from exc




@dataclass(frozen=True)
class DimensionCandidate:
    width: int
    height: int
    reason: str
    priority: int = 0


@dataclass(frozen=True)
class ImportOptions:
    import_mode: str = "auto"
    manual_format: str = "index-columns"
    skip_rows: int = 0
    delimiter: str = "auto"
    index_column: int = 0
    x_column: int = 0
    y_column: int = 1
    data_start_column: int = 1


def infer_dimensions(point_count: int) -> tuple[int, int]:
    side = int(round(math.sqrt(point_count)))
    return side, side


def factor_dimension_candidates(point_count: int, max_candidates: int = 18) -> list[dict]:
    if point_count <= 0:
        return []

    canonical: list[tuple[int, int]] = []
    limit = int(math.sqrt(point_count))
    for factor in range(1, limit + 1):
        if point_count % factor:
            continue
        canonical.append((point_count // factor, factor))

    canonical.sort(key=lambda item: (abs(item[0] - item[1]), -max(item[0], item[1]), -min(item[0], item[1])))
    seen: set[tuple[int, int]] = set()
    ordered: list[tuple[int, int]] = []
    for width, height in canonical:
        for candidate in ((width, height), (height, width)):
            if candidate in seen:
                continue
            seen.add(candidate)
            ordered.append(candidate)
            if len(ordered) >= max_candidates:
                break
        if len(ordered) >= max_candidates:
            break

    return [
        {
            "width": width,
            "height": height,
            "label": f"{width} x {height}",
        }
        for width, height in ordered
    ]


def choose_suggested_dimensions(
    point_count: int,
    embedded_width: int | None,
    embedded_height: int | None,
) -> tuple[int | None, int | None, str]:
    if embedded_width and embedded_height and embedded_width * embedded_height == point_count:
        return embedded_width, embedded_height, "embedded-metadata"

    inferred_width, inferred_height = infer_dimensions(point_count)
    if inferred_width * inferred_height == point_count:
        return inferred_width, inferred_height, "perfect-square"

    candidates = factor_dimension_candidates(point_count, max_candidates=1)
    if candidates:
        first = candidates[0]
        return int(first["width"]), int(first["height"]), "factor-candidate"

    return None, None, "unresolved"


def parse_dimensions(raw_width: str | None, raw_height: str | None, point_count: int) -> tuple[int, int]:
    if raw_width is not None and raw_height is not None:
        width = int(raw_width)
        height = int(raw_height)
        if width <= 0 or height <= 0:
            raise ValueError("X pixels and Y pixels must be positive integers.")
        if width * height != point_count:
            raise ValueError(f"X pixels * Y pixels must equal {point_count}.")
        return width, height

    square_width, square_height = infer_dimensions(point_count)
    if square_width * square_height == point_count:
        return square_width, square_height

    raise ValueError(
        f"Pixel count {point_count} is not a square map. Enter X pixels and Y pixels manually."
    )




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
    if not path.exists() or not path.is_file():
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


def coerce_wavelengths(raw_values: object, slice_count: int) -> tuple[list[float], str, str]:
    import numpy as np
    try:
        values = np.asarray(raw_values, dtype=float).reshape(-1)
    except (ValueError, TypeError):
        return [float(i) for i in range(slice_count)], "index", "Slice"
    if values.size != slice_count or not np.all(np.isfinite(values)):
        raise ValueError("Spectral axis must have one finite value per spectrum channel.")
    if len(values) > 1 and not (np.all(np.diff(values) > 0) or np.all(np.diff(values) < 0)):
        raise ValueError("Spectral axis must be strictly increasing or decreasing, without duplicates.")
    return values.tolist(), "nm", "Wavelength"


def parse_optional_int(raw_value: str | None) -> int | None:
    if raw_value is None:
        return None
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def parse_nonnegative_int(raw_value: str | None, default: int) -> int:
    if raw_value is None or raw_value == "":
        return default
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return default
    return max(0, value)


def parse_import_options(
    raw_import_mode: str | None = None,
    raw_manual_format: str | None = None,
    raw_skip_rows: str | None = None,
    raw_delimiter: str | None = None,
    raw_index_column: str | None = None,
    raw_x_column: str | None = None,
    raw_y_column: str | None = None,
    raw_data_start_column: str | None = None,
) -> ImportOptions:
    import_mode = raw_import_mode if raw_import_mode in {"auto", "manual"} else "auto"
    manual_format = raw_manual_format if raw_manual_format in {"index-columns", "xy-spectra"} else "index-columns"
    delimiter = raw_delimiter if raw_delimiter in {"auto", "comma", "tab", "space", "semicolon"} else "auto"
    return ImportOptions(
        import_mode=import_mode,
        manual_format=manual_format,
        skip_rows=parse_nonnegative_int(raw_skip_rows, 0),
        delimiter=delimiter,
        index_column=parse_nonnegative_int(raw_index_column, 0),
        x_column=parse_nonnegative_int(raw_x_column, 0),
        y_column=parse_nonnegative_int(raw_y_column, 1),
        data_start_column=parse_nonnegative_int(raw_data_start_column, 1),
    )


def delimiter_to_sep(delimiter: str) -> str | None:
    if delimiter == "comma":
        return ","
    if delimiter == "tab":
        return "\t"
    if delimiter == "space":
        return r"\s+"
    if delimiter == "semicolon":
        return ";"
    return None


def tokenize_delimited_line(line: str, delimiter: str) -> list[str]:
    stripped = line.strip()
    if not stripped:
        return []
    if delimiter == "comma":
        return [token.strip() for token in line.rstrip("\n").split(",")]
    if delimiter == "tab":
        return [token.strip() for token in line.rstrip("\n").split("\t")]
    if delimiter == "semicolon":
        return [token.strip() for token in line.rstrip("\n").split(";")]
    if delimiter == "space":
        return [token.strip() for token in stripped.split()]
    if "," in line:
        return [token.strip() for token in line.rstrip("\n").split(",")]
    if "\t" in line:
        return [token.strip() for token in line.rstrip("\n").split("\t")]
    if ";" in line:
        return [token.strip() for token in line.rstrip("\n").split(";")]
    return [token.strip() for token in stripped.split()]


def normalize_mapping_object(
    loaded: object,
    raw_width: str | None = None,
    raw_height: str | None = None,
) -> tuple["np.ndarray", list[float], str, str]:
    import numpy as np

    width_hint = parse_optional_int(raw_width)
    height_hint = parse_optional_int(raw_height)
    pixel_hint = width_hint * height_hint if width_hint and height_hint else None

    try:
        import pandas as pd  # type: ignore
    except ModuleNotFoundError:
        pd = None  # type: ignore

    if pd is not None and isinstance(loaded, pd.DataFrame):
        matrix = loaded.to_numpy(dtype=float, copy=False)
        wavelengths, unit, axis_label = coerce_wavelengths(loaded.index.to_numpy(), matrix.shape[0])
        return np.asarray(matrix, dtype=float), wavelengths, unit, axis_label

    if isinstance(loaded, dict):
        data_keys = ("data", "matrix", "cube", "values", "array", "spectra")
        wavelength_keys = ("wavelengths", "wavelength", "wl", "x")
        for key in data_keys:
            if key in loaded:
                matrix, wavelengths, unit, axis_label = normalize_mapping_object(
                    loaded[key],
                    raw_width,
                    raw_height,
                )
                for wave_key in wavelength_keys:
                    if wave_key in loaded:
                        wavelengths, unit, axis_label = coerce_wavelengths(loaded[wave_key], matrix.shape[0])
                        break
                return matrix, wavelengths, unit, axis_label
        raise TypeError("Dictionary input must contain one of: data, matrix, cube, values, array, spectra.")

    array = np.asarray(loaded, dtype=float)
    if array.ndim == 0 or array.ndim == 1:
        raise TypeError("Input array must be at least 2-dimensional.")

    if array.ndim == 2:
        candidate_matrices = [np.asarray(array, dtype=float), np.asarray(array.T, dtype=float)]
        scored: list[tuple[int, np.ndarray]] = []
        for index, matrix in enumerate(candidate_matrices):
            pixel_count = int(matrix.shape[1])
            inferred_width, inferred_height = infer_dimensions(pixel_count)
            square_match = inferred_width * inferred_height == pixel_count
            manual_match = pixel_hint is not None and pixel_count == pixel_hint
            score = 100 if manual_match else 0
            score += 10 if square_match else 0
            score += 2 if pixel_count >= int(matrix.shape[0]) else 0
            score += 1 if index == 0 else 0
            scored.append((score, matrix))
        best_matrix = max(scored, key=lambda item: item[0])[1]
        wavelengths = [float(index) for index in range(best_matrix.shape[0])]
        return best_matrix, wavelengths, "index", "Slice"

    if array.ndim == 3:
        candidates: list[tuple[int, np.ndarray]] = []
        for spectral_axis in range(3):
            moved = np.moveaxis(array, spectral_axis, 0)
            spectral_length = int(moved.shape[0])
            spatial_shape = moved.shape[1:]
            pixel_count = int(np.prod(spatial_shape))
            inferred_width, inferred_height = infer_dimensions(pixel_count)
            square_match = inferred_width * inferred_height == pixel_count
            manual_match = pixel_hint is not None and pixel_count == pixel_hint
            largest_axis = int(array.shape[spectral_axis]) == max(array.shape)
            score = 100 if manual_match else 0
            score += 10 if largest_axis else 0
            score += 5 if square_match else 0
            flattened = moved.reshape(spectral_length, pixel_count)
            candidates.append((score, np.asarray(flattened, dtype=float)))
        best_matrix = max(candidates, key=lambda item: item[0])[1]
        wavelengths = [float(index) for index in range(best_matrix.shape[0])]
        return best_matrix, wavelengths, "index", "Slice"

    raise TypeError("Only DataFrame, dict, 2D array, or 3D array inputs are supported.")


def parse_xy_spectra_text_mapping(path: Path, options: ImportOptions | None = None) -> dict | None:
    import numpy as np
    import pandas as pd  # type: ignore

    if options and options.import_mode == "manual" and options.manual_format == "xy-spectra":
        try:
            sep = delimiter_to_sep(options.delimiter)
            read_options: dict[str, object] = {
                "header": None,
                "skiprows": options.skip_rows,
                "engine": "python",
                "encoding": "latin-1",
            }
            if sep is None:
                read_options["sep"] = None
            else:
                read_options["sep"] = sep
            frame = pd.read_csv(path, **read_options).dropna(axis=0, how="all").dropna(axis=1, how="all")
        except Exception:
            return None

        if frame.empty:
            return None

        x_column = options.x_column
        y_column = options.y_column
        data_start_column = options.data_start_column
        if max(x_column, y_column, data_start_column) >= frame.shape[1]:
            return None

        first_row = frame.iloc[0]
        header_candidate = pd.to_numeric(first_row.iloc[data_start_column:], errors="coerce")
        first_x = pd.to_numeric(pd.Series([first_row.iloc[x_column]]), errors="coerce").iloc[0]
        first_y = pd.to_numeric(pd.Series([first_row.iloc[y_column]]), errors="coerce").iloc[0]
        header_like = (
            header_candidate.notna().sum() >= max(2, len(header_candidate) - 1)
            and (not pd.notna(first_x) or not pd.notna(first_y))
        )

        if header_like:
            wavelength_values = [
                float(value) if pd.notna(value) else float(index)
                for index, value in enumerate(header_candidate.to_list())
            ]
            data_frame = frame.iloc[1:].copy()
        else:
            wavelength_values = [float(index) for index in range(frame.shape[1] - data_start_column)]
            data_frame = frame.copy()

        if data_frame.empty:
            return None

        x_series = pd.to_numeric(data_frame.iloc[:, x_column], errors="coerce")
        y_series = pd.to_numeric(data_frame.iloc[:, y_column], errors="coerce")
        spectra_frame = data_frame.iloc[:, data_start_column:].apply(pd.to_numeric, errors="coerce")
        valid_mask = x_series.notna() & y_series.notna()
        if not valid_mask.any():
            return None

        x_values = x_series.loc[valid_mask].astype(int).tolist()
        y_values = y_series.loc[valid_mask].astype(int).tolist()
        spectra_rows = spectra_frame.loc[valid_mask].to_numpy(dtype=float)
        if spectra_rows.size == 0:
            return None

        min_x = min(x_values)
        min_y = min(y_values)
        width = max(x_values) - min_x + 1
        height = max(y_values) - min_y + 1
        pixel_count = width * height
        matrix = np.full((len(wavelength_values), pixel_count), np.nan, dtype=float)
        for x_value, y_value, spectrum in zip(x_values, y_values, spectra_rows):
            px = x_value - min_x
            py = y_value - min_y
            if 0 <= px < width and 0 <= py < height:
                matrix[:, py * width + px] = np.asarray(spectrum, dtype=float)

        return {
            "data": matrix,
            "wavelengths": wavelength_values,
            "width": width,
            "height": height,
            "x_origin": min_x,
            "y_origin": min_y,
            "format": "manual-xy-spectra-text",
        }

    try:
        lines = path.read_text(encoding="latin-1", errors="ignore").splitlines()
    except Exception:
        return None

    x_pixels: int | None = None
    y_pixels: int | None = None
    header_line_index: int | None = None
    wavelength_line_index: int | None = None

    for index, line in enumerate(lines[:300]):
        stripped = line.strip()
        lower = stripped.lower()
        if lower.startswith("# x pixels:"):
            try:
                x_pixels = int(stripped.split(":", 1)[1].strip())
            except Exception:
                pass
        elif lower.startswith("# y pixels:"):
            try:
                y_pixels = int(stripped.split(":", 1)[1].strip())
            except Exception:
                pass
        elif lower.startswith("#xpixel") and "ypixel" in lower:
            header_line_index = index
        elif header_line_index is not None and index == header_line_index + 1 and stripped.startswith("#"):
            wavelength_line_index = index
            break

    if header_line_index is None or wavelength_line_index is None:
        return None

    wavelength_tokens = [token.strip() for token in lines[wavelength_line_index].lstrip("#").split("\t")]
    if len(wavelength_tokens) < 3:
        return None
    wavelength_values = []
    for token in wavelength_tokens[2:]:
        if not token:
            continue
        try:
            wavelength_values.append(float(token))
        except Exception:
            return None
    if not wavelength_values:
        return None

    data_start = wavelength_line_index + 1
    x_values: list[int] = []
    y_values: list[int] = []
    spectra_rows: list[list[float]] = []

    for raw_line in lines[data_start:]:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = [token.strip() for token in raw_line.split("\t")]
        if len(parts) < 2 + len(wavelength_values):
            continue
        try:
            x_value = int(float(parts[0]))
            y_value = int(float(parts[1]))
            spectrum = [float(token) if token else float("nan") for token in parts[2 : 2 + len(wavelength_values)]]
        except Exception:
            continue
        x_values.append(x_value)
        y_values.append(y_value)
        spectra_rows.append(spectrum)

    if not spectra_rows:
        return None

    min_x = min(x_values)
    min_y = min(y_values)
    width = x_pixels or (max(x_values) - min_x + 1)
    height = y_pixels or (max(y_values) - min_y + 1)
    pixel_count = width * height
    matrix = np.full((len(wavelength_values), pixel_count), np.nan, dtype=float)

    for x_value, y_value, spectrum in zip(x_values, y_values, spectra_rows):
        px = x_value - min_x
        py = y_value - min_y
        if 0 <= px < width and 0 <= py < height:
            pixel_index = py * width + px
            matrix[:, pixel_index] = np.asarray(spectrum, dtype=float)

    return {
        "data": matrix,
        "wavelengths": wavelength_values,
        "width": width,
        "height": height,
        "x_origin": min_x,
        "y_origin": min_y,
        "format": "xy-spectra-text",
    }


def extract_dimension_hints(loaded: object) -> tuple[int | None, int | None]:
    if not isinstance(loaded, dict):
        return None, None
    width_keys = ("width", "x_pixels", "xpixels", "xpix", "nx")
    height_keys = ("height", "y_pixels", "ypixels", "ypix", "ny")
    width = next((loaded[key] for key in width_keys if key in loaded), None)
    height = next((loaded[key] for key in height_keys if key in loaded), None)
    try:
        width = int(width) if width is not None else None
    except Exception:
        width = None
    try:
        height = int(height) if height is not None else None
    except Exception:
        height = None
    return width, height


def load_mapping_source(path: Path, options: ImportOptions | None = None) -> object:
    suffix = path.suffix.lower()

    def tokenize_text_row(line: str) -> list[str]:
        return tokenize_delimited_line(line, options.delimiter if options else "auto")

    def is_numeric_token(token: str) -> bool:
        if not token:
            return False
        lowered = token.lower()
        if lowered in {"nan", "inf", "+inf", "-inf"}:
            return True
        return bool(NUMBER_TOKEN_RE.match(token))

    def detect_text_table_layout() -> tuple[int, int | None]:
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            return 0, 0

        parsed_rows: list[tuple[int, list[str], int, int]] = []
        for index, line in enumerate(lines[:120]):
            tokens = tokenize_text_row(line)
            if len(tokens) < 3:
                continue
            nonempty = [token for token in tokens if token]
            numeric_count = sum(1 for token in nonempty if is_numeric_token(token))
            parsed_rows.append((index, tokens, len(nonempty), numeric_count))

        for offset in range(len(parsed_rows) - 1):
            line_index, tokens, nonempty_count, numeric_count = parsed_rows[offset]
            next_line_index, _, next_nonempty_count, next_numeric_count = parsed_rows[offset + 1]
            dense_now = numeric_count >= max(3, nonempty_count - 1)
            dense_next = next_numeric_count >= max(3, next_nonempty_count - 1)
            if not dense_now or not dense_next:
                continue

            first_token = tokens[0] if tokens else ""
            remaining = [token for token in tokens[1:] if token]
            header_like = (
                (not first_token or not is_numeric_token(first_token))
                and len(remaining) >= 2
                and sum(1 for token in remaining if is_numeric_token(token)) >= max(2, len(remaining) - 1)
            )
            return line_index, 0 if header_like else None

        return 0, 0

    def read_text_frame(skiprows: int, header: int | None, index_col: int | None):
        import pandas as pd  # type: ignore

        sep = delimiter_to_sep(options.delimiter if options else "auto")
        read_options: dict[str, object] = {
            "skiprows": skiprows,
            "header": header,
            "encoding": "latin-1",
        }
        if index_col is not None:
            read_options["index_col"] = index_col
        if sep == r"\s+":
            read_options["sep"] = sep
            read_options["engine"] = "python"
        elif sep is None:
            read_options["sep"] = None
            read_options["engine"] = "python"
        else:
            read_options["sep"] = sep
        return pd.read_csv(path, **read_options)

    def try_read_text_table() -> object:
        import pandas as pd  # type: ignore

        if options and options.import_mode == "manual":
            if options.manual_format == "xy-spectra":
                special = parse_xy_spectra_text_mapping(path, options)
                if special is not None:
                    return special
                raise TypeError(f"Could not read XY spectra mapping data: {path.name}")

            frame = read_text_frame(options.skip_rows, None, None).dropna(axis=0, how="all").dropna(axis=1, how="all")
            if frame.empty:
                raise TypeError(f"Could not read text mapping data: {path.name}")
            if max(options.index_column, options.data_start_column) >= frame.shape[1]:
                raise TypeError("Manual import columns exceed the detected table width.")
            index_series = pd.to_numeric(frame.iloc[:, options.index_column], errors="coerce")
            data_frame = frame.iloc[:, options.data_start_column :].apply(pd.to_numeric, errors="coerce")
            valid_mask = index_series.notna()
            data_frame = data_frame.loc[valid_mask]
            index_series = index_series.loc[valid_mask]
            if data_frame.shape[0] < 2 or data_frame.shape[1] < 1:
                raise TypeError("Manual import did not find enough numeric rows/columns.")
            data_frame.columns = [f"pixel_{index}" for index in range(data_frame.shape[1])]
            data_frame.index = index_series.to_numpy(dtype=float)
            return data_frame

        skiprows, header = detect_text_table_layout()
        attempts: list[tuple[int, int | None]] = [
            (skiprows, header),
            (skiprows, None if header == 0 else 0),
            (0, 0),
            (0, None),
        ]
        last_error: Exception | None = None
        for attempt_skiprows, attempt_header in attempts:
            try:
                frame = read_text_frame(attempt_skiprows, attempt_header, 0)
                if getattr(frame, "shape", (0, 0))[0] >= 2 and getattr(frame, "shape", (0, 0))[1] >= 2:
                    return frame
            except Exception as exc:
                last_error = exc
        raise TypeError(f"Could not read text mapping data: {path.name}") from last_error

    if suffix in {".csv", ".txt", ".tsv", ".dat", ".asc"}:
        try:
            special = parse_xy_spectra_text_mapping(path, options)
            if special is not None:
                return special
            return try_read_text_table()
        except Exception as exc:
            raise TypeError(f"Could not read text mapping data: {path.name}") from exc

    if suffix in {".npy", ".npz"}:
        try:
            import numpy as np

            loaded = np.load(path, allow_pickle=False)
            if suffix == ".npz":
                keys = list(loaded.keys())
                if not keys:
                    raise TypeError("NPZ file has no arrays.")
                if len(keys) == 1:
                    result = loaded[keys[0]]
                    loaded.close()
                    return result
                result = {key: loaded[key] for key in keys}
                loaded.close()
                return result
            return loaded
        except Exception as exc:
            raise TypeError(f"Could not read NumPy mapping data: {path.name}") from exc

    try:
        with path.open("rb") as handle:
            return pickle.load(handle)
    except Exception as pickle_error:
        try:
            return try_read_text_table()
        except Exception as csv_error:
            raise TypeError(f"Unsupported or unreadable mapping file: {path.name}") from (csv_error or pickle_error)






def file_cached(function):
    @lru_cache(maxsize=4)
    def cached(path, signature, args, kwargs):
        return function(path, *args, **dict(kwargs))
    @wraps(function)
    def wrapper(path, *args, **kwargs):
        st = Path(path).stat()
        return cached(str(path), (st.st_mtime_ns, st.st_ctime_ns, st.st_size, st.st_ino), args, tuple(sorted(kwargs.items())))
    wrapper.cache_clear = cached.cache_clear
    return wrapper


@file_cached
def load_mapping_analysis(
    path: str,
    import_mode: str = "auto",
    manual_format: str = "index-columns",
    skip_rows: str | None = None,
    delimiter: str = "auto",
    index_column: str | None = None,
    x_column: str | None = None,
    y_column: str | None = None,
    data_start_column: str | None = None,
) -> dict:
    source = Path(path)
    import_options = parse_import_options(
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    frame = load_mapping_source(source, import_options)
    hint_width, hint_height = extract_dimension_hints(frame)
    embedded_width = hint_width if hint_width and hint_height and hint_width * hint_height > 0 else None
    embedded_height = hint_height if hint_width and hint_height and hint_width * hint_height > 0 else None
    effective_width = str(embedded_width) if embedded_width else None
    effective_height = str(embedded_height) if embedded_height else None

    matrix, wavelengths, wavelength_unit, wavelength_axis_label = normalize_mapping_object(
        frame,
        effective_width,
        effective_height,
    )
    import numpy as np

    matrix = np.array(matrix, dtype=float, copy=True)
    matrix[~np.isfinite(matrix)] = np.nan
    if matrix.size == 0:
        raise ValueError("Mapping data is empty.")
    pixel_count = int(matrix.shape[1])
    inferred_width, inferred_height = infer_dimensions(pixel_count)
    has_embedded_dimensions = embedded_width is not None and embedded_height is not None and embedded_width * embedded_height == pixel_count
    requires_manual_dimensions = inferred_width * inferred_height != pixel_count and not has_embedded_dimensions
    suggested_width, suggested_height, suggestion_reason = choose_suggested_dimensions(
        pixel_count,
        embedded_width,
        embedded_height,
    )
    dimension_candidates = factor_dimension_candidates(pixel_count)

    mean_trace = nan_safe_list(finite_mean(matrix, axis=1))
    return {
        "name": source.name,
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
        "wavelength_unit": wavelength_unit,
        "wavelength_axis_label": wavelength_axis_label,
        "size_bytes": source.stat().st_size,
        "source_signature": f"{source.stat().st_mtime_ns}:{source.stat().st_size}",
        "missing_count": int(np.count_nonzero(~np.isfinite(matrix))),
        "import_mode": import_options.import_mode,
        "manual_format": import_options.manual_format,
        "embedded_width": embedded_width,
        "embedded_height": embedded_height,
        "has_embedded_dimensions": has_embedded_dimensions,
        "suggested_width": suggested_width,
        "suggested_height": suggested_height,
        "suggestion_reason": suggestion_reason,
        "dimension_candidates": dimension_candidates,
        "path": str(source.resolve()),
        "folder": str(source.parent.resolve()),
    }


def load_pickle_payload(
    path: str,
    raw_width: str | None = None,
    raw_height: str | None = None,
    import_mode: str = "auto",
    manual_format: str = "index-columns",
    skip_rows: str | None = None,
    delimiter: str = "auto",
    index_column: str | None = None,
    x_column: str | None = None,
    y_column: str | None = None,
    data_start_column: str | None = None,
) -> dict:
    analysis = load_mapping_analysis(
        path,
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    embedded_width = analysis["embedded_width"]
    embedded_height = analysis["embedded_height"]
    effective_width = raw_width if raw_width is not None else (str(embedded_width) if embedded_width else None)
    effective_height = raw_height if raw_height is not None else (str(embedded_height) if embedded_height else None)
    width, height = parse_dimensions(effective_width, effective_height, analysis["pixel_count"])
    return {
        **analysis,
        "width": width,
        "height": height,
    }


def build_file_summary() -> dict:
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        try:
            payload = load_pickle_payload(str(path))
        except Exception:
            continue
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
        "source_signature": payload["source_signature"],
        "missing_count": payload["missing_count"],
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
        elif entry.is_file():
            files.append({"name": entry.name, "path": str(entry.resolve())})
    parent_dir = str(current_dir.parent.resolve()) if current_dir != BROWSE_ROOT else None
    return {
        "root": str(BROWSE_ROOT),
        "current_dir": str(current_dir.resolve()),
        "parent_dir": parent_dir,
        "directories": directories,
        "files": files,
    }


def build_file_info(
    path: Path,
    raw_width: str | None = None,
    raw_height: str | None = None,
    import_mode: str = "auto",
    manual_format: str = "index-columns",
    skip_rows: str | None = None,
    delimiter: str = "auto",
    index_column: str | None = None,
    x_column: str | None = None,
    y_column: str | None = None,
    data_start_column: str | None = None,
) -> dict:
    payload = load_pickle_payload(
        str(path),
        raw_width,
        raw_height,
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    display_name = UPLOAD_PREFIX_RE.sub("", payload["name"])
    return {
        "name": display_name,
        "path": payload["path"],
        "folder": payload["folder"],
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
        "source_signature": payload["source_signature"],
        "missing_count": payload["missing_count"],
        "wavelength_unit": payload["wavelength_unit"],
        "wavelength_axis_label": payload["wavelength_axis_label"],
        "import_mode": payload["import_mode"],
        "manual_format": payload["manual_format"],
    }


def build_file_analysis(
    path: Path,
    import_mode: str = "auto",
    manual_format: str = "index-columns",
    skip_rows: str | None = None,
    delimiter: str = "auto",
    index_column: str | None = None,
    x_column: str | None = None,
    y_column: str | None = None,
    data_start_column: str | None = None,
) -> dict:
    payload = load_mapping_analysis(
        str(path),
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    display_name = UPLOAD_PREFIX_RE.sub("", payload["name"])
    return {
        "name": display_name,
        "path": payload["path"],
        "folder": payload["folder"],
        "pixel_count": payload["pixel_count"],
        "slice_count": payload["slice_count"],
        "size_bytes": payload["size_bytes"],
        "source_signature": payload["source_signature"],
        "missing_count": payload["missing_count"],
        "min_wavelength": payload["min_wavelength"],
        "max_wavelength": payload["max_wavelength"],
        "wavelength_unit": payload["wavelength_unit"],
        "wavelength_axis_label": payload["wavelength_axis_label"],
        "inferred_width": payload["inferred_width"],
        "inferred_height": payload["inferred_height"],
        "requires_manual_dimensions": payload["requires_manual_dimensions"],
        "has_embedded_dimensions": payload["has_embedded_dimensions"],
        "embedded_width": payload["embedded_width"],
        "embedded_height": payload["embedded_height"],
        "suggested_width": payload["suggested_width"],
        "suggested_height": payload["suggested_height"],
        "suggestion_reason": payload["suggestion_reason"],
        "dimension_candidates": payload["dimension_candidates"],
        "import_mode": payload["import_mode"],
        "manual_format": payload["manual_format"],
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
    import_mode: str,
    manual_format: str,
    skip_rows: str | None,
    delimiter: str,
    index_column: str | None,
    x_column: str | None,
    y_column: str | None,
    data_start_column: str | None,
    full_resolution: bool = False,
) -> dict:
    import numpy as np

    payload = load_pickle_payload(
        str(path),
        raw_width,
        raw_height,
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    if not all(math.isfinite(v) for v in (target_wavelength, start_wavelength, end_wavelength)):
        raise ValueError("Wavelength selections must be finite.")
    slice_count = payload["slice_count"]
    wavelengths = payload["wavelengths"]
    target_index = nearest_wavelength_index(wavelengths, target_wavelength)
    start_index = nearest_wavelength_index(wavelengths, start_wavelength)
    end_index = nearest_wavelength_index(wavelengths, end_wavelength)
    safe_start, safe_end = clamp_range_indices(slice_count, start_index, end_index)

    if selection == "range":
        if mode == "mean":
            row = finite_mean(payload["matrix"][safe_start : safe_end + 1, :], axis=0)
            label = f"Range Mean {wavelengths[safe_start]:.2f}-{wavelengths[safe_end]:.2f} {payload['wavelength_unit']}"
        else:
            mode = "sum"
            row = np.nansum(payload["matrix"][safe_start : safe_end + 1, :], axis=0)
            row[np.all(~np.isfinite(payload["matrix"][safe_start : safe_end + 1, :]), axis=0)] = np.nan
            label = f"Range Sum {wavelengths[safe_start]:.2f}-{wavelengths[safe_end]:.2f} {payload['wavelength_unit']}"
        wavelength = None
    else:
        selection = "point"
        row = payload["matrix"][target_index, :]
        label = f"{wavelengths[target_index]:.2f} {payload['wavelength_unit']}"
        wavelength = wavelengths[target_index]

    values = nan_safe_list(np.asarray(row, dtype=float))
    preview = downsample_grid(values, payload["width"], payload["height"], max_edge=max(payload["width"], payload["height"]) if full_resolution else 256)
    return {
        "app_version": APP_VERSION,
        "source_signature": payload["source_signature"],
        "source_name": payload["name"],
        "missing_policy": "nonfinite -> null; aggregates ignore missing; all-missing -> null",
        "axis_unit_note": "Numeric spectral axes are interpreted as nm; verify source units before import.",
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
        "wavelength_unit": payload["wavelength_unit"],
        "wavelength_axis_label": payload["wavelength_axis_label"],
        "signal_unit": "Intensity (a.u.)",
        "caption": path.stem,
        "mode": mode,
        "selection": selection,
        "mode_label": label,
    }


def parse_pl_trace(
    path: Path,
    x_index: int,
    y_index: int,
    raw_width: str | None,
    raw_height: str | None,
    import_mode: str,
    manual_format: str,
    skip_rows: str | None,
    delimiter: str,
    index_column: str | None,
    x_column: str | None,
    y_column: str | None,
    data_start_column: str | None,
) -> dict:
    payload = load_pickle_payload(
        str(path),
        raw_width,
        raw_height,
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    x = max(0, min(payload["width"] - 1, x_index))
    y = max(0, min(payload["height"] - 1, y_index))
    pixel_index = y * payload["width"] + x
    trace = nan_safe_list(payload["matrix"][:, pixel_index])
    return {
        "x": payload["wavelengths"],
        "trace": trace,
        "mean_trace": payload["mean_trace"],
        "x_unit": payload["wavelength_unit"],
        "x_label": payload["wavelength_axis_label"],
        "y_unit": "Intensity (a.u.)",
        "pixel_x": x,
        "pixel_y": y,
        "width": payload["width"],
        "height": payload["height"],
        "caption": path.stem,
    }


def parse_pl_line_traces(
    path: Path,
    start_x: int,
    start_y: int,
    end_x: int,
    end_y: int,
    thickness: int,
    raw_width: str | None,
    raw_height: str | None,
    import_mode: str,
    manual_format: str,
    skip_rows: str | None,
    delimiter: str,
    index_column: str | None,
    x_column: str | None,
    y_column: str | None,
    data_start_column: str | None,
) -> dict:
    import numpy as np

    payload = load_pickle_payload(
        str(path),
        raw_width,
        raw_height,
        import_mode,
        manual_format,
        skip_rows,
        delimiter,
        index_column,
        x_column,
        y_column,
        data_start_column,
    )
    width = payload["width"]
    height = payload["height"]
    clamped_start_x = max(0, min(width - 1, int(start_x)))
    clamped_start_y = max(0, min(height - 1, int(start_y)))
    clamped_end_x = max(0, min(width - 1, int(end_x)))
    clamped_end_y = max(0, min(height - 1, int(end_y)))
    safe_thickness = clamp_line_thickness(thickness)
    line_pixels = get_line_pixels(clamped_start_x, clamped_start_y, clamped_end_x, clamped_end_y)
    traces: list[dict] = []

    for x_value, y_value in line_pixels:
        band_points = build_line_band_points(
            x_value,
            y_value,
            clamped_start_x,
            clamped_start_y,
            clamped_end_x,
            clamped_end_y,
            safe_thickness,
            width,
            height,
        )
        indices = [py * width + px for px, py in band_points]
        if indices:
            subset = np.asarray(payload["matrix"][:, indices], dtype=float)
            finite_counts = np.sum(np.isfinite(subset), axis=1)
            trace = np.divide(
                np.nansum(subset, axis=1),
                np.maximum(1, finite_counts),
            )
            trace[finite_counts == 0] = np.nan
        else:
            trace = payload["matrix"][:, y_value * width + x_value]
        traces.append(
            {
                "pixel_x": x_value,
                "pixel_y": y_value,
                "trace": nan_safe_list(np.asarray(trace, dtype=float)),
                "average_count": max(1, len(indices)),
            }
        )

    return {
        "x": payload["wavelengths"],
        "x_unit": payload["wavelength_unit"],
        "x_label": payload["wavelength_axis_label"],
        "y_unit": "Intensity (a.u.)",
        "width": width,
        "height": height,
        "caption": path.stem,
        "start_x": clamped_start_x,
        "start_y": clamped_start_y,
        "end_x": clamped_end_x,
        "end_y": clamped_end_y,
        "thickness": safe_thickness,
        "count": len(traces),
        "traces": traces,
    }


def image_export_zip(payload: dict, extra: dict | None = None) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["x_pixel", "y_pixel", "intensity"])
    for y in range(payload["height"]):
        for x in range(payload["width"]):
            writer.writerow([x, y, payload["values"][y * payload["width"] + x]])
    metadata = {k: v for k, v in payload.items() if k != "values"}
    metadata.update(extra or {})
    metadata.update({"layout": "row-major; x right, y down; integer pixel centers", "missing_csv": "empty cell", "processing": "raw single channel or unweighted range sum/mean; no display transforms"})
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("image.csv", stream.getvalue())
        archive.writestr("metadata.json", json.dumps(metadata, indent=2, allow_nan=False))
    return output.getvalue()


class PLMappingHandler(BaseHTTPRequestHandler):
    def valid_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            self.send_error(403, "Cross-origin writes are not allowed")
            return False
        return True

    def read_body(self, limit: int) -> bytes:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError(f"Request must be between 1 and {limit} bytes")
        data = self.rfile.read(length)
        if len(data) != length:
            raise ValueError("Incomplete upload")
        return data

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if not self.valid_origin():
            return
        if parsed.path == "/api/session":
            try:
                payload = json.loads(self.read_body(20 * 1024 * 1024))
                save_session(payload)
                self.serve_json({"saved": True})
            except Exception as exc:
                self.send_error(400, str(exc))
            return
        if parsed.path == "/api/upload-pickle":
            self.serve_upload_pickle()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if route == "/api/update-check":
            self.serve_json(check_updates(force=params.get("force", ["0"])[0] == "1", include_preview=params.get("preview", ["1"])[0] == "1"))
            return
        if route == "/api/app-info":
            self.serve_json({"version": APP_VERSION, "data_home": str(DATA_HOME)})
            return
        if route == "/api/session":
            self.serve_json(load_session())
            return
        if route == "/":
            self.serve_static(STATIC_DIR / "index.html")
            return
        if route == "/updates.js":
            self.serve_static(STATIC_DIR / "updates.js")
            return
        if route == "/processing.js":
            self.serve_static(STATIC_DIR / "processing.js")
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
        if route == "/api/file-analysis":
            self.serve_file_analysis(
                params.get("path", [None])[0],
                params.get("import_mode", [None])[0],
                params.get("manual_format", [None])[0],
                params.get("skip_rows", [None])[0],
                params.get("delimiter", [None])[0],
                params.get("index_column", [None])[0],
                params.get("x_column", [None])[0],
                params.get("y_column", [None])[0],
                params.get("data_start_column", [None])[0],
            )
            return
        if route == "/api/file-info":
            self.serve_file_info(
                params.get("path", [None])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
                params.get("import_mode", [None])[0],
                params.get("manual_format", [None])[0],
                params.get("skip_rows", [None])[0],
                params.get("delimiter", [None])[0],
                params.get("index_column", [None])[0],
                params.get("x_column", [None])[0],
                params.get("y_column", [None])[0],
                params.get("data_start_column", [None])[0],
            )
            return
        if route in {"/api/pl-image", "/api/pl-image-export"}:
            self.serve_pl_image(
                params.get("path", [None])[0],
                params.get("mode", ["sum"])[0],
                params.get("selection", ["point"])[0],
                params.get("target_wavelength", ["0"])[0],
                params.get("start_wavelength", ["0"])[0],
                params.get("end_wavelength", ["0"])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
                params.get("import_mode", [None])[0],
                params.get("manual_format", [None])[0],
                params.get("skip_rows", [None])[0],
                params.get("delimiter", [None])[0],
                params.get("index_column", [None])[0],
                params.get("x_column", [None])[0],
                params.get("y_column", [None])[0],
                params.get("data_start_column", [None])[0],
                export=route.endswith("-export"),
                expected_signature=params.get("source_signature", [None])[0],
            )
            return
        if route == "/api/pl-trace":
            self.serve_pl_trace(
                params.get("path", [None])[0],
                params.get("x", ["0"])[0],
                params.get("y", ["0"])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
                params.get("import_mode", [None])[0],
                params.get("manual_format", [None])[0],
                params.get("skip_rows", [None])[0],
                params.get("delimiter", [None])[0],
                params.get("index_column", [None])[0],
                params.get("x_column", [None])[0],
                params.get("y_column", [None])[0],
                params.get("data_start_column", [None])[0],
            )
            return
        if route == "/api/pl-line-trace":
            self.serve_pl_line_trace(
                params.get("path", [None])[0],
                params.get("x1", ["0"])[0],
                params.get("y1", ["0"])[0],
                params.get("x2", ["0"])[0],
                params.get("y2", ["0"])[0],
                params.get("thickness", ["1"])[0],
                params.get("grid_width", [None])[0],
                params.get("grid_height", [None])[0],
                params.get("import_mode", [None])[0],
                params.get("manual_format", [None])[0],
                params.get("skip_rows", [None])[0],
                params.get("delimiter", [None])[0],
                params.get("index_column", [None])[0],
                params.get("x_column", [None])[0],
                params.get("y_column", [None])[0],
                params.get("data_start_column", [None])[0],
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
        data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
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
        import_mode: str | None,
        manual_format: str | None,
        skip_rows: str | None,
        delimiter: str | None,
        index_column: str | None,
        x_column: str | None,
        y_column: str | None,
        data_start_column: str | None,
        export: bool = False,
        expected_signature: str | None = None,
    ) -> None:
        try:
            source = resolve_pickle_path(file_name)
            mode = raw_mode if raw_mode in {"sum", "mean"} else "sum"
            selection = raw_selection if raw_selection in {"point", "range"} else "point"
            target_wavelength = float(raw_target_wavelength)
            start_wavelength = float(raw_start_wavelength)
            end_wavelength = float(raw_end_wavelength)
            payload = parse_pl_image(
                    source,
                    mode,
                    selection,
                    target_wavelength,
                    start_wavelength,
                    end_wavelength,
                    raw_width,
                    raw_height,
                    import_mode or "auto",
                    manual_format or "index-columns",
                    skip_rows,
                    delimiter or "auto",
                    index_column,
                    x_column,
                    y_column,
                    data_start_column,
                    full_resolution=export,
                )
            if expected_signature and payload["source_signature"] != expected_signature:
                raise ValueError("Source file changed. Reopen the file before exporting.")
            if export:
                data = image_export_zip(payload, {"import": dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))})
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", 'attachment; filename="pl-map.zip"')
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.serve_json(payload)
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_pl_trace(
        self,
        file_name: str | None,
        raw_x: str,
        raw_y: str,
        raw_width: str | None,
        raw_height: str | None,
        import_mode: str | None,
        manual_format: str | None,
        skip_rows: str | None,
        delimiter: str | None,
        index_column: str | None,
        x_column: str | None,
        y_column: str | None,
        data_start_column: str | None,
    ) -> None:
        try:
            source = resolve_pickle_path(file_name)
            x_index = max(0, int(raw_x))
            y_index = max(0, int(raw_y))
            self.serve_json(
                parse_pl_trace(
                    source,
                    x_index,
                    y_index,
                    raw_width,
                    raw_height,
                    import_mode or "auto",
                    manual_format or "index-columns",
                    skip_rows,
                    delimiter or "auto",
                    index_column,
                    x_column,
                    y_column,
                    data_start_column,
                )
            )
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_pl_line_trace(
        self,
        file_name: str | None,
        raw_x1: str,
        raw_y1: str,
        raw_x2: str,
        raw_y2: str,
        raw_thickness: str,
        raw_width: str | None,
        raw_height: str | None,
        import_mode: str | None,
        manual_format: str | None,
        skip_rows: str | None,
        delimiter: str | None,
        index_column: str | None,
        x_column: str | None,
        y_column: str | None,
        data_start_column: str | None,
    ) -> None:
        try:
            source = resolve_pickle_path(file_name)
            self.serve_json(
                parse_pl_line_traces(
                    source,
                    int(raw_x1),
                    int(raw_y1),
                    int(raw_x2),
                    int(raw_y2),
                    int(raw_thickness),
                    raw_width,
                    raw_height,
                    import_mode or "auto",
                    manual_format or "index-columns",
                    skip_rows,
                    delimiter or "auto",
                    index_column,
                    x_column,
                    y_column,
                    data_start_column,
                )
            )
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_file_info(
        self,
        raw_path: str | None,
        raw_width: str | None,
        raw_height: str | None,
        import_mode: str | None,
        manual_format: str | None,
        skip_rows: str | None,
        delimiter: str | None,
        index_column: str | None,
        x_column: str | None,
        y_column: str | None,
        data_start_column: str | None,
    ) -> None:
        try:
            path = resolve_pickle_path(raw_path)
            payload = load_pickle_payload(
                str(path),
                raw_width,
                raw_height,
                import_mode or "auto",
                manual_format or "index-columns",
                skip_rows,
                delimiter or "auto",
                index_column,
                x_column,
                y_column,
                data_start_column,
            )
            info = build_file_info(
                path,
                raw_width,
                raw_height,
                import_mode or "auto",
                manual_format or "index-columns",
                skip_rows,
                delimiter or "auto",
                index_column,
                x_column,
                y_column,
                data_start_column,
            )
            info["width"] = payload["width"]
            info["height"] = payload["height"]
            self.serve_json(info)
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_file_analysis(
        self,
        raw_path: str | None,
        import_mode: str | None,
        manual_format: str | None,
        skip_rows: str | None,
        delimiter: str | None,
        index_column: str | None,
        x_column: str | None,
        y_column: str | None,
        data_start_column: str | None,
    ) -> None:
        try:
            path = resolve_pickle_path(raw_path)
            self.serve_json(
                build_file_analysis(
                    path,
                    import_mode or "auto",
                    manual_format or "index-columns",
                    skip_rows,
                    delimiter or "auto",
                    index_column,
                    x_column,
                    y_column,
                    data_start_column,
                )
            )
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_upload_pickle(self) -> None:
        try:
            raw_length = self.headers.get("Content-Length")
            if not raw_length:
                raise ValueError("Missing content length")
            payload = self.read_body(512 * 1024 * 1024)
            filename = self.headers.get("X-Filename", "uploaded.pkl")
            safe_name = Path(urllib.parse.unquote(filename)).name
            target = UPLOAD_DIR / f"{uuid.uuid4().hex}_{safe_name}"
            target.write_bytes(payload)
            self.serve_json(
                {
                    "name": UPLOAD_PREFIX_RE.sub("", target.name),
                    "path": str(target.resolve()),
                    "size_bytes": target.stat().st_size,
                }
            )
        except Exception as exc:  # pragma: no cover
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))


def create_server(host: str, port: int) -> ThreadingHTTPServer:
    import errno
    for candidate in ([0] if port == 0 else range(port, min(port + 20, 65536))):
        try:
            return ThreadingHTTPServer((host, candidate), PLMappingHandler)
        except OSError as exc:
            if exc.errno != errno.EADDRINUSE:
                raise
    raise OSError("No free port found. Start with --port 0 to choose an available port.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Standalone PL mapping viewer")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8234)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    ensure_pandas_available()

    server = create_server(args.host, args.port)
    args.port = server.server_port
    print(f"Serving PL mapping viewer on http://{args.host}:{args.port}")
    if DATA_DIR.exists():
        print(f"Dataset: {DATA_DIR}")
    else:
        print("Dataset: no bundled PL_mapping_opener directory found; use file upload/browser selection.")
    if not args.no_browser:
        url = f"http://{args.host}:{args.port}"
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
