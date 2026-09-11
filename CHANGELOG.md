# Changelog

## Source publication — 2026-09-11

- Published the v0.3.1 shared source, development standards, tests and build scripts
  in the existing public repository at the user's request.
- Existing binary releases and their historical tags remain unchanged.

## 0.4.0 — 2026-09-11

- Display nm-calibrated spectra in nm, eV, Raman shift or wavenumber; require an
  excitation wavelength for Raman shift. Preserve measured-channel intensity and
  channel ordering, inverse-map selections to original nm, and annotate spectrum CSV.
- Move file opening to the top and appearance/update controls to the bottom.
- Add image width share and height controls, vertical frame resizing, responsive
  plot reflow, and theme-specific default image/spectrum palettes and backgrounds.
- Persist axis/laser/layout preferences with sessions; preserve existing trace samples.

## 0.3.4 — 2026-09-11

- Keep pixel recommendation metadata when opening and restoring a file; reopening
  Import Setup no longer loses suggestions and factor candidates.
- Refresh an already-open import dialog after asynchronous session restoration.
- Show file upload/analysis progress and errors inside the import dialog, prevent
  duplicate imports while busy, and display HTTP error messages without raw HTML.
- Add regressions for recommendation retention and visible/recoverable import failures.

## 0.3.3 — 2026-09-11

- Include NumPy 1.x compatibility modules in frozen builds so existing pickle files
  reach pixel-count recommendations and map rendering.
- Preserve pickle load errors; do not retry .pkl/.pickle binary data as a text table.
- Encode upload filenames so Korean/non-ASCII filenames can pass HTTP headers.
- Add frozen-binary tests for legacy numeric/multiarray pickles and pandas DataFrames.

## 0.3.2 — 2026-09-11

- macOS now uses a one-file console executable, matching TMM packaging, instead of
  distributing individually quarantined Python/framework libraries in `_internal`.
- Stage release contents separately from build output and verify the macOS executable signature.
- This is an ad-hoc signed build, not an Apple-notarized release. Clean downloaded
  Gatekeeper launch remains unverified. Numerical behavior is unchanged.

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
