export function openModal(uiState, elements, name) {
  if (name === "settings" && elements.settingsModal) elements.settingsModal.classList.add("show");
  if (name === "more" && elements.moreModal) elements.moreModal.classList.add("show");
  if (name === "help" && elements.helpModal) elements.helpModal.classList.add("show");
}

export function closeModal(uiState, elements, name) {
  if (name === "settings" && elements.settingsModal) elements.settingsModal.classList.remove("show");
  if (name === "more" && elements.moreModal) elements.moreModal.classList.remove("show");
  if (name === "help" && elements.helpModal) elements.helpModal.classList.remove("show");
}

export function setupModalClickOutside(elements, closeFn) {
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) closeFn("settings");
  });

  if (elements.moreModal) {
    elements.moreModal.addEventListener("click", (event) => {
      if (event.target === elements.moreModal) closeFn("more");
    });
  }

  elements.helpModal.addEventListener("click", (event) => {
    if (event.target === elements.helpModal) closeFn("help");
  });
}
