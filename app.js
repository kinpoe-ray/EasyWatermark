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
  syncLayerButtons,
  setLayerButtonsEnabled,
  setWatermarkControlsEnabled,
  setEmptyStateVisible,
  applyMobileCollapse,
  setupSectionToggles,
  setupZoom,
  applyZoom,
  setI18n,
  syncResizeValueVisibility,
  syncJpgQualityVisibility,
} from "./ui.js";
import {
  createI18n,
} from "./modules/i18n.js";
import {
  createUIState,
  syncViewport,
  setModal,
  setSectionOpen,
  setAdvancedOpen,
} from "./modules/ui-state.js";
import {
  setupActionRouter,
} from "./modules/events.js";
import {
  getAllTemplates,
  renderTemplateSelect as renderTemplateSelectUI,
  renderRecentTemplates as renderRecentTemplatesUI,
  createTemplateSnapshot,
  updateTemplateActions as updateTemplateActionsUI,
  applyTemplateById as applyTemplateByIdUI,
} from "./modules/template-ui.js";
import {
  setProgress,
  updateFileSummary,
  updateLivePreview,
  syncLivePreviewToggle,
  updateExportThumb,
  resetProgress,
  updateExportReport,
  formatProgress,
} from "./modules/export-ui.js";
import {
  setupDragEvents,
} from "./modules/drag.js";
import {
  canvasToBlob,
  downloadBlob,
  buildOutputs,
  saveImagesToFolder,
  downloadImagesIndividually,
} from "./modules/export-flow.js";
import {
  openModal as openModalFn,
  closeModal as closeModalFn,
  setupModalClickOutside,
} from "./modules/modal.js";

function getSettings() {
  return {
    ...state,
    logoImage: runtime.logoImage,
  };
}

function updateHint(message) {
  if (!elements.hint) return;
  elements.hint.textContent = message;
}

let renderQueued = false;
let renderDebounceTimer = null;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartTime = 0;
let swipeEligible = false;

const DRAG_HINT_KEY = "easy-watermark-drag-hint-dismissed";
const LANG_KEY = "easy-watermark-lang";
const LIVE_PREVIEW_KEY = "easy-watermark-live-preview";

const i18n = createI18n({ initialLang: localStorage.getItem(LANG_KEY) || "zh" });
const uiState = createUIState({
  livePreviewEnabled: localStorage.getItem(LIVE_PREVIEW_KEY) !== "0",
});
Object.assign(state.ui, uiState);

function syncUiStateToCore() {
  state.ui.viewport = uiState.viewport;
  state.ui.modal = uiState.modal;
  state.ui.livePreviewEnabled = uiState.livePreviewEnabled;
  state.ui.sections = { ...uiState.sections };
  state.ui.advanced = { ...uiState.advanced };
}

function t(key, vars = {}) {
  return i18n.t(key, vars);
}

function applyI18n() {
  i18n.applyToDom(document);
  setI18n(t);
  syncLivePreviewToggle(elements, uiState.livePreviewEnabled, t);
  syncCommonAdvancedStates();
  syncExportAdvancedState();
}

function setLanguage(lang) {
  const currentLang = i18n.setLanguage(lang, document);
  localStorage.setItem(LANG_KEY, currentLang);
  if (elements.langSelect) elements.langSelect.value = currentLang;
  if (elements.moreLangSelect) elements.moreLangSelect.value = currentLang;
  setI18n(t);
  syncLivePreviewToggle(elements, uiState.livePreviewEnabled, t);
  syncCommonAdvancedStates();
  syncExportAdvancedState();
  updateExportSummary();
  syncHint();
  updateDragHintVisibility();
  updateFileSummary(elements, runtime.files, t);
  renderTemplateSelect();
}

function updateLivePreviewImage(canvas) {
  updateLivePreview(elements, canvas, uiState.livePreviewEnabled);
}

function setPrimaryButtonsEnabled(enabled) {
  elements.previewBtn.disabled = !enabled;
  elements.downloadBtn.disabled = !enabled;
}

function adjustZoom(delta) {
  runtime.zoom.scale = clamp(runtime.zoom.scale + delta, 0.6, 3);
  applyZoom();
}

function resetZoom() {
  runtime.zoom.scale = 1;
  applyZoom();
}

function updatePreviewNav() {
  if (!elements.previewIndex) return;
  const total = runtime.files.length;
  const current = total ? runtime.activeImageIndex + 1 : 0;
  elements.previewIndex.textContent = `${current} / ${total}`;
  const canNavigate = total > 1;
  const prevDisabled = !canNavigate || runtime.activeImageIndex === 0;
  const nextDisabled = !canNavigate || runtime.activeImageIndex === total - 1;
  if (elements.prevImageBtn) elements.prevImageBtn.disabled = prevDisabled;
  if (elements.nextImageBtn) elements.nextImageBtn.disabled = nextDisabled;
  if (elements.prevImageBtnOverlay) elements.prevImageBtnOverlay.disabled = prevDisabled;
  if (elements.nextImageBtnOverlay) elements.nextImageBtnOverlay.disabled = nextDisabled;
}

function goToImage(index) {
  if (!runtime.files.length) return;
  const nextIndex = clamp(index, 0, runtime.files.length - 1);
  if (nextIndex === runtime.activeImageIndex) return;
  runtime.activeImageIndex = nextIndex;
  resetZoom();
  scheduleRenderPreview();
  updatePreviewNav();
}

function goPrevImage() {
  goToImage(runtime.activeImageIndex - 1);
}

function goNextImage() {
  goToImage(runtime.activeImageIndex + 1);
}

function scheduleRenderPreview() {
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer);
  }
  renderDebounceTimer = setTimeout(() => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderPreview();
    });
  }, 150);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function updateControlAvailability() {
  const removeOnly = state.processMode === "remove-gemini" && !state.removeThenAdd;
  setWatermarkControlsEnabled(!removeOnly);
  setLayerButtonsEnabled(!removeOnly);
  if (elements.watermarkControls) {
    elements.watermarkControls.classList.toggle("is-hidden", removeOnly && isMobileViewport());
  }
}

function syncAdvancedVisibility() {
  if (!elements.advancedControls) return;
  const shouldOpen = state.mode === "tile" || state.type === "logo";
  elements.advancedControls.classList.toggle("is-open", shouldOpen);
  if (elements.advancedState) {
    elements.advancedState.textContent = t(shouldOpen ? "state.expanded" : "state.collapsed");
  }
}

function syncHint() {
  if (state.processMode === "remove-gemini" && !state.removeThenAdd) {
    updateHint(t("hint.remove"));
    updateDragHintVisibility();
    return;
  }
  updateHint(isMobileViewport() ? t("hint.dragMobile") : t("hint.drag"));
  updateDragHintVisibility();
}

function syncProcessModeButtons() {
  if (!elements.modeToggleButtons || !elements.modeToggleButtons.length) return;
  elements.modeToggleButtons.forEach((btn) => {
    const active = btn.dataset.mode === state.processMode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function syncCommonAdvancedStates() {
  if (elements.commonState && elements.watermarkControls) {
    const isOpen = elements.watermarkControls.classList.contains("show-advanced");
    elements.commonState.textContent = t(isOpen ? "state.expanded" : "state.collapsed");
  }
  if (elements.advancedState && elements.advancedControls) {
    const isOpen = elements.advancedControls.classList.contains("is-open");
    elements.advancedState.textContent = t(isOpen ? "state.expanded" : "state.collapsed");
  }
}

function syncExportAdvancedState() {
  if (!elements.exportAdvancedGroup || !elements.exportAdvancedState) return;
  const open = uiState.advanced.exportOpen;
  elements.exportAdvancedGroup.classList.toggle("is-open", open);
  elements.exportAdvancedState.textContent = t(open ? "state.expanded" : "state.collapsed");
}

function updateDragHintVisibility() {
  if (!elements.dragHint) return;
  const dismissed = localStorage.getItem(DRAG_HINT_KEY) === "1";
  const removeOnly = state.processMode === "remove-gemini" && !state.removeThenAdd;
  const shouldShow = isMobileViewport() && !dismissed && !removeOnly && !!state.type && runtime.files.length > 0;
  elements.dragHint.classList.toggle("is-hidden", !shouldShow);
}

function dismissDragHint() {
  if (!elements.dragHint) return;
  localStorage.setItem(DRAG_HINT_KEY, "1");
  elements.dragHint.classList.add("is-hidden");
}

function setSectionCollapsed(sectionKey, collapsed) {
  const section = document.querySelector(`.section-collapsible[data-section="${sectionKey}"]`);
  if (!section) return;
  section.classList.toggle("collapsed", collapsed);
  setSectionOpen(uiState, sectionKey, !collapsed);
  syncUiStateToCore();
}

function scrollToSection(sectionKey) {
  const section = document.querySelector(`.section-collapsible[data-section="${sectionKey}"]`);
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncMobileSections() {
  if (!isMobileViewport()) return;
  if (runtime.files.length > 0) {
    setSectionCollapsed("export", false);
  }
}

function scrollPreviewIntoView() {
  if (!isMobileViewport()) return;
  const preview = document.querySelector(".preview");
  if (!preview) return;
  preview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openModal(name) {
  setModal(uiState, name);
  syncUiStateToCore();
  openModalFn(uiState, elements, name);
}

function closeModal(name) {
  closeModalFn(uiState, elements, name);
  if (uiState.modal === name) setModal(uiState, "none");
  syncUiStateToCore();
}

async function renderPreview() {
  syncStateFromInputs();
  setEmptyStateVisible(runtime.files.length === 0);
  if (runtime.files.length === 0) {
    updatePreviewNav();
    return;
  }

  updateControlAvailability();
  syncAdvancedVisibility();
  const token = (runtime.renderToken += 1);
  const canvas = await renderImageWithWatermark(runtime.files[runtime.activeImageIndex], getSettings(), true);
  if (token !== runtime.renderToken) return;

  elements.previewCanvas.width = canvas.width;
  elements.previewCanvas.height = canvas.height;
  const ctx = elements.previewCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  updateLivePreviewImage(canvas);

  applyZoom();
  syncLayerButtons();
  syncHint();
  updateDragHintVisibility();
  saveTemplate();
  updatePreviewNav();
}

async function runBuildOutputs(onEach) {
  await buildOutputs({
    state,
    runtime,
    renderImageWithWatermark,
    resolveOutputFormat,
    getOutputName,
    getRandomPosition,
    canvasToBlob,
    onProgress: (index, total, name) => {
      setProgress(elements, Math.round((index / total) * 100), formatProgress(t, index, total, name));
    },
    onThumb: (canvas) => updateExportThumb(elements, canvas),
    onEach,
  });
}

function renderTemplateSelect(selectedId) {
  renderTemplateSelectUI({
    selectEl: elements.templateSelect,
    builtinTemplates: BUILTIN_TEMPLATES,
    savedTemplates: getSavedTemplates(),
    selectedId,
    t,
  });
}

function renderRecentTemplates() {
  const templates = getAllTemplates(BUILTIN_TEMPLATES, getSavedTemplates());
  renderRecentTemplatesUI({
    container: elements.recentTemplates,
    recentIds: getRecentTemplateIds(),
    templates,
    onPick: (id) => {
      applyTemplateById(id);
      elements.templateSelect.value = id;
      updateTemplateActionsUI(elements.deleteTemplateBtn, id);
    },
  });
}

function applyTemplateById(id) {
  applyTemplateByIdUI({
    id,
    builtinTemplates: BUILTIN_TEMPLATES,
    savedTemplates: getSavedTemplates(),
    state,
    runtime,
    applyStateToInputs,
    syncProcessModeButtons,
    updateExportSummary,
    loadLogoFromDataUrl,
    scheduleRenderPreview,
    touchRecentTemplate,
    renderRecent: renderRecentTemplates,
    syncMobileSections,
  });
}

function setupEvents() {
  setupActionRouter({
    root: document,
    handlers: {
      "open-more": () => openModal("more"),
      "close-more": () => closeModal("more"),
      "open-help": () => {
        closeModal("more");
        openModal("help");
      },
      "close-help": () => closeModal("help"),
      "open-export-settings": () => {
        closeModal("more");
        openModal("settings");
      },
      "close-export-settings": () => closeModal("settings"),
      "open-templates": () => {
        closeModal("more");
        setSectionCollapsed("templates", false);
        scrollToSection("templates");
      },
      "focus-preview": () => scrollPreviewIntoView(),
      "open-upload": () => elements.fileInput.click(),
      "toggle-common-advanced": () => {
        elements.watermarkControls.classList.toggle("show-advanced");
        setAdvancedOpen(uiState, "commonOpen", elements.watermarkControls.classList.contains("show-advanced"));
        syncUiStateToCore();
        syncCommonAdvancedStates();
      },
      "toggle-watermark-advanced": () => {
        elements.advancedControls.classList.toggle("is-open");
        syncCommonAdvancedStates();
      },
      "toggle-export-advanced": () => {
        setAdvancedOpen(uiState, "exportOpen", !uiState.advanced.exportOpen);
        syncUiStateToCore();
        syncExportAdvancedState();
      },
      "set-process-mode": (_event, node) => {
        const mode = node.dataset.mode;
        if (!mode) return;
        elements.processModeInput.value = mode;
        syncStateFromInputs();
        syncProcessModeButtons();
        updateExportSummary();
        scheduleRenderPreview();
      },
      "set-layer": (_event, node) => {
        const layer = node.dataset.layer;
        if (layer === "text") state.type = "text";
        if (layer === "logo") state.type = "logo";
        if (layer === "none") state.type = null;
        syncLayerButtons();
        scheduleRenderPreview();
      },
      "reset-watermark": () => {
        state.type = "text";
        state.text = "@watermark";
        state.fontFamily = "Arial";
        state.fontSize = 48;
        state.color = "#ffffff";
        state.opacity = 0.35;
        state.rotation = -20;
        state.scale = 1;
        state.mode = "single";
        state.tileGap = 180;
        state.tileStyle = "single";
        state.position = { x: 0.5, y: 0.5 };
        applyStateToInputs();
        updateRangeDisplays();
        syncLayerButtons();
        setActiveTileStyle();
        scheduleRenderPreview();
      },
      "render-preview": () => renderPreview(),
      "start-export": () => elements.downloadBtn.click(),
    },
  });

  // Mobile quick template buttons
  document.querySelectorAll('.template-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = btn.dataset.template;
      if (templateId) {
        applyTemplateByIdUI(templateId);
        touchRecentTemplate(templateId);
        renderTemplateSelect(templateId);
        renderRecentTemplates();
      }
    });
  });

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

  ["wmText", "fontFamily", "wmColor", "mode"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncStateFromInputs();
      updateExportSummary();
      scheduleRenderPreview();
    });
  });

  elements.formatSelect.addEventListener("change", () => {
    syncStateFromInputs();
    syncJpgQualityVisibility();
    updateExportSummary();
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
      syncResizeValueVisibility();
      updateExportSummary();
    });
  });

  elements.exportMethod.addEventListener("change", () => {
    syncStateFromInputs();
    updateExportSummary();
  });

  elements.removeThenAddInput.addEventListener("change", () => {
    elements.processModeInput.value = elements.removeThenAddInput.checked ? "remove-gemini" : "add";
    syncStateFromInputs();
    syncProcessModeButtons();
    updateExportSummary();
    scheduleRenderPreview();
  });

  if (elements.moreLangSelect) {
    elements.moreLangSelect.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
  }

  if (elements.livePreviewToggle) {
    elements.livePreviewToggle.addEventListener("change", () => {
      uiState.livePreviewEnabled = elements.livePreviewToggle.checked;
      syncUiStateToCore();
      localStorage.setItem(LIVE_PREVIEW_KEY, uiState.livePreviewEnabled ? "1" : "0");
      syncLivePreviewToggle(elements, uiState.livePreviewEnabled, t);
      if (uiState.livePreviewEnabled) {
        renderPreview();
      }
    });
  }

  setupModalClickOutside(elements, closeModal);

  elements.templateSelect.addEventListener("change", (event) => {
    const id = event.target.value;
    applyTemplateById(id);
    updateTemplateActionsUI(elements.deleteTemplateBtn, id);
  });

  elements.saveTemplateBtn.addEventListener("click", () => {
    const name = elements.templateNameInput.value.trim();
    if (!name) return;
    const snapshot = createTemplateSnapshot(state, runtime);
    const template = {
      id: `custom-${Date.now()}`,
      name,
      data: snapshot,
    };
    addTemplate(template);
    elements.templateNameInput.value = "";
    renderTemplateSelect(template.id);
    updateTemplateActionsUI(elements.deleteTemplateBtn, template.id);
    renderRecentTemplates();
    syncMobileSections();
  });

  elements.deleteTemplateBtn.addEventListener("click", () => {
    const id = elements.templateSelect.value;
    if (!id || id.startsWith("builtin")) return;
    removeTemplate(id);
    renderTemplateSelect(BUILTIN_TEMPLATES[0].id);
    updateTemplateActionsUI(elements.deleteTemplateBtn, BUILTIN_TEMPLATES[0].id);
    renderRecentTemplates();
    syncMobileSections();
  });

  elements.tileStyleEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-style]");
    if (!btn) return;
    state.tileStyle = btn.dataset.style;
    setActiveTileStyle(state.tileStyle);
    scheduleRenderPreview();
  });

  elements.logoInput.addEventListener("change", async () => {
    const file = elements.logoInput.files && elements.logoInput.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    state.logoDataUrl = dataUrl;
    loadLogoFromDataUrl(dataUrl, scheduleRenderPreview);
  });

  elements.fileInput.addEventListener("change", () => {
    resetImageCache();
    resetProgress(elements, updateLivePreviewImage);
    runtime.files = Array.from(elements.fileInput.files || []);
    runtime.activeImageIndex = 0;
    updatePreviewNav();
    setEmptyStateVisible(runtime.files.length === 0);

    if (runtime.files.length === 0) {
      updateFileSummary(elements, runtime.files, t);
      setPrimaryButtonsEnabled(false);
      updateDragHintVisibility();
      updateLivePreviewImage(null);
      return;
    }

    updateFileSummary(elements, runtime.files, t);
    setPrimaryButtonsEnabled(true);
    scheduleRenderPreview();
    if (isMobileViewport()) {
      setSectionCollapsed("export", false);
      requestAnimationFrame(() => scrollToSection("upload"));
    }
  });

  elements.previewBtn.addEventListener("click", renderPreview);

  elements.downloadBtn.addEventListener("click", async () => {
    if (runtime.files.length === 0) return;
    setPrimaryButtonsEnabled(false);
    setProgress(elements, 0, t("progress.start"));
    updateExportReport(elements, "");

    try {
      const method = state.export.method || "zip";
      if (method === "zip") {
        const zip = new window.JSZip();
        await runBuildOutputs(async ({ blob, fileName }) => {
          zip.file(fileName, blob);
        });
        setProgress(elements, 100, t("progress.zipping"));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `watermark-kpr-${Date.now()}.zip`);
        updateExportReport(elements, t("report.zip", { count: runtime.files.length }));
      } else if (method === "folder") {
        if ("showDirectoryPicker" in window) {
          await saveImagesToFolder(runBuildOutputs);
          updateExportReport(elements, t("report.folder", { count: runtime.files.length }));
        } else {
          await downloadImagesIndividually(runBuildOutputs, downloadBlob, runtime.files.length);
          updateExportReport(elements, t("report.individual", { count: runtime.files.length }));
        }
      } else {
        await downloadImagesIndividually(runBuildOutputs, downloadBlob, runtime.files.length);
        updateExportReport(elements, t("report.individual", { count: runtime.files.length }));
      }
      setProgress(elements, 100, t("progress.done"));
    } catch (error) {
      if (error && error.name === "AbortError") {
        setProgress(elements, 0, t("progress.canceled"));
      } else {
        console.error(error);
        setProgress(elements, 0, t("progress.failed"));
      }
    } finally {
      setPrimaryButtonsEnabled(true);
    }
  });

  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener("click", () => adjustZoom(-0.2));
  }
  if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener("click", () => adjustZoom(0.2));
  }
  if (elements.zoomResetBtn) {
    elements.zoomResetBtn.addEventListener("click", resetZoom);
  }

  if (elements.prevImageBtn) {
    elements.prevImageBtn.addEventListener("click", goPrevImage);
  }
  if (elements.nextImageBtn) {
    elements.nextImageBtn.addEventListener("click", goNextImage);
  }
  if (elements.prevImageBtnOverlay) {
    elements.prevImageBtnOverlay.addEventListener("click", goPrevImage);
  }
  if (elements.nextImageBtnOverlay) {
    elements.nextImageBtnOverlay.addEventListener("click", goNextImage);
  }

  document.addEventListener("keydown", (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "ArrowLeft") goPrevImage();
    if (event.key === "ArrowRight") goNextImage();
  });

  const previewWrap = document.getElementById("previewWrap");
  if (previewWrap) {
    previewWrap.addEventListener("touchstart", (event) => {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const canDragWatermark = state.mode === "single" && !!state.type && state.processMode !== "remove-gemini";
      if (event.target === elements.previewCanvas && canDragWatermark) {
        swipeEligible = false;
        return;
      }
      swipeEligible = true;
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeStartTime = Date.now();
    }, { passive: true });

    previewWrap.addEventListener("touchend", (event) => {
      if (!swipeEligible || runtime.isDragging) return;
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;
      const dt = Date.now() - swipeStartTime;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 600) {
        if (dx < 0) goNextImage();
        if (dx > 0) goPrevImage();
      }
    }, { passive: true });
  }

  setupDragEvents({
    state,
    runtime,
    elements,
    clamp,
    renderPreview,
    renderQueued: () => renderQueued,
    setRenderQueued: (v) => { renderQueued = v; },
    dismissDragHint,
    saveTemplate,
    isMobileViewport,
  });
}

updateRangeDisplays();
applyStateToInputs();
syncLayerButtons();
syncProcessModeButtons();
syncCommonAdvancedStates();
syncExportAdvancedState();
setupEvents();
setupSectionToggles();
applyMobileCollapse();
syncMobileSections();
updateDragHintVisibility();

const storedLang = localStorage.getItem(LANG_KEY);
if (storedLang) {
  i18n.setLanguage(storedLang, document);
}
if (elements.langSelect) {
  elements.langSelect.value = i18n.getLanguage();
  elements.langSelect.addEventListener("change", (event) => {
    setLanguage(event.target.value);
  });
}
if (elements.moreLangSelect) {
  elements.moreLangSelect.value = i18n.getLanguage();
}

setI18n(t);
applyI18n();
updateExportSummary();
syncResizeValueVisibility();
syncJpgQualityVisibility();
syncHint();
syncLivePreviewToggle(elements, uiState.livePreviewEnabled, t);

window.addEventListener("resize", () => {
  syncViewport(uiState);
  syncUiStateToCore();
  applyMobileCollapse();
  syncMobileSections();
  updateDragHintVisibility();
  syncHint();
});

setupZoom();
loadTemplate(() => {
  applyStateToInputs();
  syncProcessModeButtons();
  updateExportSummary();
  updateControlAvailability();
  syncAdvancedVisibility();
  updatePreviewNav();
}, renderPreview);

renderTemplateSelect();
renderRecentTemplates();
updateTemplateActionsUI(elements.deleteTemplateBtn, elements.templateSelect.value);
updateControlAvailability();
updatePreviewNav();
setEmptyStateVisible(true);

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
resetProgress(elements, updateLivePreviewImage);
updateFileSummary(elements, runtime.files, t);
syncUiStateToCore();

export { renderPreview, updateHint };
