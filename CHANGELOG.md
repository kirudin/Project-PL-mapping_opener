# Changelog

## Source publication — 2026-09-11

- Published the v0.3.1 shared source, development standards, tests and build scripts
  in the existing public repository at the user's request.
- Existing binary releases and their historical tags remain unchanged.

## 0.3.1 — 2026-09-11

- Daily and manual GitHub release checks, optional preview channel, and clickable release page.
- Offline-safe status, persistent cache, request throttling, and packaged certificate roots.
- Update preferences remain separate from analysis sessions. No automatic downloads/installation.

## 0.3.0 — 2026-09-11

- Full-resolution map CSV/metadata ZIP; source-change check before exporting.
- Missing-value masks preserved through image, trace, line and range calculations.
- Near-zero reference denominator masks instead of artificial large ratios.
- Display offsets excluded from processed spectrum CSV; processing metadata added.
- File-identity-aware bounded cache and explicit source reload.
- Complete line snapshots in versioned sessions, atomic OS app-data persistence, JSON save/open.
- Persistent uploads outside executables; legacy temporary paths remain readable.
- Removed silent line fallback to unaveraged pixels and 96-point truncation.
- Shared numerical and spectrum-processing modules and regression tests.
- Relative source launcher, port fallback, common target-OS PyInstaller build and release ZIP.
- Finite monotonic spectral-axis validation; numeric axes still explicitly assume nm.
- Fixed missing-value contrast contamination, low-intensity rounding, manual color retention.

Scientific compatibility: old missing-as-zero outputs, epsilon-clamped ratios, offset-bearing
CSV and downsampled map CSV will differ. Retain original files and old version for comparisons.
