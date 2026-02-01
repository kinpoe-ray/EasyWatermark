import { state, runtime, clamp } from "./core.js";

export const elements = {
  fileInput: document.getElementById("fileInput"),
  logoInput: document.getElementById("logoInput"),
  fileSummary: document.getElementById("fileSummary"),
  previewBtn: document.getElementById("previewBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewViewport: document.getElementById("previewViewport"),
  progress: document.getElementById("progress"),
  hint: document.getElementById("hint"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettings: document.getElementById("closeSettings"),
  closeSettings2: document.getElementById("closeSettings2"),
  exportSummary: document.getElementById("exportSummary"),
  helpBtn: document.getElementById("helpBtn"),
  helpModal: document.getElementById("helpModal"),
  closeHelp: document.getElementById("closeHelp"),
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
}

export function updateExportSummary() {
  const formatLabel = state.export.format === "auto" ? "Original" : state.export.format.toUpperCase();
  let resizeLabel = "No resize";
  if (state.export.resizeMode === "width") resizeLabel = `Width ${state.export.resizeValue}px`;
  if (state.export.resizeMode === "height") resizeLabel = `Height ${state.export.resizeValue}px`;
  if (state.export.resizeMode === "max") resizeLabel = `Max ${state.export.resizeValue}px`;
  let renameLabel = "Keep original";
  if (state.export.renameMode === "prefix") renameLabel = `Prefix ${state.export.renamePrefix || "wm_"}`;
  if (state.export.renameMode === "suffix") renameLabel = `Suffix ${state.export.renameSuffix || "_watermarked"}`;
  if (state.export.renameMode === "sequence") renameLabel = `Sequence from ${state.export.sequenceStart || 1}`;
  elements.exportSummary.textContent = `${formatLabel} · ${resizeLabel} · ${renameLabel}`;
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

export function applyMobileCollapse() {
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  document.querySelectorAll(".section-collapsible").forEach((section) => {
    if (!isMobile) {
      section.classList.remove("collapsed");
      return;
    }
    const key = section.dataset.section;
    section.classList.toggle("collapsed", key !== "upload");
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
