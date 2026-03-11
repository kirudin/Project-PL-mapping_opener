# Reusable Plot Axis Zoom

This file extracts the axis zoom logic used in the PL Mapping Viewer so it can be reused in other browser-based canvas plots.

## What it does

- Drag on the x-axis area to zoom x only
- Drag on the y-axis area to zoom y only
- Double-click to reset
- Keep the original data bounds so zoom stays clamped

## Core State

```js
const zoomState = {
  axisZoomDrag: null,
  currentView: null,
  plotGeometry: null,
};
```

## Plot Geometry Returned From Draw

Your drawing function should return these values:

```js
function drawPlot(canvas, bundles, options = {}) {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 320;
  const padding = { top: 20, right: 24, bottom: 48, left: 62 };

  let xMin = options.xMin;
  let xMax = options.xMax;
  let yMin = options.yMin;
  let yMax = options.yMax;

  if (options.view) {
    xMin = options.view.xMin;
    xMax = options.view.xMax;
    yMin = options.view.yMin;
    yMax = options.view.yMax;
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const invX = (px) => xMin + ((px - padding.left) / innerWidth) * (xMax - xMin);
  const invY = (py) => yMin + ((padding.top + innerHeight - py) / innerHeight) * (yMax - yMin);

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    padding,
    innerWidth,
    innerHeight,
    invX,
    invY,
    dataBounds: { xMin: options.xMin, xMax: options.xMax, yMin: options.yMin, yMax: options.yMax },
    canvas,
  };
}
```

## Axis Hit Test

```js
function axisZoomHit(event, geometry, target) {
  if (!geometry) return null;
  const rect = geometry.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const inXBand =
    x >= geometry.padding.left &&
    x <= geometry.padding.left + geometry.innerWidth &&
    y >= geometry.padding.top + geometry.innerHeight &&
    y <= geometry.padding.top + geometry.innerHeight + 28;

  const inYBand =
    x >= 0 &&
    x <= geometry.padding.left &&
    y >= geometry.padding.top &&
    y <= geometry.padding.top + geometry.innerHeight;

  if (inXBand) return { target, axis: "x", startPx: x, currentPx: x };
  if (inYBand) return { target, axis: "y", startPx: y, currentPx: y };
  return null;
}
```

## Clamp View

```js
function clampView(view, bounds) {
  return {
    xMin: Math.max(bounds.xMin, Math.min(bounds.xMax, view.xMin)),
    xMax: Math.max(bounds.xMin, Math.min(bounds.xMax, view.xMax)),
    yMin: Math.max(bounds.yMin, Math.min(bounds.yMax, view.yMin)),
    yMax: Math.max(bounds.yMin, Math.min(bounds.yMax, view.yMax)),
  };
}
```

## Apply Zoom

```js
function applyAxisZoom(drag, geometry, currentView) {
  if (!drag || !geometry) return currentView;

  const bounds = geometry.dataBounds;

  if (drag.axis === "x") {
    const left = Math.min(drag.startPx, drag.currentPx);
    const right = Math.max(drag.startPx, drag.currentPx);
    if (Math.abs(right - left) < 8) return currentView;

    return clampView(
      {
        xMin: geometry.invX(left),
        xMax: geometry.invX(right),
        yMin: currentView?.yMin ?? bounds.yMin,
        yMax: currentView?.yMax ?? bounds.yMax,
      },
      bounds
    );
  }

  const top = Math.min(drag.startPx, drag.currentPx);
  const bottom = Math.max(drag.startPx, drag.currentPx);
  if (Math.abs(bottom - top) < 8) return currentView;

  return clampView(
    {
      xMin: currentView?.xMin ?? bounds.xMin,
      xMax: currentView?.xMax ?? bounds.xMax,
      yMin: geometry.invY(bottom),
      yMax: geometry.invY(top),
    },
    bounds
  );
}
```

## Optional Drag Overlay

Draw this during dragging:

```js
function drawAxisZoomOverlay(ctx, geometry, drag) {
  if (!drag || !geometry) return;

  ctx.strokeStyle = "rgba(255, 179, 71, 0.95)";
  ctx.fillStyle = "rgba(255, 179, 71, 0.14)";

  if (drag.axis === "x") {
    const left = Math.min(drag.startPx, drag.currentPx);
    const widthPx = Math.abs(drag.currentPx - drag.startPx);
    ctx.fillRect(left, geometry.padding.top, widthPx, geometry.innerHeight);
    ctx.strokeRect(left, geometry.padding.top, widthPx, geometry.innerHeight);
    return;
  }

  const top = Math.min(drag.startPx, drag.currentPx);
  const heightPx = Math.abs(drag.currentPx - drag.startPx);
  ctx.fillRect(geometry.padding.left, top, geometry.innerWidth, heightPx);
  ctx.strokeRect(geometry.padding.left, top, geometry.innerWidth, heightPx);
}
```

## Event Wiring

```js
canvas.addEventListener("mousedown", (event) => {
  const drag = axisZoomHit(event, zoomState.plotGeometry, "my-plot");
  if (drag) zoomState.axisZoomDrag = drag;
});

canvas.addEventListener("mousemove", (event) => {
  if (!zoomState.axisZoomDrag) return;
  const rect = canvas.getBoundingClientRect();
  zoomState.axisZoomDrag.currentPx =
    zoomState.axisZoomDrag.axis === "x"
      ? event.clientX - rect.left
      : event.clientY - rect.top;
  render();
});

window.addEventListener("mouseup", () => {
  if (!zoomState.axisZoomDrag) return;
  zoomState.currentView = applyAxisZoom(
    zoomState.axisZoomDrag,
    zoomState.plotGeometry,
    zoomState.currentView
  );
  zoomState.axisZoomDrag = null;
  render();
});

canvas.addEventListener("dblclick", () => {
  zoomState.currentView = null;
  render();
});
```

## Render Pattern

```js
function render() {
  zoomState.plotGeometry = drawPlot(canvas, bundles, {
    xMin: originalXMin,
    xMax: originalXMax,
    yMin: originalYMin,
    yMax: originalYMax,
    view: zoomState.currentView,
  });
}
```

## Notes

- `dataBounds` should always be the full original range, not the current zoomed range.
- `currentView` should be stored separately and passed back into the draw function.
- The x-axis drag band is below the plot; the y-axis drag band is left of the plot.
- The `8px` threshold avoids accidental zoom from tiny drags.

## Source In This Project

If you want the live implementation, see:

- `/Users/hwijewoo/Desktop/Project-PL mapping_opener/pl_mapping_static/app.js`

Key functions there:

- `axisZoomHit(...)`
- `clampView(...)`
- `applyAxisZoom(...)`
- `drawPlot(...)`
