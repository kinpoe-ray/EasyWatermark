const fileInput = document.getElementById("fileInput");
const logoInput = document.getElementById("logoInput");
const fileSummary = document.getElementById("fileSummary");
const previewBtn = document.getElementById("previewBtn");
const downloadBtn = document.getElementById("downloadBtn");
const previewCanvas = document.getElementById("previewCanvas");
const progress = document.getElementById("progress");
const hint = document.getElementById("hint");

const addTextBtn = document.getElementById("addTextBtn");
const addLogoBtn = document.getElementById("addLogoBtn");
const removeBtn = document.getElementById("removeBtn");
const processModeInput = document.getElementById("processMode");
const removeThenAddInput = document.getElementById("removeThenAdd");

const opacityInput = document.getElementById("opacity");
const opacityValue = document.getElementById("opacityValue");
const rotationInput = document.getElementById("rotation");
const rotationValue = document.getElementById("rotationValue");
const qualityInput = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const fontSizeInput = document.getElementById("fontSize");
const fontSizeValue = document.getElementById("fontSizeValue");
const scaleInput = document.getElementById("scale");
const scaleValue = document.getElementById("scaleValue");
const tileGapInput = document.getElementById("tileGap");
const tileGapValue = document.getElementById("tileGapValue");
const tileStyleEl = document.getElementById("tileStyle");

const STORAGE_KEY = "easy-watermark-template";
const GEMINI_LOGO_VALUE = 255;

let files = [];
let activeImageIndex = 0;
let logoImage = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

const state = {
  processMode: "add",
  removeThenAdd: false,
  type: "text",
  text: "@watermark",
  fontFamily: "Arial",
  fontSize: 48,
  color: "#ffffff",
  opacity: 0.35,
  rotation: -20,
  scale: 1,
  mode: "single",
  tileStyle: "single",
  tileGap: 180,
  position: { x: 0.5, y: 0.5 },
};

let geminiAlpha48 = null;
let geminiAlpha96 = null;
let geminiAlphaPromise = null;

function updateRangeDisplays() {
  opacityValue.textContent = opacityInput.value;
  rotationValue.textContent = `${rotationInput.value}°`;
  qualityValue.textContent = qualityInput.value;
  fontSizeValue.textContent = fontSizeInput.value;
  scaleValue.textContent = Number(scaleInput.value).toFixed(2);
  tileGapValue.textContent = tileGapInput.value;
}

function loadTemplate() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    applyStateToInputs();
    if (saved.logoDataUrl) {
      loadLogoFromDataUrl(saved.logoDataUrl);
    }
  } catch (error) {
    console.warn("Failed to load template", error);
  }
}

function saveTemplate() {
  const payload = { ...state };
  if (logoImage && state.logoDataUrl) {
    payload.logoDataUrl = state.logoDataUrl;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function applyStateToInputs() {
  document.getElementById("wmText").value = state.text;
  processModeInput.value = state.processMode;
  removeThenAddInput.checked = state.removeThenAdd;
  document.getElementById("fontFamily").value = state.fontFamily;
  fontSizeInput.value = state.fontSize;
  document.getElementById("wmColor").value = state.color;
  opacityInput.value = state.opacity;
  rotationInput.value = state.rotation;
  scaleInput.value = state.scale;
  document.getElementById("mode").value = state.mode;
  tileGapInput.value = state.tileGap;
  setActiveTileStyle(state.tileStyle);
  updateRangeDisplays();
}

updateRangeDisplays();
loadTemplate();
applyStateToInputs();

[opacityInput, rotationInput, qualityInput, fontSizeInput, scaleInput, tileGapInput].forEach((input) => {
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

removeThenAddInput.addEventListener("change", () => {
  if (removeThenAddInput.checked) {
    processModeInput.value = "remove-gemini";
  } else {
    processModeInput.value = "add";
  }
  syncStateFromInputs();
  renderPreview();
});

tileStyleEl.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-style]");
  if (!btn) return;
  state.tileStyle = btn.dataset.style;
  setActiveTileStyle(state.tileStyle);
  renderPreview();
});

addTextBtn.addEventListener("click", () => {
  state.type = "text";
  renderPreview();
});

addLogoBtn.addEventListener("click", () => {
  state.type = "logo";
  renderPreview();
});

removeBtn.addEventListener("click", () => {
  state.type = null;
  renderPreview();
});

logoInput.addEventListener("change", async () => {
  const file = logoInput.files && logoInput.files[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  state.logoDataUrl = dataUrl;
  loadLogoFromDataUrl(dataUrl);
});

fileInput.addEventListener("change", () => {
  files = Array.from(fileInput.files || []);
  activeImageIndex = 0;
  if (files.length === 0) {
    fileSummary.textContent = "未选择图片";
    downloadBtn.disabled = true;
    previewBtn.disabled = true;
    return;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const sizeMb = (totalSize / (1024 * 1024)).toFixed(2);
  fileSummary.textContent = `${files.length} 张图片 (${sizeMb} MB)`;
  downloadBtn.disabled = false;
  previewBtn.disabled = false;
  renderPreview();
});

previewBtn.addEventListener("click", renderPreview);

downloadBtn.addEventListener("click", async () => {
  if (files.length === 0) return;
  downloadBtn.disabled = true;
  previewBtn.disabled = true;
  progress.textContent = "渲染中...";

  try {
    const zip = new window.JSZip();
    let index = 0;
    for (const file of files) {
      index += 1;
      progress.textContent = `处理中 ${index}/${files.length}`;
      const canvas = await renderImageWithWatermark(file, getSettings());
      const { type, quality, ext } = resolveOutputFormat(file);
      const blob = await canvasToBlob(canvas, type, quality);
      const fileName = `${stripExt(file.name)}_wm.${ext}`;
      zip.file(fileName, blob);
    }

    progress.textContent = "正在打包...";
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `easy-watermark-${Date.now()}.zip`);
    progress.textContent = "完成";
  } catch (error) {
    console.error(error);
    progress.textContent = "失败，请查看控制台";
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
});

previewCanvas.addEventListener("pointerdown", (event) => {
  if (!files.length || state.mode === "tile" || !state.type) return;
  if (state.processMode === "remove-gemini" && !state.removeThenAdd) return;
  const hit = hitTest(event);
  if (!hit) return;
  isDragging = true;
  dragOffset = hit.offset;
  previewCanvas.setPointerCapture(event.pointerId);
});

previewCanvas.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const pos = getCanvasPoint(event);
  const width = previewCanvas.width;
  const height = previewCanvas.height;
  state.position = {
    x: clamp((pos.x - dragOffset.x) / width, 0, 1),
    y: clamp((pos.y - dragOffset.y) / height, 0, 1),
  };
  renderPreview();
});

previewCanvas.addEventListener("pointerup", (event) => {
  if (!isDragging) return;
  isDragging = false;
  previewCanvas.releasePointerCapture(event.pointerId);
  saveTemplate();
});

async function renderPreview() {
  if (files.length === 0) return;
  syncStateFromInputs();
  const canvas = await renderImageWithWatermark(files[activeImageIndex], getSettings(), true);
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  saveTemplate();
}

function syncStateFromInputs() {
  state.processMode = processModeInput.value;
  state.removeThenAdd = removeThenAddInput.checked;
  state.text = document.getElementById("wmText").value.trim() || "Watermark";
  state.fontFamily = document.getElementById("fontFamily").value;
  state.fontSize = Number(fontSizeInput.value) || 48;
  state.color = document.getElementById("wmColor").value;
  state.opacity = Number(opacityInput.value);
  state.rotation = Number(rotationInput.value);
  state.scale = Number(scaleInput.value);
  state.mode = document.getElementById("mode").value;
  state.tileGap = Number(tileGapInput.value);
}

function getSettings() {
  return {
    ...state,
    logoImage,
  };
}

async function renderImageWithWatermark(file, settings, showGuide = false) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (settings.processMode === "remove-gemini") {
    await removeGeminiWatermark(canvas);
    if (!settings.removeThenAdd) {
      hint.textContent = "Gemini 可见水印移除（不影响 SynthID）";
      return canvas;
    }
  }
  if (settings.processMode === "add" || settings.removeThenAdd) {
    drawWatermark(ctx, canvas.width, canvas.height, settings, showGuide);
  }
  return canvas;
}

function drawWatermark(ctx, width, height, settings, showGuide) {
  const { type, text, fontSize, fontFamily, color, opacity, rotation, scale, mode, tileGap, tileStyle } = settings;
  if (!type) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (type === "text") {
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    if (mode === "tile") {
      const patternCanvas = document.createElement("canvas");
      const stepX = textWidth + tileGap;
      const stepY = textHeight + tileGap;
      patternCanvas.width = Math.max(1, Math.ceil(stepX));
      patternCanvas.height = Math.max(1, Math.ceil(stepY));
      const pctx = patternCanvas.getContext("2d");
      pctx.font = ctx.font;
      pctx.fillStyle = color;
      pctx.globalAlpha = opacity;
      pctx.textAlign = "center";
      pctx.textBaseline = "middle";
      drawTilePattern(pctx, text, patternCanvas.width, patternCanvas.height, tileStyle);

      const pattern = ctx.createPattern(patternCanvas, "repeat");
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
      ctx.fillStyle = pattern;
      ctx.fillRect(-width, -height, width * 3, height * 3);
      ctx.restore();
      hint.textContent = "平铺模式无法拖动";
    } else {
      const center = getCenterPoint(width, height);
      ctx.translate(center.x, center.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      if (showGuide) drawGuide(ctx, textWidth, textHeight);
      hint.textContent = "拖动水印调整位置";
    }
  }

  if (type === "logo" && settings.logoImage) {
    const img = settings.logoImage;
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    if (mode === "tile") {
      const patternCanvas = document.createElement("canvas");
      const stepX = scaledWidth + tileGap;
      const stepY = scaledHeight + tileGap;
      patternCanvas.width = Math.max(1, Math.ceil(stepX));
      patternCanvas.height = Math.max(1, Math.ceil(stepY));
      const pctx = patternCanvas.getContext("2d");
      pctx.globalAlpha = opacity;
      drawTileImagePattern(pctx, img, scaledWidth, scaledHeight, patternCanvas.width, patternCanvas.height, tileStyle);

      const pattern = ctx.createPattern(patternCanvas, "repeat");
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
      ctx.fillStyle = pattern;
      ctx.fillRect(-width, -height, width * 3, height * 3);
      ctx.restore();
      hint.textContent = "平铺模式无法拖动";
    } else {
      const center = getCenterPoint(width, height);
      ctx.translate(center.x, center.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      if (showGuide) drawGuide(ctx, scaledWidth, scaledHeight);
      hint.textContent = "拖动水印调整位置";
    }
  }

  ctx.restore();
}

function drawGuide(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "rgba(92, 200, 255, 0.8)";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawTilePattern(ctx, text, width, height, style) {
  const positions = getTilePositions(width, height, style);
  positions.forEach((pos) => {
    ctx.fillText(text, pos.x, pos.y);
  });
}

function drawTileImagePattern(ctx, img, scaledWidth, scaledHeight, width, height, style) {
  const positions = getTilePositions(width, height, style);
  positions.forEach((pos) => {
    ctx.drawImage(img, pos.x - scaledWidth / 2, pos.y - scaledHeight / 2, scaledWidth, scaledHeight);
  });
}

function getTilePositions(width, height, style) {
  if (style === "grid-9") {
    return gridPositions(width, height, 3);
  }
  if (style === "grid-4") {
    return gridPositions(width, height, 2);
  }
  return [{ x: width / 2, y: height / 2 }];
}

function gridPositions(width, height, count) {
  const positions = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      positions.push({
        x: ((col + 0.5) / count) * width,
        y: ((row + 0.5) / count) * height,
      });
    }
  }
  return positions;
}

function getCenterPoint(width, height) {
  return {
    x: state.position.x * width,
    y: state.position.y * height,
  };
}

function resolveOutputFormat(file) {
  const format = document.getElementById("format").value;
  if (format === "png") return { type: "image/png", quality: 1, ext: "png" };
  if (format === "jpg") return { type: "image/jpeg", quality: Number(qualityInput.value), ext: "jpg" };

  if (file.type === "image/jpeg") {
    return { type: "image/jpeg", quality: Number(qualityInput.value), ext: "jpg" };
  }
  return { type: "image/png", quality: 1, ext: "png" };
}

function stripExt(filename) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return filename;
  return filename.slice(0, dotIndex);
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

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    image.src = url;
  });
}

function getCanvasPoint(event) {
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function hitTest(event) {
  const { type } = state;
  if (!type) return null;

  const pos = getCanvasPoint(event);
  const center = getCenterPoint(previewCanvas.width, previewCanvas.height);
  let width = 0;
  let height = 0;

  if (type === "text") {
    const ctx = previewCanvas.getContext("2d");
    ctx.font = `${state.fontSize}px ${state.fontFamily}`;
    width = ctx.measureText(state.text).width;
    height = state.fontSize;
  } else if (type === "logo" && logoImage) {
    width = logoImage.width * state.scale;
    height = logoImage.height * state.scale;
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setActiveTileStyle(style) {
  if (!tileStyleEl) return;
  tileStyleEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.style === style);
  });
}

async function removeGeminiWatermark(canvas) {
  await ensureGeminiAlphaMaps();
  if (!geminiAlpha48 || !geminiAlpha96) return;

  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { size, margin } = getGeminiConfig(width, height);
  const alpha = size === 96 ? geminiAlpha96 : geminiAlpha48;

  const startX = Math.max(0, width - margin - size);
  const startY = Math.max(0, height - margin - size);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const alphaThreshold = 0.002;
  const maxAlpha = 0.99;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const ax = startX + col;
      const ay = startY + row;
      if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;

      let a = alpha[row * size + col];
      if (a < alphaThreshold) continue;
      if (a > maxAlpha) a = maxAlpha;

      const idx = (ay * width + ax) * 4;
      for (let c = 0; c < 3; c += 1) {
        const watermarked = data[idx + c];
        const original = (watermarked - a * GEMINI_LOGO_VALUE) / (1 - a);
        data[idx + c] = clamp(Math.round(original), 0, 255);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function getGeminiConfig(width, height) {
  if (width > 1024 && height > 1024) {
    return { size: 96, margin: 64 };
  }
  return { size: 48, margin: 32 };
}

async function ensureGeminiAlphaMaps() {
  if (geminiAlpha48 && geminiAlpha96) return;
  if (!geminiAlphaPromise) {
    geminiAlphaPromise = Promise.all([
      buildAlphaMap(window.GEMINI_BG_48),
      buildAlphaMap(window.GEMINI_BG_96),
    ]).then(([map48, map96]) => {
      geminiAlpha48 = map48;
      geminiAlpha96 = map96;
    });
  }
  await geminiAlphaPromise;
}

async function buildAlphaMap(dataUrl) {
  const img = await loadImageFromUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  const alpha = new Float32Array(img.width * img.height);

  for (let i = 0; i < alpha.length; i += 1) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const max = Math.max(r, g, b);
    alpha[i] = max / 255;
  }

  return alpha;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load asset image"));
    img.src = url;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadLogoFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    logoImage = img;
    if (!state.type) state.type = "logo";
    renderPreview();
  };
  img.src = dataUrl;
}

previewBtn.disabled = true;
downloadBtn.disabled = true;
