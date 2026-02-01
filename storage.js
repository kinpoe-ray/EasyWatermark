import { STORAGE_KEY, state, runtime } from "./core.js";
import { loadLogoFromDataUrl } from "./core.js";

export function loadTemplate(applyStateToInputs, renderPreview) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    applyStateToInputs();
    if (saved.logoDataUrl) {
      loadLogoFromDataUrl(saved.logoDataUrl, renderPreview);
    }
  } catch (error) {
    console.warn("Failed to load template", error);
  }
}

export function saveTemplate() {
  const payload = { ...state };
  if (runtime.logoImage && state.logoDataUrl) {
    payload.logoDataUrl = state.logoDataUrl;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
