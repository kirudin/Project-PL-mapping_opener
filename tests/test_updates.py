import sys, tempfile, unittest, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from unittest.mock import Mock
from update_checker import version_key, select_release, check_updates, RELEASES_URL

def release(tag, preview=False, **extra):
    return {'tag_name':tag,'prerelease':preview,'draft':False,'assets':[], **extra}

class UpdateTests(unittest.TestCase):
    def test_numeric_semver(self):
        self.assertGreater(version_key('v0.10.0'),version_key('v0.9.9'))
        self.assertGreater(version_key('1.0.0'),version_key('1.0.0-rc.9'))
        self.assertGreater(version_key('1.0.0-rc.10'),version_key('1.0.0-rc.2'))
    def test_preview_channel_and_drafts(self):
        data=[release('0.4.0',True),release('0.3.1'),release('9.0.0',draft=True),release('garbage')]
        self.assertEqual(select_release(data,include_preview=False)['latest_version'],'0.3.1')
        self.assertEqual(select_release(data)['latest_version'],'0.4.0')
    def test_equal_and_older_not_upgrade(self):
        for tag in ['0.3.0','0.3.1']:
            self.assertFalse(select_release([release(tag)],current='0.3.1')['update_available'])
    def test_newer_link_is_constructed_not_trusted(self):
        result=select_release([release('0.4.0',html_url='https://evil.example/')])
        self.assertTrue(result['update_available'])
        self.assertEqual(result['release_url'],RELEASES_URL+'/tag/0.4.0')
    def test_no_release(self):
        self.assertEqual(select_release([])['status'],'no_release')
    def test_daily_persistent_cache_manual_check(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'cache.json';fetch=Mock(return_value=[release('0.4.0')])
            self.assertTrue(check_updates(now=100,cache_path=path,fetcher=fetch)['update_available'])
            self.assertTrue(check_updates(now=200,cache_path=path,fetcher=fetch)['cached'])
            self.assertEqual(fetch.call_count,1)
            check_updates(now=201,force=True,cache_path=path,fetcher=fetch)
            self.assertEqual(fetch.call_count,2)
            check_updates(now=202,force=True,cache_path=path,fetcher=fetch)
            self.assertEqual(fetch.call_count,2)
            check_updates(now=87000,cache_path=path,fetcher=fetch)
            self.assertEqual(fetch.call_count,3)
    def test_offline_failure_and_retry(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'cache.json';fetch=Mock(side_effect=TimeoutError())
            result=check_updates(now=100,cache_path=path,fetcher=fetch)
            self.assertEqual(result['status'],'unavailable')
            check_updates(now=200,cache_path=path,fetcher=fetch)
            self.assertEqual(fetch.call_count,1)
            check_updates(now=401,cache_path=path,fetcher=fetch)
            self.assertEqual(fetch.call_count,2)
    def test_corrupt_cache_recovers(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'cache.json';p.write_text('{broken')
            self.assertEqual(check_updates(now=100,cache_path=p,fetcher=lambda:[])['status'],'no_release')
    def test_stale_data_marked_not_current(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'cache.json'
            check_updates(now=100,cache_path=p,fetcher=lambda:[release('0.4.0')])
            fetch=Mock(side_effect=OSError())
            result=check_updates(now=87000,cache_path=p,fetcher=fetch)
            self.assertTrue(result['stale']);self.assertEqual(result['status'],'unavailable')

if __name__=='__main__':unittest.main()
