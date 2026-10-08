"""python tests/smoke_binary_wip.py /path/to/binary [optional-real.wip]."""
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_wip import fixture


def main():
    with tempfile.TemporaryDirectory(prefix='pl-wip-smoke-') as directory:
        work = Path(directory)
        source = Path(sys.argv[2]) if len(sys.argv) > 2 else work / 'synthetic.wip'
        if len(sys.argv) <= 2: fixture(source)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        def get(route): return json.load(urlopen(base + route, timeout=90))
        def post(route, content, headers):
            return json.load(urlopen(Request(base + route, data=content, headers=headers), timeout=90))
        with (work / 'server.log').open('w') as log:
            process = subprocess.Popen([str(Path(sys.argv[1]).resolve()), '--no-browser', '--port', str(port)],
                cwd=work, env={**os.environ, 'PL_MAPPING_DATA_HOME': str(work / 'data')}, stdout=log, stderr=log)
            try:
                for _ in range(120):
                    if process.poll() is not None: raise RuntimeError((work / 'server.log').read_text())
                    try: get('/api/app-info'); break
                    except OSError: time.sleep(.5)
                else: raise RuntimeError('Server startup timed out')
                uploaded = post('/api/upload-pickle', source.read_bytes(), {'X-Filename':quote(source.name)})
                maps = get('/api/wip-maps?' + urlencode({'path': uploaded['path']}))['maps']
                assert maps
                for item in maps:
                    result = post('/api/wip-import', json.dumps({'path':uploaded['path'],'key':item['key']}).encode(), {'Content-Type':'application/json'})
                    query=urlencode({'path':result['path']})
                    analysis=get('/api/file-analysis?' + query)
                    assert analysis['suggested_width']==item['width']
                    assert analysis['suggested_height']==item['height']
                    assert analysis['slice_count']==item['channels']
                    image=get('/api/pl-image?' + query)
                    assert image['width']==item['width'] and image['height']==item['height']
                    trace=get('/api/pl-trace?' + query + '&x=0&y=0')
                    assert len(trace['trace'])==item['channels']
                    with urlopen(base+'/api/pl-image-export?'+query,timeout=90) as response:
                        with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
                            meta=json.loads(archive.read('metadata.json'))
                            assert meta['wip_provenance']['dataset']['key']==item['key']
                    print(f"Map {item['key']}: enumerate, select, dimensions, image, spectrum, provenance export PASS",flush=True)
            finally:
                process.terminate(); process.wait(timeout=15)

if __name__=='__main__': main()
