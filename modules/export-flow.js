export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function buildOutputs(options) {
  const {
    state,
    runtime,
    renderImageWithWatermark,
    resolveOutputFormat,
    getOutputName,
    getRandomPosition,
    canvasToBlob: toBlob,
    onProgress,
    onThumb,
  } = options;

  const originalPosition = { ...state.position };
  let index = 0;
  for (const file of runtime.files) {
    index += 1;
    onProgress(index, runtime.files.length, file.name);
    if (state.export.randomizePosition && state.mode === "single") {
      state.position = getRandomPosition(file.name);
    }
    const canvas = await renderImageWithWatermark(file, { ...state, logoImage: runtime.logoImage });
    onThumb(canvas);
    const { type, quality, ext } = resolveOutputFormat(file);
    const blob = await toBlob(canvas, type, quality);
    const fileName = getOutputName(file, index - 1, ext);
    await options.onEach({ blob, fileName, index });
  }
  state.position = originalPosition;
}

export async function saveImagesToFolder(buildOutputsFn) {
  const dirHandle = await window.showDirectoryPicker();
  await buildOutputsFn(async ({ blob, fileName }) => {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  });
}

export async function downloadImagesIndividually(buildOutputsFn, download, total) {
  await buildOutputsFn(async ({ blob, fileName, index }) => {
    download(blob, fileName);
    if (index < total) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
}
