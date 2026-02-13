import { STORAGE_KEY, state, runtime } from "./core.js";
import { loadLogoFromDataUrl } from "./core.js";

const TEMPLATE_KEY = "easy-watermark-templates";
const RECENT_KEY = "easy-watermark-recent-templates";

export const BUILTIN_TEMPLATES = [
  {
    id: "builtin-light",
    name: "浅色防泄漏",
    data: {
      type: "text",
      text: "仅用于提交材料",
      fontFamily: "PingFang SC",
      fontSize: 48,
      color: "#ffffff",
      opacity: 0.28,
      rotation: -20,
      mode: "tile",
      tileStyle: "grid-4",
      tileGap: 220,
    },
  },
  {
    id: "builtin-strong",
    name: "强对角平铺",
    data: {
      type: "text",
      text: "DO NOT COPY",
      fontFamily: "Arial",
      fontSize: 64,
      color: "#ffb74a",
      opacity: 0.4,
      rotation: -30,
      mode: "tile",
      tileStyle: "grid-9",
      tileGap: 160,
    },
  },
  {
    id: "builtin-corner",
    name: "角落 Logo",
    data: {
      type: "logo",
      text: "",
      opacity: 0.5,
      rotation: 0,
      scale: 0.8,
      mode: "single",
      position: { x: 0.85, y: 0.85 },
    },
  },
  {
    id: "builtin-center",
    name: "中央水印",
    data: {
      type: "text",
      text: "CONFIDENTIAL",
      fontFamily: "Arial",
      fontSize: 56,
      color: "#5cc8ff",
      opacity: 0.45,
      rotation: 0,
      mode: "single",
      position: { x: 0.5, y: 0.5 },
    },
  },
  {
    id: "builtin-date",
    name: "日期标记",
    data: {
      type: "text",
      text: "© 2024 版权所有",
      fontFamily: "PingFang SC",
      fontSize: 24,
      color: "#9aa3b2",
      opacity: 0.6,
      rotation: 0,
      mode: "single",
      position: { x: 0.5, y: 0.92 },
    },
  },
  {
    id: "builtin-dense",
    name: "密集防泄漏",
    data: {
      type: "text",
      text: "内部资料",
      fontFamily: "PingFang SC",
      fontSize: 36,
      color: "#ffffff",
      opacity: 0.22,
      rotation: -15,
      mode: "tile",
      tileStyle: "grid-9",
      tileGap: 100,
    },
  },
  {
    id: "builtin-review",
    name: "审核专用",
    data: {
      type: "text",
      text: "REVIEW ONLY",
      fontFamily: "Arial",
      fontSize: 72,
      color: "#ff6b6b",
      opacity: 0.35,
      rotation: -25,
      mode: "tile",
      tileStyle: "grid-4",
      tileGap: 200,
    },
  },
  {
    id: "builtin-social",
    name: "社交媒体",
    data: {
      type: "text",
      text: "@username",
      fontFamily: "Arial",
      fontSize: 32,
      color: "#ffffff",
      opacity: 0.7,
      rotation: 0,
      mode: "single",
      position: { x: 0.5, y: 0.9 },
    },
  },
];

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

export function getSavedTemplates() {
  const raw = localStorage.getItem(TEMPLATE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    console.warn("Failed to parse templates", error);
  }
  return [];
}

export function saveTemplates(templates) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

export function addTemplate(template) {
  const templates = getSavedTemplates();
  templates.unshift(template);
  saveTemplates(templates);
  return templates;
}

export function removeTemplate(id) {
  const templates = getSavedTemplates().filter((tpl) => tpl.id !== id);
  saveTemplates(templates);
  return templates;
}

export function getRecentTemplateIds() {
  const raw = localStorage.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    console.warn("Failed to parse recent templates", error);
  }
  return [];
}

export function touchRecentTemplate(id) {
  const current = getRecentTemplateIds().filter((item) => item !== id);
  current.unshift(id);
  const next = current.slice(0, 3);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
