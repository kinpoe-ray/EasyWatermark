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
} from "./core.js";
import { loadTemplate, saveTemplate } from "./storage.js";
import {
  elements,
  updateRangeDisplays,
  applyStateToInputs,
  syncStateFromInputs,
  updateExportSummary,
  setActiveTileStyle,
  bindLayerButton,
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

function syncHint() {
  if (state.processMode === "remove-gemini" && !state.removeThenAdd) {
    updateHint("Gemini 可见水印移除（不影响 SynthID）");
    return;
  }
  if (state.mode === "tile") {
    updateHint("平铺模式无法拖动");
    return;
  }
  updateHint("拖动水印调整位置");
}

async function renderPreview() {
  if (runtime.files.length === 0) return;
  syncStateFromInputs();
  const canvas = await renderImageWithWatermark(runtime.files[runtime.activeImageIndex], getSettings(), true);
  elements.previewCanvas.width = canvas.width;
  elements.previewCanvas.height = canvas.height;
  const ctx = elements.previewCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  runtime.zoom.scale = 1;
  applyZoom();
  syncHint();
  saveTemplate();
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
      renderPreview();
    });
  });

  ["wmText", "fontFamily", "wmColor", "mode", "processMode"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncStateFromInputs();
      renderPreview();
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

  elements.removeThenAddInput.addEventListener("change", () => {
    if (elements.removeThenAddInput.checked) {
      elements.processModeInput.value = "remove-gemini";
    } else {
      elements.processModeInput.value = "add";
    }
    syncStateFromInputs();
    renderPreview();
  });

  elements.settingsBtn.addEventListener("click", () => elements.settingsModal.classList.add("show"));
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

  elements.tileStyleEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-style]");
    if (!btn) return;
    state.tileStyle = btn.dataset.style;
    setActiveTileStyle(state.tileStyle);
    renderPreview();
  });

  bindLayerButton(elements.addTextBtn, "text", renderPreview);
  bindLayerButton(elements.addLogoBtn, "logo", renderPreview);
  bindLayerButton(elements.removeBtn, null, renderPreview);
  bindLayerButton(elements.addTextBtnMobile, "text", renderPreview);
  bindLayerButton(elements.addLogoBtnMobile, "logo", renderPreview);
  bindLayerButton(elements.removeBtnMobile, null, renderPreview);

  elements.logoInput.addEventListener("change", async () => {
    const file = elements.logoInput.files && elements.logoInput.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    state.logoDataUrl = dataUrl;
    loadLogoFromDataUrl(dataUrl, renderPreview);
  });

  elements.fileInput.addEventListener("change", () => {
    runtime.files = Array.from(elements.fileInput.files || []);
    runtime.activeImageIndex = 0;
    if (runtime.files.length === 0) {
      elements.fileSummary.textContent = "未选择图片";
      elements.downloadBtn.disabled = true;
      elements.previewBtn.disabled = true;
      return;
    }

    const totalSize = runtime.files.reduce((sum, file) => sum + file.size, 0);
    const sizeMb = (totalSize / (1024 * 1024)).toFixed(2);
    elements.fileSummary.textContent = `${runtime.files.length} 张图片 (${sizeMb} MB)`;
    elements.downloadBtn.disabled = false;
    elements.previewBtn.disabled = false;
    renderPreview();
  });

  elements.previewBtn.addEventListener("click", renderPreview);

  elements.downloadBtn.addEventListener("click", async () => {
    if (runtime.files.length === 0) return;
    elements.downloadBtn.disabled = true;
    elements.previewBtn.disabled = true;
    elements.progress.textContent = "渲染中...";

    try {
      const zip = new window.JSZip();
      const originalPosition = { ...state.position };
      let index = 0;
      for (const file of runtime.files) {
        index += 1;
        elements.progress.textContent = `处理中 ${index}/${runtime.files.length}`;
        if (state.export.randomizePosition && state.mode === "single") {
          state.position = getRandomPosition(file.name);
        }
        const canvas = await renderImageWithWatermark(file, getSettings());
        const { type, quality, ext } = resolveOutputFormat(file);
        const blob = await canvasToBlob(canvas, type, quality);
        const fileName = getOutputName(file, index - 1, ext);
        zip.file(fileName, blob);
      }
      state.position = originalPosition;

      elements.progress.textContent = "正在打包...";
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `watermark-kpr-${Date.now()}.zip`);
      elements.progress.textContent = "完成";
    } catch (error) {
      console.error(error);
      elements.progress.textContent = "失败，请查看控制台";
    } finally {
      elements.downloadBtn.disabled = false;
      elements.previewBtn.disabled = false;
    }
  });

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
    renderPreview();
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

  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const right = center.x + width / 2;
  const bottom = center.y + height / 2;

  if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
    return { offset: { x: pos.x - center.x, y: pos.y - center.y } };
  }
  return null;
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
setupEvents();
setupSectionToggles();
applyMobileCollapse();
window.addEventListener("resize", applyMobileCollapse);
setupZoom();
loadTemplate(() => {
  applyStateToInputs();
  updateExportSummary();
}, renderPreview);

elements.previewBtn.disabled = true;
elements.downloadBtn.disabled = true;

export { renderPreview, updateHint };
