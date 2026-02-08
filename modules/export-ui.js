function makeThumb(canvas, maxSize, quality) {
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  thumbCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = thumbCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  return thumbCanvas.toDataURL("image/jpeg", quality);
}

export function setProgress(elements, percent, text) {
  if (elements.progressFill) {
    elements.progressFill.style.width = `${percent}%`;
  }
  if (elements.progress) {
    elements.progress.textContent = text || "";
  }
}

export function updateFileSummary(elements, files, t) {
  if (!elements.fileSummary) return;
  if (!files.length) {
    elements.fileSummary.textContent = t("file.none");
    return;
  }
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const sizeMb = (totalSize / (1024 * 1024)).toFixed(2);
  elements.fileSummary.textContent = t("file.summary", { count: files.length, size: sizeMb });
}

export function updateLivePreview(elements, canvas, enabled) {
  if (!elements.livePreview) return;
  if (!enabled || !canvas) {
    elements.livePreview.removeAttribute("src");
    return;
  }
  elements.livePreview.src = makeThumb(canvas, 240, 0.8);
}

export function syncLivePreviewToggle(elements, enabled, t) {
  if (!elements.livePreviewToggle || !elements.livePreview) return;
  elements.livePreviewToggle.checked = enabled;
  const text = enabled ? t("label.livePreviewOn") : t("label.livePreviewOff");
  const textEl = elements.livePreviewToggle.closest(".switch")?.querySelector(".switch-text");
  if (textEl) textEl.textContent = text;
  if (!enabled) {
    elements.livePreview.removeAttribute("src");
  }
}

export function updateExportThumb(elements, canvas) {
  if (!elements.exportThumb || !canvas) return;
  elements.exportThumb.src = makeThumb(canvas, 160, 0.72);
}

export function resetProgress(elements, updateLivePreviewFn) {
  setProgress(elements, 0, "");
  if (elements.exportReport) elements.exportReport.textContent = "";
  if (elements.exportThumb) elements.exportThumb.removeAttribute("src");
  updateLivePreviewFn(null);
}

export function updateExportReport(elements, message) {
  if (!elements.exportReport) return;
  elements.exportReport.textContent = message || "";
}

export function formatProgress(t, index, total, name) {
  const percent = Math.round((index / total) * 100);
  return t("progress.processing", { index, total, percent, name: name || "" }).trim();
}
