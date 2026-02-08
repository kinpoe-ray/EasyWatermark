export function setupActionRouter(options) {
  const { root = document, handlers = {} } = options;
  root.addEventListener("click", (event) => {
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    const handler = handlers[action];
    if (!handler) return;
    event.preventDefault();
    handler(event, actionNode);
  });
}
