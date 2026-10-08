// Keep in-memory sessions working even when browser storage is unavailable.
export function replaceRoute(path) {
  window.history.replaceState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
