/**
 * Search-as-you-type over a place provider (Nominatim), independent of React
 * so it can be tested with fake timers (VEN-406):
 *
 * - debounced: typing "Teatro" sends one request, not six;
 * - every new query aborts the request still in flight (AbortSignal), so only
 *   the last one reaches the server and a slow early answer can't overwrite a
 *   later one;
 * - `retry()` repeats the last query right away, keeping the typed text;
 * - empty results and provider failures are states of their own, never errors
 *   thrown at the caller.
 *
 * States: idle | loading | results | empty | error.
 */

export const SEARCH_DEBOUNCE_MS = 450
export const MIN_SEARCH_LENGTH = 3

/**
 * @param {{
 *   search: (query: string, options: { signal: AbortSignal }) => Promise<unknown[]>,
 *   onChange: (state: { status: string, query: string, results: unknown[] }) => void,
 *   delayMs?: number,
 *   minLength?: number,
 * }} options
 */
export function createPlaceSearch({ search, onChange, delayMs = SEARCH_DEBOUNCE_MS, minLength = MIN_SEARCH_LENGTH }) {
  let timer = null
  let controller = null
  let lastQuery = ''

  const emit = (status, results = []) => onChange({ status, query: lastQuery, results })

  function cancelPending() {
    clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
  }

  async function run(query) {
    cancelPending()
    const current = new AbortController()
    controller = current
    emit('loading')
    try {
      const results = await search(query, { signal: current.signal })
      if (controller !== current) return // superseded meanwhile
      controller = null
      emit(results.length ? 'results' : 'empty', results)
    } catch (error) {
      if (controller !== current || error?.name === 'AbortError') return
      controller = null
      emit('error')
    }
  }

  return {
    /** Text typed by the person; schedules a debounced search. */
    setQuery(text) {
      cancelPending()
      lastQuery = String(text ?? '').trim()
      if (lastQuery.length < minLength) {
        emit('idle')
        return
      }
      emit('loading')
      timer = setTimeout(() => {
        timer = null
        run(lastQuery)
      }, delayMs)
    },
    /** Repeats the last query immediately (after an error). */
    retry() {
      if (lastQuery.length < minLength) return
      run(lastQuery)
    },
    /** Drops pending work, e.g. after picking a suggestion or on unmount. */
    cancel() {
      cancelPending()
    },
  }
}
