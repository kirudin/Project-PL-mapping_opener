import os
import tempfile
import unittest
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SANDBOX = tempfile.TemporaryDirectory(prefix='pl-regression-')
os.environ['PL_MAPPING_DATA_HOME'] = SANDBOX.name
import numpy as np
import json, io, zipfile, csv, threading
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError
import pl_mapping_viewer as app
from runtime_paths import UPLOAD_DIR, save_session, load_session

OPTIONS = dict(raw_width='3', raw_height='2', import_mode='auto', manual_format='index-columns', skip_rows=None, delimiter='auto', index_column=None, x_column=None, y_column=None, data_start_column=None)

class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.path = UPLOAD_DIR / 'synthetic.npz'
        self.data = np.arange(18, dtype=float).reshape(3, 6)
        self.write(self.data)
    def write(self, data):
        np.savez(self.path, data=data, wavelengths=[500., 510., 520.], width=3, height=2)
    def image(self, **kwargs):
        return app.parse_pl_image(self.path, 'sum', 'range', 500., 500., 520., **OPTIONS, **kwargs)
    def test_rectangle_and_range(self):
        trace = app.parse_pl_trace(self.path, 2, 1, **OPTIONS)
        self.assertEqual(trace['trace'], [5,11,17])
        self.assertEqual(self.image()['values'], self.data.sum(axis=0).tolist())
    def test_missing_is_not_zero(self):
        self.data[:, 0] = np.nan
        self.data[1, 1] = np.inf
        self.write(self.data)
        result = self.image()
        self.assertIsNone(result['values'][0])
        self.assertEqual(result['values'][1], 14)
        json.dumps(result, allow_nan=False)
        trace = app.parse_pl_trace(self.path, 0, 0, **OPTIONS)
        self.assertEqual(trace['trace'], [None]*3)
    def test_line_missing_and_thickness(self):
        self.data[0,:] = np.nan
        self.write(self.data)
        line = app.parse_pl_line_traces(self.path, 0,0,2,0,1, **OPTIONS)
        self.assertEqual(line['count'], 3)
        self.assertEqual(line['traces'][1]['trace'], [None,7,13])
        wide = app.parse_pl_line_traces(self.path,0,0,2,0,3,**OPTIONS)
        self.assertGreater(wide['traces'][1]['average_count'],1)
    def test_replaced_file_invalidates_cache(self):
        self.assertEqual(app.load_pickle_payload(str(self.path),'3','2')['matrix'][0,0],0)
        self.write(np.full((3,6),99.))
        self.assertEqual(app.load_pickle_payload(str(self.path),'3','2')['matrix'][0,0],99)
    def test_full_resolution_export(self):
        p=UPLOAD_DIR/'large.npz'
        data=np.arange(512*512,dtype=float).reshape(1,-1)
        np.savez(p,data=data,wavelengths=[500],width=512,height=512)
        opts={**OPTIONS,'raw_width':'512','raw_height':'512'}
        preview=app.parse_pl_image(p,'sum','point',500,500,500,**opts)
        full=app.parse_pl_image(p,'sum','point',500,500,500,**opts,full_resolution=True)
        self.assertEqual(len(preview['values']),256*256)
        z=zipfile.ZipFile(io.BytesIO(app.image_export_zip(full)))
        rows=list(csv.DictReader(io.StringIO(z.read('image.csv').decode())))
        self.assertEqual(len(rows),512*512)
        self.assertEqual(float(rows[-1]['intensity']),512*512-1)
        self.assertEqual(rows[-1]['x_pixel'],'511')
        self.assertEqual(json.loads(z.read('metadata.json'))['width'],512)
    def test_axis_validation(self):
        for axis in ([500,500,510],[500,np.nan,510],[510,500,520]):
            with self.assertRaises(ValueError): app.coerce_wavelengths(axis,3)
        self.assertEqual(app.coerce_wavelengths([520,510,500],3)[0],[520,510,500])
    def test_stale_session_save_is_ignored(self):
        newer = {"schema_version":3,"saved_at_ms":200,"selectedPath":"new"}
        save_session(newer)
        save_session({"schema_version":3,"saved_at_ms":100,"selectedPath":"old"})
        self.assertEqual(load_session(),newer)

    def test_session_atomic_and_validation(self):
        value={'schema_version':3,'clickedTraces':[{'groupType':'line','thickness':3,'y':[None,2]}]}
        save_session(value)
        self.assertEqual(load_session(),value)
        with self.assertRaises(ValueError): save_session({'schema_version':999})
        self.assertEqual(load_session(),value)

class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=app.create_server('127.0.0.1',0)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.base=f'http://127.0.0.1:{cls.server.server_port}'
        cls.path=UPLOAD_DIR/'http.npz'
        np.savez(cls.path,data=np.arange(18).reshape(3,6),wavelengths=[500,510,520],width=3,height=2)
    @classmethod
    def tearDownClass(cls): cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def test_app_assets(self):
        for route in ['/', '/app.js','/processing.js','/styles.css','/api/app-info']:
            with urlopen(self.base+route) as r: self.assertEqual(r.status,200)
    def test_export_http_and_stale_source(self):
        params=dict(path=str(self.path),grid_width=3,grid_height=2,target_wavelength=500)
        preview=json.load(urlopen(self.base+'/api/pl-image?'+urlencode(params)))
        params['source_signature']=preview['source_signature']
        data=urlopen(self.base+'/api/pl-image-export?'+urlencode(params)).read()
        self.assertIn('image.csv',zipfile.ZipFile(io.BytesIO(data)).namelist())
        params['source_signature']='stale'
        with self.assertRaises(HTTPError) as e:urlopen(self.base+'/api/pl-image-export?'+urlencode(params))
        self.assertEqual(e.exception.code,400)
    def test_session_http(self):
        value={'schema_version':3,'selectedPath':'synthetic'}
        req=Request(self.base+'/api/session',data=json.dumps(value).encode(),headers={'Content-Type':'application/json'})
        self.assertTrue(json.load(urlopen(req))['saved'])
        self.assertEqual(json.load(urlopen(self.base+'/api/session')),value)
    def test_foreign_origin_rejected(self):
        req=Request(self.base+'/api/session',data=b'{}',headers={'Origin':'https://example.org'})
        with self.assertRaises(HTTPError) as e:urlopen(req)
        self.assertEqual(e.exception.code,403)
    def test_port_conflict(self):
        other=app.create_server('127.0.0.1',self.server.server_port)
        try:self.assertNotEqual(other.server_port,self.server.server_port)
        finally:other.server_close()

if __name__=='__main__':unittest.main()
