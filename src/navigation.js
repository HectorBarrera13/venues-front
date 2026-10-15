// Keep in-memory sessions working even when browser storage is unavailable.
export function replaceRoute(path) {
  if (window.location.pathname === path) return false
  window.history.replaceState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  return true
}
