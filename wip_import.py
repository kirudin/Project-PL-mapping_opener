"""Read-only WITec project import; derived arrays use channels × (y * width + x)."""
from functools import lru_cache
from pathlib import Path
import json
import uuid
import struct
import numpy as np
import witio


@lru_cache(maxsize=1)
def _read(path, mtime_ns, size):
    # Validate offsets before handing numeric payloads to the pinned reader.
    # In particular, reject malformed tag lengths instead of allocating from them.
    from witio.tag import WitTag, MAGIC_STRINGS, _read_payload
    from witio.project import WitProject
    with open(path, 'rb') as stream:
        magic = stream.read(8)
        if magic not in MAGIC_STRINGS:
            raise ValueError('This is not a WITec project file.')
        count = 0
        def read_tag(bound, depth=0):
            nonlocal count
            count += 1
            pos = stream.tell()
            if depth > 64 or count > 500000 or pos + 24 > bound:
                raise ValueError(f'Invalid WIP tag structure at byte {pos}.')
            length = struct.unpack('<I', stream.read(4))[0]
            if length > 4096 or stream.tell() + length + 20 > bound:
                raise ValueError(f'Invalid WIP tag name length at byte {pos}.')
            raw_name = stream.read(length)
            kind, start, end = struct.unpack('<IQQ', stream.read(20))
            if not stream.tell() <= start <= end <= bound:
                raise ValueError(f'Invalid WIP data offsets at byte {pos}; the file may be damaged or use an unsupported layout.')
            try:
                name = raw_name.decode('cp1252')
            except UnicodeDecodeError as exc:
                raise ValueError(f'Unsupported WIP tag encoding at byte {pos}.') from exc
            stream.seek(start)
            if kind == 0:
                children = []
                while stream.tell() < end:
                    children.append(read_tag(end, depth + 1))
                return WitTag(name, kind, children=children)
            return WitTag(name, kind, data=_read_payload(stream, kind, start, end))
        return WitProject(magic, read_tag(size), file_path=path)


def project(path):
    path = Path(path).resolve()
    if path.suffix.lower() != '.wip':
        raise ValueError('Choose a WITec .wip project.')
    stat = path.stat()
    return _read(str(path), stat.st_mtime_ns, stat.st_size)


def dimensions(entry):
    return tuple(int(entry.payload[key].scalar()) for key in ('SizeX', 'SizeY', 'SizeGraph'))


def list_maps(path):
    maps, skipped = [], []
    for index, entry in enumerate(project(path).data):
        if entry.class_name != 'TDGraph':
            continue
        try:
            width, height, channels = dimensions(entry)
            if min(width, height) <= 0 or width * height <= 1 or channels <= 1:
                continue
            maps.append(dict(key=index, name=entry.caption or f'Data {index}',
                             width=width, height=height, channels=channels))
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            skipped.append(f'Data {index}: {exc}')
    return dict(maps=maps, skipped=skipped)


def import_map(path, key, output_dir):
    available = list_maps(path)['maps']
    selected = next((item for item in available if item['key'] == key), None)
    if selected is None:
        raise ValueError('The selected spectral map is not present in this project.')
    entry = project(path).data[key]
    width, height, channels = dimensions(entry)
    cube = entry.array()
    if cube.shape != (width, height, channels):
        raise ValueError('WIP map dimensions do not match its spectral data.')
    # WITio returns x,y,channel; viewer pixels advance x first, then y.
    matrix = cube.transpose(2, 1, 0).reshape(channels, width * height)
    axis, unit = entry.x_axis('nm')
    axis = np.asarray(axis, dtype=float)
    warning = None
    arrays = dict(matrix=matrix, width=width, height=height)
    if unit == 'nm' and axis.shape == (channels,) and np.all(np.isfinite(axis)) and np.all(axis > 0):
        arrays['wavelengths'] = axis
    elif unit == 'a.u.':
        warning = 'No calibrated wavelength axis: opened using channel indices; physical unit conversion is unavailable.'
    else:
        raise ValueError(f'Cannot obtain a valid wavelength axis in nm (reader returned {unit}).')
    provenance = dict(source_file=Path(path).name, source_format='WITec WIP',
                      dataset=selected, reader='witio 0.2.0', axis_unit='nm' if 'wavelengths' in arrays else 'index',
                      pixel_order='y * width + x', warning=warning)
    arrays['wip_provenance'] = json.dumps(provenance, ensure_ascii=False)
    target = Path(output_dir) / f'{uuid.uuid4().hex}_{Path(path).stem}_map-{key}.npz'
    np.savez(target, **arrays)
    return dict(path=str(target.resolve()), name=selected['name'], warning=warning)
