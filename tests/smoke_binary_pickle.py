"""Run against a built executable: python tests/smoke_binary_pickle.py /path/to/binary."""
import json
import os
from pathlib import Path
import pickle
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode

import numpy as np
import pandas as pd


def main():
    binary = Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory(prefix='pl-pickle-smoke-') as directory:
        work = Path(directory)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        with (work / 'server.log').open('w') as log:
            process = subprocess.Popen([str(binary), '--no-browser', '--port', str(port)], cwd=work,
                env={**os.environ, 'PL_MAPPING_DATA_HOME': str(work / 'data')}, stdout=log, stderr=log)
            try:
                for _ in range(120):
                    if process.poll() is not None:
                        raise RuntimeError((work / 'server.log').read_text())
                    try:
                        urlopen(base + '/api/app-info', timeout=1).close()
                        break
                    except OSError:
                        time.sleep(.5)
                else:
                    raise RuntimeError('Server startup timed out')
                array = np.arange(18., dtype=float).reshape(3, 6)
                # Protocol 2 has no frames: explicitly reference NumPy 1.x import paths.
                multiarray = pickle.dumps(array, protocol=2).replace(b'numpy._core.multiarray\n', b'numpy.core.multiarray\n')
                args = pickle.dumps((array.tobytes(), array.dtype, array.shape, 'C'), protocol=2)
                numeric = b'\x80\x02cnumpy.core.numeric\n_frombuffer\n' + args[2:-1] + b'R.'
                for label, content in [('legacy-multiarray', multiarray), ('legacy-numeric', numeric),
                        ('측정 DataFrame', pickle.dumps(pd.DataFrame(array, index=[500., 510., 520.])) )]:
                    request = Request(base + '/api/upload-pickle', data=content,
                        headers={'X-Filename': quote(label + '.pickle')})
                    uploaded = json.load(urlopen(request, timeout=90))
                    query = urlencode({'path': uploaded['path'], 'grid_width': 3, 'grid_height': 2,
                        'target_wavelength': 500 if 'DataFrame' in label else 0})
                    analysis = json.load(urlopen(base + '/api/file-analysis?' + query, timeout=90))
                    assert analysis['pixel_count'] == 6 and analysis['slice_count'] == 3, analysis
                    result = json.load(urlopen(base + '/api/pl-image?' + query, timeout=90))
                    assert result['width'] == 3 and result['height'] == 2, result
                    print(label + ': upload, pixel recommendation and map PASS', flush=True)
            finally:
                process.terminate()
                process.wait(timeout=15)


if __name__ == '__main__':
    main()
