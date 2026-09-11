from __future__ import annotations
import math
from dataclasses import dataclass

@dataclass
class GridPreview:
    width: int
    height: int
    min_value: float
    max_value: float
    values: list[float | None]
    source_points: int


def downsample_grid(values: list[float | None], source_width: int, source_height: int, max_edge: int = 256) -> GridPreview:
    clean_values = [value if value is not None and math.isfinite(value) else None for value in values]
    if source_width <= max_edge and source_height <= max_edge:
        min_value, max_value = finite_min_max(clean_values)
        return GridPreview(source_width, source_height, min_value, max_value, clean_values, len(clean_values))

    scale = max(source_width / max_edge, source_height / max_edge)
    target_width = max(1, int(round(source_width / scale)))
    target_height = max(1, int(round(source_height / scale)))
    sampled: list[float | None] = []
    for ty in range(target_height):
        sy = min(source_height - 1, int(ty * source_height / target_height))
        base = sy * source_width
        for tx in range(target_width):
            sx = min(source_width - 1, int(tx * source_width / target_width))
            sampled.append(clean_values[base + sx])
    min_value, max_value = finite_min_max(clean_values)
    return GridPreview(target_width, target_height, min_value, max_value, sampled, len(clean_values))


def nan_safe_list(values: "np.ndarray") -> list[float | None]:
    import numpy as np

    array = np.asarray(values, dtype=float)
    if array.size == 0:
        return []
    return [float(value) if np.isfinite(value) else None for value in array.reshape(-1)]


def finite_min_max(values: list[float | None]) -> tuple[float, float]:
    finite = [value for value in values if value is not None and math.isfinite(value)]
    if not finite:
        return 0.0, 0.0
    return min(finite), max(finite)


def clamp_line_thickness(thickness: int | str | None) -> int:
    try:
        value = int(thickness) if thickness is not None else 1
    except (TypeError, ValueError):
        value = 1
    return max(1, min(25, value))


def get_line_pixels(start_x: int, start_y: int, end_x: int, end_y: int) -> list[tuple[int, int]]:
    x0, y0, x1, y1 = start_x, start_y, end_x, end_y
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    points: list[tuple[int, int]] = []
    while True:
        points.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return points


def build_line_band_points(
    x: int,
    y: int,
    start_x: int,
    start_y: int,
    end_x: int,
    end_y: int,
    thickness: int,
    width: int,
    height: int,
) -> list[tuple[int, int]]:
    if thickness <= 1:
        return [(x, y)]
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.hypot(dx, dy)
    if length < 1e-12:
        half = thickness // 2
        points = []
        for oy in range(-half, half + 1):
            for ox in range(-half, half + 1):
                px = x + ox
                py = y + oy
                if 0 <= px < width and 0 <= py < height:
                    points.append((px, py))
        return points or [(x, y)]

    perp_x = -dy / length
    perp_y = dx / length
    offsets = [index - (thickness - 1) / 2 for index in range(thickness)]
    seen: set[tuple[int, int]] = set()
    points: list[tuple[int, int]] = []
    for offset in offsets:
        px = int(round(x + perp_x * offset))
        py = int(round(y + perp_y * offset))
        if 0 <= px < width and 0 <= py < height and (px, py) not in seen:
            seen.add((px, py))
            points.append((px, py))
    return points or [(x, y)]


def finite_mean(values, axis):
    import numpy as np
    a = np.asarray(values, dtype=float)
    valid = np.isfinite(a)
    count = valid.sum(axis=axis)
    total = np.where(valid, a, 0).sum(axis=axis)
    return np.divide(total, count, out=np.full(np.shape(total), np.nan), where=count > 0)
