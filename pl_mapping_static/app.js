const state = {
  restoring: false,
  previewRequest: 0,
  manualColorLimits: false,
  plotRequest: 0,
  selectedFile: null,
  fileAnalysis: null,
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
  lineDrag: null,
  lineDragMoved: false,
  imageToastTimer: null,
  plotRenderScheduled: false,
  activeTab: "viewer",
  multiSnapshots: [],
  importPresets: [],
  currentFilePatternSignature: null,
  importModalOpen: false,
  clickedViewMode: "spectra",
  clickedHeatmapNormalizeAxis: "none",
  clickedHeatmapRenderMode: "pcolormesh",
  clickedHeatmapTranspose: false,
  referenceEnabled: false,
  referenceSelection: "",
  referenceOffset: 0,
  lastMeanRawBundle: null,
  layoutDrag: null,
};

const STORAGE_KEY = "pl-mapping-viewer-state-v2";

const heatmapScratchCanvas = document.createElement("canvas");
const heatmapScratchCtx = heatmapScratchCanvas.getContext("2d");

const els = {
  datasetMeta: document.getElementById("dataset-meta"),
  appError: document.getElementById("app-error"),
  uiTheme: document.getElementById("ui-theme"),
  browserPath: document.getElementById("browser-path"),
  openFileModal: document.getElementById("open-file-modal"),
  pickFileInput: document.getElementById("pick-file-input"),
  modalPickFileInput: document.getElementById("modal-pick-file-input"),
  importMode: document.getElementById("import-mode"),
  manualImportSettings: document.getElementById("manual-import-settings"),
  manualFormat: document.getElementById("manual-format"),
  importSkipRows: document.getElementById("import-skip-rows"),
  importDelimiter: document.getElementById("import-delimiter"),
  importIndexColumn: document.getElementById("import-index-column"),
  importXColumn: document.getElementById("import-x-column"),
  importYColumn: document.getElementById("import-y-column"),
  importDataStartColumn: document.getElementById("import-data-start-column"),
  manualIndexColumns: document.getElementById("manual-index-columns"),
  manualXyColumns: document.getElementById("manual-xy-columns"),
  rememberImportRule: document.getElementById("remember-import-rule"),
  clearImportRules: document.getElementById("clear-import-rules"),
  importLearningStatus: document.getElementById("import-learning-status"),
  fileList: document.getElementById("file-list"),
  imageMode: document.getElementById("image-mode"),
  imageTool: document.getElementById("image-tool"),
  imageToolHint: document.getElementById("image-tool-hint"),
  lineThickness: document.getElementById("line-thickness"),
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
  referenceToggle: document.getElementById("reference-toggle"),
  referenceSelect: document.getElementById("reference-select"),
  referenceOffset: document.getElementById("reference-offset"),
  clickedViewMode: document.getElementById("clicked-view-mode"),
  heatmapControls: document.getElementById("heatmap-controls"),
  heatmapNormalizeAxis: document.getElementById("heatmap-normalize-axis"),
  heatmapRenderMode: document.getElementById("heatmap-render-mode"),
  heatmapTranspose: document.getElementById("heatmap-transpose"),
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
  importModal: document.getElementById("import-modal"),
  importModalClose: document.getElementById("import-modal-close"),
  importModalFile: document.getElementById("import-modal-file"),
  importModalMeta: document.getElementById("import-modal-meta"),
  importSuggestedReason: document.getElementById("import-suggested-reason"),
  importSuggestedDims: document.getElementById("import-suggested-dims"),
  importSuggestedCopy: document.getElementById("import-suggested-copy"),
  useSuggestedDims: document.getElementById("use-suggested-dims"),
  dimensionCandidateList: document.getElementById("dimension-candidate-list"),
  modalGridWidth: document.getElementById("modal-grid-width"),
  modalGridHeight: document.getElementById("modal-grid-height"),
  modalGridValidation: document.getElementById("modal-grid-validation"),
  importModalOpenButton: document.getElementById("import-modal-open"),
  contentGrid: document.getElementById("content-grid"),
  viewerStack: document.getElementById("viewer-stack"),
  horizontalSplitter: document.getElementById("horizontal-splitter"),
  verticalSplitter: document.getElementById("vertical-splitter"),
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    if (response.headers.get("content-type")?.includes("text/html")) {
      const page = new DOMParser().parseFromString(body, "text/html");
      message = Array.from(page.querySelectorAll("p")).map(p => p.textContent)
        .find(text => text.startsWith("Message:"))?.replace(/^Message:\s*/, "") || `HTTP ${response.status}`;
    }
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

function showError(message) {
  els.appError.hidden = false;
  els.appError.textContent = String(message);
  const modalError = document.getElementById("import-error");
  if (modalError) {
    modalError.hidden = false;
    modalError.textContent = String(message);
  }
}

function clearError() {
  els.appError.hidden = true;
  els.appError.textContent = "";
  const modalError = document.getElementById("import-error");
  if (modalError) {
    modalError.hidden = true;
    modalError.textContent = "";
  }
}

function formatNumber(value, digits = 2) {
  if (Number.isFinite(value) && value !== 0 && Math.abs(value) < 10 ** (-digits)) return value.toExponential(2);
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function baseFileName(name, fallback = "pl-data") {
  if (!name) return fallback;
  return name.replace(/\.[^.]+$/u, "") || fallback;
}

function currentAxisUnit() {
  return state.selectedFile?.wavelength_unit || state.currentPreview?.wavelength_unit || "nm";
}

function currentAxisLabel() {
  return state.selectedFile?.wavelength_axis_label || "Wavelength";
}

function getImportSettings() {
  return {
    importMode: els.importMode.value || "auto",
    manualFormat: els.manualFormat.value || "index-columns",
    skipRows: els.importSkipRows.value || "0",
    delimiter: els.importDelimiter.value || "auto",
    indexColumn: els.importIndexColumn.value || "0",
    xColumn: els.importXColumn.value || "0",
    yColumn: els.importYColumn.value || "1",
    dataStartColumn: els.importDataStartColumn.value || "1",
  };
}

function applyImportSettings(settings = {}) {
  els.importMode.value = settings.importMode || "auto";
  els.manualFormat.value = settings.manualFormat || "index-columns";
  els.importSkipRows.value = settings.skipRows ?? "0";
  els.importDelimiter.value = settings.delimiter || "auto";
  els.importIndexColumn.value = settings.indexColumn ?? "0";
  els.importXColumn.value = settings.xColumn ?? "0";
  els.importYColumn.value = settings.yColumn ?? "1";
  els.importDataStartColumn.value = settings.dataStartColumn ?? "1";
  updateImportUi();
}

function updateImportUi() {
  const manual = els.importMode.value === "manual";
  const xyMode = manual && els.manualFormat.value === "xy-spectra";
  els.manualImportSettings.hidden = !manual;
  els.manualIndexColumns.hidden = !manual || xyMode;
  els.manualXyColumns.hidden = !manual || !xyMode;
}

function appendImportParams(params) {
  const settings = getImportSettings();
  params.set("import_mode", settings.importMode);
  if (settings.importMode !== "manual") return params;
  params.set("manual_format", settings.manualFormat);
  params.set("skip_rows", settings.skipRows);
  params.set("delimiter", settings.delimiter);
  params.set("index_column", settings.indexColumn);
  params.set("x_column", settings.xColumn);
  params.set("y_column", settings.yColumn);
  params.set("data_start_column", settings.dataStartColumn);
  return params;
}

function setImportLearningStatus(message) {
  if (!els.importLearningStatus) return;
  els.importLearningStatus.textContent = message || "";
}

function normalizeSignatureLine(line) {
  return line
    .trim()
    .toLowerCase()
    .replace(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

async function buildFilePatternSignature(file) {
  const extension = (file.name.match(/\.[^.]+$/u)?.[0] || "").toLowerCase();
  try {
    const sample = await file.slice(0, 16384).text();
    const lines = sample
      .split(/\r?\n/u)
      .map(normalizeSignatureLine)
      .filter(Boolean)
      .slice(0, 12);
    if (lines.length) return `${extension}::${lines.join("|")}`;
  } catch {
    // ignore
  }
  return `${extension}::size:${Math.round(file.size / 1024)}`;
}

function findImportPreset(signature) {
  if (!signature) return null;
  return state.importPresets.find((preset) => preset.signature === signature) || null;
}

function rememberImportPreset(signature, fileName) {
  if (!signature) return;
  const preset = {
    signature,
    settings: getImportSettings(),
    fileName: fileName || state.selectedFile?.name || "learned-format",
    learnedAt: new Date().toISOString(),
  };
  state.importPresets = [preset, ...state.importPresets.filter((item) => item.signature !== signature)].slice(0, 40);
  setImportLearningStatus(`Learned import rule from ${preset.fileName}.`);
}

async function applyLearnedImportPreset(file) {
  state.currentFilePatternSignature = await buildFilePatternSignature(file);
  const preset = findImportPreset(state.currentFilePatternSignature);
  if (!preset) {
    setImportLearningStatus("");
    return;
  }
  applyImportSettings(preset.settings);
  setImportLearningStatus(`Applied learned rule from ${preset.fileName}.`);
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sessionSnapshot() {
  return {
    schema_version: 3,
    saved_at_ms: Date.now(),
    app_version: "0.3.4",
    clickedTraces: state.clickedTraces,
    selectedPath: state.selectedPath,
    selectedFile: state.selectedFile,
    importPresets: state.importPresets,
    importSettings: getImportSettings(),
    selection: state.selection,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    scanSizeX: els.scanSizeX.value,
    scanSizeY: els.scanSizeY.value,
    scanUnit: els.scanUnit.value,
    imageMode: els.imageMode.value,
    imageTool: els.imageTool.value,
    lineThickness: els.lineThickness.value,
    manualColorLimits: state.manualColorLimits,
    imageLowValue: els.imageLowValue.value,
    imageHighValue: els.imageHighValue.value,
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
    referenceToggle: els.referenceToggle.checked,
    referenceSelection: els.referenceSelect.value,
    referenceOffset: els.referenceOffset.value,
    clickedViewMode: els.clickedViewMode.value,
    clickedHeatmapNormalizeAxis: els.heatmapNormalizeAxis.value,
    clickedHeatmapRenderMode: els.heatmapRenderMode.value,
    clickedHeatmapTranspose: els.heatmapTranspose.checked,
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
}

let sessionTimer;
let sessionWrites = Promise.resolve();
function persistSession(payload) {
  sessionWrites = sessionWrites.then(() => fetchJson("/api/session", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)})).catch(error => showError(`Session save failed: ${error.message}`));
  return sessionWrites;
}
function writeStoredState() {
  if (state.restoring) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => persistSession(sessionSnapshot()), 250);
}

function clearStoredState() {
  localStorage.removeItem(STORAGE_KEY);
}

function sanitizeLineThickness() {
  let value = Number(els.lineThickness.value);
  if (!Number.isInteger(value) || value < 1) value = 1;
  if (value > 25) value = 25;
  els.lineThickness.value = String(value);
  return value;
}

function updateImageToolHint() {
  if (els.imageTool.value === "line") {
    els.imageToolHint.textContent = `Line mode: drag on the map to append line spectra (${sanitizeLineThickness()} px avg).`;
  } else {
    els.imageToolHint.textContent = "Point mode: click map to add spectra.";
  }
}

function updateClickedViewControls() {
  const heatmapMode = els.clickedViewMode.value === "heatmap";
  els.heatmapControls.hidden = !heatmapMode;
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
  const sorted = preview.values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return {min: 0, max: 1, label: "No finite values"};
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
  const range = dataMax > dataMin ? dataMax - dataMin : 1;

  for (let index = 0; index < preview.values.length; index += 1) {
    if (!Number.isFinite(preview.values[index])) {
      image.data.set([128, 128, 128, 255], index * 4);
      continue;
    }
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
  const range = dataMax > dataMin ? dataMax - dataMin : 1;
  for (let index = 0; index < preview.values.length; index += 1) {
    if (!Number.isFinite(preview.values[index])) {
      image.data.set([128, 128, 128, 255], index * 4);
      continue;
    }
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

function buildClickedBundles(forExport = false) {
  const normalize = els.normalizeToggle.checked;
  const smoothingEnabled = els.smoothToggle.checked;
  const smoothWindow = els.smoothWindow.value;
  const smoothPoly = els.smoothPoly.value;
  const offsetFactor = (Number(els.offsetRange.value) / 100) ** 2;
  const rawBundles = state.clickedTraces.map((trace) => ({
    label: trace.label,
    exportLabel: trace.exportLabel || trace.label,
    x: trace.x.slice(),
    y: trace.y.slice(),
    groupType: trace.groupType || "point",
    groupId: trace.groupId || null,
    groupLabel: trace.groupLabel || trace.label,
    pixelX: trace.pixelX,
    pixelY: trace.pixelY,
    lineDistancePixels: trace.lineDistancePixels,
    lineDistancePhysical: trace.lineDistancePhysical,
    lineDistanceUnit: trace.lineDistanceUnit || "",
  }));
  const processed = applyReferenceAndTraceSettings(rawBundles, getSelectedReferenceBundle(rawBundles), {
    normalize,
    smoothingEnabled,
    smoothWindow,
    smoothPoly,
    offsetFactor,
    applyOffset: !forExport,
  });
  return processed.map((bundle, index) => ({
    ...bundle,
    strokeColor: clickedTraceColor(index, processed.length),
  }));
}

function averageReferenceFromGroup(groupId, rawBundles) {
  const group = rawBundles.filter((bundle) => bundle.groupId === groupId);
  if (!group.length) return null;
  const minLen = Math.min(...group.map((bundle) => Math.min(bundle.x.length, bundle.y.length)));
  if (minLen < 1) return null;
  const x = group[0].x.slice(0, minLen);
  const y = Array.from({length: minLen}, (_, i) => {
    const values = group.map(b => b.y[i]).filter(Number.isFinite);
    return values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
  });
  return { label: group[0].groupLabel || "Line", x, y };
}

function getSelectedReferenceBundle(rawBundles) {
  if (!els.referenceToggle.checked) return null;
  const value = els.referenceSelect.value;
  if (!value) return null;
  if (value === "__mean__") return state.lastMeanRawBundle;
  if (value.startsWith("point:")) return rawBundles.find((bundle) => bundle.label === value.slice(6)) || null;
  if (value.startsWith("line:")) return averageReferenceFromGroup(value.slice(5), rawBundles);
  return null;
}

function applyReferenceAndTraceSettings(rawBundles, referenceBundle, options = {}) {
  const normalize = Boolean(options.normalize);
  const smoothingEnabled = Boolean(options.smoothingEnabled);
  const smoothWindow = options.smoothWindow;
  const smoothPoly = options.smoothPoly;
  const offsetFactor = Number(options.offsetFactor) || 0;
  const applyOffset = Boolean(options.applyOffset);
  const referenceOffset = Number(els.referenceOffset.value) || 0;

  return rawBundles.map((bundle, index) => {
    let xValues = bundle.x.slice();
    let yValues = bundle.y.slice();
    if (referenceBundle?.y?.length) {
      const length = Math.min(xValues.length, yValues.length, referenceBundle.y.length);
      xValues = xValues.slice(0, length);
      yValues = applyReferenceDivision(yValues.slice(0, length), referenceBundle.y.slice(0, length), referenceOffset);
    }
    if (smoothingEnabled) yValues = smoothSeries(yValues, smoothWindow, smoothPoly);
    if (normalize) yValues = normalizeSeries(yValues);
    if (applyOffset) {
      const finite = yValues.filter(Number.isFinite);
      const localRange = finite.length ? Math.max(1e-12, Math.max(...finite) - Math.min(...finite)) : 1;
      yValues = yValues.map((value) => Number.isFinite(value) ? value + index * localRange * offsetFactor : null);
    }
    return {
      ...bundle,
      x: xValues.slice(0, yValues.length),
      y: yValues,
    };
  });
}

function buildCenteredEdges(values) {
  if (!values.length) return [];
  if (values.length === 1) return [values[0] - 0.5, values[0] + 0.5];
  const edges = [values[0] - (values[1] - values[0]) / 2];
  for (let index = 1; index < values.length; index += 1) {
    edges.push((values[index - 1] + values[index]) / 2);
  }
  edges.push(values[values.length - 1] + (values[values.length - 1] - values[values.length - 2]) / 2);
  return edges;
}

function getNestedFiniteMinMax(rows) {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  rows.forEach((row) => {
    row.forEach((value) => {
      if (!Number.isFinite(value)) return;
      min = Math.min(min, value);
      max = Math.max(max, value);
      count += 1;
    });
  });
  if (!count) return { min: 0, max: 1, count: 0 };
  return { min, max, count };
}

function normalizeHeatmapRows(rows) {
  return rows.map((row) => {
    const finite = row.filter((value) => Number.isFinite(value));
    if (!finite.length) return row.slice();
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const range = Math.max(1e-12, max - min);
    return row.map((value) => (Number.isFinite(value) ? (value - min) / range : value));
  });
}

function normalizeHeatmapCols(rows) {
  if (!rows.length || !rows[0]?.length) return rows.map((row) => row.slice());
  const width = rows[0].length;
  const mins = new Array(width).fill(Infinity);
  const maxs = new Array(width).fill(-Infinity);
  rows.forEach((row) => {
    row.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      mins[index] = Math.min(mins[index], value);
      maxs[index] = Math.max(maxs[index], value);
    });
  });
  return rows.map((row) =>
    row.map((value, index) => {
      if (!Number.isFinite(value)) return value;
      const range = Math.max(1e-12, maxs[index] - mins[index]);
      return (value - mins[index]) / range;
    })
  );
}

function transposeRows(rows) {
  if (!rows.length || !rows[0]?.length) return [];
  return rows[0].map((_, columnIndex) => rows.map((row) => row[columnIndex]));
}

function getClickedHeatmapData(bundles) {
  const valid = bundles.filter((bundle) => bundle.x?.length && bundle.y?.length);
  if (!valid.length) return null;
  const minLen = Math.min(...valid.map((bundle) => Math.min(bundle.x.length, bundle.y.length)));
  if (minLen < 1) return null;
  const baseX = valid[0].x.slice(0, minLen);
  const baseRows = valid.map((bundle) => bundle.y.slice(0, minLen));
  const baseRowLabels = valid.map((bundle) => bundle.groupLabel || bundle.label);

  let xValues = baseX.slice();
  let yValues = Array.from({ length: baseRows.length }, (_, index) => index + 1);
  let rowLabels = baseRowLabels.slice();
  let columnLabels = baseX.map((value) => formatNumber(value, 2));
  let zRows = baseRows.map((row) => row.slice());
  let xLabel = `${currentAxisLabel()} (${currentAxisUnit()})`;
  let yLabel = "Trace index";

  if (els.heatmapTranspose.checked) {
    zRows = transposeRows(zRows);
    xValues = Array.from({ length: baseRows.length }, (_, index) => index + 1);
    yValues = baseX.slice();
    rowLabels = baseX.map((value) => formatNumber(value, 2));
    columnLabels = baseRowLabels.slice();
    xLabel = "Trace index";
    yLabel = `${currentAxisLabel()} (${currentAxisUnit()})`;
  }

  if (els.heatmapNormalizeAxis.value === "x") zRows = normalizeHeatmapRows(zRows);
  else if (els.heatmapNormalizeAxis.value === "y") zRows = normalizeHeatmapCols(zRows);

  return {
    xValues,
    yValues,
    zRows,
    rowLabels,
    columnLabels,
    xLabel,
    yLabel,
    renderMode: els.heatmapRenderMode.value,
  };
}

function drawClickedHeatmap(canvas, heatmap) {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 420;
  const ctx = setCanvasSize(canvas, width, height);
  const [bgTop, bgBottom] = plotBackgroundStops(els.spectrumBackground.value);
  const theme = plotThemeForBackground(els.spectrumBackground.value);
  if (bgTop && bgBottom) {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, bgTop);
    bg.addColorStop(1, bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
  if (!heatmap?.xValues?.length || !heatmap?.yValues?.length || !heatmap?.zRows?.length) {
    ctx.fillStyle = theme.emptyText;
    ctx.font = '14px "Avenir Next", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("No data.", width / 2, height / 2);
    return null;
  }

  const padding = { left: 72, right: 20, top: 24, bottom: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xEdges = buildCenteredEdges(heatmap.xValues);
  const yEdges = buildCenteredEdges(heatmap.yValues);
  const stats = getNestedFiniteMinMax(heatmap.zRows);
  const zMin = stats.min;
  const zRange = Math.max(1e-12, stats.max - stats.min);
  const xMin = Math.min(...xEdges);
  const xMax = Math.max(...xEdges);
  const yMin = Math.min(...yEdges);
  const yMax = Math.max(...yEdges);
  const mapX = (value) => padding.left + ((value - xMin) / Math.max(1e-12, xMax - xMin)) * innerWidth;
  const mapY = (value) => padding.top + innerHeight - ((value - yMin) / Math.max(1e-12, yMax - yMin)) * innerHeight;

  for (let rowIndex = 0; rowIndex < heatmap.zRows.length; rowIndex += 1) {
    const row = heatmap.zRows[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const value = row[colIndex];
      if (!Number.isFinite(value)) continue;
      const normalized = (value - zMin) / zRange;
      ctx.fillStyle = colorToCss(mapColorByName(els.spectrumColorMap.value, normalized, Boolean(els.invertSpectrumColormap.checked)));
      const left = mapX(xEdges[colIndex]);
      const right = mapX(xEdges[colIndex + 1]);
      const top = mapY(yEdges[rowIndex + 1]);
      const bottom = mapY(yEdges[rowIndex]);
      ctx.fillRect(Math.min(left, right), Math.min(top, bottom), Math.max(1, Math.abs(right - left)), Math.max(1, Math.abs(bottom - top)));
    }
  }

  ctx.strokeStyle = theme.grid;
  ctx.strokeRect(padding.left, padding.top, innerWidth, innerHeight);
  ctx.fillStyle = theme.axisText;
  ctx.font = '12px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(heatmap.xLabel, padding.left + innerWidth / 2, height - 14);
  ctx.save();
  ctx.translate(18, padding.top + innerHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(heatmap.yLabel, 0, 0);
  ctx.restore();

  ctx.font = '11px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  const xTickValues = [heatmap.xValues[0], heatmap.xValues[Math.floor((heatmap.xValues.length - 1) / 2)], heatmap.xValues[heatmap.xValues.length - 1]];
  xTickValues.forEach((value) => {
    const px = mapX(value);
    ctx.fillText(formatNumber(value, 1), px, padding.top + innerHeight + 18);
  });

  ctx.textAlign = "right";
  const yTickValues = [heatmap.yValues[0], heatmap.yValues[Math.floor((heatmap.yValues.length - 1) / 2)], heatmap.yValues[heatmap.yValues.length - 1]];
  yTickValues.forEach((value) => {
    const py = mapY(value);
    ctx.fillText(formatNumber(value, 1), padding.left - 8, py + 4);
  });
  return null;
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
      if (!Number.isFinite(value)) return;
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
    let connected = false;
    bundle.x.forEach((xValue, pointIndex) => {
      if (!Number.isFinite(xValue) || !Number.isFinite(bundle.y[pointIndex])) { connected = false; return; }
      const px = mapX(xValue);
      const py = mapY(bundle.y[pointIndex]);
      if (!connected) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      connected = true;
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

    const hoverUnit = options.xUnit || "nm";
    const label = `${formatNumber(options.hoverGuideX, 2)} ${hoverUnit}`;
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
  els.imageLowValue.value = String(limits.min);
  els.imageHighValue.value = String(limits.max);
}

function updateOffsetLabel() {
  const mapped = (Number(els.offsetRange.value) / 100) ** 2;
  els.offsetValue.textContent = `${mapped.toFixed(3)}x`;
}

function defaultSmoothWindow(length) {
  if (!Number.isFinite(length) || length < 3) return 3;
  let windowSize = Math.round(length * 0.005);
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
  const unit = currentAxisUnit();
  if (state.selection.type === "point") {
    els.rangeLabel.textContent = `Point: ${formatNumber(state.selection.targetWavelength, 2)} ${unit}`;
  } else {
    els.rangeLabel.textContent = `Range: ${formatNumber(state.selection.startWavelength, 2)} - ${formatNumber(state.selection.endWavelength, 2)} ${unit}`;
  }
}

function scanSizeText() {
  const sizeX = Number(els.scanSizeX.value);
  const sizeY = Number(els.scanSizeY.value);
  if (!(sizeX > 0 && sizeY > 0)) return "";
  return `${formatNumber(sizeX, 2)} x ${formatNumber(sizeY, 2)} ${els.scanUnit.value}`;
}

function getSpatialCalibration(width, height) {
  const sizeX = Number(els.scanSizeX.value);
  const sizeY = Number(els.scanSizeY.value);
  if (!(sizeX > 0 && sizeY > 0)) return null;
  return {
    xStep: width > 1 ? sizeX / (width - 1) : 0,
    yStep: height > 1 ? sizeY / (height - 1) : 0,
    unit: els.scanUnit.value || "",
  };
}

function updateGridHint() {
  const meta = activeFileMeta();
  if (!meta) {
    els.gridHint.textContent = "Open a file first. We will suggest pixel dimensions before rendering.";
    return;
  }
  if (meta.requires_manual_dimensions) {
    els.gridHint.textContent = `This file has ${meta.pixel_count} pixels. Choose Width × Height in the popup or edit it here.`;
    return;
  }
  const suggestedWidth = meta.suggested_width || meta.width;
  const suggestedHeight = meta.suggested_height || meta.height;
  els.gridHint.textContent = `Suggested shape: ${suggestedWidth} x ${suggestedHeight}. You can still override it manually.`;
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
  const meta = activeFileMeta();
  if (!meta) {
    els.browserPath.textContent = "No file selected.";
    els.fileList.className = "file-list empty";
    els.fileList.textContent = "Choose a data file from Finder.";
    updateGridHint();
    return;
  }
  const dims = getGridDimensions();
  const width = dims?.width || meta.width || meta.suggested_width || meta.inferred_width || 0;
  const height = dims?.height || meta.height || meta.suggested_height || meta.inferred_height || 0;
  els.browserPath.textContent = state.selectedFile ? "File loaded." : "File analyzed. Confirm pixel dimensions.";
  els.fileList.className = "file-list";
  els.fileList.innerHTML = `
    <div class="file-item active">
      <strong>${meta.name || "Selected dataset"}</strong>
      <span>${width} x ${height} pixels • ${meta.slice_count} slices • ${formatBytes(meta.size_bytes)}</span>
    </div>
  `;
  updateGridHint();
}

function closeImportModal() {
  state.importModalOpen = false;
  els.importModal.hidden = true;
}

function resetImportModalView() {
  els.importModalFile.textContent = "No file selected";
  els.importModalMeta.textContent = "Choose a file to start the analysis.";
  els.importSuggestedReason.textContent = "";
  els.importSuggestedDims.textContent = "-";
  els.importSuggestedCopy.textContent = "No automatic suggestion yet.";
  els.dimensionCandidateList.innerHTML = "";
  setModalDimensions(0, 0);
}

function setModalDimensions(width, height) {
  els.modalGridWidth.value = width > 0 ? String(width) : "0";
  els.modalGridHeight.value = height > 0 ? String(height) : "0";
  updateModalValidation();
}

function updateModalValidation() {
  const analysis = state.fileAnalysis;
  if (!analysis) {
    els.modalGridValidation.textContent = "Open a file first.";
    return false;
  }
  const width = Number(els.modalGridWidth.value);
  const height = Number(els.modalGridHeight.value);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    els.modalGridValidation.textContent = `Enter positive integers. Pixel count must equal ${analysis.pixel_count}.`;
    return false;
  }
  const product = width * height;
  if (product !== analysis.pixel_count) {
    els.modalGridValidation.textContent = `${width} × ${height} = ${product}. It must equal ${analysis.pixel_count}.`;
    return false;
  }
  els.modalGridValidation.textContent = `${width} × ${height} confirmed.`;
  return true;
}

function renderDimensionCandidates(analysis) {
  els.dimensionCandidateList.innerHTML = "";
  const candidates = Array.isArray(analysis.dimension_candidates) ? analysis.dimension_candidates : [];
  candidates.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-chip";
    button.textContent = `${candidate.width} × ${candidate.height}`;
    button.addEventListener("click", () => {
      setModalDimensions(candidate.width, candidate.height);
      els.dimensionCandidateList.querySelectorAll(".candidate-chip").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
    });
    if (Number(els.modalGridWidth.value) === Number(candidate.width) && Number(els.modalGridHeight.value) === Number(candidate.height)) {
      button.classList.add("active");
    }
    els.dimensionCandidateList.appendChild(button);
  });
}

function openImportModal(analysis) {
  state.importModalOpen = true;
  els.importModal.hidden = false;
  if (!analysis) {
    resetImportModalView();
    if (state.restoring) els.importModalMeta.textContent = "Restoring the previous file and pixel dimensions…";
    return;
  }
  els.importModalFile.textContent = analysis.name || "Selected file";
  const minWave = Number.isFinite(analysis.min_wavelength) ? formatNumber(analysis.min_wavelength, 2) : "-";
  const maxWave = Number.isFinite(analysis.max_wavelength) ? formatNumber(analysis.max_wavelength, 2) : "-";
  els.importModalMeta.textContent = `${analysis.pixel_count} pixels • ${analysis.slice_count} slices • ${minWave} - ${maxWave} ${analysis.wavelength_unit || ""}`.trim();
  els.importSuggestedReason.textContent = suggestionReasonLabel(analysis.suggestion_reason);
  if (analysis.suggested_width && analysis.suggested_height) {
    els.importSuggestedDims.textContent = `${analysis.suggested_width} × ${analysis.suggested_height}`;
    els.importSuggestedCopy.textContent = `We can suggest this from ${suggestionReasonLabel(analysis.suggestion_reason).toLowerCase()}.`;
    setModalDimensions(analysis.suggested_width, analysis.suggested_height);
  } else {
    els.importSuggestedDims.textContent = "No clear suggestion";
    els.importSuggestedCopy.textContent = "Choose a factor pair or type your own width and height.";
    setModalDimensions(0, 0);
  }
  renderDimensionCandidates(analysis);
  updateModalValidation();
}

async function confirmImportDimensionsAndRender() {
  if (!state.fileAnalysis) return;
  if (!updateModalValidation()) {
    showError("Choose valid pixel dimensions before opening the file.");
    return;
  }
  state.gridWidth = Number(els.modalGridWidth.value);
  state.gridHeight = Number(els.modalGridHeight.value);
  syncGridInputsFromState();
  await refreshSelectedFileFromImportSettings(true);
  closeImportModal();
}

function resetSelectionFromFile(file) {
  state.manualColorLimits = false;
  const anchor = Number.isFinite(file?.min_wavelength) ? file.min_wavelength : 0;
  state.selection = {
    type: "point",
    targetWavelength: anchor,
    startWavelength: anchor,
    endWavelength: anchor,
  };
}

function clampSelectionToFile(file) {
  if (!file) return;
  const minWave = Number.isFinite(file.min_wavelength) ? file.min_wavelength : 0;
  const maxWave = Number.isFinite(file.max_wavelength) ? file.max_wavelength : minWave;
  const clamp = (value) => Math.max(minWave, Math.min(maxWave, Number.isFinite(value) ? value : minWave));
  if (!Number.isFinite(state.selection.targetWavelength)) {
    resetSelectionFromFile(file);
    return;
  }
  state.selection.targetWavelength = clamp(state.selection.targetWavelength);
  state.selection.startWavelength = clamp(state.selection.startWavelength);
  state.selection.endWavelength = clamp(state.selection.endWavelength);
  if (state.selection.type === "range" && state.selection.startWavelength > state.selection.endWavelength) {
    [state.selection.startWavelength, state.selection.endWavelength] = [state.selection.endWavelength, state.selection.startWavelength];
  }
}

async function refreshSelectedFileFromImportSettings(resetSelection = false, options = {}) {
  if (!state.selectedPath) return;
  const info = await fetchJson(buildFileInfoRequest(state.selectedPath, options));
  state.selectedFile = info;
  state.fileAnalysis = await fetchFileAnalysis(state.selectedPath);
  const dims = getGridDimensions();
  state.gridWidth = dims?.width ?? (info.requires_manual_dimensions ? null : info.width);
  state.gridHeight = dims?.height ?? (info.requires_manual_dimensions ? null : info.height);
  syncGridInputsFromState();
  if (resetSelection) resetSelectionFromFile(info);
  else clampSelectionToFile(info);
  syncSmoothDefaults(true);
  state.imageCache.clear();
  state.traceCache.clear();
  state.clickedTraces = [];
  renderClickedList();
  renderMarkers();
  updateReferenceControls();
  renderSelectedFileSummary();
  syncRangeInputs();
  await renderCurrentFile();
}

function currentImageSummary() {
  if (!state.selectedFile || !state.currentPreview) return null;
  const dims = getGridDimensions();
  const width = dims?.width || state.selectedFile.width;
  const height = dims?.height || state.selectedFile.height;
  const modeText = els.imageMode.value === "mean" ? "Range Mean" : "Range Sum";
  const unit = currentAxisUnit();
  const selectionText =
    state.selection.type === "point"
      ? `${formatNumber(state.selection.targetWavelength, 2)} ${unit}`
      : `${formatNumber(state.selection.startWavelength, 2)}-${formatNumber(state.selection.endWavelength, 2)} ${unit}`;
  return {
    title: state.selectedFile.name,
    subtitle: `${width} x ${height} px • ${modeText} • ${selectionText}`,
    detail: `${els.colorMap.options[els.colorMap.selectedIndex].text} • ${els.colorScale.value}${els.invertColormap.checked ? " • inverted" : ""}`,
  };
}

function tracesToCsv(bundles, kind = "processed-clicked") {
  if (!bundles.length) return "wavelength";
  const lineOnly = bundles.every((bundle) => bundle.groupType === "line");
  const length = bundles[0].x.length;
  const header = [`${currentAxisLabel()} (${currentAxisUnit()})`, ...bundles.map((bundle) => bundle.exportLabel || bundle.label)];
  const metadata = {app_version: "0.3.4", kind, source: state.selectedFile?.name, source_signature: state.selectedFile?.source_signature, unit: currentAxisUnit(), missing: "empty cell", processing: kind === "raw-mean" ? [] : {reference: els.referenceToggle.checked ? els.referenceSelect.value : null, reference_offset: Number(els.referenceOffset.value), invalid_reference: "abs(denominator)<1e-12 or missing -> missing", smoothing: els.smoothToggle.checked ? {window: Number(els.smoothWindow.value), polynomial: Number(els.smoothPoly.value), domain: "channel index"} : null, normalization: els.normalizeToggle.checked ? "min-max" : null, display_offset: false}, selections: kind === "raw-mean" ? [] : state.clickedTraces.map(({x,y,...meta}) => meta)};
  const rows = ["# " + JSON.stringify(metadata), header.map(csvEscape).join(",")];
  if (lineOnly) {
    rows.push(["pixel_coordinate", ...bundles.map((bundle) => `(${bundle.pixelX}, ${bundle.pixelY})`)].map(csvEscape).join(","));
    rows.push(["distance_px", ...bundles.map((bundle) => formatNumber(bundle.lineDistancePixels, 4))].map(csvEscape).join(","));
    if (bundles.some((bundle) => Number.isFinite(bundle.lineDistancePhysical))) {
      const unit = bundles.find((bundle) => bundle.lineDistanceUnit)?.lineDistanceUnit || "physical";
      rows.push([`distance_${unit}`, ...bundles.map((bundle) => (Number.isFinite(bundle.lineDistancePhysical) ? formatNumber(bundle.lineDistancePhysical, 6) : ""))].map(csvEscape).join(","));
    }
  }
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
  appendImportParams(params);
  return `/api/pl-image?${params.toString()}`;
}

function buildFileInfoRequest(path, options = {}) {
  const params = new URLSearchParams({ path });
  const dims = options.includeGridDimensions === false ? null : getGridDimensions();
  if (dims) {
    params.set("grid_width", String(dims.width));
    params.set("grid_height", String(dims.height));
  }
  appendImportParams(params);
  return `/api/file-info?${params.toString()}`;
}

function buildFileAnalysisRequest(path) {
  const params = new URLSearchParams({ path });
  appendImportParams(params);
  return `/api/file-analysis?${params.toString()}`;
}

async function fetchFileAnalysis(path) {
  return fetchJson(buildFileAnalysisRequest(path));
}

function suggestionReasonLabel(reason) {
  if (reason === "embedded-metadata") return "Embedded metadata";
  if (reason === "perfect-square") return "Square-root guess";
  if (reason === "factor-candidate") return "Closest factor pair";
  return "Manual choice recommended";
}

function activeFileMeta() {
  return state.selectedFile || state.fileAnalysis;
}

async function fetchImagePayload(path) {
  const dims = getGridDimensions();
  const key = `${path}::${dims?.width || "auto"}::${dims?.height || "auto"}::${els.imageMode.value}::${state.selection.type}::${state.selection.targetWavelength}::${state.selection.startWavelength}::${state.selection.endWavelength}`;
  if (state.imageCache.has(key)) return state.imageCache.get(key);
  const requestUrl = buildImageRequest(path);
  const payload = await fetchJson(requestUrl);
  payload.requestUrl = requestUrl;
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
  appendImportParams(params);
  const payload = await fetchJson(`/api/pl-trace?${params.toString()}`);
  state.traceCache.set(key, payload);
  return payload;
}

function getImportQueryParams() {
  const params = new URLSearchParams();
  const dims = getGridDimensions();
  if (dims) {
    params.set("grid_width", String(dims.width));
    params.set("grid_height", String(dims.height));
  }
  appendImportParams(params);
  return params;
}

function getLinePixels(start, end) {
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const points = [];
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

function sampleLineTraceItems(traces, maxCount = 96) {
  if (traces.length <= maxCount) return traces.slice();
  const sampled = [];
  for (let index = 0; index < maxCount; index += 1) {
    const sourceIndex = Math.round((index * (traces.length - 1)) / Math.max(1, maxCount - 1));
    sampled.push(traces[sourceIndex]);
  }
  return sampled;
}

async function fetchSampledPlLineFallback(path, start, end, maxCount = 96) {
  const points = sampleLineTraceItems(getLinePixels(start, end), maxCount);
  const traces = [];
  let xAxis = [];
  let xUnit = currentAxisUnit();
  let xLabel = currentAxisLabel();
  for (const point of points) {
    const payload = await loadTrace(path, point.x, point.y);
    if (!payload?.x?.length || !payload?.trace?.length) continue;
    if (!xAxis.length) {
      xAxis = payload.x.slice();
      xUnit = payload.x_unit || xUnit;
      xLabel = payload.x_label || xLabel;
    }
    traces.push({
      pixel_x: point.x,
      pixel_y: point.y,
      trace: payload.trace.slice(),
      average_count: 1,
    });
  }
  return {
    x: xAxis,
    x_unit: xUnit,
    x_label: xLabel,
    y_unit: "Intensity (a.u.)",
    start_x: start.x,
    start_y: start.y,
    end_x: end.x,
    end_y: end.y,
    thickness: 1,
    traces,
    fallback: true,
  };
}

async function getPlLineTracePayload(path, start, end, options = {}) {
  const thickness = Math.max(1, Number.isFinite(Number(options.thickness)) ? Number(options.thickness) : 1);
  const params = new URLSearchParams({
    path,
    x1: String(start.x),
    y1: String(start.y),
    x2: String(end.x),
    y2: String(end.y),
    thickness: String(thickness),
  });
  const shared = getImportQueryParams();
  shared.forEach((value, key) => params.set(key, value));
  return await fetchJson(`/api/pl-line-trace?${params.toString()}`);
}

function buildPlLineTraceItems(payload) {
  const traces = Array.isArray(payload?.traces) ? payload.traces : [];
  const groupId = `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const groupLabel = `Line (${payload.start_x}, ${payload.start_y}) → (${payload.end_x}, ${payload.end_y})`;
  const calibration = getSpatialCalibration(payload.width, payload.height);
  return traces.map((trace, index) => {
    const dx = trace.pixel_x - payload.start_x;
    const dy = trace.pixel_y - payload.start_y;
    const lineDistancePixels = Math.hypot(dx, dy);
    const lineDistancePhysical = calibration ? Math.hypot(dx * calibration.xStep, dy * calibration.yStep) : null;
    const distanceLabel = Number.isFinite(lineDistancePhysical)
      ? `${formatNumber(lineDistancePhysical, 3)} ${calibration.unit}`.trim()
      : `${formatNumber(lineDistancePixels, 2)} px`;
    return {
      label: `L${index + 1} (${trace.pixel_x}, ${trace.pixel_y})`,
      exportLabel: distanceLabel,
      groupId,
      groupType: "line",
      lineStart: {x: payload.start_x, y: payload.start_y},
      lineEnd: {x: payload.end_x, y: payload.end_y},
      thickness: payload.thickness,
      averageCount: trace.average_count,
      groupLabel,
      pixelX: trace.pixel_x,
      pixelY: trace.pixel_y,
      lineDistancePixels,
      lineDistancePhysical,
      lineDistanceUnit: calibration?.unit || "",
      x: payload.x.slice(),
      y: trace.trace.slice(),
    };
  });
}

async function appendPlLineTrace(path, start, end, thickness = 1) {
  const payload = await getPlLineTracePayload(path, start, end, { thickness });
  if (path !== state.selectedPath) return;
  const items = buildPlLineTraceItems(payload);
  if (!items.length) return;
  for (const item of items) {
    state.clickedTraces.push(item);
  }
  renderClickedList();
  updateReferenceControls();
  renderMarkers();
  await renderMeanAndClickedPlots();
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
  const x = Math.max(0, Math.min(preview.source_width - 1, Math.floor(Math.min(preview.width - 1, Math.floor(relX * preview.width)) * preview.source_width / preview.width)));
  const y = Math.max(0, Math.min(preview.source_height - 1, Math.floor(Math.min(preview.height - 1, Math.floor(relY * preview.height)) * preview.source_height / preview.height)));
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
  if (state.lineDrag?.start && state.lineDrag?.current) {
    const startX = layout.drawLeft + ((state.lineDrag.start.x + 0.5) / preview.source_width) * layout.drawWidth;
    const startY = layout.drawTop + ((state.lineDrag.start.y + 0.5) / preview.source_height) * layout.drawHeight;
    const endX = layout.drawLeft + ((state.lineDrag.current.x + 0.5) / preview.source_width) * layout.drawWidth;
    const endY = layout.drawTop + ((state.lineDrag.current.y + 0.5) / preview.source_height) * layout.drawHeight;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    const line = document.createElement("div");
    line.className = "line-overlay";
    line.style.left = `${startX}px`;
    line.style.top = `${startY}px`;
    line.style.width = `${Math.max(2, length)}px`;
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    els.markerLayer.appendChild(line);
    for (const point of [state.lineDrag.start, state.lineDrag.current]) {
      const handle = document.createElement("div");
      handle.className = "line-handle";
      handle.style.left = `${layout.drawLeft + ((point.x + 0.5) / preview.source_width) * layout.drawWidth}px`;
      handle.style.top = `${layout.drawTop + ((point.y + 0.5) / preview.source_height) * layout.drawHeight}px`;
      els.markerLayer.appendChild(handle);
    }
  }
}

async function renderPreview() {
  const requestId = ++state.previewRequest;
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
    if (requestId !== state.previewRequest || file.path !== state.selectedPath) return;
    state.currentPreview = payload;
    const autoLimits = state.manualColorLimits ? resolveColorLimits(payload, els.imageLow.value, els.imageHigh.value, els.imageLowValue.value, els.imageHighValue.value) : effectiveQuantileLimits(payload, els.imageLow.value, els.imageHigh.value);
    els.imageLowValue.value = String(autoLimits.min);
    els.imageHighValue.value = String(autoLimits.max);
    els.imageTitle.textContent = file.name;
    if (payload.selection === "range") {
      els.imageSubtitle.textContent = `${payload.mode === "mean" ? "Range mean" : "Range sum"} • ${formatNumber(payload.range_start_wavelength, 2)} - ${formatNumber(payload.range_end_wavelength, 2)} ${payload.wavelength_unit}`;
    } else {
      els.imageSubtitle.textContent = `Single ${payload.wavelength_axis_label.toLowerCase()} • ${formatNumber(payload.target_wavelength, 2)} ${payload.wavelength_unit}`;
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
    if (requestId !== state.previewRequest) return;
    state.currentPreview = null;
    drawEmptyCanvas(els.imageCanvas, "Failed to render image.");
    showError(`Image render failed:\n${error}`);
    throw error;
  }
}

function renderClickedList() {
  els.clickedList.innerHTML = "";
  const groupedEntries = [];
  const lineGroups = new Map();
  state.clickedTraces.forEach((trace) => {
    if (trace.groupType === "line" && trace.groupId) {
      if (!lineGroups.has(trace.groupId)) {
        lineGroups.set(trace.groupId, {
          id: trace.groupId,
          label: trace.groupLabel || "Line",
          remove: async () => {
        state.clickedTraces = state.clickedTraces.filter((item) => item.groupId !== trace.groupId);
        renderClickedList();
        renderMarkers();
        updateReferenceControls();
        await renderMeanAndClickedPlots();
      },
    });
      }
      return;
    }
    groupedEntries.push({
      id: trace.label,
      label: trace.label,
      remove: async () => {
        state.clickedTraces = state.clickedTraces.filter((item) => item.label !== trace.label);
        renderClickedList();
        renderMarkers();
        updateReferenceControls();
        await renderMeanAndClickedPlots();
      },
    });
  });
  groupedEntries.push(...lineGroups.values());
  groupedEntries.forEach((entry) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${entry.label}</span><button type="button" aria-label="Remove ${entry.label}">x</button>`;
    chip.querySelector("button").addEventListener("click", entry.remove);
    els.clickedList.appendChild(chip);
  });
}

function updateReferenceControls() {
  const currentValue = els.referenceSelect.value;
  const options = [{ value: "", label: "None" }, { value: "__mean__", label: "Global Mean" }];
  const lineGroups = new Map();
  state.clickedTraces.forEach((trace) => {
    if (trace.groupType === "line" && trace.groupId) {
      if (!lineGroups.has(trace.groupId)) {
        lineGroups.set(trace.groupId, trace.groupLabel || "Line");
      }
      return;
    }
    options.push({ value: `point:${trace.label}`, label: trace.label });
  });
  lineGroups.forEach((label, groupId) => {
    options.push({ value: `line:${groupId}`, label });
  });

  els.referenceSelect.innerHTML = "";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    els.referenceSelect.appendChild(node);
  });
  els.referenceSelect.value = options.some((option) => option.value === currentValue) ? currentValue : "";
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
  const requestId = ++state.plotRequest;
  const file = getSelectedFile();
  if (!file) return;
  try {
    const meanPayload = await loadTrace(file.path, 0, 0);
    if (requestId !== state.plotRequest || file.path !== state.selectedPath) return;
    state.lastMeanRawBundle = {
      label: "Global Mean",
      x: meanPayload.x.slice(),
      y: meanPayload.mean_trace.slice(),
    };
    const selectionGuideX = state.selection.type === "point" ? state.selection.targetWavelength : null;
    const rangeStart = state.selection.type === "range" ? state.selection.startWavelength : null;
    const rangeEnd = state.selection.type === "range" ? state.selection.endWavelength : null;
    const rawClickedBundles = state.clickedTraces.map((trace) => ({
      label: trace.label,
      x: trace.x.slice(),
      y: trace.y.slice(),
      groupType: trace.groupType || "point",
      groupId: trace.groupId || null,
      groupLabel: trace.groupLabel || trace.label,
    }));
    const referenceBundle = getSelectedReferenceBundle(rawClickedBundles);
    const processedMeanBundles = applyReferenceAndTraceSettings([state.lastMeanRawBundle], referenceBundle, {
      normalize: false,
      smoothingEnabled: false,
      smoothWindow: els.smoothWindow.value,
      smoothPoly: els.smoothPoly.value,
      offsetFactor: 0,
      applyOffset: false,
    });
    state.meanPlotGeometry = drawPlot(
      els.meanCanvas,
      processedMeanBundles,
      `${meanPayload.x_label} (${meanPayload.x_unit})`,
      {
        selectionGuideX,
        hoverGuideX: state.meanHoverGuide,
        rangeStart,
        rangeEnd,
        xUnit: meanPayload.x_unit,
        view: state.meanView,
        singleColor: meanLineColorForBackground(els.spectrumBackground.value),
        backgroundName: els.spectrumBackground.value,
        axisZoomDrag: state.axisZoomDrag?.target === "mean" ? state.axisZoomDrag : null,
      }
    );
    els.meanSubtitle.textContent = `Mean across ${meanPayload.width} x ${meanPayload.height} pixels.`;

    const clickedBundles = buildClickedBundles();
    if (els.clickedViewMode.value === "heatmap") {
      const heatmap = getClickedHeatmapData(clickedBundles);
      state.clickedPlotGeometry = drawClickedHeatmap(els.clickedCanvas, heatmap);
      els.clickedSubtitle.textContent = heatmap ? `${clickedBundles.length} trace(s) • heatmap • ${els.heatmapRenderMode.value}` : "Click on the map to add spectra.";
    } else {
      state.clickedPlotGeometry = drawPlot(els.clickedCanvas, clickedBundles, `${meanPayload.x_label} (${meanPayload.x_unit})`, {
        selectionGuideX,
        hoverGuideX: state.hoverGuide,
        rangeStart,
        rangeEnd,
        xUnit: meanPayload.x_unit,
        view: state.clickedView,
        colorMapName: els.spectrumColorMap.value,
        invertColormap: els.invertSpectrumColormap.checked,
        backgroundName: els.spectrumBackground.value,
        axisZoomDrag: state.axisZoomDrag?.target === "clicked" ? state.axisZoomDrag : null,
      });
      els.clickedSubtitle.textContent = clickedBundles.length ? `${clickedBundles.length} clicked spectrum(s)` : "Click on the map to add spectra.";
    }
  } catch (error) {
    if (requestId !== state.plotRequest) return;
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
    els.fileSubtitle.textContent = "Choose a PL mapping data file.";
    state.lastMeanRawBundle = null;
    drawEmptyCanvas(els.imageCanvas, "No map loaded.");
    drawEmptyCanvas(els.meanCanvas, "No spectrum loaded.");
    drawEmptyCanvas(els.clickedCanvas, "No clicked spectra.");
    els.clickedList.innerHTML = "";
    updateReferenceControls();
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
  if (file.path !== state.selectedPath) return;
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
  updateReferenceControls();
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
  if (state.fileImportBusy) return;
  state.fileImportBusy = true;
  const progress = document.getElementById("import-progress");
  const controls = [els.pickFileInput, els.modalPickFileInput, els.useSuggestedDims, els.importModalOpenButton];
  controls.forEach(control => { control.disabled = true; });
  const reportProgress = message => {
    if (progress) { progress.hidden = false; progress.textContent = message; }
  };
  reportProgress(`Uploading ${file.name}…`);
  try {
    clearError();
    await applyLearnedImportPreset(file);
    const uploaded = await fetchJson("/api/upload-pickle", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name),
      },
      body: file,
    });
    reportProgress(`Reading ${file.name} and calculating pixel dimensions… The first file can take longer.`);
    state.selectedPath = uploaded.path;
    state.fileAnalysis = null;
    updateModalValidation();
    state.selectedFile = null;
    state.clickedTraces = [];
    state.hoverGuide = null;
    state.meanHoverGuide = null;
    state.meanView = null;
    state.clickedView = null;
    state.gridWidth = null;
    state.gridHeight = null;
    syncGridInputsFromState();
    try {
      const analysis = await fetchFileAnalysis(state.selectedPath);
    state.fileAnalysis = analysis;
    renderSelectedFileSummary();
    openImportModal(analysis);
    } catch (error) {
      if (els.importMode.value === "manual") {
        applyImportSettings({ importMode: "auto" });
        setImportLearningStatus("Learned rule failed for this file. Fell back to Auto.");
        const analysis = await fetchFileAnalysis(state.selectedPath);
        state.fileAnalysis = analysis;
        renderSelectedFileSummary();
        openImportModal(analysis);
      } else {
        throw error;
      }
    }
  } catch (error) {
    showError(`File open failed:\n${error}`);
    console.error(error);
  } finally {
    state.fileImportBusy = false;
    controls.forEach(control => { control.disabled = false; });
    if (progress) { progress.hidden = true; progress.textContent = ""; }
  }
}

async function restorePreviousSession(provided = null) {
  const saved = provided || await fetchJson("/api/session").catch(() => null) || readStoredState();
  if (!saved?.selectedPath) {
    if (!provided && readStoredState()?.selectedPath) return restorePreviousSession(readStoredState());
    return;
  }
  state.restoring = true;
  try {
    applyTheme(saved.uiTheme || "bright");
    state.importPresets = Array.isArray(saved.importPresets) ? saved.importPresets : [];
    applyImportSettings(saved.importSettings || {});
    els.scanSizeX.value = saved.scanSizeX ?? els.scanSizeX.value;
    els.scanSizeY.value = saved.scanSizeY ?? els.scanSizeY.value;
    els.scanUnit.value = saved.scanUnit ?? els.scanUnit.value;
    els.imageMode.value = saved.imageMode ?? els.imageMode.value;
    els.imageTool.value = saved.imageTool ?? "point";
    els.lineThickness.value = saved.lineThickness ?? "1";
    state.manualColorLimits = Boolean(saved.manualColorLimits);
    els.imageLowValue.value = saved.imageLowValue ?? "";
    els.imageHighValue.value = saved.imageHighValue ?? "";
    els.imageLow.value = saved.imageLow ?? els.imageLow.value;
    els.imageHigh.value = saved.imageHigh ?? els.imageHigh.value;
    els.colorMap.value = saved.colorMap ?? els.colorMap.value;
    els.invertColormap.checked = Boolean(saved.invertColormap);
    els.spectrumColorMap.value = saved.spectrumColorMap ?? els.spectrumColorMap.value;
    els.invertSpectrumColormap.checked = Boolean(saved.invertSpectrumColormap);
    els.spectrumBackground.value = saved.spectrumBackground ?? els.spectrumBackground.value;
    els.colorScale.value = saved.colorScale ?? els.colorScale.value;
    els.normalizeToggle.checked = Boolean(saved.normalizeToggle);
    els.referenceToggle.checked = Boolean(saved.referenceToggle);
    els.referenceSelect.value = saved.referenceSelection ?? "";
    els.referenceOffset.value = saved.referenceOffset ?? "0";
    els.clickedViewMode.value = saved.clickedViewMode ?? "spectra";
    els.heatmapNormalizeAxis.value = saved.clickedHeatmapNormalizeAxis ?? "none";
    els.heatmapRenderMode.value = saved.clickedHeatmapRenderMode || "pcolormesh";
    els.heatmapTranspose.checked = Boolean(saved.clickedHeatmapTranspose);
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
    updateImageToolHint();
    updateClickedViewControls();
    try {
      state.selectedFile = await fetchJson(buildFileInfoRequest(state.selectedPath));
      state.fileAnalysis = await fetchFileAnalysis(state.selectedPath);
    } catch (error) {
      if (!state.selectedFile) throw error;
      showError(`Last file could not be reopened automatically:\n${error}`);
      return;
    }
    if (!(state.gridWidth && state.gridHeight)) {
      state.gridWidth = state.selectedFile.requires_manual_dimensions ? null : state.selectedFile.width;
      state.gridHeight = state.selectedFile.requires_manual_dimensions ? null : state.selectedFile.height;
    }
    syncSmoothDefaults(!saved.smoothWindow);
    state.selection = saved.selection || state.selection;
    clampSelectionToFile(state.selectedFile);
    syncRangeInputs();
    updateRangeLabel();
    syncGridInputsFromState();
    renderSelectedFileSummary();
    await renderCurrentFile();
    state.clickedTraces = [];
    if (saved.schema_version === 3 && Array.isArray(saved.clickedTraces)) {
      if (saved.selectedFile?.source_signature !== state.selectedFile.source_signature) {
        showError("Source file changed. Saved selections were not restored; select points or lines again.");
      } else {
        state.clickedTraces = saved.clickedTraces;
      }
    } else {
      for (const pixel of saved.clickedPixels || []) await appendClickedTrace(pixel.x, pixel.y);
    }
    updateReferenceControls();
    els.referenceSelect.value = saved.referenceSelection || "";
    renderMarkers();
    await renderMeanAndClickedPlots();
    renderClickedList();
    writeStoredState();
  } catch (error) {
    showError(`Previous session could not be restored:\n${error}`);
  } finally {
    state.restoring = false;
    if (state.importModalOpen && !state.fileImportBusy) openImportModal(state.fileAnalysis);
  }
}

function bindEvents() {
  document.getElementById("auto-contrast").addEventListener("click", async () => { state.manualColorLimits = false; await renderPreview(); writeStoredState(); });
  document.getElementById("session-save").addEventListener("click", () => {
    const payload = sessionSnapshot();
    persistSession(payload);
    exportBlob(new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"}), "pl-session.json");
  });
  document.getElementById("session-load").addEventListener("change", async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      const saved = JSON.parse(await file.text());
      if (saved.schema_version !== 3 || !Array.isArray(saved.clickedTraces) || saved.clickedTraces.some(t => !Array.isArray(t.x) || !Array.isArray(t.y) || t.x.length !== t.y.length)) throw new Error("Unsupported or invalid session file");
      await restorePreviousSession(saved);
    } catch (error) { showError(`Session open failed: ${error.message}`); }
    event.target.value = "";
  });
  document.getElementById("reload-source").addEventListener("click", async () => {
    try {
      if (!state.selectedPath) return;
      state.clickedTraces = [];
      await refreshSelectedFileFromImportSettings(true);
      renderClickedList(); updateReferenceControls();
    } catch (error) { showError(`Reload failed: ${error.message}`); }
  });
  window.addEventListener("pagehide", () => {
    if (!state.restoring) navigator.sendBeacon("/api/session", new Blob([JSON.stringify(sessionSnapshot())], {type: "application/json"}));
  });

  els.uiTheme.addEventListener("change", () => {
    applyTheme(els.uiTheme.value);
    writeStoredState();
  });
  const handleImportSettingsChange = async (resetSelection = true) => {
    updateImportUi();
    writeStoredState();
    if (!state.selectedPath) return;
    try {
      const analysis = await fetchFileAnalysis(state.selectedPath);
      state.fileAnalysis = analysis;
      renderSelectedFileSummary();
      const dims = getGridDimensions();
      if (!dims || dims.width * dims.height !== analysis.pixel_count) {
        openImportModal(analysis);
        return;
      }
      await refreshSelectedFileFromImportSettings(resetSelection);
      writeStoredState();
    } catch (error) {
      showError(`Import settings failed:\n${error}`);
    }
  };
  els.importMode.addEventListener("change", async () => {
    await handleImportSettingsChange(true);
  });
  els.manualFormat.addEventListener("change", async () => {
    await handleImportSettingsChange(true);
  });
  for (const input of [els.importSkipRows, els.importDelimiter, els.importIndexColumn, els.importXColumn, els.importYColumn, els.importDataStartColumn]) {
    input.addEventListener("change", async () => {
      await handleImportSettingsChange(true);
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      await handleImportSettingsChange(true);
    });
  }
  els.rememberImportRule.addEventListener("click", () => {
    if (!state.currentFilePatternSignature) {
      setImportLearningStatus("Open a file first to learn its format.");
      return;
    }
    rememberImportPreset(state.currentFilePatternSignature, state.selectedFile?.name);
    writeStoredState();
  });
  els.clearImportRules.addEventListener("click", () => {
    state.importPresets = [];
    setImportLearningStatus("Cleared learned import rules.");
    writeStoredState();
  });
  els.openFileModal.addEventListener("click", () => {
    openImportModal(state.fileAnalysis);
  });
  els.pickFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await uploadPickedFile(file);
    els.pickFileInput.value = "";
  });
  els.modalPickFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    openImportModal(null);
    await uploadPickedFile(file);
    els.modalPickFileInput.value = "";
  });
  els.importModalClose.addEventListener("click", () => closeImportModal());
  els.useSuggestedDims.addEventListener("click", async () => {
    if (!state.fileAnalysis?.suggested_width || !state.fileAnalysis?.suggested_height) return;
    setModalDimensions(state.fileAnalysis.suggested_width, state.fileAnalysis.suggested_height);
    await confirmImportDimensionsAndRender();
  });
  els.importModalOpenButton.addEventListener("click", async () => {
    await confirmImportDimensionsAndRender();
  });
  for (const input of [els.modalGridWidth, els.modalGridHeight]) {
    input.addEventListener("input", () => updateModalValidation());
    input.addEventListener("change", () => updateModalValidation());
  }
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
    const name = baseFileName(state.selectedFile?.name, "pl-image");
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
  els.imageExportCsv.addEventListener("click", async () => {
    const preview = state.currentPreview;
    if (!preview) return;
    try {
      const url = new URL(preview.requestUrl, location.origin);
      url.pathname = "/api/pl-image-export";
      url.searchParams.set("source_signature", preview.source_signature);
      const response = await fetch(url);
      if (!response.ok) {
    const body = await response.text();
    let message = body;
    if (response.headers.get("content-type")?.includes("text/html")) {
      const page = new DOMParser().parseFromString(body, "text/html");
      message = Array.from(page.querySelectorAll("p")).map(p => p.textContent)
        .find(text => text.startsWith("Message:"))?.replace(/^Message:\s*/, "") || `HTTP ${response.status}`;
    }
    throw new Error(message || `HTTP ${response.status}`);
  }
      exportBlob(await response.blob(), `${baseFileName(preview.source_name, "pl-map")}-full-map.zip`);
    } catch (error) { showError(`Export failed: ${error.message}`); }
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
    updateReferenceControls();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.meanExportPng.addEventListener("click", () => {
    const name = baseFileName(state.selectedFile?.name, "pl-mean-spectrum");
    exportCanvas(els.meanCanvas, `${name}-mean-spectrum`);
  });
  els.meanExportCsv.addEventListener("click", async () => {
    const file = getSelectedFile();
    if (!file) return;
    const payload = await loadTrace(file.path, 0, 0);
    exportCsv(
      tracesToCsv([{ label: "Global Mean", x: payload.x.slice(), y: payload.mean_trace.slice() }], "raw-mean"),
      `${baseFileName(file.name, "pl-mean-spectrum")}-mean-spectrum`
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
    const name = baseFileName(state.selectedFile?.name, "pl-clicked-spectra");
    exportCanvas(els.clickedCanvas, `${name}-clicked-spectra`);
  });
  els.clickedExportCsv.addEventListener("click", () => {
    const file = getSelectedFile();
    if (!file || !state.clickedTraces.length) return;
    exportCsv(
      tracesToCsv(buildClickedBundles(true)),
      `${baseFileName(file.name, "pl-clicked-spectra")}-clicked-spectra`
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
  els.imageTool.addEventListener("change", () => {
    updateImageToolHint();
    writeStoredState();
  });
  els.lineThickness.addEventListener("change", () => {
    sanitizeLineThickness();
    updateImageToolHint();
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
      state.clickedTraces = [];
      renderClickedList(); updateReferenceControls();
      const dims = getGridDimensions();
      state.gridWidth = dims?.width ?? null;
      state.gridHeight = dims?.height ?? null;
      state.imageCache.clear();
      state.traceCache.clear();
      renderSelectedFileSummary();
      if (state.selectedPath) {
        await refreshSelectedFileFromImportSettings(false);
      } else {
        await renderCurrentFile();
      }
      writeStoredState();
    });
  }
  for (const input of [els.scanSizeX, els.scanSizeY, els.scanUnit]) {
    input.addEventListener("change", async () => {
      const dims = getGridDimensions();
      const calibration = dims ? getSpatialCalibration(dims.width, dims.height) : null;
      for (const trace of state.clickedTraces) {
        if (trace.groupType !== "line" || !trace.lineStart) continue;
        trace.lineDistancePhysical = calibration ? Math.hypot((trace.pixelX-trace.lineStart.x)*calibration.xStep, (trace.pixelY-trace.lineStart.y)*calibration.yStep) : null;
        trace.lineDistanceUnit = calibration?.unit || "";
        trace.exportLabel = calibration ? `${formatNumber(trace.lineDistancePhysical,3)} ${calibration.unit}` : `${formatNumber(trace.lineDistancePixels,2)} px`;
      }
      await renderCurrentFile();
      writeStoredState();
    });
  }
  els.imageLow.addEventListener("input", async () => {
    state.manualColorLimits = false;
    if (Number(els.imageLow.value) >= Number(els.imageHigh.value)) {
      els.imageHigh.value = String(Number(els.imageLow.value) + 1);
    }
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageHigh.addEventListener("input", async () => {
    state.manualColorLimits = false;
    if (Number(els.imageHigh.value) <= Number(els.imageLow.value)) {
      els.imageLow.value = String(Number(els.imageHigh.value) - 1);
    }
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageLowValue.addEventListener("change", async () => {
    state.manualColorLimits = true;
    updateImageRangeLabel();
    await renderPreview();
    writeStoredState();
  });
  els.imageHighValue.addEventListener("change", async () => {
    state.manualColorLimits = true;
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
  els.referenceToggle.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.referenceSelect.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.referenceOffset.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.clickedViewMode.addEventListener("change", async () => {
    updateClickedViewControls();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.heatmapNormalizeAxis.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.heatmapRenderMode.addEventListener("change", async () => {
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.heatmapTranspose.addEventListener("change", async () => {
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
    updateReferenceControls();
    await renderMeanAndClickedPlots();
    writeStoredState();
  });
  els.imageCanvas.addEventListener("mousedown", (event) => {
    if (els.imageTool.value !== "line") return;
    const pixel = getPixelFromEvent(event);
    if (!pixel) return;
    state.lineDrag = { start: pixel, current: pixel };
    state.lineDragMoved = false;
    renderMarkers();
  });
  els.imageCanvas.addEventListener("mousemove", (event) => {
    if (!state.lineDrag) return;
    const pixel = getPixelFromEvent(event);
    if (!pixel) return;
    state.lineDrag.current = pixel;
    if (pixel.x !== state.lineDrag.start.x || pixel.y !== state.lineDrag.start.y) state.lineDragMoved = true;
    renderMarkers();
  });
  els.imageCanvas.addEventListener("mouseleave", () => {
    if (!state.lineDrag) return;
    renderMarkers();
  });
  els.imageCanvas.addEventListener("click", async (event) => {
    if (els.imageTool.value !== "point") return;
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
    els.meanHover.textContent = `${currentAxisLabel()}: ${formatNumber(nearest.value, 2)} ${currentAxisUnit()}`;
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
    if (state.lineDrag) {
      const drag = state.lineDrag;
      const endPixel = getPixelFromEvent(event) || drag.current || drag.start;
      state.lineDrag = null;
      renderMarkers();
      if (els.imageTool.value === "line" && state.lineDragMoved && state.selectedPath) {
        try {
          await appendPlLineTrace(state.selectedPath, drag.start, endPixel, sanitizeLineThickness());
          writeStoredState();
        } catch (error) {
          showError(`Line trace failed:\n${error}`);
        }
      }
      state.lineDragMoved = false;
      return;
    }
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
    if (els.clickedHover) els.clickedHover.textContent = `${currentAxisLabel()}: ${formatNumber(nearest.value, 2)} ${currentAxisUnit()}`;
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
  const saved = readStoredState();
  state.importPresets = Array.isArray(saved?.importPresets) ? saved.importPresets : [];
  applyTheme(saved?.uiTheme || "bright");
  applyImportSettings(saved?.importSettings || {});
  setImportLearningStatus("");
  els.datasetMeta.textContent = "Missing values: gray / gaps. Numeric spectral axes: nm (verify input). Pickle files: trusted sources only.";
  clearError();
  renderSelectedFileSummary();
  renderMultiGallery();
  setActiveTab("viewer");
  updateImageRangeLabel();
  updateOffsetLabel();
  updateImageToolHint();
  updateClickedViewControls();
  bindEvents();
  drawEmptyCanvas(els.imageCanvas, "Choose a data file.");
  drawEmptyCanvas(els.meanCanvas, "No spectrum loaded.");
  drawEmptyCanvas(els.clickedCanvas, "No clicked spectra.");
  syncGridInputsFromState();
  restorePreviousSession().catch((error) => console.warn("Failed to restore previous session", error));
}

init();
