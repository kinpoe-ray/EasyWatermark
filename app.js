const fileInput = document.getElementById("fileInput");
const fileSummary = document.getElementById("fileSummary");
const previewBtn = document.getElementById("previewBtn");
const downloadBtn = document.getElementById("downloadBtn");
const previewCanvas = document.getElementById("previewCanvas");
const progress = document.getElementById("progress");

const opacityInput = document.getElementById("opacity");
const opacityValue = document.getElementById("opacityValue");
const rotationInput = document.getElementById("rotation");
const rotationValue = document.getElementById("rotationValue");
const qualityInput = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");

let files = [];

function updateRangeDisplays() {
  opacityValue.textContent = opacityInput.value;
  rotationValue.textContent = `${rotationInput.value}°`;
  qualityValue.textContent = qualityInput.value;
}

updateRangeDisplays();

opacityInput.addEventListener("input", updateRangeDisplays);
rotationInput.addEventListener("input", updateRangeDisplays);
qualityInput.addEventListener("input", updateRangeDisplays);

fileInput.addEventListener("change", () => {
  files = Array.from(fileInput.files || []);
  if (files.length === 0) {
    fileSummary.textContent = "No files selected.";
    downloadBtn.disabled = true;
    previewBtn.disabled = true;
    return;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const sizeMb = (totalSize / (1024 * 1024)).toFixed(2);
  fileSummary.textContent = `${files.length} files selected (${sizeMb} MB).`;
  downloadBtn.disabled = false;
  previewBtn.disabled = false;
  renderPreview();
});

previewBtn.addEventListener("click", renderPreview);

downloadBtn.addEventListener("click", async () => {
  if (files.length === 0) return;
  downloadBtn.disabled = true;
  previewBtn.disabled = true;
  progress.textContent = "Rendering...";

  try {
    const zip = new window.JSZip();
    let index = 0;
    for (const file of files) {
      index += 1;
      progress.textContent = `Processing ${index}/${files.length}`;
      const canvas = await renderImageWithWatermark(file, getSettings());
      const { type, quality, ext } = resolveOutputFormat(file);
      const blob = await canvasToBlob(canvas, type, quality);
      const fileName = `${stripExt(file.name)}_wm.${ext}`;
      zip.file(fileName, blob);
    }

    progress.textContent = "Packaging ZIP...";
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `easy-watermark-${Date.now()}.zip`);
    progress.textContent = "Done.";
  } catch (error) {
    console.error(error);
    progress.textContent = "Failed. Check console for details.";
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
});

async function renderPreview() {
  if (files.length === 0) return;
  const canvas = await renderImageWithWatermark(files[0], getSettings());
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
}

function getSettings() {
  return {
    text: document.getElementById("wmText").value.trim() || "Watermark",
    fontSize: Number(document.getElementById("fontSize").value) || 48,
    color: document.getElementById("wmColor").value,
    opacity: Number(opacityInput.value),
    rotation: (Number(rotationInput.value) * Math.PI) / 180,
    position: document.getElementById("position").value,
    margin: Number(document.getElementById("margin").value) || 0,
    tileGap: Number(document.getElementById("tileGap").value) || 120,
  };
}

async function renderImageWithWatermark(file, settings) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas.width, canvas.height, settings);
  return canvas;
}

function drawWatermark(ctx, width, height, settings) {
  const { text, fontSize, color, opacity, rotation, position, margin, tileGap } = settings;
  if (!text) return;

  ctx.save();
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  if (position === "tile") {
    const patternCanvas = document.createElement("canvas");
    const stepX = textWidth + tileGap;
    const stepY = textHeight + tileGap;
    patternCanvas.width = Math.max(1, Math.ceil(stepX));
    patternCanvas.height = Math.max(1, Math.ceil(stepY));
    const pctx = patternCanvas.getContext("2d");
    pctx.font = ctx.font;
    pctx.fillStyle = color;
    pctx.globalAlpha = opacity;
    pctx.textBaseline = "top";
    pctx.fillText(text, tileGap / 2, tileGap / 2);

    const pattern = ctx.createPattern(patternCanvas, "repeat");
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotation);
    ctx.translate(-width / 2, -height / 2);
    ctx.fillStyle = pattern;
    ctx.fillRect(-width, -height, width * 3, height * 3);
    ctx.restore();
  } else {
    const point = getAnchorPoint(position, width, height, textWidth, textHeight, margin);
    ctx.translate(point.x, point.y);
    ctx.rotate(rotation);
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}

function getAnchorPoint(position, width, height, textWidth, textHeight, margin) {
  switch (position) {
    case "top-left":
      return { x: margin, y: margin + textHeight };
    case "top-right":
      return { x: width - margin - textWidth, y: margin + textHeight };
    case "bottom-left":
      return { x: margin, y: height - margin };
    case "bottom-right":
      return { x: width - margin - textWidth, y: height - margin };
    case "center":
    default:
      return { x: (width - textWidth) / 2, y: (height + textHeight) / 2 };
  }
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

previewBtn.disabled = true;
downloadBtn.disabled = true;
