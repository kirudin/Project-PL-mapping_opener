"""Read-only GitHub release lookup. No assets, installation or measurement uploads."""
from __future__ import annotations
import json
import re
import ssl
import time
import threading
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import certifi
from runtime_paths import APP_VERSION, DATA_HOME

REPOSITORY = 'kirudin/Project-PL-mapping_opener'
RELEASES_URL = f'https://github.com/{REPOSITORY}/releases'
API_URL = f'https://api.github.com/repos/{REPOSITORY}/releases?per_page=100'
CACHE_FILE = DATA_HOME / 'update-cache.json'
_LOCK = threading.Lock()
_VERSION = re.compile(r'^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$')

def version_key(value):
    m = _VERSION.fullmatch(str(value))
    if not m:
        raise ValueError('Unsupported release version')
    suffix = m[4]
    prerelease = tuple((0, int(p)) if p.isdigit() else (1, p) for p in suffix.split('.')) if suffix else ()
    return (*map(int, m.group(1,2,3)), 0 if suffix else 1, prerelease)

def select_release(releases, current=APP_VERSION, include_preview=True):
    if not isinstance(releases, list):
        raise ValueError('Invalid release response')
    candidates = []
    for release in releases:
        if not isinstance(release, dict) or release.get('draft'):
            continue
        try:
            key = version_key(release.get('tag_name'))
        except ValueError:
            continue
        preview = bool(release.get('prerelease')) or key[3] == 0
        if preview and not include_preview:
            continue
        candidates.append((key, release, preview))
    result = {'current_version': current, 'release_url': RELEASES_URL, 'update_available': False,
              'include_preview': include_preview, 'latest_version': None}
    if not candidates:
        return {**result, 'status': 'no_release'}
    key, release, preview = max(candidates, key=lambda item: item[0])
    tag = release['tag_name']
    return {**result, 'status': 'ok', 'latest_version': tag, 'prerelease': preview,
            'update_available': key > version_key(current),
            'release_url': f'{RELEASES_URL}/tag/{quote(tag, safe="")}',
            'published_at': release.get('published_at'),
            'assets': [a['name'] for a in release.get('assets', []) if isinstance(a, dict) and isinstance(a.get('name'),str)]}

def fetch_releases():
    req = Request(API_URL, headers={'Accept':'application/vnd.github+json', 'User-Agent':'PL-Mapping-Viewer-Update-Checker', 'X-GitHub-Api-Version':'2022-11-28'})
    with urlopen(req, timeout=4, context=ssl.create_default_context(cafile=certifi.where())) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError('Release response too large')
    value = json.loads(raw)
    if not isinstance(value, list):
        raise ValueError('Invalid release response')
    return value

def check_updates(force=False, include_preview=True, *, now=None, cache_path=None, fetcher=None):
    timestamp = time.time() if now is None else now
    path = Path(cache_path) if cache_path else CACHE_FILE
    fetcher = fetcher or fetch_releases
    # Only this lookup is locked. Local analysis requests run independently.
    with _LOCK:
        try:
            cache = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(cache, dict): cache = {}
        except (OSError, ValueError):
            cache = {}
        age = timestamp - cache.get('attempted_at', 0) if isinstance(cache.get('attempted_at',0),(int,float)) else -1
        ttl = 86400 if cache.get('success') else 300
        due = "attempted_at" not in cache or not (0 <= age < (15 if force else ttl))
        error = None
        if due:
            try:
                releases = fetcher()
                select_release(releases)  # Validate before persisting a response.
                cache = {'attempted_at':timestamp,'checked_at':timestamp,'success':True,'releases':releases}
            except Exception:
                cache = {**cache,'attempted_at':timestamp,'success':False}
            try:
                temp = path.with_suffix('.tmp')
                temp.write_text(json.dumps(cache, allow_nan=False), encoding='utf-8')
                temp.replace(path)
            except (OSError, ValueError):
                pass  # A read-only data directory must not block analysis or this result.
        if not cache.get('success'):
            error = 'Could not check GitHub. Your local work is unaffected; try again later.'
        try:
            result = select_release(cache.get('releases', []), include_preview=include_preview)
        except (TypeError, ValueError):
            result = select_release([], include_preview=include_preview)
        return {**result, 'status': 'unavailable' if error else result['status'], 'error':error,
                'checked_at':cache.get('checked_at'), 'cached':not due, 'stale':bool(error and cache.get('releases'))}
