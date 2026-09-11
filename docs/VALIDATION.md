# Validation — 0.3.0, 2026-09-11

## Verified

- Python regression suite: 13 tests passed on macOS. Cases cover rectangular pixel
  indexing, range sums, all-missing masks, band extraction, same-path replacement,
  full-resolution export values and axes, spectral-axis rejection, atomic session
  persistence, stale-write ordering, HTTP routes, foreign-origin writes and port conflict.
- Node processing regressions passed: reference zero/missing masking, min-max missing
  handling, known quadratic smoothing, display offsets excluded from exported values.
- JavaScript syntax, source shell launcher syntax, and git diff whitespace check passed.
- Source launcher opened the local server using PL_MAPPING_DATA_HOME in an isolated test directory.
- Browser: loaded synthetic 12x8 map (61 wavelengths), confirmed dimensions, clicked a
  pixel, extracted a 3-pixel-thick line with six samples, switched to heatmap, reloaded.
  Seven total traces and the line group remained; persisted spectra, thickness and distances
  were inspected in the session. No console errors in that workflow.
- Browser DOM layout check at actual 1023 CSS-pixel width: zero document horizontal overflow
  and no element extending past the right edge after the responsive fix.
- Map CSV button was exercised without a displayed error. The in-app browser did not
  expose a download event; final filesystem arrival through that browser is unverified.
  ZIP bytes, CSV values and metadata were independently downloaded/read through HTTP.
- macOS arm64 PyInstaller ZIP: 25,980,448 bytes, 162 files. Extracted using macOS ditto
  outside the source tree and launched the executable with an isolated user-data folder.
  Verified packaged app version, file upload, 12x8 map with missing pixel, CSV/metadata ZIP,
  and session + retained upload after terminating and restarting the executable.
- ZIP did not contain app Python source files, tests, measurement folders or analysis outputs.
  Frontend resources and compiled Python are part of the bundle; packaging does not
  guarantee source secrecy.

## Not verified / remaining

- Windows build/run on Windows hardware; x86_64 macOS; code signing/notarization.
- External publication or repository visibility changes (not performed).
- Collaborator hardware and real instrument data format coverage.
- Browser PNG/clipboard downloads and pixel-perfect figure layout. Map PNG still exports
  a preview without a complete scientific figure frame.
- Large-dataset performance, multi-tab conflicts beyond timestamp ordering, and all UI edge cases.
- ROI, background subtraction, peak analysis, batch processing and physical-axis conversion
  are future analysis milestones, not part of the completed foundation release.

Tests use temporary paths and synthetic data; user measurements were not changed.

## 0.3.1 update-check validation — 2026-09-11

- All 22 Python tests and Node processing/update-message tests passed. New cases cover
  numeric/prerelease ordering, channel filtering, stale/offline data, cache persistence,
  retries, manual throttling and release URL construction.
- Real GitHub source lookup returned the published v0.3.0 preview. Browser confirmed
  the installed/newest comparison and no-release status with stable-only filtering.
- Isolated synthetic cache fixture v0.4.0 produced the new-version notification and
  release URL in the browser; fixture was replaced with real GitHub data afterward.
- Release link was clicked; opening an external target was not observable in the in-app
  tab inventory. Link href and target were verified.
- Rebuilt macOS arm64 ZIP (26,119,637 bytes, 165 files) was extracted outside the source
  tree. Binary HTTPS update lookup succeeded with bundled certificate roots. Upload,
  missing-value map, full CSV ZIP and session/upload preservation across restart passed.
- No Windows or Intel Mac validation was performed.

## 0.3.2 macOS packaging — 2026-09-11

- Python regression suite: 22 passed; Node processing and update-message tests passed.
- Built macOS arm64 one-file console executable; codesign --verify --strict passed
  (ad-hoc signature only; this is not Developer ID signing/notarization).
- Extracted ZIP outside source: exactly executable, launcher, guide and version file;
  no loose _internal libraries. Launch, synthetic upload, missing-value map, full-resolution
  export, live HTTPS update lookup, restart/session/upload persistence passed.
- Previous local package checks did not reproduce browser-download quarantine. User
  reported v0.3.1 _internal/Python blocked by macOS. Packaging now follows TMM onefile,
  but clean-Mac downloaded Gatekeeper approval count remains unverified. Windows not tested.

## 0.3.3 pickle compatibility — 2026-09-11

- Reproduced v0.3.2 frozen failure: ModuleNotFoundError for numpy.core.numeric while
  source Python read the same local pickle successfully. Text fallback obscured this error.
- Python suite: 23 passed; Node processing and update-message suites passed.
- Fixed binary: four existing local measurement pickles (DataFrame and viewer-ready dict,
  1600 channels, 6400/7500 pixels) all passed file analysis and full-size map generation.
  Files were read-only and were not included in source or release assets.
- Synthetic frozen smoke: legacy numpy.core.numeric, numpy.core.multiarray and pandas
  DataFrame pickle uploads passed analysis and map generation, including encoded Korean
  filename. Browser page version 0.3.3 loaded; Finder file-picker interaction not repeated.
- macOS onefile packaging retained; Apple notarization and clean downloaded Gatekeeper
  behavior remain unverified. Windows remains untested.

## 0.3.4 interactive import investigation — 2026-09-11

- Tested the published 0.3.3 executable through the browser file chooser with local
  80x80 DataFrame and 150x50 viewer-ready pickles. Initial recommendations and maps worked.
- Reproduced missing suggestions/candidates when reopening Import Setup after opening
  a file: file-info had replaced file-analysis state. Fixed by obtaining analysis metadata.
- Also reproduced a blank import modal when opened during asynchronous session restore.
  The modal now refreshes when restore completes, and indicates restoration in progress.
- Added visible upload/analysis progress and error messages inside the modal. Verified
  a synthetic corrupt pickle reports its load error in the dialog and permits retry.
- Node import-feedback regression tests cover preserved recommendations and failure
  recovery. Python suite 23 passed; processing/update Node suites passed.
- These findings do not identify the user's exact failing file, whose path/version
  has not been provided. Do not claim every pickle or their specific failure is resolved.

## 0.4.0 units, layout and palettes — 2026-09-11

- Pure conversion tests: known 500 nm energy, round trips across all four units, Raman
  zero/Stokes/anti-Stokes and missing-laser checks, descending energy axis, preserved
  intensities, unchanged index axes, converted CSV coordinates/metadata passed.
- Python 23 regressions and Node processing/import-feedback/update suites passed.
- Actual browser file chooser loaded a 150x50, 1600-channel measurement pickle. Changed
  nm to eV to Raman (532 nm excitation): same starting channel displayed 612.52 nm,
  2.02 eV, 2470.87 cm⁻¹. Missing laser produced a visible validation error.
- Dark theme selected Inferno image palette and night spectrum background. Image height
  control resized the stage; mean plot follows stage height. Axis/laser restored after reload.
- Browser viewport controls are scaled in this environment: measured CSS widths 2149
  and 1014 px showed two columns and one column respectively, without document overflow.
- No Windows build or clean-download Gatekeeper verification; macOS remains ad-hoc signed.
