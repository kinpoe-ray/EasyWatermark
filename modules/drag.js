export function hitTest(state, elements, runtime, event, isMobileViewport) {
  const { type } = state;
  if (!type) return null;

  const pos = getCanvasPoint(elements, event);
  const center = getCenterPoint(state, elements.previewCanvas.width, elements.previewCanvas.height);
  let width = 0;
  let height = 0;
  const padding = getHitPadding(event, isMobileViewport);

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

  const left = center.x - width / 2 - padding;
  const top = center.y - height / 2 - padding;
  const right = center.x + width / 2 + padding;
  const bottom = center.y + height / 2 + padding;

  if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
    return { offset: { x: pos.x - center.x, y: pos.y - center.y } };
  }
  return null;
}

export function setupDragEvents(options) {
  const {
    state,
    runtime,
    elements,
    clamp,
    renderPreview,
    renderQueued,
    setRenderQueued,
    dismissDragHint,
    saveTemplate,
    isMobileViewport,
  } = options;

  elements.previewCanvas.addEventListener("pointerdown", (event) => {
    if (!runtime.files.length || !state.type) return;
    if (state.processMode === "remove-gemini" && !state.removeThenAdd) return;

    if (state.mode === "single") {
      const hit = hitTest(state, elements, runtime, event, isMobileViewport);
      if (!hit) return;
      runtime.dragOffset = hit.offset;
    } else {
      const pos = getCanvasPoint(elements, event);
      runtime.dragOffset = {
        x: pos.x - state.position.x * elements.previewCanvas.width,
        y: pos.y - state.position.y * elements.previewCanvas.height,
      };
    }
    runtime.isDragging = true;
    dismissDragHint();
    elements.previewCanvas.setPointerCapture(event.pointerId);
    elements.previewCanvas.closest(".canvas-wrap")?.classList.add("is-dragging");
  });

  elements.previewCanvas.addEventListener("pointermove", (event) => {
    if (!runtime.isDragging) return;
    const pos = getCanvasPoint(elements, event);
    const width = elements.previewCanvas.width;
    const height = elements.previewCanvas.height;
    state.position = {
      x: clamp((pos.x - runtime.dragOffset.x) / width, 0, 1),
      y: clamp((pos.y - runtime.dragOffset.y) / height, 0, 1),
    };
    if (!renderQueued()) {
      setRenderQueued(true);
      requestAnimationFrame(() => {
        setRenderQueued(false);
        renderPreview();
      });
    }
  });

  elements.previewCanvas.addEventListener("pointerup", (event) => {
    if (!runtime.isDragging) return;
    runtime.isDragging = false;
    elements.previewCanvas.releasePointerCapture(event.pointerId);
    elements.previewCanvas.closest(".canvas-wrap")?.classList.remove("is-dragging");
    saveTemplate();
  });

  elements.previewCanvas.addEventListener("pointercancel", (event) => {
    if (!runtime.isDragging) return;
    runtime.isDragging = false;
    elements.previewCanvas.releasePointerCapture(event.pointerId);
    elements.previewCanvas.closest(".canvas-wrap")?.classList.remove("is-dragging");
  });
}

function getHitPadding(event, isMobileViewport) {
  const isTouch = event.pointerType === "touch" || isMobileViewport();
  return isTouch ? 24 : 8;
}

function getCenterPoint(state, width, height) {
  return {
    x: state.position.x * width,
    y: state.position.y * height,
  };
}

function getCanvasPoint(elements, event) {
  const rect = elements.previewCanvas.getBoundingClientRect();
  const scaleX = elements.previewCanvas.width / rect.width;
  const scaleY = elements.previewCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}
