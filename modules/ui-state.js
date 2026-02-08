const MOBILE_QUERY = "(max-width: 640px)";

export function detectViewport() {
  return window.matchMedia(MOBILE_QUERY).matches ? "mobile" : "desktop";
}

export function createUIState(initial = {}) {
  return {
    viewport: detectViewport(),
    sections: {
      upload: true,
      templates: false,
      watermark: true,
      export: true,
      ...(initial.sections || {}),
    },
    modal: "none",
    advanced: {
      commonOpen: false,
      exportOpen: false,
      ...(initial.advanced || {}),
    },
    livePreviewEnabled: initial.livePreviewEnabled !== undefined ? !!initial.livePreviewEnabled : true,
  };
}

export function syncViewport(uiState) {
  uiState.viewport = detectViewport();
  return uiState.viewport;
}

export function setModal(uiState, modalName) {
  uiState.modal = modalName;
}

export function setSectionOpen(uiState, key, open) {
  if (!Object.prototype.hasOwnProperty.call(uiState.sections, key)) return;
  uiState.sections[key] = !!open;
}

export function setAdvancedOpen(uiState, key, open) {
  if (!Object.prototype.hasOwnProperty.call(uiState.advanced, key)) return;
  uiState.advanced[key] = !!open;
}
