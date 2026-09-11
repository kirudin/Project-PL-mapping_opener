# PL Mapping Viewer development rules

Read docs/APP_BUILD_SPEC_KO.md, DEVELOPER_HANDOFF.md and docs/API_GUIDE.md before changes.
Preserve original measurements, local user edits and historical versions. Use temporary
PL_MAPPING_DATA_HOME plus synthetic inputs for tests. Never add measurements to release ZIPs.
Root source is canonical on both OSes; do not edit/synchronize legacy win_version0.2 copies.
Preserve missing values; distinguish raw, processed and display-only data. Keep axis, pixel
layout, processing order and metadata consistent through selection, plotting and export.
Do not treat a PL bright spot, fitted peak or apparent splitting as a confirmed mechanism.
Run Python regression tests and Node processing tests; verify affected browser workflows.
Document platform validation honestly. Build success is not publication or Windows validation.
