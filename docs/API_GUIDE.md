# PL Mapping Viewer API — 0.3.1

Local single-user API; default loopback only. Read source for authoritative parsing details.
Do not modify original measurements for tests. Set PL_MAPPING_DATA_HOME to a temporary directory.

- GET /api/app-info: version and data directory.
- POST /api/upload-pickle: raw file bytes; X-Filename URL-encoded. At most 512 MiB.
  Stores a copy under app-data/uploads, never overwrites the original. Supports other input formats too.
- GET /api/file-analysis?path=...: shape/axis analysis and suggestions.
- GET /api/file-info?path=...&grid_width=...&grid_height=...: selected dataset metadata and source_signature.
- GET /api/pl-image: path, grid_width/grid_height, mode=sum|mean, selection=point|range,
  target_wavelength, start_wavelength, end_wavelength. Returns at-most-256-edge preview.
- GET /api/pl-image-export: same parameters, optional source_signature to reject stale export.
  Returns ZIP of full-resolution image.csv and metadata.json.
- GET /api/pl-trace: path, x, y and grid dimensions; returns pixel and mean spectrum.
- GET /api/pl-line-trace: path, x1,y1,x2,y2,thickness and grid dimensions; returns band means.
- GET /api/session: latest session object or {}.
- POST /api/session: JSON object, schema_version=3, max 20 MiB; atomic persistent replacement.

Import parameters: import_mode=auto|manual, manual_format=index-columns|xy-spectra,
skip_rows, delimiter, index_column, x_column, y_column, data_start_column.
Use the UI for exact allowed parser settings. JSON uses null for nonfinite numeric results.
Most validation failures retain legacy HTTP 400 text/HTML error bodies; clients must check status.
Writes reject foreign Origin headers; this is not an authenticated remote service. Do not
expose --host publicly. Pickle input executes Python deserialization and must be trusted.

Session JSON includes source metadata, input settings, display settings and selected trace
snapshots with line groups/thickness/distances. It references the raw file; it does not bundle it.

- GET /api/update-check?force=0|1&preview=0|1: public release metadata; JSON status ok/no_release/unavailable, update_available, current/latest_version, release_url, checked_at, cached, stale. Default preview=1. Failure returns HTTP 200 with unavailable status so analysis remains independent. This call contacts GitHub only when cache policy permits. No files are uploaded.
