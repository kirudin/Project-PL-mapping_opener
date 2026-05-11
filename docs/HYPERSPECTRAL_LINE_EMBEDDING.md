# Hyperspectral Line Spectrum Embedding

This note explains how to reuse the current hyperspectral tab's "Line spectrum" extraction flow in another panel without copying the whole tab UI.

## Recommended entry points

- Server extraction:
  - `/Users/hwijewoo/Desktop/Project-MVI_opener/viewer_server.py`
  - `parse_hyperspectral_line_traces(path, start_x, start_y, end_x, end_y, thickness=1)`
- Browser-side fetch helper:
  - `/Users/hwijewoo/Desktop/Project-MVI_opener/viewer_static/app.js`
  - `getHyperLineTracePayload(path, start, end, options)`
- Current hyperspectral-tab adapter:
  - `/Users/hwijewoo/Desktop/Project-MVI_opener/viewer_static/app.js`
  - `appendHyperLineTrace(path, start, end, thickness)`

## Separation of responsibility

- `parse_hyperspectral_line_traces(...)` does the real extraction.
- `getHyperLineTracePayload(...)` is the reusable frontend entry point.
  - It calls `/api/hyper-line-trace`.
  - If the endpoint fails, it falls back to the existing per-pixel sampling path.
  - It returns a normalized payload and does not touch UI state.
- `buildHyperLineTraceItems(...)` converts the payload into the same trace-item shape used by the current hyperspectral panel.
- `appendHyperLineTrace(...)` is panel-specific.
  - It appends items into `state.hyperClickedTraces`.
  - It triggers `snapshotCurrentRunHyperClickedTraces()` and `renderHyperExtraPlots()`.

## Minimal embedding patterns

### 1. If another tab only needs line spectra data

Use `getHyperLineTracePayload(...)`.

```js
const payload = await getHyperLineTracePayload(
  hyperPath,
  { x: 10, y: 20 },
  { x: 80, y: 20 },
  { thickness: 3 }
);

// payload.x -> shared spectral axis
// payload.traces[i].trace -> spectrum at each sampled line pixel
```

This path is safest when the new panel has its own chart or table renderer.

### 2. If another tab wants the same clicked-trace item format

Use `buildHyperLineTraceItems(...)`.

```js
const payload = await getHyperLineTracePayload(hyperPath, start, end, { thickness: 3 });
const items = buildHyperLineTraceItems(hyperPath, payload, {
  runId: state.selectedRunId,
  start,
  end,
});
```

Each returned item matches the structure already consumed by:

- `renderHyperExtraPlots()`
- `buildHyperClickGroups()`
- `getHyperLineHeatmapData()`

### 3. If another tab intentionally wants the current hyperspectral-tab behavior

Call `appendHyperLineTrace(...)` directly.

Use this only if the new UI is supposed to share:

- `state.hyperClickedTraces`
- the current export buttons
- the current spectra/heatmap rendering rules

## Coordinate expectations

- `start` and `end` are source-image pixel coordinates.
- Do not pass canvas coordinates directly.
- If the caller starts from mouse events on a hyperspectral preview canvas, convert them first with the same source-space mapping used by:
  - `getHyperPixelFromEvent(...)`
  - `getHyperPixelFromLocal(...)`

## Payload shape

`getHyperLineTracePayload(...)` returns the backend payload plus fallback metadata when applicable.

- `x`: shared spectral axis
- `x_label`, `x_unit`: axis metadata
- `start_x`, `start_y`, `end_x`, `end_y`: clamped line endpoints
- `thickness`: actual averaging thickness
- `traces`: ordered samples along the line
- `traces[n].pixel_x`, `traces[n].pixel_y`: sampled pixel
- `traces[n].trace`: extracted spectrum
- `traces[n].average_count`: number of band pixels averaged into that sample
- `fallback`: true only when the browser had to reconstruct the line trace without `/api/hyper-line-trace`

## State coupling to avoid by default

If the new panel is meant to be independent, avoid depending on these directly:

- `state.hyperClickedTraces`
- `state.hyperLine`
- `state.hyperMode`
- `renderHyperExtraPlots()`

Those belong to the current hyperspectral-tab interaction model, not to the extraction primitive itself.
