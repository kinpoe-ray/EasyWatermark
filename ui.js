import { state, runtime, clamp } from "./core.js";

export const elements = {
  fileInput: document.getElementById("fileInput"),
  logoInput: document.getElementById("logoInput"),
  fileSummary: document.getElementById("fileSummary"),
  previewBtn: document.getElementById("previewBtn"),
  previewBtnMobile: document.getElementById("previewBtnMobile"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadBtnMobile: document.getElementById("downloadBtnMobile"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewViewport: document.getElementById("previewViewport"),
  previewIndex: document.getElementById("previewIndex"),
  dragHint: document.getElementById("dragHint"),
  prevImageBtn: document.getElementById("prevImageBtn"),
  nextImageBtn: document.getElementById("nextImageBtn"),
  prevImageBtnOverlay: document.getElementById("prevImageBtnOverlay"),
  nextImageBtnOverlay: document.getElementById("nextImageBtnOverlay"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomResetBtn: document.getElementById("zoomResetBtn"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  progress: document.getElementById("progress"),
  progressFill: document.getElementById("progressFill"),
  exportReport: document.getElementById("exportReport"),
  exportThumb: document.getElementById("exportThumb"),
  hint: document.getElementById("hint"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsBtnMobile: document.getElementById("settingsBtnMobile"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettings: document.getElementById("closeSettings"),
  closeSettings2: document.getElementById("closeSettings2"),
  exportSummary: document.getElementById("exportSummary"),
  exportMethodTip: document.getElementById("exportMethodTip"),
  helpBtn: document.getElementById("helpBtn"),
  helpModal: document.getElementById("helpModal"),
  closeHelp: document.getElementById("closeHelp"),
  templateSelect: document.getElementById("templateSelect"),
  templateNameInput: document.getElementById("templateName"),
  saveTemplateBtn: document.getElementById("saveTemplateBtn"),
  deleteTemplateBtn: document.getElementById("deleteTemplateBtn"),
  recentTemplates: document.getElementById("recentTemplates"),
  watermarkControls: document.getElementById("watermarkControls"),
  advancedToggle: document.getElementById("advancedToggle"),
  advancedControls: document.getElementById("advancedControls"),
  addTextBtn: document.getElementById("addTextBtn"),
  addLogoBtn: document.getElementById("addLogoBtn"),
  removeBtn: document.getElementById("removeBtn"),
  addTextBtnMobile: document.getElementById("addTextBtnMobile"),
  addLogoBtnMobile: document.getElementById("addLogoBtnMobile"),
  removeBtnMobile: document.getElementById("removeBtnMobile"),
  processModeInput: document.getElementById("processMode"),
  removeThenAddInput: document.getElementById("removeThenAdd"),
  opacityInput: document.getElementById("opacity"),
  opacityValue: document.getElementById("opacityValue"),
  rotationInput: document.getElementById("rotation"),
  rotationValue: document.getElementById("rotationValue"),
  qualityInput: document.getElementById("quality"),
  qualityValue: document.getElementById("qualityValue"),
  fontSizeInput: document.getElementById("fontSize"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  scaleInput: document.getElementById("scale"),
  scaleValue: document.getElementById("scaleValue"),
  tileGapInput: document.getElementById("tileGap"),
  tileGapValue: document.getElementById("tileGapValue"),
  tileStyleEl: document.getElementById("tileStyle"),
  resizeModeInput: document.getElementById("resizeMode"),
  resizeValueInput: document.getElementById("resizeValue"),
  renameModeInput: document.getElementById("renameMode"),
  renamePrefixInput: document.getElementById("renamePrefix"),
  renameSuffixInput: document.getElementById("renameSuffix"),
  sequenceStartInput: document.getElementById("sequenceStart"),
  randomizePositionInput: document.getElementById("randomizePosition"),
  wmText: document.getElementById("wmText"),
  fontFamily: document.getElementById("fontFamily"),
  wmColor: document.getElementById("wmColor"),
  modeSelect: document.getElementById("mode"),
  formatSelect: document.getElementById("format"),
  exportMethod: document.getElementById("exportMethod"),
};

export function updateRangeDisplays() {
  elements.opacityValue.textContent = elements.opacityInput.value;
  elements.rotationValue.textContent = `${elements.rotationInput.value}°`;
  elements.qualityValue.textContent = elements.qualityInput.value;
  elements.fontSizeValue.textContent = elements.fontSizeInput.value;
  elements.scaleValue.textContent = Number(elements.scaleInput.value).toFixed(2);
  elements.tileGapValue.textContent = elements.tileGapInput.value;
}

export function applyStateToInputs() {
  elements.wmText.value = state.text;
  elements.processModeInput.value = state.processMode;
  elements.removeThenAddInput.checked = state.removeThenAdd;
  elements.fontFamily.value = state.fontFamily;
  elements.fontSizeInput.value = state.fontSize;
  elements.wmColor.value = state.color;
  elements.opacityInput.value = state.opacity;
  elements.rotationInput.value = state.rotation;
  elements.scaleInput.value = state.scale;
  elements.modeSelect.value = state.mode;
  elements.tileGapInput.value = state.tileGap;
  setActiveTileStyle(state.tileStyle);
  elements.formatSelect.value = state.export.format;
  elements.qualityInput.value = state.export.quality;
  elements.resizeModeInput.value = state.export.resizeMode;
  elements.resizeValueInput.value = state.export.resizeValue;
  elements.renameModeInput.value = state.export.renameMode;
  elements.renamePrefixInput.value = state.export.renamePrefix;
  elements.renameSuffixInput.value = state.export.renameSuffix;
  elements.sequenceStartInput.value = state.export.sequenceStart;
  elements.randomizePositionInput.checked = state.export.randomizePosition;
  elements.exportMethod.value = state.export.method || "folder";
  updateRangeDisplays();
  updateExportSummary();
}

export function syncStateFromInputs() {
  state.processMode = elements.processModeInput.value;
  state.removeThenAdd = elements.removeThenAddInput.checked;
  state.text = elements.wmText.value.trim() || "Watermark";
  state.fontFamily = elements.fontFamily.value;
  state.fontSize = Number(elements.fontSizeInput.value) || 48;
  state.color = elements.wmColor.value;
  state.opacity = Number(elements.opacityInput.value);
  state.rotation = Number(elements.rotationInput.value);
  state.scale = Number(elements.scaleInput.value);
  state.mode = elements.modeSelect.value;
  state.tileGap = Number(elements.tileGapInput.value);
  state.export.format = elements.formatSelect.value;
  state.export.quality = Number(elements.qualityInput.value);
  state.export.resizeMode = elements.resizeModeInput.value;
  state.export.resizeValue = Number(elements.resizeValueInput.value) || 1024;
  state.export.renameMode = elements.renameModeInput.value;
  state.export.renamePrefix = elements.renamePrefixInput.value.trim();
  state.export.renameSuffix = elements.renameSuffixInput.value.trim();
  state.export.sequenceStart = Number(elements.sequenceStartInput.value) || 1;
  state.export.randomizePosition = elements.randomizePositionInput.checked;
  state.export.method = elements.exportMethod.value;
}

export function updateExportSummary() {
  const formatLabel = state.export.format === "auto" ? "原图格式" : state.export.format.toUpperCase();
  let resizeLabel = "不缩放";
  if (state.export.resizeMode === "width") resizeLabel = `宽度 ${state.export.resizeValue}px`;
  if (state.export.resizeMode === "height") resizeLabel = `高度 ${state.export.resizeValue}px`;
  if (state.export.resizeMode === "max") resizeLabel = `最长边 ${state.export.resizeValue}px`;
  let renameLabel = "保留原名";
  if (state.export.renameMode === "prefix") renameLabel = `前缀 ${state.export.renamePrefix || "wm_"}`;
  if (state.export.renameMode === "suffix") renameLabel = `后缀 ${state.export.renameSuffix || "_watermarked"}`;
  if (state.export.renameMode === "sequence") renameLabel = `序列起始 ${state.export.sequenceStart || 1}`;
  const methodMap = {
    folder: "保存到文件夹",
    individual: "逐张下载",
    zip: "ZIP",
  };
  const methodLabel = methodMap[state.export.method] || "ZIP";
  elements.exportSummary.textContent = `${formatLabel} · ${resizeLabel} · ${renameLabel} · ${methodLabel}`;
  updateExportMethodTip();
}

export function updateExportMethodTip() {
  if (!elements.exportMethodTip) return;
  const method = state.export.method;
  if (method === "folder") {
    elements.exportMethodTip.textContent = "保存到文件夹：仅桌面 Chrome/Edge 支持；iOS Safari 会自动改为「逐张下载」。";
    return;
  }
  if (method === "individual") {
    elements.exportMethodTip.textContent = "逐张下载：会触发多次下载提示，适合少量图片。";
    return;
  }
  elements.exportMethodTip.textContent = "ZIP 打包：只下载一个文件，适合移动端与批量导出。";
}

export function setActiveTileStyle(style) {
  if (!elements.tileStyleEl) return;
  elements.tileStyleEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.style === style);
  });
}

export function bindLayerButton(button, type, onChange) {
  if (!button) return;
  button.addEventListener("click", () => {
    state.type = type;
    onChange();
  });
}

export function setLayerButtonsEnabled(enabled) {
  [
    elements.addTextBtn,
    elements.addLogoBtn,
    elements.removeBtn,
    elements.addTextBtnMobile,
    elements.addLogoBtnMobile,
    elements.removeBtnMobile,
  ].forEach((btn) => {
    if (!btn) return;
    btn.disabled = !enabled;
  });
}

export function syncLayerButtons() {
  const isText = state.type === "text";
  const isLogo = state.type === "logo";
  const isRemove = !state.type;
  [
    [elements.addTextBtn, isText],
    [elements.addLogoBtn, isLogo],
    [elements.removeBtn, isRemove],
    [elements.addTextBtnMobile, isText],
    [elements.addLogoBtnMobile, isLogo],
    [elements.removeBtnMobile, isRemove],
  ].forEach(([btn, active]) => {
    if (!btn) return;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function setWatermarkControlsEnabled(enabled) {
  if (!elements.watermarkControls) return;
  elements.watermarkControls.classList.toggle("is-disabled", !enabled);
  elements.watermarkControls.querySelectorAll("input, select, button").forEach((el) => {
    el.disabled = !enabled;
  });
}

export function applyMobileCollapse() {
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  document.querySelectorAll(".section-collapsible").forEach((section) => {
    if (!isMobile) {
      section.classList.remove("collapsed");
      return;
    }
    const key = section.dataset.section;
    section.classList.toggle("collapsed", !["upload", "watermark"].includes(key));
  });
}

export function setupSectionToggles() {
  document.querySelectorAll(".section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const section = toggle.closest(".section-collapsible");
      if (!section) return;
      section.classList.toggle("collapsed");
    });
  });
}

export function applyZoom() {
  if (!elements.previewViewport) return;
  elements.previewViewport.style.transform = `scale(${runtime.zoom.scale})`;
}

export function setupZoom() {
  if (!elements.previewViewport) return;

  elements.previewViewport.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      runtime.zoom.startDist = getTouchDistance(event.touches[0], event.touches[1]);
      runtime.zoom.startScale = runtime.zoom.scale;
    }
  }, { passive: true });

  elements.previewViewport.addEventListener("touchmove", (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const dist = getTouchDistance(event.touches[0], event.touches[1]);
      const factor = dist / runtime.zoom.startDist;
      runtime.zoom.scale = clamp(runtime.zoom.startScale * factor, 0.6, 3);
      applyZoom();
    }
  }, { passive: false });

  elements.previewViewport.addEventListener("touchend", () => {
    elements.previewViewport.style.transition = "transform 0.08s ease-out";
    setTimeout(() => {
      elements.previewViewport.style.transition = "";
    }, 120);
  });
}

function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}
