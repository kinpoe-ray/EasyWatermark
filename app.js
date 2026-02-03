import {
  state,
  runtime,
  clamp,
  fileToDataUrl,
  loadLogoFromDataUrl,
  renderImageWithWatermark,
  resolveOutputFormat,
  getOutputName,
  getRandomPosition,
  resetImageCache,
} from "./core.js";
import {
  BUILTIN_TEMPLATES,
  loadTemplate,
  saveTemplate,
  getSavedTemplates,
  addTemplate,
  removeTemplate,
  touchRecentTemplate,
  getRecentTemplateIds,
} from "./storage.js";
import {
  elements,
  updateRangeDisplays,
  applyStateToInputs,
  syncStateFromInputs,
  updateExportSummary,
  setActiveTileStyle,
  bindLayerButton,
  syncLayerButtons,
  setLayerButtonsEnabled,
  setWatermarkControlsEnabled,
  applyMobileCollapse,
  setupSectionToggles,
  setupZoom,
  applyZoom,
} from "./ui.js";

function getSettings() {
  return {
    ...state,
    logoImage: runtime.logoImage,
  };
}

function updateHint(message) {
  elements.hint.textContent = message;
}

let renderQueued = false;

function setPrimaryButtonsEnabled(enabled) {
  elements.previewBtn.disabled = !enabled;
  elements.downloadBtn.disabled = !enabled;
  if (elements.previewBtnMobile) elements.previewBtnMobile.disabled = !enabled;
  if (elements.downloadBtnMobile) elements.downloadBtnMobile.disabled = !enabled;
}

function adjustZoom(delta) {
  runtime.zoom.scale = clamp(runtime.zoom.scale + delta, 0.6, 3);
  applyZoom();
}

function resetZoom() {
  runtime.zoom.scale = 1;
  applyZoom();
}

function scheduleRenderPreview() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function updateControlAvailability() {
  const removeOnly = state.processMode === "remove-gemini" && !state.removeThenAdd;
  setWatermarkControlsEnabled(!removeOnly);
  setLayerButtonsEnabled(!removeOnly);
}

function syncAdvancedVisibility() {
  if (!elements.advancedControls) return;
  const shouldOpen = state.mode === "tile" || state.type === "logo";
  elements.advancedControls.classList.toggle("is-open", shouldOpen);
}

function syncHint() {
  if (state.processMode === "remove-gemini" && !state.removeThenAdd) {
    updateHint("Gemini 可见水印移除（不影响 SynthID）");
    return;
  }
  if (state.mode === "tile") {
    updateHint("平铺模式无法拖动");
    return;
  }
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  updateHint(isMobile ? "拖动水印调整位置 · 双指缩放预览" : "拖动水印调整位置");
}

async function renderPreview() {
  if (runtime.files.length === 0) return;
  syncStateFromInputs();
  updateControlAvailability();
  syncAdvancedVisibility();
  const token = (runtime.renderToken += 1);
  const canvas = await renderImageWithWatermark(runtime.files[runtime.activeImageIndex], getSettings(), true);
  if (token !== runtime.renderToken) return;
  elements.previewCanvas.width = canvas.width;
  elements.previewCanvas.height = canvas.height;
  const ctx = elements.previewCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  runtime.zoom.scale = 1;
  applyZoom();
  syncLayerButtons();
  syncHint();
  saveTemplate();
}

function formatProgress(index, total, name) {
  const percent = Math.round((index / total) * 100);
  const safeName = name ? ` · ${name}` : "";
  return `处理中 ${index}/${total} (${percent}%)${safeName}`;
}

function setProgress(percent, text) {
  if (elements.progressFill) {
    elements.progressFill.style.width = `${percent}%`;
  }
  elements.progress.textContent = text || "";
}

function resetProgress() {
  setProgress(0, "");
  if (elements.exportReport) elements.exportReport.textContent = "";
  if (elements.exportThumb) elements.exportThumb.removeAttribute("src");
}

function updateExportThumb(canvas) {
  if (!elements.exportThumb) return;
  const maxSize = 160;
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  thumbCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = thumbCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  elements.exportThumb.src = thumbCanvas.toDataURL("image/jpeg", 0.72);
}

async function buildOutputs(onEach) {
  const originalPosition = { ...state.position };
  let index = 0;
  for (const file of runtime.files) {
    index += 1;
    setProgress(Math.round((index / runtime.files.length) * 100), formatProgress(index, runtime.files.length, file.name));
    if (state.export.randomizePosition && state.mode === "single") {
      state.position = getRandomPosition(file.name);
    }
    const canvas = await renderImageWithWatermark(file, getSettings());
    updateExportThumb(canvas);
    const { type, quality, ext } = resolveOutputFormat(file);
    const blob = await canvasToBlob(canvas, type, quality);
    const fileName = getOutputName(file, index - 1, ext);
    await onEach({ blob, fileName, index });
  }
  state.position = originalPosition;
}

async function saveImagesToFolder() {
  const dirHandle = await window.showDirectoryPicker();
  await buildOutputs(async ({ blob, fileName }) => {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  });
}

async function downloadImagesIndividually() {
  await buildOutputs(async ({ blob, fileName, index }) => {
    downloadBlob(blob, fileName);
    if (index < runtime.files.length) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
}

function getAllTemplates() {
  return [...BUILTIN_TEMPLATES, ...getSavedTemplates()];
}

function findTemplateById(id) {
  return getAllTemplates().find((tpl) => tpl.id === id);
}

function renderTemplateSelect(selectedId) {
  if (!elements.templateSelect) return;
  const templates = getAllTemplates();
  elements.templateSelect.innerHTML = "";

  const builtinGroup = document.createElement("optgroup");
  builtinGroup.label = "内置模板";
  BUILTIN_TEMPLATES.forEach((tpl) => {
    const option = document.createElement("option");
    option.value = tpl.id;
    option.textContent = tpl.name;
    builtinGroup.appendChild(option);
  });
  elements.templateSelect.appendChild(builtinGroup);

  const customGroup = document.createElement("optgroup");
  customGroup.label = "自定义模板";
  templates.filter((tpl) => !tpl.id.startsWith("builtin")).forEach((tpl) => {
    const option = document.createElement("option");
    option.value = tpl.id;
    option.textContent = tpl.name;
    customGroup.appendChild(option);
  });
  elements.templateSelect.appendChild(customGroup);

  elements.templateSelect.value = selectedId || BUILTIN_TEMPLATES[0].id;
}

function renderRecentTemplates() {
  if (!elements.recentTemplates) return;
  elements.recentTemplates.innerHTML = "";
  const recentIds = getRecentTemplateIds();
  const templates = getAllTemplates();
  recentIds
    .map((id) => templates.find((tpl) => tpl.id === id))
    .filter(Boolean)
    .forEach((tpl) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = tpl.name;
      btn.addEventListener("click", () => {
        applyTemplateById(tpl.id);
        elements.templateSelect.value = tpl.id;
      });
      elements.recentTemplates.appendChild(btn);
    });
}

function applyTemplateById(id) {
  const tpl = findTemplateById(id);
  if (!tpl) return;
  const data = tpl.data || {};
  Object.assign(state, data, { processMode: "add", removeThenAdd: false });
  applyStateToInputs();
  updateExportSummary();
  if (data.logoDataUrl) {
    state.logoDataUrl = data.logoDataUrl;
    loadLogoFromDataUrl(data.logoDataUrl, scheduleRenderPreview);
  } else {
    state.logoDataUrl = null;
    runtime.logoImage = null;
    scheduleRenderPreview();
  }
  touchRecentTemplate(id);
  renderRecentTemplates();
}

function updateTemplateActions(id) {
  if (!elements.deleteTemplateBtn) return;
  const isBuiltin = id && id.startsWith("builtin");
  elements.deleteTemplateBtn.disabled = !!isBuiltin;
}

function createTemplateSnapshot() {
  const snapshot = {
    ...state,
    processMode: "add",
    removeThenAdd: false,
  };
  if (runtime.logoImage && state.logoDataUrl) {
    snapshot.logoDataUrl = state.logoDataUrl;
  }
  return snapshot;
}

function updateExportReport(message) {
  if (!elements.exportReport) return;
  elements.exportReport.textContent = message || "";
}

function setupEvents() {
  [
    elements.opacityInput,
    elements.rotationInput,
    elements.qualityInput,
    elements.fontSizeInput,
    elements.scaleInput,
    elements.tileGapInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      syncStateFromInputs();
      updateRangeDisplays();
      scheduleRenderPreview();
    });
  });

  ["wmText", "fontFamily", "wmColor", "mode", "processMode"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncStateFromInputs();
      updateExportSummary();
      scheduleRenderPreview();
    });
  });

  [
    elements.resizeModeInput,
    elements.resizeValueInput,
    elements.renameModeInput,
    elements.renamePrefixInput,
    elements.renameSuffixInput,
    elements.sequenceStartInput,
    elements.randomizePositionInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      syncStateFromInputs();
      updateExportSummary();
    });
  });

  elements.exportMethod.addEventListener("change", () => {
    syncStateFromInputs();
    updateExportSummary();
  });

  elements.removeThenAddInput.addEventListener("change", () => {
    if (elements.removeThenAddInput.checked) {
      elements.processModeInput.value = "remove-gemini";
    } else {
      elements.processModeInput.value = "add";
    }
    syncStateFromInputs();
    updateExportSummary();
    scheduleRenderPreview();
  });

  elements.settingsBtn.addEventListener("click", () => elements.settingsModal.classList.add("show"));
  if (elements.settingsBtnMobile) {
    elements.settingsBtnMobile.addEventListener("click", () => elements.settingsModal.classList.add("show"));
  }
  elements.closeSettings.addEventListener("click", () => elements.settingsModal.classList.remove("show"));
  elements.closeSettings2.addEventListener("click", () => elements.settingsModal.classList.remove("show"));
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) elements.settingsModal.classList.remove("show");
  });

  elements.helpBtn.addEventListener("click", () => elements.helpModal.classList.add("show"));
  elements.closeHelp.addEventListener("click", () => elements.helpModal.classList.remove("show"));
  elements.helpModal.addEventListener("click", (event) => {
    if (event.target === elements.helpModal) elements.helpModal.classList.remove("show");
  });

  elements.advancedToggle.addEventListener("click", () => {
    elements.advancedControls.classList.toggle("is-open");
  });

  elements.templateSelect.addEventListener("change", (event) => {
    const id = event.target.value;
    applyTemplateById(id);
    updateTemplateActions(id);
  });

  elements.saveTemplateBtn.addEventListener("click", () => {
    const name = elements.templateNameInput.value.trim();
    if (!name) return;
    const snapshot = createTemplateSnapshot();
    const template = {
      id: `custom-${Date.now()}`,
      name,
      data: snapshot,
    };
    addTemplate(template);
    elements.templateNameInput.value = "";
    renderTemplateSelect(template.id);
    updateTemplateActions(template.id);
    renderRecentTemplates();
  });

  elements.deleteTemplateBtn.addEventListener("click", () => {
    const id = elements.templateSelect.value;
    if (!id || id.startsWith("builtin")) return;
    removeTemplate(id);
    renderTemplateSelect(BUILTIN_TEMPLATES[0].id);
    updateTemplateActions(BUILTIN_TEMPLATES[0].id);
    renderRecentTemplates();
  });

  elements.tileStyleEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-style]");
    if (!btn) return;
    state.tileStyle = btn.dataset.style;
    setActiveTileStyle(state.tileStyle);
    scheduleRenderPreview();
  });

  bindLayerButton(elements.addTextBtn, "text", scheduleRenderPreview);
  bindLayerButton(elements.addLogoBtn, "logo", scheduleRenderPreview);
  bindLayerButton(elements.removeBtn, null, scheduleRenderPreview);
  bindLayerButton(elements.addTextBtnMobile, "text", scheduleRenderPreview);
  bindLayerButton(elements.addLogoBtnMobile, "logo", scheduleRenderPreview);
  bindLayerButton(elements.removeBtnMobile, null, scheduleRenderPreview);

  elements.logoInput.addEventListener("change", async () => {
    const file = elements.logoInput.files && elements.logoInput.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    state.logoDataUrl = dataUrl;
    loadLogoFromDataUrl(dataUrl, scheduleRenderPreview);
  });

  elements.fileInput.addEventListener("change", () => {
    resetImageCache();
    resetProgress();
    runtime.files = Array.from(elements.fileInput.files || []);
    runtime.activeImageIndex = 0;
    if (runtime.files.length === 0) {
      elements.fileSummary.textContent = "未选择图片";
      setPrimaryButtonsEnabled(false);
      return;
    }

    const totalSize = runtime.files.reduce((sum, file) => sum + file.size, 0);
    const sizeMb = (totalSize / (1024 * 1024)).toFixed(2);
    elements.fileSummary.textContent = `${runtime.files.length} 张图片 (${sizeMb} MB)`;
    setPrimaryButtonsEnabled(true);
    scheduleRenderPreview();
  });

  elements.previewBtn.addEventListener("click", renderPreview);
  if (elements.previewBtnMobile) {
    elements.previewBtnMobile.addEventListener("click", renderPreview);
  }

  elements.downloadBtn.addEventListener("click", async () => {
    if (runtime.files.length === 0) return;
    setPrimaryButtonsEnabled(false);
    setProgress(0, "开始渲染...");
    updateExportReport("");

    try {
      const method = state.export.method || "zip";
      if (method === "zip") {
        const zip = new window.JSZip();
        await buildOutputs(async ({ blob, fileName }) => {
          zip.file(fileName, blob);
        });
        setProgress(100, "正在打包...");
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `watermark-kpr-${Date.now()}.zip`);
        updateExportReport(`完成 ${runtime.files.length} 张图片，已打包 ZIP`);
      } else if (method === "folder") {
        if ("showDirectoryPicker" in window) {
          await saveImagesToFolder();
          updateExportReport(`完成 ${runtime.files.length} 张图片，已保存到文件夹`);
        } else {
          await downloadImagesIndividually();
          updateExportReport(`完成 ${runtime.files.length} 张图片，已逐张下载`);
        }
      } else {
        await downloadImagesIndividually();
        updateExportReport(`完成 ${runtime.files.length} 张图片，已逐张下载`);
      }
      setProgress(100, "完成");
    } catch (error) {
      if (error && error.name === "AbortError") {
        setProgress(0, "已取消");
      } else {
        console.error(error);
        setProgress(0, "失败，请查看控制台");
      }
    } finally {
      setPrimaryButtonsEnabled(true);
    }
  });
  if (elements.downloadBtnMobile) {
    elements.downloadBtnMobile.addEventListener("click", () => elements.downloadBtn.click());
  }

  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener("click", () => adjustZoom(-0.2));
  }
  if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener("click", () => adjustZoom(0.2));
  }
  if (elements.zoomResetBtn) {
    elements.zoomResetBtn.addEventListener("click", resetZoom);
  }

  elements.previewCanvas.addEventListener("pointerdown", (event) => {
    if (!runtime.files.length || state.mode === "tile" || !state.type) return;
    if (state.processMode === "remove-gemini" && !state.removeThenAdd) return;
    const hit = hitTest(event);
    if (!hit) return;
    runtime.isDragging = true;
    runtime.dragOffset = hit.offset;
    elements.previewCanvas.setPointerCapture(event.pointerId);
  });

  elements.previewCanvas.addEventListener("pointermove", (event) => {
    if (!runtime.isDragging) return;
    const pos = getCanvasPoint(event);
    const width = elements.previewCanvas.width;
    const height = elements.previewCanvas.height;
    state.position = {
      x: clamp((pos.x - runtime.dragOffset.x) / width, 0, 1),
      y: clamp((pos.y - runtime.dragOffset.y) / height, 0, 1),
    };
    scheduleRenderPreview();
  });

  elements.previewCanvas.addEventListener("pointerup", (event) => {
    if (!runtime.isDragging) return;
    runtime.isDragging = false;
    elements.previewCanvas.releasePointerCapture(event.pointerId);
    saveTemplate();
  });
}

function hitTest(event) {
  const { type } = state;
  if (!type) return null;

  const pos = getCanvasPoint(event);
  const center = getCenterPoint(elements.previewCanvas.width, elements.previewCanvas.height);
  let width = 0;
  let height = 0;
  const padding = getHitPadding(event);

  if (type === "text") {
    const ctx = elements.previewCanvas.getContext("2d");
    ctx.font = `${state.fontSize}px ${state.fontFamily}`;
    width = ctx.measureText(state.text).width;
    height = state.fontSize;
  } else if (type === "logo" && runtime.logoImage) {
    width = runtime.logoImage.width * state.scale;
    height = runtime.logoImage.height * state.scale;
  }

  if (!width || !height) return null;

  const left = center.x - width / 2 - padding;
  const top = center.y - height / 2 - padding;
  const right = center.x + width / 2 + padding;
  const bottom = center.y + height / 2 + padding;

  if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
    return { offset: { x: pos.x - center.x, y: pos.y - center.y } };
  }
  return null;
}

function getHitPadding(event) {
  const isTouch = event.pointerType === "touch" || window.matchMedia("(max-width: 640px)").matches;
  return isTouch ? 24 : 8;
}

function getCenterPoint(width, height) {
  return {
    x: state.position.x * width,
    y: state.position.y * height,
  };
}

function getCanvasPoint(event) {
  const rect = elements.previewCanvas.getBoundingClientRect();
  const scaleX = elements.previewCanvas.width / rect.width;
  const scaleY = elements.previewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

updateRangeDisplays();
applyStateToInputs();
syncLayerButtons();
setupEvents();
setupSectionToggles();
applyMobileCollapse();
window.addEventListener("resize", applyMobileCollapse);
setupZoom();
loadTemplate(() => {
  applyStateToInputs();
  updateExportSummary();
  updateControlAvailability();
  syncAdvancedVisibility();
}, renderPreview);

renderTemplateSelect();
renderRecentTemplates();
updateTemplateActions(elements.templateSelect.value);
updateControlAvailability();

if (!("showDirectoryPicker" in window)) {
  const option = elements.exportMethod.querySelector('option[value="folder"]');
  if (option) option.disabled = true;
  if (elements.exportMethod.value === "folder") {
    elements.exportMethod.value = "zip";
    syncStateFromInputs();
    updateExportSummary();
  }
}


setPrimaryButtonsEnabled(false);
resetProgress();

export { renderPreview, updateHint };
