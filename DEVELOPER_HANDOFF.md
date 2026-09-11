# Developer handoff — 0.4.0

## Scope and source

Root `pl_mapping_viewer.py` handles import, cache, HTTP and application orchestration.
`pl_core.py` contains numerical masks, averages, preview sampling and line geometry.
`runtime_paths.py` owns version, user paths and atomic session storage.
`pl_mapping_static/processing.js` has pure spectrum operations, tested in Node.
`pl_mapping_static/app.js` owns UI state, rendering, export and session snapshots.
Root launchers and `scripts/build_binary.py` build this same source on each OS.
Public `win_version0.1/` is historical. The local `win_version0.2/` snapshot is
preserved outside the new source publication and is not a dependency or build input.

The user selected public source distribution on 2026-09-11. The root implementation,
development documents, tests and build scripts are published together. The v0.3.0 and
v0.3.1 macOS binary previews were published earlier; their existing tags are not rewritten.
Use the source-commit link in release notes to inspect the published v0.3.1 implementation.
Measurement/output folders and local historical snapshots are preserved and excluded from
this publication. TMM's development/validation principles still apply; private source
hosting is not a requirement for this project.

## Contracts

Matrix = channels x flattened pixels. Pixel index = y * width + x; origin at top left.
Missing = NaN inside NumPy, null in JSON, empty in CSV; no artificial zero substitution.
Range Sum = unweighted channel sum, not quadrature. All-missing aggregate is missing.
Scalar spectral axes currently assume nm. Raw 2D/3D orientation inference is legacy and
requires user verification; metadata-driven explicit axis mapping is still future work.
Smoothing fits channel indices, not actual wavelength spacing. It preserves missing centers.
Reference -> smoothing -> normalization -> display offset. CSV excludes display offset.

## API

Read docs/API_GUIDE.md before changing routes. No TMM routes are imported into this app.
Session persistence is a single-user latest-session store. Atomic replacement prevents
partial files, but multiple open tabs use last-write-wins (no multi-user conflict resolution).
Uploaded copies persist and are not automatically deleted. Cache holds four file analyses;
very large cubes and many selected line spectra may still consume substantial memory.

## Verification and open work

Run commands in README and consult docs/VALIDATION.md for actual execution evidence.
UI/app code is still substantial; import parsers and rendering can be split further after
compatibility fixtures are collected. Do not copy the whole TMM app into this repository.
Next analysis milestones: ROI statistics, background model, peak models with residuals and
failure masks, then batch processing. These are not claimed as implemented in 0.3.0.

Before external distribution: test on Windows hardware, test collaborator measurements,
verify package contents and source disclosure policy, align future release tags with the corresponding source commit, and
publish only within user authorization. Build artifacts do not imply source secrecy.

`update_checker.py` implements read-only public release lookup; `updates.js` owns independent status and browser-origin preferences. Cache is separate from sessions. Preview builds default to checking prereleases. Tests inject release data and isolated cache files; do not fabricate remote releases to test notifications.

macOS builds use --onefile console packaging; Windows retains --onedir. Release staging is separate from dist/<OS>. No Developer ID signing identity is installed; do not claim notarization or a verified number of Gatekeeper prompts.

Frozen pickle support requires numpy.core compatibility modules even though current
NumPy imports numpy._core. Run tests/smoke_binary_pickle.py against release binaries;
NPZ-only smoke tests do not cover pickle's dynamic imports. Never text-parse failed
.pickle/.pkl inputs. First pandas initialization can take several seconds.

Keep state.fileAnalysis from /api/file-analysis: /api/file-info does not contain the suggested dimensions or factor candidates. File import errors must be visible inside the modal. Run node tests/test_import_feedback.cjs after changing this workflow.

Spectral display conversion lives in processing.js. API axes and image export remain
original nm; fetchJson converts analysis/image/trace response coordinates and
buildImageRequest inverses display selections. Never reorder intensity without its
coordinate; no density Jacobian is applied. Session spectralSettings identifies stored
trace/selection coordinate units. Tests: node tests/test_spectral_units.cjs.
