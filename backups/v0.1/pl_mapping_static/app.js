const state = {
  selectedFile: null,
  selectedPath: null,
  gridWidth: null,
  gridHeight: null,
  currentPreview: null,
  clickedTraces: [],
  traceCache: new Map(),
  imageCache: new Map(),
  hoverGuide: null,
  meanHoverGuide: null,
  selection: {
    type: "point",
    targetWavelength: 0,
    startWavelength: 0,
    endWavelength: 0,
  },
  meanDrag: null,
  meanDragMoved: false,
  clickedDrag: null,
  clickedDragMoved: false,
  meanPlotGeometry: null,
  clickedPlotGeometry: null,
  meanView: null,
  clickedView: null,
  axisZoomDrag: null,
  imageView: { zoom: 1, offsetX: 0, offsetY: 0 },
  imagePan: null,
  imagePanMoved: false,
  imageToastTimer: null,
  plotRenderScheduled: false,
  activeTab: "viewer",
  multiSnapshots: [],
};

const STORAGE_KEY = "pl-mapping-viewer-state-v1";

const heatmapScratchCanvas = document.createElement("canvas");
const heatmapScratchCtx = heatmapScratchCanvas.getContext("2d");

const els = {
  datasetMeta: document.getElementById("dataset-meta"),
  appError: document.getElementById("app-error"),
  uiTheme: document.getElementById("ui-theme"),
  browserPath: document.getElementById("browser-path"),
  pickFileButton: document.getElementById("pick-file-button"),
  pickFileInput: document.getElementById("pick-file-input"),
  fileList: document.getElementById("file-list"),
  imageMode: document.getElementById("image-mode"),
  rangeStart: document.getElementById("range-start"),
  rangeEnd: document.getElementById("range-end"),
  rangeLabel: document.getElementById("range-label"),
  gridWidth: document.getElementById("grid-width"),
  gridHeight: document.getElementById("grid-height"),
  gridHint: document.getElementById("grid-hint"),
  scanSizeX: document.getElementById("scan-size-x"),
  scanSizeY: document.getElementById("scan-size-y"),
  scanUnit: document.getElementById("scan-unit"),
  imageLow: document.getElementById("image-low"),
  imageHigh: document.getElementById("image-high"),
  imageRangeLabel: document.getElementById("image-range-label"),
  imageLowValue: document.getElementById("image-low-value"),
  imageHighValue: document.getElementById("image-high-value"),
  colorMap: document.getElementById("color-map"),
  invertColormap: document.getElementById("invert-colormap"),
  spectrumColorMap: document.getElementById("spectrum-color-map"),
  invertSpectrumColormap: document.getElementById("invert-spectrum-colormap"),
  spectrumBackground: document.getElementById("spectrum-background"),
  colorScale: document.getElementById("color-scale"),
  normalizeToggle: document.getElementById("normalize-toggle"),
  smoothToggle: document.getElementById("smooth-toggle"),
  smoothWindow: document.getElementById("smooth-window"),
  smoothPoly: document.getElementById("smooth-poly"),
  offsetRange: document.getElementById("offset-range"),
  offsetValue: document.getElementById("offset-value"),
  clearButton: document.getElementById("clear-button"),
  fileTitle: document.getElementById("file-title"),
  fileSubtitle: document.getElementById("file-subtitle"),
  imageTitle: document.getElementById("image-title"),
  imageSubtitle: document.getElementById("image-subtitle"),
  imageToast: document.getElementById("image-toast"),
  imageStage: document.getElementById("image-stage"),
  imageCanvas: document.getElementById("image-canvas"),
  imageCopy: document.getElementById("image-copy"),
  imageExportPng: document.getElementById("image-export-png"),
  imageExportCsv: document.getElementById("image-export-csv"),
  imageClear: document.getElementById("image-clear"),
  markerLayer: document.getElementById("marker-layer"),
  meanSubtitle: document.getElementById("mean-subtitle"),
  meanHover: document.getElementById("mean-hover"),
  meanCanvas: document.getElementById("mean-canvas"),
  meanCopy: document.getElementById("mean-copy"),
  meanExportPng: document.getElementById("mean-export-png"),
  meanExportCsv: document.getElementById("mean-export-csv"),
  resetMeanAxes: document.getElementById("reset-mean-axes"),
  clickedSubtitle: document.getElementById("clicked-subtitle"),
  clickedList: document.getElementById("clicked-list"),
  clickedHover: document.getElementById("clicked-hover"),
  clickedCanvas: document.getElementById("clicked-canvas"),
  clickedCopy: document.getElementById("clicked-copy"),
  clickedExportPng: document.getElementById("clicked-export-png"),
  clickedExportCsv: document.getElementById("clicked-export-csv"),
  resetClickedAxes: document.getElementById("reset-clicked-axes"),
  tabViewer: document.getElementById("tab-viewer"),
  tabMulti: document.getElementById("tab-multi"),
  viewerTab: document.getElementById("viewer-tab"),
  multiTab: document.getElementById("multi-tab"),
  sendToMulti: document.getElementById("send-to-multi"),
  clearMulti: document.getElementById("clear-multi"),
  multiGallery: document.getElementById("multi-gallery"),
  multiSubtitle: document.getElementById("multi-subtitle"),
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function showError(message) {
  els.appError.hidden = false;
  els.appError.textContent = String(message);
}

function clearError() {
  els.appError.hidden = true;
  els.appError.textContent = "";
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredState() {
  const payload = {
    selectedPath: state.selectedPath,
    selectedFile: state.selectedFile,
    selection: state.selection,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    scanSizeX: els.scanSizeX.value,
    scanSizeY: els.scanSizeY.value,
    scanUnit: els.scanUnit.value,
    imageMode: els.imageMode.value,
    imageLow: els.imageLow.value,
    imageHigh: els.imageHigh.value,
    uiTheme: els.uiTheme.value,
    colorMap: els.colorMap.value,
    invertColormap: els.invertColormap.checked,
    spectrumColorMap: els.spectrumColorMap.value,
    invertSpectrumColormap: els.invertSpectrumColormap.checked,
    spectrumBackground: els.spectrumBackground.value,
    colorScale: els.colorScale.value,
    normalizeToggle: els.normalizeToggle.checked,
    smoothToggle: els.smoothToggle.checked,
    smoothWindow: els.smoothWindow.value,
    smoothPoly: els.smoothPoly.value,
    offsetRange: els.offsetRange.value,
    clickedPixels: state.clickedTraces.map((trace) => ({ x: trace.pixelX, y: trace.pixelY })),
    meanView: state.meanView,
    clickedView: state.clickedView,
    activeTab: state.activeTab,
    multiSnapshots: state.multiSnapshots,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredState() {
  localStorage.removeItem(STORAGE_KEY);
}

function applyTheme(theme) {
  const safeTheme = ["bright", "dark", "skyblue", "rosered", "twilight"].includes(theme) ? theme : "bright";
  document.body.dataset.theme = safeTheme;
  els.uiTheme.value = safeTheme;
}

function setActiveTab(tab) {
  state.activeTab = tab === "multi" ? "multi" : "viewer";
  els.tabViewer.classList.toggle("active", state.activeTab === "viewer");
  els.tabMulti.classList.toggle("active", state.activeTab === "multi");
  els.viewerTab.classList.toggle("active", state.activeTab === "viewer");
  els.multiTab.classList.toggle("active", state.activeTab === "multi");
}

function exportCanvas(canvas, baseName) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${baseName}.png`;
  link.click();
}

function exportBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(text, baseName) {
  exportBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
}

function showImageToast(message) {
  if (state.imageToastTimer) {
    clearTimeout(state.imageToastTimer);
    state.imageToastTimer = null;
  }
  els.imageToast.textContent = message;
  els.imageToast.hidden = false;
  els.imageToast.style.display = "inline-flex";
  els.imageToast.classList.add("show");
  state.imageToastTimer = window.setTimeout(() => {
    els.imageToast.hidden = true;
    els.imageToast.style.display = "";
    els.imageToast.textContent = "";
    els.imageToast.classList.remove("show");
    state.imageToastTimer = null;
  }, 3000);
}

async function copyCanvas(canvas) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    showError("Clipboard image copy is not supported in this browser.");
    return;
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    showError("Could not copy image.");
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function copyDataUrlImage(dataUrl) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    showError("Clipboard image copy is not supported in this browser.");
    return;
  }
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}

function exportDataUrlImage(dataUrl, baseName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${baseName}.png`;
  link.click();
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function setCanvasSize(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function interpolateStops(value, stops) {
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [leftPos, leftColor] = stops[index];
    const [rightPos, rightColor] = stops[index + 1];
    if (value >= leftPos && value <= rightPos) {
      const local = (value - leftPos) / Math.max(1e-12, rightPos - leftPos);
      return [
        Math.round(leftColor[0] + (rightColor[0] - leftColor[0]) * local),
        Math.round(leftColor[1] + (rightColor[1] - leftColor[1]) * local),
        Math.round(leftColor[2] + (rightColor[2] - leftColor[2]) * local),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function turboColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(34.61 + clamped * (1172.33 + clamped * (-10793.56 + clamped * (33300.12 + clamped * (-38394.49 + clamped * 14825.05)))));
  const g = Math.round(23.31 + clamped * (557.33 + clamped * (1225.33 + clamped * (-3574.96 + clamped * (1073.77 + clamped * 707.56)))));
  const b = Math.round(27.2 + clamped * (3211.1 + clamped * (-15327.97 + clamped * (27814.0 + clamped * (-22569.18 + clamped * 6838.66)))));
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

function infernoColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 4]],
    [0.25, [87, 15, 109]],
    [0.5, [187, 55, 84]],
    [0.75, [249, 142, 8]],
    [1.0, [252, 255, 164]],
  ]);
}

function plasmaColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [13, 8, 135]],
    [0.25, [126, 3, 168]],
    [0.5, [203, 71, 119]],
    [0.75, [248, 149, 64]],
    [1.0, [240, 249, 33]],
  ]);
}

function magmaColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 4]],
    [0.25, [79, 18, 123]],
    [0.5, [183, 55, 121]],
    [0.75, [251, 140, 60]],
    [1.0, [252, 253, 191]],
  ]);
}

function viridisColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [68, 1, 84]],
    [0.25, [59, 82, 139]],
    [0.5, [33, 145, 140]],
    [0.75, [94, 201, 98]],
    [1.0, [253, 231, 37]],
  ]);
}

function cividisColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 34, 78]],
    [0.25, [47, 72, 110]],
    [0.5, [92, 110, 117]],
    [0.75, [149, 149, 105]],
    [1.0, [253, 234, 69]],
  ]);
}

function coolColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 255, 255]],
    [1.0, [255, 0, 255]],
  ]);
}

function grayColor(t) {
  const c = Math.round(Math.max(0, Math.min(1, t)) * 255);
  return [c, c, c];
}

function jetColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 131]],
    [0.2, [0, 60, 170]],
    [0.4, [5, 255, 255]],
    [0.6, [255, 255, 0]],
    [0.8, [250, 0, 0]],
    [1.0, [128, 0, 0]],
  ]);
}

function coolwarmColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [59, 76, 192]],
    [0.25, [120, 157, 242]],
    [0.5, [221, 221, 221]],
    [0.75, [242, 142, 120]],
    [1.0, [180, 4, 38]],
  ]);
}

function hotColor(t) {
  const c = Math.max(0, Math.min(1, t));
  const r = Math.min(1, 3 * c);
  const g = Math.min(1, Math.max(0, 3 * c - 1));
  const b = Math.min(1, Math.max(0, 3 * c - 2));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function afmhotColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 0]],
    [0.35, [140, 0, 0]],
    [0.7, [255, 120, 0]],
    [1.0, [255, 255, 180]],
  ]);
}

function rdbuColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [5, 48, 97]],
    [0.2, [33, 102, 172]],
    [0.5, [247, 247, 247]],
    [0.8, [214, 96, 77]],
    [1.0, [103, 0, 31]],
  ]);
}

function seismicColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 76]],
    [0.25, [0, 0, 255]],
    [0.5, [255, 255, 255]],
    [0.75, [255, 0, 0]],
    [1.0, [127, 0, 0]],
  ]);
}

function spectralColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [158, 1, 66]],
    [0.2, [213, 62, 79]],
    [0.4, [244, 109, 67]],
    [0.5, [255, 255, 191]],
    [0.7, [102, 194, 165]],
    [0.85, [50, 136, 189]],
    [1.0, [94, 79, 162]],
  ]);
}

function cubehelixColor(t) {
  return interpolateStops(Math.max(0, Math.min(1, t)), [
    [0.0, [0, 0, 0]],
    [0.25, [41, 88, 136]],
    [0.5, [124, 123, 120]],
    [0.75, [199, 153, 88]],
    [1.0, [255, 255, 255]],
  ]);
}

function mapColorByName(name, t, invert = false) {
  const mapped = invert ? 1 - t : t;
  if (name === "inferno") return infernoColor(mapped);
  if (name === "plasma") return plasmaColor(mapped);
  if (name === "magma") return magmaColor(mapped);
  if (name === "viridis") return viridisColor(mapped);
  if (name === "cividis") return cividisColor(mapped);
  if (name === "gray") return grayColor(mapped);
  if (name === "cool") return coolColor(mapped);
  if (name === "jet") return jetColor(mapped);
  if (name === "coolwarm") return coolwarmColor(mapped);
  if (name === "rdbu") return rdbuColor(mapped);
  if (name === "seismic") return seismicColor(mapped);
  if (name === "hot") return hotColor(mapped);
  if (name === "afmhot") return afmhotColor(mapped);
  if (name === "spectral") return spectralColor(mapped);
  if (name === "cubehelix") return cubehelixColor(mapped);
  return turboColor(mapped);
}

function colorToCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function plotBackgroundStops(name) {
  if (name === "transparent") return [null, null];
  if (name === "slate") return ["#2b3647", "#111827"];
  if (name === "graphite") return ["#30343f", "#171b24"];
  if (name === "ocean") return ["#16324a", "#081521"];
  if (name === "forest") return ["#1c3a32", "#0c1915"];
  if (name === "white") return ["#ffffff", "#f3f6fb"];
  return ["#182434", "#0a1422"];
}

function meanLineColorForBackground(name) {
  if (name === "transparent") return document.body.dataset.theme === "dark" ? "#ffd166" : "#1f3a5f";
  if (name === "slate") return "#ffd166";
  if (name === "graphite") return "#ffcf70";
  if (name === "ocean") return "#ffd6a5";
  if (name === "forest") return "#ffd6a5";
  if (name === "white") return "#2f4f6f";
  return "#ffcf70";
}

function plotThemeForBackground(name) {
  if (name === "transparent") {
    if (document.body.dataset.theme === "dark") {
      return {
        emptyText: "rgba(237, 244, 255, 0.72)",
        grid: "rgba(157, 177, 200, 0.18)",
        tick: "rgba(157, 177, 200, 0.28)",
        axisText: "rgba(237, 244, 255, 0.88)",
        hoverLine: "rgba(255,255,255,0.45)",
        hoverLabelBg: "rgba(8, 16, 26, 0.82)",
        hoverLabelBorder: "rgba(255, 255, 255, 0.18)",
        hoverLabelText: "rgba(237, 244, 255, 0.96)",
      };
    }
    return {
      emptyText: "rgba(31, 58, 95, 0.72)",
      grid: "rgba(31, 58, 95, 0.12)",
      tick: "rgba(31, 58, 95, 0.22)",
      axisText: "rgba(31, 58, 95, 0.92)",
      hoverLine: "rgba(31, 58, 95, 0.5)",
      hoverLabelBg: "rgba(255, 255, 255, 0.96)",
      hoverLabelBorder: "rgba(31, 58, 95, 0.18)",
      hoverLabelText: "rgba(31, 58, 95, 0.96)",
    };
  }
  if (name === "white") {
    return {
      emptyText: "rgba(31, 58, 95, 0.72)",
      grid: "rgba(31, 58, 95, 0.12)",
      tick: "rgba(31, 58, 95, 0.22)",
      axisText: "rgba(31, 58, 95, 0.92)",
      hoverLine: "rgba(31, 58, 95, 0.5)",
      hoverLabelBg: "rgba(255, 255, 255, 0.96)",
      hoverLabelBorder: "rgba(31, 58, 95, 0.18)",
        hoverLabelText: "rgba(31, 58, 95, 0.96)",
    };
  }
  return {
    emptyText: "rgba(237, 244, 255, 0.65)",
    grid: "rgba(157, 177, 200, 0.18)",
    tick: "rgba(157, 177, 200, 0.28)",
    axisText: "rgba(237, 244, 255, 0.82)",
    hoverLine: "rgba(255,255,255,0.45)",
    hoverLabelBg: "rgba(8, 16, 26, 0.82)",
    hoverLabelBorder: "rgba(255, 255, 255, 0.18)",
    hoverLabelText: "rgba(237, 244, 255, 0.96)",
  };
}

function clickedTraceColor(index, total) {
  if (total <= 10) {
    const fixedPalette = [
      "#ffb347",
      "#63c5da",
      "#ff7a90",
      "#b6e36d",
      "#c8a7ff",
      "#f4ef7c",
      "#7dd3fc",
      "#fdba74",
      "#86efac",
      "#f9a8d4",
    ];
    return fixedPalette[index % fixedPalette.length];
  }
  const t = total <= 1 ? 0.72 : index / Math.max(1, total - 1);
  return colorToCss(mapColorByName(els.spectrumColorMap.value, t, Boolean(els.invertSpectrumColormap.checked)));
}

function transformColorScale(value, mode) {
  const clamped = Math.max(0, Math.min(1, value));
  if (mode === "sqrt") return Math.sqrt(clamped);
  if (mode === "log") return Math.log10(1 + clamped * 9);
  return clamped;
}

function clampColorRange(lowPercent, highPercent) {
  const low = Math.max(0, Math.min(95, Number(lowPercent)));
  const high = Math.max(low + 1, Math.min(100, Number(highPercent)));
  return { low, high };
}

function resolveColorLimits(preview, lowPercent, highPercent, actualMinRaw, actualMaxRaw) {
  const autoMin = preview.min;
  const autoMax = preview.max;
  const actualMin = Number(actualMinRaw);
  const actualMax = Number(actualMaxRaw);
  if (Number.isFinite(actualMin) && Number.isFinite(actualMax) && actualMax > actualMin) {
    return { min: actualMin, max: actualMax, label: `${formatNumber(actualMin, 3)} - ${formatNumber(actualMax, 3)}` };
  }
  if (Number.isFinite(actualMin) && !Number.isFinite(actualMax)) {
    return { min: actualMin, max: autoMax, label: `${formatNumber(actualMin, 3)} - auto` };
  }
  if (!Number.isFinite(actualMin) && Number.isFinite(actualMax)) {
    return { min: autoMin, max: actualMax, label: `auto - ${formatNumber(actualMax, 3)}` };
  }
  const { low, high } = clampColorRange(lowPercent, highPercent);
  return {
    min: autoMin + ((autoMax - autoMin) * low) / 100,
    max: autoMin + ((autoMax - autoMin) * high) / 100,
    label: `${low}% - ${high}%`,
  };
}

function quantileColorLimits(preview, lowerQ = 0.0005, upperQ = 0.995) {
  const sorted = [...preview.values].sort((a, b) => a - b);
  const pick = (q) => {
    const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)));
    return sorted[index];
  };
  const min = pick(lowerQ);
  const max = pick(upperQ);
  return {
    min,
    max: max > min ? max : min + 1e-12,
    label: `${formatNumber(min, 3)} - ${formatNumber(max, 3)} (0.05%-99.5%)`,
  };
}

function effectiveQuantileLimits(preview, lowPercent, highPercent) {
  const base = quantileColorLimits(preview);
  const { low, high } = clampColorRange(lowPercent, highPercent);
  return {
    min: base.min + ((base.max - base.min) * low) / 100,
    max: base.min + ((base.max - base.min) * high) / 100,
    label: `${formatNumber(base.min, 3)} - ${formatNumber(base.max, 3)} base • ${low}% - ${high}%`,
  };
}

function drawEmptyCanvas(canvas, message) {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 280;
  const ctx = setCanvasSize(canvas, width, height);
  const [bgTop, bgBottom] = plotBackgroundStops("night");
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(237, 244, 255, 0.65)";
  ctx.font = '14px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function renderHeatmapToCanvas(
  canvas,
  preview,
  width,
  height,
  lowPercent,
  highPercent,
  actualMinRaw,
  actualMaxRaw,
  colorMapName,
  invertColormap,
  colorScaleMode
) {
  const ctx = setCanvasSize(canvas, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#182434");
  bg.addColorStop(1, "#0a1422");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (heatmapScratchCanvas.width !== preview.width) heatmapScratchCanvas.width = preview.width;
  if (heatmapScratchCanvas.height !== preview.height) heatmapScratchCanvas.height = preview.height;
  const image = heatmapScratchCtx.createImageData(preview.width, preview.height);
  const limits = resolveColorLimits(preview, lowPercent, highPercent, actualMinRaw, actualMaxRaw);
  const dataMin = limits.min;
  const dataMax = limits.max;
  const range = Math.max(1e-12, dataMax - dataMin);

  for (let index = 0; index < preview.values.length; index += 1) {
    const clipped = Math.max(dataMin, Math.min(dataMax, preview.values[index]));
    const normalized = (clipped - dataMin) / range;
    const transformed = transformColorScale(normalized, colorScaleMode);
    const color = mapColorByName(colorMapName, transformed, invertColormap);
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }

  heatmapScratchCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(width / heatmapScratchCanvas.width, height / heatmapScratchCanvas.height);
  const drawWidth = heatmapScratchCanvas.width * scale;
  const drawHeight = heatmapScratchCanvas.height * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  ctx.drawImage(heatmapScratchCanvas, drawX, drawY, drawWidth, drawHeight);
}

function renderHeatmapToOffscreenCanvas(preview, lowPercent, highPercent, actualMinRaw, actualMaxRaw, colorMapName, invertColormap, colorScaleMode) {
  const canvas = document.createElement("canvas");
  canvas.width = preview.width;
  canvas.height = preview.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(preview.width, preview.height);
  const limits = resolveColorLimits(preview, lowPercent, highPercent, actualMinRaw, actualMaxRaw);
  const dataMin = limits.min;
  const dataMax = limits.max;
  const range = Math.max(1e-12, dataMax - dataMin);
  for (let index = 0; index < preview.values.length; index += 1) {
    const clipped = Math.max(dataMin, Math.min(dataMax, preview.values[index]));
    const normalized = (clipped - dataMin) / range;
    const transformed = transformColorScale(normalized, colorScaleMode);
    const color = mapColorByName(colorMapName, transformed, invertColormap);
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function normalizeSeries(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-12, max - min);
  return values.map((value) => (value - min) / range);
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const a = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) maxRow = row;
    }
    if (Math.abs(a[maxRow][pivot]) < 1e-12) return null;
    if (maxRow !== pivot) [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];
    const pivotValue = a[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) a[pivot][col] /= pivotValue;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      for (let col = pivot; col <= size; col += 1) a[row][col] -= factor * a[pivot][col];
    }
  }
  return a.map((row) => row[size]);
}

function smoothSeries(values, rawWindow, rawPoly) {
  const length = values.length;
  let windowSize = Number(rawWindow);
  let polyOrder = Number(rawPoly);
  if (!Number.isInteger(windowSize)) windowSize = 7;
  if (!Number.isInteger(polyOrder)) polyOrder = 2;
  if (windowSize < 3) windowSize = 3;
  if (windowSize > length) windowSize = length;
  polyOrder = Math.max(1, Math.min(polyOrder, windowSize - 1));
  if (windowSize < 3 || windowSize <= polyOrder || windowSize > length) return values.slice();

  const half = Math.floor(windowSize / 2);
  const degreeCount = polyOrder + 1;
  const output = new Array(length);

  for (let center = 0; center < length; center += 1) {
    const start = Math.max(0, Math.min(length - windowSize, center - half));
    const xtx = Array.from({ length: degreeCount }, () => Array(degreeCount).fill(0));
    const xty = Array(degreeCount).fill(0);

    for (let localIndex = 0; localIndex < windowSize; localIndex += 1) {
      const sourceIndex = start + localIndex;
      const x = sourceIndex - center;
      const powers = Array(degreeCount).fill(1);
      for (let power = 1; power < degreeCount; power += 1) powers[power] = powers[power - 1] * x;
      for (let row = 0; row < degreeCount; row += 1) {
        xty[row] += powers[row] * values[sourceIndex];
        for (let col = 0; col < degreeCount; col += 1) xtx[row][col] += powers[row] * powers[col];
      }
    }

    const coefficients = solveLinearSystem(xtx, xty);
    output[center] = coefficients ? coefficients[0] : values[center];
  }

  return output;
}

function buildClickedBundles() {
  const normalize = els.normalizeToggle.checked;
  const smoothingEnabled = els.smoothToggle.checked;
  const smoothWindow = els.smoothWindow.value;
  const smoothPoly = els.smoothPoly.value;
  const offsetFactor = (Number(els.offsetRange.value) / 100) ** 2;

  return state.clickedTraces.map((trace, index) => {
    let yValues = trace.y.slice();
    if (smoothingEnabled) yValues = smoothSeries(yValues, smoothWindow, smoothPoly);
    if (normalize) yValues = normalizeSeries(yValues);
    const localRange = Math.max(1e-12, Math.max(...yValues) - Math.min(...yValues));
    yValues = yValues.map((value) => value + index * localRange * offsetFactor);
    return { label: trace.label, x: trace.x.slice(), y: yValues, strokeColor: clickedTraceColor(index, state.clickedTraces.length) };
  });
}

function drawPlot(canvas, bundles, xLabel, options = {}) {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 280;
  const ctx = setCanvasSize(canvas, width, height);
  const padding = { top: 20, right: 24, bottom: 48, left: 62 };

  const [bgTop, bgBottom] = plotBackgroundStops(options.backgroundName || "night");
  const theme = plotThemeForBackground(options.backgroundName || "night");
  if (bgTop && bgBottom) {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, bgTop);
    bg.addColorStop(1, bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  if (!bundles.length) {
    ctx.fillStyle = theme.emptyText;
    ctx.font = '14px "Avenir Next", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("No spectra loaded.", width / 2, height / 2);
    return null;
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  bundles.forEach((bundle) => {
    bundle.x.forEach((value) => {
      xMin = Math.min(xMin, value);
      xMax = Math.max(xMax, value);
    });
    bundle.y.forEach((value) => {
      yMin = Math.min(yMin, value);
      yMax = Math.max(yMax, value);
    });
  });
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) return null;
  if (xMin === xMax) xMax += 1;
  if (yMin === yMax) yMax += 1;
  const dataBounds = { xMin, xMax, yMin, yMax };
  if (options.view) {
    xMin = options.view.xMin;
    xMax = options.view.xMax;
    yMin = options.view.yMin;
    yMax = options.view.yMax;
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const mapX = (value) => padding.left + ((value - xMin) / (xMax - xMin)) * innerWidth;
  const mapY = (value) => padding.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
  const invX = (px) => xMin + ((px - padding.left) / innerWidth) * (xMax - xMin);
  const invY = (py) => yMin + ((padding.top + innerHeight - py) / innerHeight) * (yMax - yMin);

  ctx.strokeStyle = theme.grid;
  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (innerHeight * step) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  if (Number.isFinite(options.rangeStart) && Number.isFinite(options.rangeEnd)) {
    const rawStartX = mapX(Math.min(options.rangeStart, options.rangeEnd));
    const rawEndX = mapX(Math.max(options.rangeStart, options.rangeEnd));
    const plotLeft = padding.left;
    const plotRight = padding.left + innerWidth;
    const startX = Math.max(plotLeft, Math.min(plotRight, rawStartX));
    const endX = Math.max(plotLeft, Math.min(plotRight, rawEndX));
    const bandWidth = Math.max(0, endX - startX);
    if (bandWidth > 0) {
      ctx.fillStyle = "rgba(99, 197, 218, 0.22)";
      ctx.fillRect(startX, padding.top, bandWidth, innerHeight);
    }
  }

  bundles.forEach((bundle, index) => {
    const t = bundles.length === 1 ? 0.72 : index / Math.max(1, bundles.length - 1);
    const strokeColor =
      bundle.strokeColor ||
      options.singleColor ||
      colorToCss(mapColorByName(options.colorMapName || "turbo", t, Boolean(options.invertColormap)));
    ctx.beginPath();
    bundle.x.forEach((xValue, pointIndex) => {
      const px = mapX(xValue);
      const py = mapY(bundle.y[pointIndex]);
      if (pointIndex === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });

  if (Number.isFinite(options.selectionGuideX)) {
    const guideX = mapX(options.selectionGuideX);
    ctx.beginPath();
    ctx.moveTo(guideX, padding.top);
    ctx.lineTo(guideX, padding.top + innerHeight);
    ctx.strokeStyle = "rgba(99, 197, 218, 0.95)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (Number.isFinite(options.hoverGuideX)) {
    const guideX = mapX(options.hoverGuideX);
    ctx.beginPath();
    ctx.moveTo(guideX, padding.top);
    ctx.lineTo(guideX, padding.top + innerHeight);
    ctx.strokeStyle = theme.hoverLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    const label = `${formatNumber(options.hoverGuideX, 2)} nm`;
    ctx.font = '11px "Avenir Next", sans-serif';
    const labelWidth = Math.ceil(ctx.measureText(label).width) + 12;
    const labelX = Math.max(padding.left, Math.min(width - padding.right - labelWidth, guideX - labelWidth / 2));
    const labelY = padding.top + 8;
    ctx.fillStyle = theme.hoverLabelBg;
    ctx.strokeStyle = theme.hoverLabelBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, 20, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.hoverLabelText;
    ctx.textAlign = "center";
    ctx.fillText(label, labelX + labelWidth / 2, labelY + 14);
  }

  if (options.axisZoomDrag) {
    ctx.strokeStyle = "rgba(255, 179, 71, 0.95)";
    ctx.fillStyle = "rgba(255, 179, 71, 0.14)";
    if (options.axisZoomDrag.axis === "x") {
      const left = Math.min(options.axisZoomDrag.startPx, options.axisZoomDrag.currentPx);
      const widthPx = Math.abs(options.axisZoomDrag.currentPx - options.axisZoomDrag.startPx);
      ctx.fillRect(left, padding.top, widthPx, innerHeight);
      ctx.strokeRect(left, padding.top, widthPx, innerHeight);
    } else if (options.axisZoomDrag.axis === "y") {
      const top = Math.min(options.axisZoomDrag.startPx, options.axisZoomDrag.currentPx);
      const heightPx = Math.abs(options.axisZoomDrag.currentPx - options.axisZoomDrag.startPx);
      ctx.fillRect(padding.left, top, innerWidth, heightPx);
      ctx.strokeRect(padding.left, top, innerWidth, heightPx);
    }
  }

  ctx.fillStyle = theme.axisText;
  ctx.font = '11px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  for (let step = 0; step <= 4; step += 1) {
    const value = xMin + ((xMax - xMin) * step) / 4;
    const x = padding.left + (innerWidth * step) / 4;
    ctx.beginPath();
    ctx.moveTo(x, padding.top + innerHeight);
    ctx.lineTo(x, padding.top + innerHeight + 6);
    ctx.strokeStyle = theme.tick;
    ctx.stroke();
    ctx.fillText(formatNumber(value, 1), x, padding.top + innerHeight + 18);
  }

  ctx.textAlign = "right";
  for (let step = 0; step <= 4; step += 1) {
    const value = yMin + ((yMax - yMin) * (4 - step)) / 4;
    const y = padding.top + (innerHeight * step) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left - 6, y);
    ctx.lineTo(padding.left, y);
    ctx.strokeStyle = theme.tick;
    ctx.stroke();
    ctx.fillText(formatNumber(value, 1), padding.left - 10, y + 4);
  }

  ctx.fillStyle = theme.axisText;
  ctx.font = '12px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(xLabel, padding.left + innerWidth / 2, height - 14);

  return { xMin, xMax, yMin, yMax, padding, innerWidth, innerHeight, invX, invY, dataBounds, canvas };
}

function getSelectedFile() {
  return state.selectedFile;
}

function updateImageRangeLabel() {
  if (state.currentPreview) {
    const limits = effectiveQuantileLimits(state.currentPreview, els.imageLow.value, els.imageHigh.value);
    els.imageRangeLabel.textContent = limits.label;
    return;
  }
  const { low, high } = clampColorRange(els.imageLow.value, els.imageHigh.value);
  els.imageRangeLabel.textContent = `${low}% - ${high}%`;
}

function updateActualColorInputs(preview) {
  if (!preview) return;
  const limits = effectiveQuantileLimits(preview, els.imageLow.value, els.imageHigh.value);
  els.imageLowValue.value = String(Number(limits.min.toFixed(6)));
  els.imageHighValue.value = String(Number(limits.max.toFixed(6)));
}

function updateOffsetLabel() {
  const mapped = (Number(els.offsetRange.value) / 100) ** 2;
  els.offsetValue.textContent = `${mapped.toFixed(3)}x`;
}

function defaultSmoothWindow(length) {
  if (!Number.isFinite(length) || length < 3) return 3;
  let windowSize = Math.round(length * 0.05);
  if (windowSize < 3) windowSize = 3;
  if (windowSize > length) windowSize = length;
  return Math.max(3, windowSize);
}

function sanitizeSmoothInputs() {
  let windowSize = Number(els.smoothWindow.value);
  let polyOrder = Number(els.smoothPoly.value);
  if (!Number.isInteger(windowSize) || windowSize < 3) windowSize = 3;
  const sliceCount = state.selectedFile?.slice_count;
  if (Number.isFinite(sliceCount) && windowSize > sliceCount) windowSize = sliceCount;
  polyOrder = Math.max(1, Number.isInteger(polyOrder) ? polyOrder : 2);
  if (polyOrder >= windowSize) polyOrder = windowSize - 1;
  els.smoothWindow.value = String(windowSize);
  els.smoothPoly.value = String(polyOrder);
}

function getGridDimensions() {
  const width = Number(els.gridWidth.value);
  const height = Number(els.gridHeight.value);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function syncGridInputsFromState() {
  els.gridWidth.value = state.gridWidth ? String(state.gridWidth) : "0";
  els.gridHeight.value = state.gridHeight ? String(state.gridHeight) : "0";
}

function syncRangeInputs() {
  els.rangeStart.value = formatNumber(state.selection.startWavelength, 2);
  els.rangeEnd.value = formatNumber(state.selection.endWavelength, 2);
  updateRangeLabel();
}

function updateRangeLabel() {
  if (state.selection.type === "point") {
    els.rangeLabel.textContent = `Point: ${formatNumber(state.selection.targetWavelength, 2)} nm`;
  } else {
    els.rangeLabel.textContent = `Range: ${formatNumber(state.selection.startWavelength, 2)} - ${formatNumber(state.selection.endWavelength, 2)} nm`;
  }
}

function scanSizeText() {
  const sizeX = Number(els.scanSizeX.value);
  const sizeY = Number(els.scanSizeY.value);
  if (!(sizeX > 0 && sizeY > 0)) return "";
  return `${formatNumber(sizeX, 2)} x ${formatNumber(sizeY, 2)} ${els.scanUnit.value}`;
}

function updateGridHint() {
  if (!state.selectedFile) {
    els.gridHint.textContent = "Square maps are inferred automatically.";
    return;
  }
  if (state.selectedFile.requires_manual_dimensions) {
    els.gridHint.textContent = `Manual input required. X * Y must equal ${state.selectedFile.pixel_count}. Wavelengths: ${state.selectedFile.slice_count}.`;
    return;
  }
  els.gridHint.textContent = `Square map inferred: ${state.selectedFile.width} x ${state.selectedFile.height}. Wavelengths: ${state.selectedFile.slice_count}.`;
}

function syncSmoothDefaults(force = false) {
  const sliceCount = state.selectedFile?.slice_count;
  if (!Number.isFinite(sliceCount) || sliceCount < 3) return;
  const targetWindow = defaultSmoothWindow(sliceCount);
  if (force || !Number(els.smoothWindow.value) || Number(els.smoothWindow.value) < 3) {
    els.smoothWindow.value = String(targetWindow);
  }
  let polyOrder = Number(els.smoothPoly.value);
  if (!Number.isInteger(polyOrder) || polyOrder < 1) polyOrder = 2;
  if (polyOrder >= Number(els.smoothWindow.value)) polyOrder = Math.max(1, Number(els.smoothWindow.value) - 1);
  els.smoothPoly.value = String(polyOrder);
}

function renderSelectedFileSummary() {
  if (!state.selectedFile) {
    els.browserPath.textContent = "No file selected.";
    els.fileList.className = "file-list empty";
    els.fileList.textContent = "Choose a pickle file from Finder.";
    updateGridHint();
    return;
  }
  const dims = getGridDimensions();
  const width = dims?.width || state.selectedFile.width;
  const height = dims?.height || state.selectedFile.height;
  els.browserPath.textContent = "File loaded.";
  els.fileList.className = "file-list";
  els.fileList.innerHTML = `
    <div class="file-item active">
      <strong>Loaded dataset</strong>
      <span>${width} x ${height} pixels • ${state.selectedFile.slice_count} wavelengths • ${formatBytes(state.selectedFile.size_bytes)}</span>
    </div>
  `;
  updateGridHint();
}

function currentImageSummary() {
  if (!state.selectedFile || !state.currentPreview) return null;
  const dims = getGridDimensions();
  const width = dims?.width || state.selectedFile.width;
  const height = dims?.height || state.selectedFile.height;
  const modeText = els.imageMode.value === "mean" ? "Range Mean" : "Range Sum";
  const selectionText =
    state.selection.type === "point"
      ? `${formatNumber(state.selection.targetWavelength, 2)} nm`
      : `${formatNumber(state.selection.startWavelength, 2)}-${formatNumber(state.selection.endWavelength, 2)} nm`;
  return {
    title: state.selectedFile.name,
    subtitle: `${width} x ${height} px • ${modeText} • ${selectionText}`,
    detail: `${els.colorMap.options[els.colorMap.selectedIndex].text} • ${els.colorScale.value}${els.invertColormap.checked ? " • inverted" : ""}`,
  };
}

function imagePreviewCsv(preview) {
  const rows = ["x,y,value"];
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      const value = preview.values[y * preview.width + x];
      rows.push(`${x},${y},${value}`);
    }
  }
  return rows.join("\n");
}

function tracesToCsv(bundles) {
  if (!bundles.length) return "wavelength";
  const length = bundles[0].x.length;
  const header = ["wavelength", ...bundles.map((bundle) => bundle.label)];
  const rows = [header.map(csvEscape).join(",")];
  for (let index = 0; index < length; index += 1) {
    const row = [bundles[0].x[index], ...bundles.map((bundle) => bundle.y[index])];
    rows.push(row.map(csvEscape).join(","));
  }
  return rows.join("\n");
}

function renderMultiGallery() {
  if (!state.multiSnapshots.length) {
    els.multiGallery.innerHTML = '<div class="multi-empty">No saved images yet.</div>';
    els.multiSubtitle.textContent = "Saved snapshots of the current image.";
    return;
  }
  els.multiSubtitle.textContent = `${state.multiSnapshots.length} saved image(s).`;
  els.multiGallery.innerHTML = state.multiSnapshots
    .map(
      (item, index) => `
        <article class="multi-card">
          <img src="${item.dataUrl}" alt="${item.title}">
          <strong>${item.title}</strong>
          <p>${item.subtitle}</p>
          <p>${item.detail}</p>
          <div class="panel-actions multi-card-actions">
            <button class="multi-copy" type="button" data-index="${index}">Copy</button>
            <button class="multi-export-png" type="button" data-index="${index}">PNG</button>
            <button class="multi-export-csv" type="button" data-index="${index}">CSV</button>
            <button class="multi-remove" type="button" data-index="${index}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
  els.multiGallery.querySelectorAll(".multi-copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);
      try {
        await copyDataUrlImage(state.multiSnapshots[index].dataUrl);
      } catch (error) {
        showError(`Copy failed:\n${error}`);
      }
    });
  });
  els.multiGallery.querySelectorAll(".multi-export-png").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const item = state.multiSnapshots[index];
      exportDataUrlImage(item.dataUrl, `${item.title}-multi`);
    });
  });
  els.multiGallery.querySelectorAll(".multi-export-csv").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const item = state.multiSnapshots[index];
      const lines = [
        "field,value",
        `title,${csvEscape(item.title)}`,
        `subtitle,${csvEscape(item.subtitle)}`,
        `detail,${csvEscape(item.detail)}`,
      ];
      exportCsv(lines.join("\n"), `${item.title}-multi`);
    });
  });
  els.multiGallery.querySelectorAll(".multi-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      state.multiSnapshots.splice(index, 1);
      renderMultiGallery();
      writeStoredState();
    });
  });
}

function buildImageRequest(path) {
  const params = new URLSearchParams({
    path,
    mode: els.imageMode.value,
    selection: state.selection.type,
    target_wavelength: String(state.selection.targetWavelength),
    start_wavelength: String(state.selection.startWavelength),
    end_wavelength: String(state.selection.endWavelength),
  });
  const dims = getGridDimensions();
  if (dims) {
    params.set("grid_width", String(dims.width));
    params.set("grid_height", String(dims.height));
  }
  return `/api/pl-image?${params.toString()}`;
}

async function fetchImagePayload(path) {
  const dims = getGridDimensions();
  const key = `${path}::${dims?.width || "auto"}::${dims?.height || "auto"}::${els.imageMode.value}::${state.selection.type}::${state.selection.targetWavelength}::${state.selection.startWavelength}::${state.selection.endWavelength}`;
  if (state.imageCache.has(key)) return state.imageCache.get(key);
  const payload = await fetchJson(buildImageRequest(path));
  state.imageCache.set(key, payload);
  return payload;
}

async function loadTrace(path, x, y) {
  const dims = getGridDimensions();
  const key = `${path}::${dims?.width || "auto"}::${dims?.height || "auto"}::${x}::${y}`;
  if (state.traceCache.has(key)) return state.traceCache.get(key);
  const params = new URLSearchParams({
    path,
    x: String(x),
    y: String(y),
  });
  if (dims) {
    params.set("grid_width", String(dims.width));
    params.set("grid_height", String(dims.height));
  }
  const payload = await fetchJson(`/api/pl-trace?${params.toString()}`);
  state.traceCache.set(key, payload);
  return payload;
}

function getMapLayout(preview) {
  if (!preview) return null;
  const stageRect = els.imageStage.getBoundingClientRect();
  const canvasRect = els.imageCanvas.getBoundingClientRect();
  const scale = Math.min(canvasRect.width / preview.width, canvasRect.height / preview.height);
  const drawWidth = preview.width * scale;
  const drawHeight = preview.height * scale;
  const drawLeft = canvasRect.left - stageRect.left + (canvasRect.width - drawWidth) / 2;
  const drawTop = canvasRect.top - stageRect.top + (canvasRect.height - drawHeight) / 2;
  return { stageRect, drawLeft, drawTop, drawWidth, drawHeight };
}

function getPixelFromEvent(event) {
  const preview = state.currentPreview;
  const layout = getMapLayout(preview);
  if (!preview || !layout) return null;
  const localX = event.clientX - layout.stageRect.left;
  const localY = event.clientY - layout.stageRect.top;
  const relX = (localX - layout.drawLeft) / Math.max(1, layout.drawWidth);
  const relY = (localY - layout.drawTop) / Math.max(1, layout.drawHeight);
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
  const x = Math.max(0, Math.min(preview.source_width - 1, Math.round(relX * (preview.source_width - 1))));
  const y = Math.max(0, Math.min(preview.source_height - 1, Math.round(relY * (preview.source_height - 1))));
  return { x, y };
}

function renderMarkers() {
  const preview = state.currentPreview;
  const layout = getMapLayout(preview);
  els.markerLayer.innerHTML = "";
  if (!preview || !layout) return;
  state.clickedTraces.forEach((trace, index) => {
    const marker = document.createElement("div");
    marker.className = "pixel-marker";
    marker.textContent = String(index + 1);
    marker.style.background = clickedTraceColor(index, state.clickedTraces.length);
    marker.style.left = `${layout.drawLeft + ((trace.pixelX + 0.5) / preview.source_width) * layout.drawWidth}px`;
    marker.style.top = `${layout.drawTop + ((trace.pixelY + 0.5) / preview.source_height) * layout.drawHeight}px`;
    els.markerLayer.appendChild(marker);
  });
}

async function renderPreview() {
  const file = getSelectedFile();
  if (!file) return;
  if (file.requires_manual_dimensions && !getGridDimensions()) {
    state.currentPreview = null;
    drawEmptyCanvas(els.imageCanvas, "Enter X pixels and Y pixels.");
    showError(`This file has ${file.pixel_count} pixels. Enter X pixels and Y pixels first.`);
    return;
  }
  try {
    const payload = await fetchImagePayload(state.selectedPath);
    state.currentPreview = payload;
    const autoLimits = effectiveQuantileLimits(payload, els.imageLow.value, els.imageHigh.value);
    els.imageLowValue.value = String(Number(autoLimits.min.toFixed(6)));
    els.imageHighValue.value = String(Number(autoLimits.max.toFixed(6)));
    els.imageTitle.textContent = file.name;
    if (payload.selection === "range") {
      els.imageSubtitle.textContent = `${payload.mode === "mean" ? "Range mean" : "Range sum"} • ${formatNumber(payload.range_start_wavelength, 2)} - ${formatNumber(payload.range_end_wavelength, 2)} nm`;
    } else {
      els.imageSubtitle.textContent = `Single wavelength • ${formatNumber(payload.target_wavelength, 2)} nm`;
    }
  renderHeatmapToCanvas(
    els.imageCanvas,
    payload,
    Math.max(320, els.imageStage.clientWidth - 2),
    Math.max(420, Math.round((els.imageStage.clientWidth - 2) * 0.7)),
    els.imageLow.value,
    els.imageHigh.value,
    autoLimits.min,
    autoLimits.max,
    els.colorMap.value,
    els.invertColormap.checked,
    els.colorScale.value
  );
  updateImageRangeLabel();
  renderMarkers();
  } catch (error) {
    drawEmptyCanvas(els.imageCanvas, "Failed to render image.");
    showError(`Image render failed:\n${error}`);
    throw error;
  }
}

function renderClickedList() {
  els.clickedList.innerHTML = "";
  state.clickedTraces.forEach((trace) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${trace.label}</span><button type="button" aria-label="Remove ${trace.label}">x</button>`;
    chip.querySelector("button").addEventListener("click", async () => {
      state.clickedTraces = state.clickedTraces.filter((item) => item.label !== trace.label);
      renderClickedList();
      renderMarkers();
      await renderMeanAndClickedPlots();
    });
    els.clickedList.appendChild(chip);
  });
}

function schedulePlotRender() {
  if (state.plotRenderScheduled) return;
  state.plotRenderScheduled = true;
  window.requestAnimationFrame(() => {
    state.plotRenderScheduled = false;
    renderMeanAndClickedPlots().catch((error) => console.warn("Failed to rerender plots", error));
  });
}

async function renderMeanAndClickedPlots() {
  const file = getSelectedFile();
  if (!file) return;
  try {
    const meanPayload = await loadTrace(file.path, 0, 0);
    const selectionGuideX = state.selection.type === "point" ? state.selection.targetWavelength : null;
    const rangeStart = state.selection.type === "range" ? state.selection.startWavelength : null;
    const rangeEnd = state.selection.type === "range" ? state.selection.endWavelength : null;
    state.meanPlotGeometry = drawPlot(
      els.meanCanvas,
      [{ label: "Global Mean", x: meanPayload.x.slice(), y: meanPayload.mean_trace.slice() }],
      `${meanPayload.x_label} (${meanPayload.x_unit})`,
      {
        selectionGuideX,
        hoverGuideX: state.meanHoverGuide,
        rangeStart,
        rangeEnd,
        view: state.meanView,
        singleColor: meanLineColorForBackground(els.spectrumBackground.value),
        backgroundName: els.spectrumBackground.value,
        axisZoomDrag: state.axisZoomDrag?.target === "mean" ? state.axisZoomDrag : null,
      }
    );
    els.meanSubtitle.textContent = `Mean across ${meanPayload.width} x ${meanPayload.height} pixels.`;

    const clickedBundles = buildClickedBundles();
    state.clickedPlotGeometry = drawPlot(els.clickedCanvas, clickedBundles, `${meanPayload.x_label} (${meanPayload.x_unit})`, {
      selectionGuideX,
      hoverGuideX: state.hoverGuide,
      rangeStart,
      rangeEnd,
      view: state.clickedView,
      colorMapName: els.spectrumColorMap.value,
      invertColormap: els.invertSpectrumColormap.checked,
      backgroundName: els.spectrumBackground.value,
      axisZoomDrag: state.axisZoomDrag?.target === "clicked" ? state.axisZoomDrag : null,
    });
    els.clickedSubtitle.textContent = clickedBundles.length ? `${clickedBundles.length} clicked spectrum(s)` : "Click on the map to add spectra.";
  } catch (error) {
    drawEmptyCanvas(els.meanCanvas, "Failed to render mean spectrum.");
    drawEmptyCanvas(els.clickedCanvas, "Failed to render spectra.");
    showError(`Spectrum render failed:\n${error}`);
    throw error;
  }
}

async function renderCurrentFile() {
  const file = getSelectedFile();
  if (!file) {
    els.fileTitle.textContent = "No file selected";
    els.fileSubtitle.textContent = "Choose a PL mapping pickle file.";
    drawEmptyCanvas(els.imageCanvas, "No map loaded.");
    drawEmptyCanvas(els.meanCanvas, "No spectrum loaded.");
    drawEmptyCanvas(els.clickedCanvas, "No clicked spectra.");
    els.clickedList.innerHTML = "";
    return;
  }
  try {
    clearError();
    state.imageCache.clear();
    state.traceCache.clear();
    els.fileTitle.textContent = file.name;
    const dims = getGridDimensions();
    const width = dims?.width || file.width;
    const height = dims?.height || file.height;
    const scanText = scanSizeText();
    els.fileSubtitle.textContent = `${width} x ${height} pixels • ${file.slice_count} wavelengths • ${formatBytes(file.size_bytes)}${scanText ? ` • scan ${scanText}` : ""}`;
    await renderPreview();
    await renderMeanAndClickedPlots();
    writeStoredState();
  } catch (error) {
    console.error(error);
  }
}

async function appendClickedTrace(x, y) {
  const file = getSelectedFile();
  if (!file) return;
  const payload = await loadTrace(file.path, x, y);
  const label = `(${payload.pixel_x}, ${payload.pixel_y})`;
  state.clickedTraces = state.clickedTraces.filter((item) => item.label !== label);
  state.clickedTraces.push({
    label,
    pixelX: payload.pixel_x,
    pixelY: payload.pixel_y,
    x: payload.x.slice(),
    y: payload.trace.slice(),
  });
  renderClickedList();
  renderMarkers();
  await renderMeanAndClickedPlots();
}

function axisPositionFromCanvasEvent(event, canvas, axisValues, geometry) {
  if (!axisValues.length || !geometry) return null;
  const rect = canvas.getBoundingClientRect();
  const plotLeft = geometry.padding.left;
  const plotRight = geometry.padding.left + geometry.innerWidth;
  const localX = event.clientX - rect.left;
  const clampedX = Math.max(plotLeft, Math.min(plotRight, localX));
  const targetValue = geometry.invX(clampedX);
  const index = axisValues.reduce((bestIndex, value, currentIndex) => {
    const bestDistance = Math.abs(axisValues[bestIndex] - targetValue);
    const currentDistance = Math.abs(value - targetValue);
    return currentDistance < bestDistance ? currentIndex : bestIndex;
  }, 0);
  return { index, value: axisValues[index] };
}

function clampView(view, bounds) {
  return {
    xMin: Math.max(bounds.xMin, Math.min(bounds.xMax, view.xMin)),
    xMax: Math.max(bounds.xMin, Math.min(bounds.xMax, view.xMax)),
    yMin: Math.max(bounds.yMin, Math.min(bounds.yMax, view.yMin)),
    yMax: Math.max(bounds.yMin, Math.min(bounds.yMax, view.yMax)),
  };
}

function axisZoomHit(event, geometry, target) {
  if (!geometry) return null;
  const rect = geometry.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const inXBand =
    x >= geometry.padding.left &&
    x <= geometry.padding.left + geometry.innerWidth &&
    y >= geometry.padding.top + geometry.innerHeight - 10 &&
    y <= geometry.padding.top + geometry.innerHeight + 34;
  const inYBand = x >= 0 && x <= geometry.padding.left && y >= geometry.padding.top && y <= geometry.padding.top + geometry.innerHeight;
  if (inXBand) return { target, axis: "x", startPx: x, currentPx: x };
  if (inYBand) return { target, axis: "y", startPx: y, currentPx: y };
  return null;
}

function plotBodyHit(event, geometry) {
  if (!geometry) return false;
  const rect = geometry.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return (
    x >= geometry.padding.left &&
    x <= geometry.padding.left + geometry.innerWidth &&
    y >= geometry.padding.top &&
    y <= geometry.padding.top + geometry.innerHeight
  );
}

function applyAxisZoom(drag, geometry, currentView) {
  if (!drag || !geometry) return currentView;
  const bounds = geometry.dataBounds;
  if (drag.axis === "x") {
    const left = Math.min(drag.startPx, drag.currentPx);
    const right = Math.max(drag.startPx, drag.currentPx);
    if (Math.abs(right - left) < 8) return currentView;
    return clampView({
      xMin: geometry.invX(left),
      xMax: geometry.invX(right),
      yMin: currentView?.yMin ?? bounds.yMin,
      yMax: currentView?.yMax ?? bounds.yMax,
    }, bounds);
  }
  const top = Math.min(drag.startPx, drag.currentPx);
  const bottom = Math.max(drag.startPx, drag.currentPx);
  if (Math.abs(bottom - top) < 8) return currentView;
  return clampView({
    xMin: currentView?.xMin ?? bounds.xMin,
    xMax: currentView?.xMax ?? bounds.xMax,
    yMin: geometry.invY(bottom),
    yMax: geometry.invY(top),
  }, bounds);
}

function updateRangeFromInputs() {
  const start = Number(els.rangeStart.value);
  const end = Number(els.rangeEnd.value);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  state.selection.type = "range";
  state.selection.startWavelength = Math.min(start, end);
  state.selection.endWavelength = Math.max(start, end);
  state.selection.targetWavelength = state.selection.startWavelength;
  updateRangeLabel();
}

async function selectMeanPointFromEvent(event) {
  const axisValues = state.currentPreview?.wavelengths || [];
  const nearest = axisPositionFromCanvasEvent(event, els.meanCanvas, axisValues, state.meanPlotGeometry);
  if (!nearest) return;
  state.selection.type = "point";
  state.selection.targetWavelength = nearest.value;
  state.selection.startWavelength = nearest.value;
  state.selection.endWavelength = nearest.value;
  syncRangeInputs();
  state.imageCache.clear();
  await renderPreview();
  await renderMeanAndClickedPlots();
  writeStoredState();
}

async function uploadPickedFile(file) {
  try {
    clearError();
    const info = await fetchJson("/api/upload-pickle", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Filename": file.name,
      },
      body: file,
    });
    state.selectedFile = info;
    state.selectedPath = info.path;
    state.gridWidth = info.requires_manual_dimensions ? null : info.width;
    state.gridHeight = info.requires_manual_dimensions ? null : info.height;
    state.clickedTraces = [];
    state.hoverGuide = null;
    state.meanView = null;
    state.clickedView = null;
    state.selection = {
      type: "point",
      targetWavelength: info.min_wavelength,
      startWavelength: info.min_wavelength,
      endWavelength: info.min_wavelength,
    };
    syncSmoothDefaults(true);
    syncGridInputsFromState();
    renderSelectedFileSummary();
    syncRangeInputs();
    await renderCurrentFile();
  } catch (error) {
    showError(`File open failed:\n${error}`);
    console.error(error);
  }
}

async function restorePreviousSession() {
  const saved = readStoredState();
  if (!saved?.selectedPath) return;
  try {
    applyTheme(saved.uiTheme || "bright");
    els.scanSizeX.value = saved.scanSizeX ?? els.scanSizeX.value;
    els.scanSizeY.value = saved.scanSizeY ?? els.scanSizeY.value;
    els.scanUnit.value = saved.scanUnit ?? els.scanUnit.value;
    els.imageMode.value = saved.imageMode ?? els.imageMode.value;
    els.imageLow.value = saved.imageLow ?? els.imageLow.value;
    els.imageHigh.value = saved.imageHigh ?? els.imageHigh.value;
    els.colorMap.value = saved.colorMap ?? els.colorMap.value;
    els.invertColormap.checked = Boolean(saved.invertColormap);
    els.spectrumColorMap.value = saved.spectrumColorMap ?? els.spectrumColorMap.value;
    els.invertSpectrumColormap.checked = Boolean(saved.invertSpectrumColormap);
    els.spectrumBackground.value = saved.spectrumBackground ?? els.spectrumBackground.value;
    els.colorScale.value = saved.colorScale ?? els.colorScale.value;
    els.normalizeToggle.checked = Boolean(saved.normalizeToggle);
    els.smoothToggle.checked = Boolean(saved.smoothToggle);
    els.smoothWindow.value = saved.smoothWindow ?? "7";
    els.smoothPoly.value = saved.smoothPoly ?? "2";
    els.offsetRange.value = saved.offsetRange ?? "0";
    state.meanView = saved.meanView ?? null;
    state.clickedView = saved.clickedView ?? null;
    state.activeTab = saved.activeTab === "multi" ? "multi" : "viewer";
    state.multiSnapshots = Array.isArray(saved.multiSnapshots) ? saved.multiSnapshots : [];
    state.gridWidth = Number.isInteger(saved.gridWidth) ? saved.gridWidth : null;
    state.gridHeight = Number.isInteger(saved.gridHeight) ? saved.gridHeight : null;
    state.selectedPath = saved.selectedPath;
    state.selectedFile = saved.selectedFile ?? null;
    syncGridInputsFromState();
    renderSelectedFileSummary();
    renderMultiGallery();
    setActiveTab(state.activeTab);
    syncRangeInputs();
    updateImageRangeLabel();
    updateOffsetLabel();
    const params = new URLSearchParams({ path: state.selectedPath });
    if (state.gridWidth && state.gridHeight) {
      params.set("grid_width", String(state.gridWidth));
      params.set("grid_height", String(state.gridHeight));
    }
    try {
      state.selectedFile = await fetchJson(`/api/file-info?${params.toString()}`);
    } catch (error) {
      if (!state.selectedFile) throw error;
      showError(`Last file could not be reopened automatically:\n${error}`);
      return;
    }
    syncSmoothDefaults(!saved.smoothWindow);
    state.selection = saved.selection || state.selection;
    renderSelectedFileSummary();
    await renderCurrentFile();
    state.clickedTraces = [];
    for (const pixel of saved.clickedPixels || []) {
      await appendClickedTrace(pixel.x, pixel.y);
    }
    renderClickedList();
    writeStoredState();
  } catch (error) {
    showError(`Previous session could not be restored:\n${error}`);
  }
}

function bindEvents() {
  els.uiTheme.addEventListener("change", () => {
    applyTheme(els.uiTheme.value);
    writeStoredState();
  });
  if (els.pickFileButton) {
    els.pickFileButton.addEventListener("click", () => {
      els.pickFileInput.click();
    });
  }
  els.pickFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await uploadPickedFile(file);
    els.pickFileInput.value = "";
  });
  els.tabViewer.addEventListener("click", () => {
    setActiveTab("viewer");
    writeStoredState();
  });
  els.tabMulti.addEventListener("click", () => {
    setActiveTab("multi");
    writeStoredState();
  });
  els.sendToMulti.addEventListener("click", () => {
    const summary = currentImageSummary();
    if (!summary) return;
    const exportCanvasEl = state.currentPreview
      ? renderHeatmapToOffscreenCanvas(
          state.currentPreview,
          els.imageLow.value,
          els.imageHigh.value,
          els.imageLowValue.value,
          els.imageHighValue.value,
          els.colorMap.value,
          els.invertColormap.checked,
          els.colorScale.value
        )
      : els.imageCanvas;
    state.multiSnapshots.unshift({
      ...summary,
      dataUrl: exportCanvasEl.toDataURL("image/png"),
    });
    renderMultiGallery();
    showImageToast("Sent to Multi.");
    writeStoredState();
  });
  els.imageExportPng.addEventListener("click", () => {
    const name = state.selectedFile?.name?.replace(/\.pickle$/i, "") || "pl-image";
    if (!state.currentPreview) return;
    const exportCanvasEl = renderHeatmapToOffscreenCanvas(
      state.currentPreview,
      els.imageLow.value,
      els.imageHigh.value,
      els.imageLowValue.value,
      els.imageHighValue.value,
      els.colorMap.value,
      els.invertColormap.checked,
      els.colorScale.value
    );
    exportCanvas(exportCanvasEl, `${name}-image`);
  });
  els.imageExportCsv.addEventListener("click", () => {
    const name = state.selectedFile?.name?.replace(/\.pickle$/i, "") || "pl-image";
    if (!state.currentPreview) return;
    exportCsv(imagePreviewCsv(state.currentPreview), `${name}-image`);
  });
  els.imageCopy.addEventListener("click", async () => {
    try {
      if (!state.currentPreview) return;
      const exportCanvasEl = renderHeatmapToOffscreenCanvas(
        state.currentPreview,
        els.imageLow.value,
        els.imageHigh.value,
        els.imageLowValue.value,
        els.imageHighValue.value,
        els.colorMap.value,
        els.invertColormap.checked,
        els.colorScale.value
      );
      await copyCanvas(exportCanvasEl);
    } catch (error) {
      showError(`Copy failed:\n${error}`);
    }
  });
  els.imageClear.addEventListener("click", async () => {
    state.clickedTraces = [];
    renderClickedList();
    renderMarkers();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.meanExportPng.addEventListener("click", () => {
    const name = state.selectedFile?.name?.replace(/\.pickle$/i, "") || "pl-mean-spectrum";
    exportCanvas(els.meanCanvas, `${name}-mean-spectrum`);
  });
  els.meanExportCsv.addEventListener("click", async () => {
    const file = getSelectedFile();
    if (!file) return;
    const payload = await loadTrace(file.path, 0, 0);
    exportCsv(
      tracesToCsv([{ label: "Global Mean", x: payload.x.slice(), y: payload.mean_trace.slice() }]),
      `${file.name.replace(/\.pickle$/i, "")}-mean-spectrum`
    );
  });
  els.meanCopy.addEventListener("click", async () => {
    try {
      await copyCanvas(els.meanCanvas);
    } catch (error) {
      showError(`Copy failed:\n${error}`);
    }
  });
  els.clickedExportPng.addEventListener("click", () => {
    const name = state.selectedFile?.name?.replace(/\.pickle$/i, "") || "pl-clicked-spectra";
    exportCanvas(els.clickedCanvas, `${name}-clicked-spectra`);
  });
  els.clickedExportCsv.addEventListener("click", () => {
    const file = getSelectedFile();
    if (!file || !state.clickedTraces.length) return;
    exportCsv(
      tracesToCsv(buildClickedBundles()),
      `${file.name.replace(/\.pickle$/i, "")}-clicked-spectra`
    );
  });
  els.clickedCopy.addEventListener("click", async () => {
    try {
      await copyCanvas(els.clickedCanvas);
    } catch (error) {
      showError(`Copy failed:\n${error}`);
    }
  });
  els.clearMulti.addEventListener("click", () => {
    state.multiSnapshots = [];
    renderMultiGallery();
    writeStoredState();
  });
  els.imageMode.addEventListener("change", async () => {
    state.imageCache.clear();
    await renderPreview();
    writeStoredState();
  });
  els.rangeStart.addEventListener("change", async () => {
    updateRangeFromInputs();
    state.imageCache.clear();
    await renderPreview();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.rangeEnd.addEventListener("change", async () => {
    updateRangeFromInputs();
    state.imageCache.clear();
    await renderPreview();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  for (const input of [els.gridWidth, els.gridHeight]) {
    input.addEventListener("change", async () => {
      const dims = getGridDimensions();
      state.gridWidth = dims?.width ?? null;
      state.gridHeight = dims?.height ?? null;
      state.imageCache.clear();
      state.traceCache.clear();
      renderSelectedFileSummary();
      await renderCurrentFile();
      writeStoredState();
    });
  }
  for (const input of [els.scanSizeX, els.scanSizeY, els.scanUnit]) {
    input.addEventListener("change", async () => {
      await renderCurrentFile();
      writeStoredState();
    });
  }
  els.imageLow.addEventListener("input", async () => {
    if (Number(els.imageLow.value) >= Number(els.imageHigh.value)) {
      els.imageHigh.value = String(Number(els.imageLow.value) + 1);
    }
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageHigh.addEventListener("input", async () => {
    if (Number(els.imageHigh.value) <= Number(els.imageLow.value)) {
      els.imageLow.value = String(Number(els.imageHigh.value) - 1);
    }
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageLowValue.addEventListener("change", async () => {
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageHighValue.addEventListener("change", async () => {
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.colorMap.addEventListener("change", async () => {
    await renderPreview();
    writeStoredState();
  });
  els.invertColormap.addEventListener("change", async () => {
    await renderPreview();
    writeStoredState();
  });
  els.spectrumColorMap.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.invertSpectrumColormap.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.spectrumBackground.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.colorScale.addEventListener("change", async () => {
    await renderPreview();
    writeStoredState();
  });
  els.offsetRange.addEventListener("input", async () => {
    updateOffsetLabel();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.normalizeToggle.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.smoothToggle.addEventListener("change", async () => {
    sanitizeSmoothInputs();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  for (const input of [els.smoothWindow, els.smoothPoly]) {
    input.addEventListener("change", async () => {
      sanitizeSmoothInputs();
      await renderMeanAndClickedPlots();
      writeStoredState();
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      sanitizeSmoothInputs();
      await renderMeanAndClickedPlots();
      writeStoredState();
    });
  }
  els.clearButton.addEventListener("click", async () => {
    state.clickedTraces = [];
    renderClickedList();
    renderMarkers();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.imageCanvas.addEventListener("click", async (event) => {
    try {
      const pixel = getPixelFromEvent(event);
      if (!pixel) return;
      await appendClickedTrace(pixel.x, pixel.y);
      writeStoredState();
    } catch (error) {
      showError(`Map click failed:\n${error}`);
    }
  });
  els.meanCanvas.addEventListener("mousedown", (event) => {
    const zoomDrag = axisZoomHit(event, state.meanPlotGeometry, "mean");
    if (zoomDrag) {
      state.axisZoomDrag = zoomDrag;
      return;
    }
    if (!plotBodyHit(event, state.meanPlotGeometry)) return;
    const axisValues = state.currentPreview?.wavelengths || [];
    const nearest = axisPositionFromCanvasEvent(event, els.meanCanvas, axisValues, state.meanPlotGeometry);
    if (!nearest) return;
    state.meanDrag = nearest;
    state.meanDragMoved = false;
  });
  els.meanCanvas.addEventListener("mousemove", async (event) => {
    if (state.axisZoomDrag?.target === "mean") {
      const rect = els.meanCanvas.getBoundingClientRect();
      state.axisZoomDrag.currentPx = state.axisZoomDrag.axis === "x" ? event.clientX - rect.left : event.clientY - rect.top;
      schedulePlotRender();
      return;
    }
    const axisValues = state.currentPreview?.wavelengths || [];
    const nearest = axisPositionFromCanvasEvent(event, els.meanCanvas, axisValues, state.meanPlotGeometry);
    if (!nearest) return;
    state.meanHoverGuide = nearest.value;
    els.meanHover.textContent = `Wavelength: ${formatNumber(nearest.value, 2)} nm`;
    schedulePlotRender();
    if (!state.meanDrag) return;
    if (Math.abs(nearest.index - state.meanDrag.index) > 1) state.meanDragMoved = true;
    state.selection.type = "range";
    state.selection.startWavelength = Math.min(state.meanDrag.value, nearest.value);
    state.selection.endWavelength = Math.max(state.meanDrag.value, nearest.value);
    syncRangeInputs();
    schedulePlotRender();
  });
  window.addEventListener("mouseup", async (event) => {
    if (state.axisZoomDrag) {
      if (state.axisZoomDrag.target === "mean") {
        state.meanView = applyAxisZoom(state.axisZoomDrag, state.meanPlotGeometry, state.meanView);
      } else {
        state.clickedView = applyAxisZoom(state.axisZoomDrag, state.clickedPlotGeometry, state.clickedView);
      }
      state.axisZoomDrag = null;
      await renderMeanAndClickedPlots();
      writeStoredState();
      return;
    }
    const activeSource = state.meanDrag ? "mean" : state.clickedDrag ? "clicked" : null;
    if (!activeSource) return;
    const dragState = activeSource === "mean" ? state.meanDrag : state.clickedDrag;
    const dragMoved = activeSource === "mean" ? state.meanDragMoved : state.clickedDragMoved;
    const dragCanvas = activeSource === "mean" ? els.meanCanvas : els.clickedCanvas;
    const dragGeometry = activeSource === "mean" ? state.meanPlotGeometry : state.clickedPlotGeometry;
    const axisValues = state.currentPreview?.wavelengths || [];
    const nearest = axisPositionFromCanvasEvent(event, dragCanvas, axisValues, dragGeometry) || dragState;
    const delta = Math.abs(nearest.index - dragState.index);
    if (!dragMoved && delta <= 1) {
      state.selection.type = "point";
      state.selection.targetWavelength = nearest.value;
      state.selection.startWavelength = nearest.value;
      state.selection.endWavelength = nearest.value;
    } else {
      state.selection.type = "range";
      state.selection.startWavelength = Math.min(dragState.value, nearest.value);
      state.selection.endWavelength = Math.max(dragState.value, nearest.value);
      state.selection.targetWavelength = state.selection.startWavelength;
    }
    state.meanDrag = null;
    state.meanDragMoved = false;
    state.clickedDrag = null;
    state.clickedDragMoved = false;
    syncRangeInputs();
    state.imageCache.clear();
    await renderPreview();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.meanCanvas.addEventListener("mouseleave", async () => {
    if (!state.meanDrag) {
      state.meanHoverGuide = null;
      els.meanHover.textContent = "";
      schedulePlotRender();
    }
  });
  els.clickedCanvas.addEventListener("mousemove", async (event) => {
    if (state.axisZoomDrag?.target === "clicked") {
      const rect = els.clickedCanvas.getBoundingClientRect();
      state.axisZoomDrag.currentPx = state.axisZoomDrag.axis === "x" ? event.clientX - rect.left : event.clientY - rect.top;
      schedulePlotRender();
      return;
    }
    const axisValues = state.currentPreview?.wavelengths || [];
    const nearest = axisPositionFromCanvasEvent(event, els.clickedCanvas, axisValues, state.clickedPlotGeometry);
    if (!nearest) return;
    state.hoverGuide = nearest.value;
    if (els.clickedHover) els.clickedHover.textContent = `Wavelength: ${formatNumber(nearest.value, 2)} nm`;
    if (state.clickedDrag) {
      if (Math.abs(nearest.index - state.clickedDrag.index) > 1) state.clickedDragMoved = true;
      state.selection.type = "range";
      state.selection.startWavelength = Math.min(state.clickedDrag.value, nearest.value);
      state.selection.endWavelength = Math.max(state.clickedDrag.value, nearest.value);
      syncRangeInputs();
    }
    schedulePlotRender();
  });
  els.clickedCanvas.addEventListener("mouseleave", async () => {
    if (!state.clickedDrag) {
      state.hoverGuide = null;
      if (els.clickedHover) els.clickedHover.textContent = "";
      schedulePlotRender();
    }
  });
  els.clickedCanvas.addEventListener("mousedown", (event) => {
    const zoomDrag = axisZoomHit(event, state.clickedPlotGeometry, "clicked");
    if (zoomDrag) {
      state.axisZoomDrag = zoomDrag;
      return;
    }
    if (!plotBodyHit(event, state.clickedPlotGeometry)) return;
    const axisValues = state.currentPreview?.wavelengths || [];
    const nearest = axisPositionFromCanvasEvent(event, els.clickedCanvas, axisValues, state.clickedPlotGeometry);
    if (!nearest) return;
    state.clickedDrag = nearest;
    state.clickedDragMoved = false;
  });
  els.meanCanvas.addEventListener("dblclick", async () => {
    state.meanView = null;
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.clickedCanvas.addEventListener("dblclick", async () => {
    state.clickedView = null;
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.resetMeanAxes.addEventListener("click", async () => {
    state.meanView = null;
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.resetClickedAxes.addEventListener("click", async () => {
    state.clickedView = null;
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  window.addEventListener("resize", () => {
    renderPreview().catch((error) => console.warn("Failed to rerender preview", error));
    renderMeanAndClickedPlots().catch((error) => console.warn("Failed to rerender plots", error));
  });
}

function init() {
  applyTheme("bright");
  els.datasetMeta.textContent = "Choose a pickle file from anywhere on this Mac.";
  clearError();
  renderSelectedFileSummary();
  renderMultiGallery();
  setActiveTab("viewer");
  updateImageRangeLabel();
  updateOffsetLabel();
  bindEvents();
  drawEmptyCanvas(els.imageCanvas, "Choose a pickle file.");
  drawEmptyCanvas(els.meanCanvas, "No spectrum loaded.");
  drawEmptyCanvas(els.clickedCanvas, "No clicked spectra.");
  syncGridInputsFromState();
  restorePreviousSession().catch((error) => console.warn("Failed to restore previous session", error));
}

init();
