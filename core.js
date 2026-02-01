export const STORAGE_KEY = "easy-watermark-template";
export const GEMINI_LOGO_VALUE = 255;

export const state = {
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
  export: {
    format: "auto",
    quality: 0.92,
    resizeMode: "none",
    resizeValue: 1024,
    renameMode: "keep",
    renamePrefix: "wm_",
    renameSuffix: "_watermarked",
    sequenceStart: 1,
    randomizePosition: false,
  },
};

export const runtime = {
  files: [],
  activeImageIndex: 0,
  logoImage: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  zoom: { scale: 1, startDist: 0, startScale: 1 },
  geminiAlpha48: null,
  geminiAlpha96: null,
  geminiAlphaPromise: null,
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function loadImage(file) {
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

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadLogoFromDataUrl(dataUrl, onLoad) {
  const img = new Image();
  img.onload = () => {
    runtime.logoImage = img;
    if (!state.type) state.type = "logo";
    if (onLoad) onLoad();
  };
  img.src = dataUrl;
}

export async function renderImageWithWatermark(file, settings, showGuide = false) {
  const image = await loadImage(file);
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = image.width;
  baseCanvas.height = image.height;
  const baseCtx = baseCanvas.getContext("2d");
  baseCtx.drawImage(image, 0, 0, baseCanvas.width, baseCanvas.height);

  if (settings.processMode === "remove-gemini") {
    await removeGeminiWatermark(baseCanvas);
    if (!settings.removeThenAdd) {
      if (settings.export.resizeMode !== "none") {
        return resizeCanvas(baseCanvas, settings.export.resizeMode, settings.export.resizeValue);
      }
      return baseCanvas;
    }
  }

  let workingCanvas = baseCanvas;
  if (settings.export.resizeMode !== "none") {
    workingCanvas = resizeCanvas(baseCanvas, settings.export.resizeMode, settings.export.resizeValue);
  }

  if (settings.processMode === "add" || settings.removeThenAdd) {
    const ctx = workingCanvas.getContext("2d");
    drawWatermark(ctx, workingCanvas.width, workingCanvas.height, settings, showGuide);
  }

  return workingCanvas;
}

export function drawWatermark(ctx, width, height, settings, showGuide) {
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
    } else {
      const center = getCenterPoint(width, height);
      ctx.translate(center.x, center.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      if (showGuide) drawGuide(ctx, textWidth, textHeight);
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
    } else {
      const center = getCenterPoint(width, height);
      ctx.translate(center.x, center.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      if (showGuide) drawGuide(ctx, scaledWidth, scaledHeight);
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
  if (style === "grid-9") return gridPositions(width, height, 3);
  if (style === "grid-4") return gridPositions(width, height, 2);
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

export function resolveOutputFormat(file) {
  const format = state.export.format;
  if (format === "png") return { type: "image/png", quality: 1, ext: "png" };
  if (format === "jpg") return { type: "image/jpeg", quality: state.export.quality, ext: "jpg" };
  if (file.type === "image/jpeg") {
    return { type: "image/jpeg", quality: state.export.quality, ext: "jpg" };
  }
  return { type: "image/png", quality: 1, ext: "png" };
}

export function getOutputName(file, index, ext) {
  const base = stripExt(file.name);
  switch (state.export.renameMode) {
    case "prefix":
      return `${state.export.renamePrefix || "wm_"}${base}.${ext}`;
    case "suffix":
      return `${base}${state.export.renameSuffix || "_watermarked"}.${ext}`;
    case "sequence": {
      const start = state.export.sequenceStart || 1;
      const num = String(start + index).padStart(3, "0");
      return `image_${num}.${ext}`;
    }
    case "keep":
    default:
      return `${base}.${ext}`;
  }
}

function stripExt(filename) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return filename;
  return filename.slice(0, dotIndex);
}

export function resizeCanvas(source, mode, value) {
  const width = source.width;
  const height = source.height;
  let targetWidth = width;
  let targetHeight = height;

  if (mode === "width") {
    targetWidth = value;
    targetHeight = Math.round((height / width) * targetWidth);
  } else if (mode === "height") {
    targetHeight = value;
    targetWidth = Math.round((width / height) * targetHeight);
  } else if (mode === "max") {
    const maxSide = Math.max(width, height);
    const scale = value / maxSide;
    targetWidth = Math.round(width * scale);
    targetHeight = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function getRandomPosition(seedText) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rand1 = ((hash >>> 0) % 1000) / 1000;
  const rand2 = (((hash >>> 8) >>> 0) % 1000) / 1000;
  return {
    x: 0.15 + rand1 * 0.7,
    y: 0.15 + rand2 * 0.7,
  };
}

async function removeGeminiWatermark(canvas) {
  await ensureGeminiAlphaMaps();
  if (!runtime.geminiAlpha48 || !runtime.geminiAlpha96) return;

  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { size, margin } = getGeminiConfig(width, height);
  const alpha = size === 96 ? runtime.geminiAlpha96 : runtime.geminiAlpha48;

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
  if (runtime.geminiAlpha48 && runtime.geminiAlpha96) return;
  if (!runtime.geminiAlphaPromise) {
    runtime.geminiAlphaPromise = Promise.all([
      buildAlphaMap(window.GEMINI_BG_48),
      buildAlphaMap(window.GEMINI_BG_96),
    ]).then(([map48, map96]) => {
      runtime.geminiAlpha48 = map48;
      runtime.geminiAlpha96 = map96;
    });
  }
  await runtime.geminiAlphaPromise;
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
