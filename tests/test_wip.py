"""Small synthetic WIT-tag projects; no measurement data checked in."""
import tempfile
import unittest
from pathlib import Path
import numpy as np
from witio.tag import WitTag as T, write_bytes
from wip_import import list_maps, import_map
from pl_mapping_viewer import load_mapping_source, normalize_mapping_object


def tree(name, *children): return T(name, 0, children=list(children))
def integer(name, value): return T(name, 5, np.array([value], dtype='<i4'))
def string(name, value): return T(name, 9, value)
def real(name, value): return T(name, 2, np.array([value], dtype='<f8'))


def fixture(path, maps=2, calibrated=True):
    entries = []
    for i in range(maps):
        cube = np.arange(24, dtype=float).reshape(3, 2, 4) + i * 100
        cube[2, 1, 2] = np.nan
        # Normal WITec layout: channel varies first, then y, then x.
        raw = cube.transpose(2, 1, 0).flatten(order='F').astype('<f8').view('u1')
        entries += [string(f'DataClassName {i}', 'TDGraph'), tree(f'Data {i}',
            tree('TData', integer('ID', i), string('Caption', f'Map {i}')),
            tree('TDGraph', integer('SizeX', 3), integer('SizeY', 2), integer('SizeGraph', 4),
                 integer('XTransformationID', 100),
                 tree('GraphData', integer('DataType', 10), T('Data', 7, raw))))]
    if calibrated:
        entries += [string(f'DataClassName {maps}', 'TDLinearTransformation'), tree(f'Data {maps}',
            tree('TData', integer('ID', 100)), tree('TDTransformation', string('StandardUnit', 'nm')),
            tree('TDLinearTransformation', real('ModelOrigin', 0), real('WorldOrigin', 600), real('Scale', 2)))]
    path.write_bytes(write_bytes(b'WIT_PR06', tree('WITec Project', integer('Version', 7), tree('Data', *entries))))


class WipTests(unittest.TestCase):
    def test_multiple_maps_orientation_axis_and_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'project.wip'; fixture(path)
            maps = list_maps(path)['maps']
            self.assertEqual([m['name'] for m in maps], ['Map 0', 'Map 1'])
            result = import_map(path, 1, tmp)
            loaded = load_mapping_source(Path(result['path']))
            matrix, axis, unit, _ = normalize_mapping_object(loaded, '3', '2')
            self.assertEqual(unit, 'nm'); self.assertEqual(axis, [600,602,604,606])
            np.testing.assert_equal(matrix[:, 1 * 3 + 2], [120,121,np.nan,123])
            np.testing.assert_equal(matrix[:, 1], [108,109,110,111])
            with self.assertRaises(ValueError): import_map(path, 100, tmp)

    def test_single_and_no_maps_and_index_axis(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'project.wip'; fixture(path, maps=1, calibrated=False)
            self.assertEqual(len(list_maps(path)['maps']), 1)
            result = import_map(path, 0, tmp)
            self.assertIn('indices', result['warning'])
            loaded = load_mapping_source(Path(result['path']))
            self.assertEqual(normalize_mapping_object(loaded, '3', '2')[2], 'index')
            fixture(path, maps=0)
            self.assertEqual(list_maps(path)['maps'], [])

    def test_invalid_offsets(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'broken.wip'; fixture(path)
            data=bytearray(path.read_bytes()); data[37:45]=(2**63).to_bytes(8,'little'); path.write_bytes(data)
            with self.assertRaisesRegex(ValueError, 'offsets'): list_maps(path)

if __name__ == '__main__': unittest.main()
