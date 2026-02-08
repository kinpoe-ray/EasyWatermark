export function getAllTemplates(builtinTemplates, savedTemplates) {
  return [...builtinTemplates, ...savedTemplates];
}

export function findTemplateById(id, builtinTemplates, savedTemplates) {
  return getAllTemplates(builtinTemplates, savedTemplates).find((tpl) => tpl.id === id);
}

export function renderTemplateSelect(options) {
  const {
    selectEl,
    builtinTemplates,
    savedTemplates,
    selectedId,
    t,
  } = options;

  if (!selectEl) return;

  selectEl.innerHTML = "";

  const builtinGroup = document.createElement("optgroup");
  builtinGroup.label = t("template.group.builtin");
  builtinTemplates.forEach((tpl) => {
    const option = document.createElement("option");
    option.value = tpl.id;
    option.textContent = tpl.name;
    builtinGroup.appendChild(option);
  });
  selectEl.appendChild(builtinGroup);

  const customGroup = document.createElement("optgroup");
  customGroup.label = t("template.group.custom");
  savedTemplates.forEach((tpl) => {
    const option = document.createElement("option");
    option.value = tpl.id;
    option.textContent = tpl.name;
    customGroup.appendChild(option);
  });
  selectEl.appendChild(customGroup);

  selectEl.value = selectedId || (builtinTemplates[0] && builtinTemplates[0].id) || "";
}

export function renderRecentTemplates(options) {
  const {
    container,
    recentIds,
    templates,
    onPick,
  } = options;
  if (!container) return;

  container.innerHTML = "";
  recentIds
    .map((id) => templates.find((tpl) => tpl.id === id))
    .filter(Boolean)
    .forEach((tpl) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = tpl.name;
      btn.addEventListener("click", () => onPick(tpl.id));
      container.appendChild(btn);
    });
}

export function createTemplateSnapshot(state, runtime) {
  const snapshot = {
    ...state,
    processMode: "add",
    removeThenAdd: false,
  };
  if (runtime.logoImage && state.logoDataUrl) {
    snapshot.logoDataUrl = state.logoDataUrl;
  }
  return snapshot;
}

export function updateTemplateActions(deleteBtn, id) {
  if (!deleteBtn) return;
  const isBuiltin = !!(id && id.startsWith("builtin"));
  deleteBtn.disabled = isBuiltin;
}

export function applyTemplateById(options) {
  const {
    id,
    builtinTemplates,
    savedTemplates,
    state,
    runtime,
    applyStateToInputs,
    syncProcessModeButtons,
    updateExportSummary,
    loadLogoFromDataUrl,
    scheduleRenderPreview,
    touchRecentTemplate,
    renderRecent,
    syncMobileSections,
  } = options;

  const tpl = findTemplateById(id, builtinTemplates, savedTemplates);
  if (!tpl) return;

  const data = tpl.data || {};
  Object.assign(state, data, { processMode: "add", removeThenAdd: false });
  applyStateToInputs();
  syncProcessModeButtons();
  updateExportSummary();

  if (data.logoDataUrl) {
    state.logoDataUrl = data.logoDataUrl;
    loadLogoFromDataUrl(data.logoDataUrl, scheduleRenderPreview);
  } else {
    state.logoDataUrl = null;
    runtime.logoImage = null;
    scheduleRenderPreview();
  }

  touchRecentTemplate(id);
  renderRecent();
  syncMobileSections();
}
